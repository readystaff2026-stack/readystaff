-- Additive catalog update: preserve all existing categories and professional offers.
insert into public.categories (name, slug, description, sort_order, active)
values (
  'Bar de Drinks para Eventos',
  'bar-de-drinks-para-eventos',
  'Serviço de bar para festas, casamentos e eventos, com estrutura e preparo de drinks. Os itens incluídos são combinados no orçamento.',
  22,
  true
)
on conflict (slug) do nothing;
