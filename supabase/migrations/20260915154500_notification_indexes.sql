create index if not exists notification_outbox_recipient_status_created_idx
on public.notification_outbox (recipient_id, status, created_at);

create index if not exists quote_requests_category_id_idx
on public.quote_requests (category_id);

drop policy if exists "Notification outbox is service only" on public.notification_outbox;
create policy "Notification outbox is service only"
on public.notification_outbox
for all
to authenticated
using (false)
with check (false);

