-- Evaluate the trusted JWT once per statement instead of once per row.
alter policy "Reporters and designated admins read reports" on public.quote_reports
using(reporter_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'readystaff_admin')='true');
alter policy "Designated admins resolve reports" on public.quote_reports
using(((select auth.jwt())->'app_metadata'->>'readystaff_admin')='true')
with check(((select auth.jwt())->'app_metadata'->>'readystaff_admin')='true');
alter policy "Designated admins inspect accounts" on public.profiles using(((select auth.jwt())->'app_metadata'->>'readystaff_admin')='true');
alter policy "Designated admins inspect reviews" on public.reviews using(((select auth.jwt())->'app_metadata'->>'readystaff_admin')='true');
alter policy "Designated admins inspect notification delivery" on public.notification_outbox using(((select auth.jwt())->'app_metadata'->>'readystaff_admin')='true');
