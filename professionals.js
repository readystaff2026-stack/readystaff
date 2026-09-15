import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

const supabase = createClient(
  'https://wsutvfonuualpckowzpv.supabase.co',
  'sb_publishable_g9DWS8l0nuhGbe4wvNZTjA_EXydGO_R'
);

const section = document.getElementById('talentos');
const container = document.getElementById('talent-cards');
const count = document.getElementById('talent-count');
const empty = document.getElementById('talent-empty');
const service = document.getElementById('service');
const budget = document.getElementById('budget');
const minimum = document.getElementById('budget-min');
let professionals = [];

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
  info.append(name, location);

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
  return link;
}

function matchingProfessionals() {
  const max = Number(budget.value);
  return professionals.filter(profile => offerings(profile).some(offer => {
    if (service.value && offer.categories.slug !== service.value) return false;
    if (!budget.value || !Number.isFinite(max)) return true;
    const price = Number(offer.price);
    return (price > 0 && price <= max) || offer.accepts_proposals;
  }));
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
  updateMinimum();
  const selected = matchingProfessionals();
  container.replaceChildren(...selected.map(renderProfile));
  count.textContent = `${selected.length} ${selected.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}`;
  empty.hidden = selected.length !== 0;
  section.hidden = false;
}

async function loadProfessionals() {
  const { data, error } = await supabase
    .from('professional_profiles')
    .select('id, display_name, avatar_url, city, state, bio, professional_categories(price, accepts_proposals, categories(id, name, slug))')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    empty.textContent = 'Não foi possível carregar os profissionais agora. Tente novamente em instantes.';
    section.hidden = false;
    return;
  }
  professionals = data || [];
  render();
}

document.addEventListener('readystaff:search', render);
document.addEventListener('readystaff:filters-changed', render);
budget.addEventListener('input', render);
loadProfessionals();
