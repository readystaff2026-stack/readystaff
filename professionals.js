import { supabase } from './supabase-client.js';

const section = document.getElementById('talentos');
const container = document.getElementById('talent-cards');
const count = document.getElementById('talent-count');
const empty = document.getElementById('talent-empty');
const service = document.getElementById('service');
const budget = document.getElementById('budget');
const minimum = document.getElementById('budget-min');
const city = document.getElementById('city-filter');
const gate = document.getElementById('access-gate');
let professionals = [];
let canBrowse = false;
let requestVersion = 0;
let accountId = '';
let favorites = new Set();
let blockedIds = new Set();
const eventDate = document.getElementById('event-date-filter');
const sortOrder = document.getElementById('sort-filter');
const favoritesOnly = document.getElementById('favorites-filter');
let consultedDate = '';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function avatar(profile) {
  if (profile.avatar_url) {
    const image = document.createElement('img');
    image.className = 'talent-avatar';
    image.src = profile.avatar_url;
    image.alt = `Foto de ${profile.display_name}`;
    image.loading = 'lazy';
    return image;
  }
  const fallback = document.createElement('span');
  fallback.className = 'talent-avatar talent-avatar-fallback';
  fallback.textContent = initials(profile.display_name);
  fallback.setAttribute('aria-hidden', 'true');
  return fallback;
}

function offerings(profile) {
  return (profile.professional_categories || []).filter(item => item.categories);
}

function ratingLabel(profile) {
  if (!profile.rating_count) return 'Novo profissional';
  const average = Number(profile.rating_average).toFixed(1).replace('.', ',');
  return `★ ${average} · ${profile.rating_count} ${profile.rating_count === 1 ? 'avaliação' : 'avaliações'}`;
}

function activeOffering(profile) {
  const list = offerings(profile);
  if (service.value) return list.find(item => item.categories.slug === service.value);
  return [...list].sort((a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity))[0];
}

function priceLabel(offer) {
  if (!offer) return 'Consulte o profissional';
  const price = Number(offer.price);
  if (price > 0) return `A partir de ${currency.format(price)}${offer.accepts_proposals ? ' · aceita proposta' : ''}`;
  return offer.accepts_proposals ? 'Valor negociável' : 'Consulte o profissional';
}

function renderProfile(profile) {
  const link = document.createElement('a');
  link.className = 'talent-card';
  link.href = `perfil.html?id=${encodeURIComponent(profile.id)}`;

  const info = document.createElement('div');
  const name = document.createElement('h3');
  name.textContent = profile.display_name;
  const location = document.createElement('span');
  location.className = 'talent-location';
  location.textContent = [profile.city, profile.state].filter(Boolean).join(' / ');
  const rating = document.createElement('span');
  rating.className = 'talent-rating';
  rating.textContent = ratingLabel(profile);
  info.append(name, location, rating);

  const tags = document.createElement('div');
  tags.className = 'talent-tags';
  offerings(profile).slice(0, 3).forEach(item => {
    const tag = document.createElement('span');
    tag.textContent = item.categories.name;
    tags.append(tag);
  });

  const price = document.createElement('strong');
  price.className = 'talent-price';
  price.textContent = priceLabel(activeOffering(profile));
  const bio = document.createElement('p');
  bio.textContent = profile.bio || 'Conheça este profissional e seus serviços para eventos.';
  link.append(avatar(profile), info, tags, price, bio);
  if (eventDate?.value) link.append(Object.assign(document.createElement('small'), { className: 'date-match', textContent: 'Sem bloqueio informado para a data. Confirme com o profissional.' }));
  const wrapper = document.createElement('div'); wrapper.className = 'talent-wrapper';
  const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = 'favorite-button';
  const saved = favorites.has(profile.id); favorite.textContent = saved ? '♥ Salvo' : '♡ Salvar';
  favorite.setAttribute('aria-pressed', String(saved)); favorite.setAttribute('aria-label', `${saved ? 'Remover dos' : 'Adicionar aos'} favoritos: ${profile.display_name}`);
  favorite.addEventListener('click', async () => {
    favorite.disabled = true;
    const result = saved
      ? await supabase.from('professional_favorites').delete().eq('client_id', accountId).eq('professional_id', profile.id)
      : await supabase.from('professional_favorites').insert({client_id:accountId,professional_id:profile.id});
    if (result.error) { favorite.disabled = false; alert('Não foi possível atualizar seus favoritos. Tente novamente.'); return; }
    saved ? favorites.delete(profile.id) : favorites.add(profile.id); render();
  });
  wrapper.append(link, favorite); return wrapper;
}

function matchingProfessionals() {
  const max = Number(budget.value);
  const selected = professionals.filter(profile => (!favoritesOnly?.checked || favorites.has(profile.id)) && (!eventDate?.value || !blockedIds.has(profile.id)) && (!city.value || normalize(`${profile.city} ${profile.state}`).includes(normalize(city.value))) && offerings(profile).some(offer => {
    if (service.value && offer.categories.slug !== service.value) return false;
    if (!budget.value || !Number.isFinite(max)) return true;
    const price = Number(offer.price);
    return (price > 0 && price <= max) || offer.accepts_proposals;
  }));
  if (sortOrder?.value === 'rating') selected.sort((a,b) => Number(b.rating_average || 0)-Number(a.rating_average || 0) || Number(b.rating_count || 0)-Number(a.rating_count || 0));
  if (sortOrder?.value === 'price') selected.sort((a,b) => (Number(activeOffering(a)?.price)||Infinity)-(Number(activeOffering(b)?.price)||Infinity));
  return selected;
}

