-- Additive workflow: original quotes, uploads and authentication remain unchanged.
create table public.quote_completions (
  quote_id uuid not null references public.quote_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (quote_id, user_id)
);
create index quote_completions_user_idx on public.quote_completions(user_id);
alter table public.quote_completions enable row level security;
revoke all on public.quote_completions from anon, authenticated;
grant select on public.quote_completions to authenticated;
grant insert(quote_id,user_id) on public.quote_completions to authenticated;
revoke all on public.quote_completions from anon;
create policy "Participants see completion confirmations" on public.quote_completions for select to authenticated
using (exists(select 1 from public.quote_requests q where q.id=quote_id and (q.client_id=(select auth.uid()) or q.professional_id=(select auth.uid()))));
create policy "Participants confirm their own completed event" on public.quote_completions for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.quote_requests q where q.id=quote_id and q.status='accepted' and q.event_date < (now() at time zone 'America/Sao_Paulo')::date and (q.client_id=user_id or q.professional_id=user_id)));
drop policy "Participants can create one review after acceptance" on public.reviews;
create policy "Participants review mutually completed services" on public.reviews for insert to authenticated
with check (reviewer_id=(select auth.uid()) and exists(select 1 from public.quote_requests q where q.id=quote_id and q.status='accepted'
and q.event_date < (now() at time zone 'America/Sao_Paulo')::date
and ((q.client_id=reviewer_id and q.professional_id=reviewed_id) or (q.professional_id=reviewer_id and q.client_id=reviewed_id))
and exists(select 1 from public.quote_completions c where c.quote_id=q.id and c.user_id=q.client_id)
and exists(select 1 from public.quote_completions c where c.quote_id=q.id and c.user_id=q.professional_id)));

create table public.quote_messages (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.quote_requests(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 proposed_amount numeric(12,2) check(proposed_amount > 0 and proposed_amount <= 9999999),
 created_at timestamptz not null default now()
);
create index quote_messages_quote_created_idx on public.quote_messages(quote_id,created_at desc);
create index quote_messages_sender_idx on public.quote_messages(sender_id);
alter table public.quote_messages enable row level security;
revoke all on public.quote_messages from anon, authenticated;
grant select on public.quote_messages to authenticated;
grant insert(quote_id,sender_id,body,proposed_amount) on public.quote_messages to authenticated;
revoke all on public.quote_messages from anon;
create policy "Participants read their conversation" on public.quote_messages for select to authenticated
using (exists(select 1 from public.quote_requests q where q.id=quote_id and (q.client_id=(select auth.uid()) or q.professional_id=(select auth.uid()))));
create policy "Participants send messages to active quotes" on public.quote_messages for insert to authenticated
with check(sender_id=(select auth.uid()) and exists(select 1 from public.quote_requests q where q.id=quote_id and q.status in('pending','accepted') and (q.client_id=sender_id or q.professional_id=sender_id)));

create table public.quote_offer_responses (
 message_id uuid primary key references public.quote_messages(id) on delete cascade,
 responder_id uuid not null references public.profiles(id) on delete cascade,
 decision text not null check(decision in('accepted','declined')),
 created_at timestamptz not null default now()
);
create index quote_offer_responses_user_idx on public.quote_offer_responses(responder_id);
alter table public.quote_offer_responses enable row level security;
revoke all on public.quote_offer_responses from anon, authenticated;
grant select on public.quote_offer_responses to authenticated;
grant insert(message_id,responder_id,decision) on public.quote_offer_responses to authenticated;
revoke all on public.quote_offer_responses from anon;
create policy "Participants see offer responses" on public.quote_offer_responses for select to authenticated
using(exists(select 1 from public.quote_messages m where m.id=message_id));
create policy "Only the recipient responds to an active offer" on public.quote_offer_responses for insert to authenticated
with check(responder_id=(select auth.uid()) and exists(select 1 from public.quote_messages m join public.quote_requests q on q.id=m.quote_id where m.id=message_id and m.proposed_amount is not null and m.sender_id<>responder_id and q.status in('pending','accepted') and (q.client_id=responder_id or q.professional_id=responder_id)));

create table public.professional_unavailability (
 id uuid primary key default gen_random_uuid(),
 professional_id uuid not null references public.professional_profiles(id) on delete cascade,
 starts_on date not null, ends_on date not null,
 check(ends_on>=starts_on and ends_on-starts_on<=366),
 created_at timestamptz not null default now()
);
create index professional_unavailability_dates_idx on public.professional_unavailability(professional_id,starts_on,ends_on);
alter table public.professional_unavailability enable row level security;
revoke all on public.professional_unavailability from anon, authenticated;
grant select,delete on public.professional_unavailability to authenticated;
grant insert(professional_id,starts_on,ends_on) on public.professional_unavailability to authenticated;
revoke all on public.professional_unavailability from anon;
create policy "Clients and owners see blocked dates" on public.professional_unavailability for select to authenticated
using(professional_id=(select auth.uid()) or exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.role='client'));
create policy "Owners block dates" on public.professional_unavailability for insert to authenticated with check(professional_id=(select auth.uid()));
create policy "Owners remove their blocked dates" on public.professional_unavailability for delete to authenticated using(professional_id=(select auth.uid()));

