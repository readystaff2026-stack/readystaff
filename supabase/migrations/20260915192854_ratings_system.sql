-- Avaliações recíprocas após um pedido de orçamento aceito.
-- Cada participante pode publicar uma única avaliação por pedido.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (
    comment is null
    or char_length(btrim(comment)) between 3 and 600
  ),
  created_at timestamptz not null default now(),
  constraint reviews_people_differ check (reviewer_id <> reviewed_id),
  constraint reviews_one_per_participant unique (quote_id, reviewer_id)
);

comment on table public.reviews is
  'Avaliações recíprocas vinculadas a pedidos aceitos da ReadyStaff.';

create index reviews_reviewed_created_idx
  on public.reviews (reviewed_id, created_at desc);

create index reviews_quote_idx
  on public.reviews (quote_id);

create index reviews_reviewer_idx
  on public.reviews (reviewer_id);

alter table public.reviews enable row level security;

grant select, insert on table public.reviews to authenticated;
revoke all on table public.reviews from anon;
revoke update, delete on table public.reviews from authenticated;

create policy "Participants can create one review after acceptance"
on public.reviews
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and reviewer_id = (select auth.uid())
  and exists (
    select 1
    from public.quote_requests q
    where q.id = quote_id
      and q.status = 'accepted'
      and (
        (
          q.client_id = (select auth.uid())
          and reviewed_id = q.professional_id
        )
        or
        (
          q.professional_id = (select auth.uid())
          and reviewed_id = q.client_id
        )
      )
  )
);

create policy "Ratings are visible to the appropriate audience"
on public.reviews
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    reviewer_id = (select auth.uid())
    or reviewed_id = (select auth.uid())
    or (
      exists (
        select 1
        from public.profiles me
        where me.id = (select auth.uid())
          and me.role = 'client'
      )
      and exists (
        select 1
        from public.professional_profiles pp
        where pp.id = reviews.reviewed_id
          and pp.status = 'approved'
      )
    )
    or exists (
      select 1
      from public.quote_requests q
      where q.professional_id = (select auth.uid())
        and q.client_id = reviews.reviewed_id
    )
  )
);

create view public.review_summaries
with (security_invoker = true)
as
select
  reviewed_id,
  round(avg(rating)::numeric, 2) as rating_average,
  count(*)::bigint as rating_count
from public.reviews
group by reviewed_id;

comment on view public.review_summaries is
  'Média e quantidade de avaliações, respeitando a visibilidade definida pela RLS.';

grant select on table public.review_summaries to authenticated;
revoke all on table public.review_summaries from anon;
