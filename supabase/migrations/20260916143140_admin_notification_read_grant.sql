grant select(id,event_type,status,attempt_count,last_error,created_at) on public.notification_outbox to authenticated;
-- Row-level security still limits these columns to the designated trusted administrator.
