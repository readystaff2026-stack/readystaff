-- Delivery function v3 deployed after explicit provider-data approval.
create trigger enqueue_message_notice after insert on public.quote_messages for each row execute function private.enqueue_conversation_notification();
create trigger enqueue_offer_notice after insert on public.quote_offer_responses for each row execute function private.enqueue_conversation_notification();
create trigger enqueue_completion_notice after insert on public.quote_completions for each row execute function private.enqueue_conversation_notification();
