-- Add per-message notices without losing legacy quote notices.
alter table public.notification_outbox
add column message_id uuid references public.quote_messages(id) on delete cascade,
add column next_attempt_at timestamptz not null default now(),
add column claimed_at timestamptz;
alter table public.notification_outbox drop constraint notification_outbox_event_type_check;
alter table public.notification_outbox add constraint notification_outbox_event_type_check check(event_type in('new_quote','quote_accepted','quote_declined','quote_cancelled','new_message','new_proposal','proposal_accepted','proposal_declined','service_completion'));
alter table public.notification_outbox drop constraint notification_outbox_status_check;
alter table public.notification_outbox add constraint notification_outbox_status_check check(status in('pending','processing','sent','configuration_pending','failed','skipped'));
alter table public.notification_outbox drop constraint notification_outbox_quote_id_recipient_id_event_type_key;
create unique index notification_outbox_quote_event_unique on public.notification_outbox(quote_id,recipient_id,event_type) where message_id is null;
create unique index notification_outbox_message_event_unique on public.notification_outbox(message_id,recipient_id,event_type) where message_id is not null;
create index notification_outbox_retry_idx on public.notification_outbox(next_attempt_at,created_at) where status in('pending','configuration_pending','failed');
create or replace function private.enqueue_quote_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_recipient uuid; target_event text;
begin
if tg_op='INSERT' then target_recipient:=new.professional_id; target_event:='new_quote';
elsif old.status is distinct from new.status then
if new.status in('accepted','declined') then target_recipient:=new.client_id; target_event:=case new.status when 'accepted' then 'quote_accepted' else 'quote_declined' end;
elsif new.status='cancelled' then target_recipient:=new.professional_id; target_event:='quote_cancelled'; end if;
end if;
if target_recipient is not null and target_event is not null then
insert into public.notification_outbox(quote_id,recipient_id,event_type) values(new.id,target_recipient,target_event) on conflict do nothing;
end if; return new;
end $$;
revoke all on function private.enqueue_quote_notification() from public,anon,authenticated;
-- Privileged code is private, trigger-only, and validates its authenticated actor.
create function private.enqueue_conversation_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare q public.quote_requests%rowtype; actor uuid; related_message uuid; target_event text; target_recipient uuid;
begin
if tg_table_name='quote_messages' then
select * into q from public.quote_requests where id=new.quote_id;
actor:=new.sender_id; related_message:=new.id;
target_event:=case when new.proposed_amount is null then 'new_message' else 'new_proposal' end;
elsif tg_table_name='quote_offer_responses' then
select qr.* into q from public.quote_messages m join public.quote_requests qr on qr.id=m.quote_id where m.id=new.message_id;
actor:=new.responder_id; related_message:=new.message_id;
target_event:=case new.decision when 'accepted' then 'proposal_accepted' else 'proposal_declined' end;
elsif tg_table_name='quote_completions' then
select * into q from public.quote_requests where id=new.quote_id;
actor:=new.user_id; target_event:='service_completion';
else raise exception 'Unsupported notification source'; end if;
if auth.uid() is null or actor is distinct from auth.uid() or q.id is null or (actor<>q.client_id and actor<>q.professional_id) then
raise exception 'Only the authenticated participant may enqueue a notice'; end if;
target_recipient:=case actor when q.client_id then q.professional_id else q.client_id end;
insert into public.notification_outbox(quote_id,recipient_id,event_type,message_id) values(q.id,target_recipient,target_event,related_message) on conflict do nothing;
return new;
end $$;
revoke all on function private.enqueue_conversation_notification() from public,anon,authenticated;
create trigger enqueue_message_notice after insert on public.quote_messages for each row execute function private.enqueue_conversation_notification();
create trigger enqueue_offer_notice after insert on public.quote_offer_responses for each row execute function private.enqueue_conversation_notification();
create trigger enqueue_completion_notice after insert on public.quote_completions for each row execute function private.enqueue_conversation_notification();
revoke select(message_id,next_attempt_at,claimed_at) on public.notification_outbox from anon,authenticated;