function updateMinimum() {
  const prices = professionals.flatMap(profile => offerings(profile))
    .filter(offer => !service.value || offer.categories.slug === service.value)
    .map(offer => Number(offer.price))
    .filter(value => value > 0);
  if (!prices.length) {
    budget.removeAttribute('min');
    minimum.textContent = service.value ? 'Ainda não há valor mínimo cadastrado nesta categoria.' : 'Escolha uma categoria para ver o menor valor.';
    return;
  }
  const min = Math.min(...prices);
  budget.min = String(min);
  budget.placeholder = currency.format(min);
  minimum.textContent = `Menor valor cadastrado: ${currency.format(min)}.`;
}

function render() {
  if (!canBrowse) return;
  if (eventDate?.value && consultedDate !== eventDate.value) { container.replaceChildren(); count.textContent = 'Consultando bloqueios de agenda...'; return; }
  updateMinimum();
  const selected = matchingProfessionals();
  container.replaceChildren(...selected.map(renderProfile));
  count.textContent = `${selected.length} ${selected.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}`;
  empty.hidden = selected.length !== 0;
  section.hidden = false;
}

async function loadProfessionals() {
  const version = ++requestVersion;
  canBrowse = false;
  professionals = [];
  container.replaceChildren();
  section.hidden = true;
  gate.hidden = false;
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (version !== requestVersion || !session || sessionError) return;
    const { data: account, error: accountError } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (version !== requestVersion) return;
    if (account?.role === 'professional') { location.replace('painel.html'); return; }
    if (accountError || account?.role !== 'client') return;
    accountId = session.user.id;
    const favoritesResult = await supabase.from('professional_favorites').select('professional_id').eq('client_id', accountId);
    if (version !== requestVersion) return;
    if (favoritesResult.error) throw favoritesResult.error;
    favorites = new Set((favoritesResult.data || []).map(item => item.professional_id));
    canBrowse = true;
    gate.hidden = true;
    section.hidden = false;
    count.textContent = 'Carregando profissionais...';
    const { data, error } = await supabase
    .from('professional_profiles')
    .select('id, display_name, avatar_url, city, state, bio, professional_categories(price, accepts_proposals, categories(id, name, slug))')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

    if (version !== requestVersion) return;
    if (error) throw error;
    professionals = data || [];
    const professionalIds = professionals.map(profile => profile.id);
    if (professionalIds.length) {
      const { data: ratingRows, error: ratingError } = await supabase
        .from('review_summaries')
        .select('reviewed_id, rating_average, rating_count')
        .in('reviewed_id', professionalIds);
      if (!ratingError) {
        const grouped = new Map((ratingRows || []).map(item => [item.reviewed_id, item]));
        professionals.forEach(profile => {
          const summary = grouped.get(profile.id);
          profile.rating_count = Number(summary?.rating_count || 0);
          profile.rating_average = Number(summary?.rating_average || 0);
        });
      }
    }
    if (version !== requestVersion) return;
    empty.textContent = 'Nenhum profissional corresponde aos filtros. Tente outra categoria, cidade ou orçamento.';
    await updateDateFilter();
  } catch (_error) {
    if (version !== requestVersion) return;
    empty.textContent = 'Não foi possível carregar os profissionais agora. Tente novamente em instantes.';
    empty.hidden = false;
    count.textContent = '';
    section.hidden = false;
  }
}

async function updateDateFilter() {
  const selectedDate = eventDate?.value || '';
  blockedIds = new Set();
  consultedDate = '';
  if (!canBrowse) return;
  if (selectedDate) {
    count.textContent = 'Consultando bloqueios de agenda...';
    const { data, error } = await supabase.from('professional_unavailability').select('professional_id').lte('starts_on', selectedDate).gte('ends_on', selectedDate);
    if (eventDate.value !== selectedDate || !canBrowse) return;
    if (error) { count.textContent = 'Não foi possível consultar a agenda. Tente novamente.'; container.replaceChildren(); return; }
    blockedIds = new Set((data || []).map(item => item.professional_id));
    consultedDate = selectedDate;
  }
  render();
}
document.addEventListener('readystaff:search', updateDateFilter);
if (favoritesOnly && new URLSearchParams(location.search).has('favoritos')) favoritesOnly.checked = true;
document.addEventListener('readystaff:filters-changed', render);
document.getElementById('reset')?.addEventListener('click', () => {
  if (eventDate) eventDate.value = '';
  if (sortOrder) sortOrder.value = 'recent';
  if (favoritesOnly) favoritesOnly.checked = false;
  updateDateFilter();
});
budget.addEventListener('input', render);
city.addEventListener('input', render);
eventDate?.addEventListener('change', updateDateFilter);
sortOrder?.addEventListener('change', render);
favoritesOnly?.addEventListener('change', render);
supabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') {
    requestVersion++;
    canBrowse = false;
    professionals = [];
    accountId = '';
    favorites = new Set();
    blockedIds = new Set();
    consultedDate = '';
    container.replaceChildren();
    section.hidden = true;
    gate.hidden = false;
    minimum.textContent = 'Entre para consultar os valores cadastrados.';
    budget.removeAttribute('min');
  } else if (event === 'SIGNED_IN') {
    setTimeout(loadProfessionals, 0);
  }
});
loadProfessionals();