create table public.professional_favorites (
 client_id uuid not null references public.profiles(id) on delete cascade,
 professional_id uuid not null references public.professional_profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(client_id,professional_id)
);
create index professional_favorites_professional_idx on public.professional_favorites(professional_id);
alter table public.professional_favorites enable row level security;
revoke all on public.professional_favorites from anon, authenticated;
grant select,delete on public.professional_favorites to authenticated;
grant insert(client_id,professional_id) on public.professional_favorites to authenticated;
revoke all on public.professional_favorites from anon;
create policy "Clients see own favorites" on public.professional_favorites for select to authenticated using(client_id=(select auth.uid()));
create policy "Clients save professionals" on public.professional_favorites for insert to authenticated
with check(client_id=(select auth.uid()) and exists(select 1 from public.profiles me where me.id=client_id and me.role='client') and exists(select 1 from public.professional_profiles pp where pp.id=professional_id and pp.status='approved'));
create policy "Clients remove own favorites" on public.professional_favorites for delete to authenticated using(client_id=(select auth.uid()));

create table public.quote_reports (
 id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quote_requests(id) on delete cascade,
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check(char_length(btrim(reason)) between 10 and 1000),
 status text not null default 'open' check(status in('open','resolved')),
 created_at timestamptz not null default now()
);
create index quote_reports_quote_idx on public.quote_reports(quote_id);
create index quote_reports_reporter_idx on public.quote_reports(reporter_id);
create index quote_reports_status_idx on public.quote_reports(status,created_at desc);
alter table public.quote_reports enable row level security;
revoke all on public.quote_reports from anon, authenticated;
grant select on public.quote_reports to authenticated;
grant insert(quote_id,reporter_id,reason) on public.quote_reports to authenticated;
grant update(status) on public.quote_reports to authenticated;
revoke all on public.quote_reports from anon;
create policy "Reporters and designated admins read reports" on public.quote_reports for select to authenticated
using(reporter_id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'readystaff_admin')='true');
create policy "Participants report a quote" on public.quote_reports for insert to authenticated
with check(reporter_id=(select auth.uid()) and exists(select 1 from public.quote_requests q where q.id=quote_id and (q.client_id=reporter_id or q.professional_id=reporter_id)));
create policy "Designated admins resolve reports" on public.quote_reports for update to authenticated
using((select auth.jwt()->'app_metadata'->>'readystaff_admin')='true') with check((select auth.jwt()->'app_metadata'->>'readystaff_admin')='true');
-- Admin identity is never inferred from editable user metadata or a signup field.
create policy "Designated admins inspect accounts" on public.profiles for select to authenticated using((select auth.jwt()->'app_metadata'->>'readystaff_admin')='true');
create policy "Designated admins inspect reviews" on public.reviews for select to authenticated using((select auth.jwt()->'app_metadata'->>'readystaff_admin')='true');
create policy "Designated admins inspect notification delivery" on public.notification_outbox for select to authenticated using((select auth.jwt()->'app_metadata'->>'readystaff_admin')='true');
