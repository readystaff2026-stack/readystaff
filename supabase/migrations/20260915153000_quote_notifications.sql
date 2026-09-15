create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  whatsapp_opted_in_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

revoke all on table public.notification_preferences from anon;
grant select, insert, update on table public.notification_preferences to authenticated;

drop policy if exists "Users can read notification preferences" on public.notification_preferences;
create policy "Users can read notification preferences"
on public.notification_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create notification preferences" on public.notification_preferences;
create policy "Users can create notification preferences"
on public.notification_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update notification preferences" on public.notification_preferences;
create policy "Users can update notification preferences"
on public.notification_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_requests(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('new_quote', 'quote_accepted', 'quote_declined', 'quote_cancelled')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'configuration_pending', 'failed')),
  channel text check (channel in ('whatsapp', 'email')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (quote_id, recipient_id, event_type)
);

alter table public.notification_outbox enable row level security;
revoke all on table public.notification_outbox from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.enqueue_quote_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_recipient uuid;
  target_event text;
begin
  if tg_op = 'INSERT' then
    target_recipient := new.professional_id;
    target_event := 'new_quote';
  elsif old.status is distinct from new.status then
    if new.status in ('accepted', 'declined') then
      target_recipient := new.client_id;
      target_event := case new.status
        when 'accepted' then 'quote_accepted'
        else 'quote_declined'
      end;
    elsif new.status = 'cancelled' then
      target_recipient := new.professional_id;
      target_event := 'quote_cancelled';
    end if;
  end if;

  if target_recipient is not null and target_event is not null then
    insert into public.notification_outbox (quote_id, recipient_id, event_type)
    values (new.id, target_recipient, target_event)
    on conflict (quote_id, recipient_id, event_type) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_quote_notification() from public, anon, authenticated;

drop trigger if exists enqueue_quote_notification_trigger on public.quote_requests;
create trigger enqueue_quote_notification_trigger
after insert or update of status on public.quote_requests
for each row execute function private.enqueue_quote_notification();

