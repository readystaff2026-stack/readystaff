-- Deployment of the expanded delivery function requires explicit approval.
-- Keep new triggers inactive until that function is deployed successfully.
drop trigger if exists enqueue_message_notice on public.quote_messages;
drop trigger if exists enqueue_offer_notice on public.quote_offer_responses;
drop trigger if exists enqueue_completion_notice on public.quote_completions;
