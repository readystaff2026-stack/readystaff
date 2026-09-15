import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

const supabase = createClient(
  'https://wsutvfonuualpckowzpv.supabase.co',
  'sb_publishable_g9DWS8l0nuhGbe4wvNZTjA_EXydGO_R',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const params = new URLSearchParams(location.search);
const message = document.getElementById('profile-message');
const publicProfile = document.getElementById('public-profile');
const editor = document.getElementById('profile-editor');
const form = document.getElementById('profile-form');
const editorMessage = document.getElementById('editor-message');
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const statusLabels = { pending: 'Perfil publicado', approved: 'Perfil publicado', rejected: 'Revisão necessária', suspended: 'Perfil suspenso' };
let session = null;
let profileId = '';
let profile = null;
let categories = [];
let currentCategoryIds = new Set();
let currentOfferings = new Map();
let portfolio = [];

function setMessage(copy, type = '') {
  message.textContent = copy;
  message.className = `wrap message ${type}`.trim();
  message.hidden = !copy;
}

function setEditorMessage(copy, type = '') {
  editorMessage.textContent = copy;
  editorMessage.className = `form-message ${type}`.trim();
  editorMessage.hidden = !copy;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_error) {
    return '';
  }
}

function initials(name = 'RS') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'RS';
}

function categoryItems() {
  return (profile.professional_categories || []).map(item => item.categories).filter(Boolean);
}

function offerItems() {
  return (profile.professional_categories || []).filter(item => item.categories);
}

function offerPrice(offer) {
  const price = Number(offer?.price);
  if (price > 0) return currency.format(price);
  return 'Valor a combinar';
}

function showAvatar() {
  const avatar = document.getElementById('profile-avatar');
  avatar.replaceChildren();
  const url = safeUrl(profile.avatar_url);
  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = `Foto de ${profile.display_name}`;
    avatar.append(image);
    avatar.removeAttribute('aria-hidden');
  } else {
    avatar.textContent = initials(profile.display_name);
    avatar.setAttribute('aria-hidden', 'true');
  }
}

function whatsappUrl(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 10) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent('Olá! Encontrei seu perfil na ReadyStaff e gostaria de conversar sobre um evento.')}`;
}

function instagramUrl(value) {
  const direct = safeUrl(value);
  if (direct) return direct;
  const username = String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
  return username ? `https://www.instagram.com/${username}/` : '';
}

function renderPortfolio(target, editable = false) {
  target.replaceChildren();
  portfolio.forEach(item => {
    const figure = document.createElement('figure');
    figure.className = 'portfolio-item';
    const image = document.createElement('img');
    image.src = safeUrl(item.image_url);
    image.alt = item.caption || `Trabalho de ${profile.display_name}`;
    image.loading = 'lazy';
    figure.append(image);
    if (item.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = item.caption;
      figure.append(caption);
    }
    if (editable) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remover';
      remove.addEventListener('click', () => removePortfolio(item));
      figure.append(remove);
    }
    target.append(figure);
  });
}

function renderPublicProfile() {
  document.title = `${profile.display_name} — ReadyStaff`;
  document.getElementById('profile-name').textContent = profile.display_name;
  document.getElementById('profile-location').textContent = [profile.city, profile.state].filter(Boolean).join(' / ');
  document.getElementById('profile-bio').textContent = profile.bio || 'Este profissional ainda está preparando sua apresentação.';
  document.getElementById('profile-experience').textContent = `${profile.experience_years || 0} ${(profile.experience_years || 0) === 1 ? 'ano' : 'anos'}`;
  const prices = offerItems().map(offer => Number(offer.price)).filter(value => value > 0);
  document.getElementById('profile-price').textContent = prices.length ? `A partir de ${currency.format(Math.min(...prices))}` : 'Valor a combinar';
  document.getElementById('profile-availability').textContent = profile.availability || 'Consulte diretamente';

  const tags = document.getElementById('profile-tags');
  tags.replaceChildren(...categoryItems().map(category => {
    const tag = document.createElement('span');
    tag.textContent = category.name;
    return tag;
  }));

  const services = document.getElementById('profile-services');
  services.replaceChildren(...offerItems().map(offer => {
    const card = document.createElement('article');
    card.className = 'offer-card';
    const name = document.createElement('strong');
    name.textContent = offer.categories.name;
    const price = document.createElement('span');
    price.textContent = offerPrice(offer);
    card.append(name, price);
    if (offer.accepts_proposals) {
      const proposal = document.createElement('small');
      proposal.textContent = 'Aceita propostas de valor';
      card.append(proposal);
    }
    return card;
  }));

  const whatsapp = whatsappUrl(profile.whatsapp);
  const whatsappLink = document.getElementById('whatsapp-link');
  whatsappLink.href = whatsapp || '#';
  whatsappLink.hidden = !whatsapp;
  const instagram = instagramUrl(profile.instagram);
  const instagramLink = document.getElementById('instagram-link');
  instagramLink.href = instagram || '#';
  instagramLink.hidden = !instagram;

  const status = document.getElementById('profile-status');
  const isOwner = session?.user?.id === profile.id;
  status.textContent = statusLabels[profile.status] || profile.status;
  status.hidden = !isOwner;

  showAvatar();
  const portfolioSection = document.getElementById('portfolio-section');
  portfolioSection.hidden = portfolio.length === 0;
  renderPortfolio(document.getElementById('portfolio-grid'));
  publicProfile.hidden = false;
  setMessage('');
}

function renderCategoryEditor() {
  const target = document.getElementById('editor-categories');
  target.replaceChildren(...categories.map(category => {
    const offering = currentOfferings.get(category.id);
    const card = document.createElement('article');
    card.className = 'category-option';
    const title = document.createElement('label');
    title.className = 'category-title';
    const toggle = document.createElement('input');
    toggle.className = 'category-toggle';
    toggle.type = 'checkbox';
    toggle.name = 'categories';
    toggle.value = String(category.id);
    toggle.checked = currentCategoryIds.has(category.id);
    const name = document.createElement('span');
    name.textContent = category.name;
    title.append(toggle, name);

    const price = document.createElement('label');
    price.className = 'category-price';
    const priceLabel = document.createElement('span');
    priceLabel.textContent = 'Valor (R$)';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '1';
    priceInput.step = '0.01';
    priceInput.inputMode = 'decimal';
    priceInput.dataset.priceFor = String(category.id);
    priceInput.value = offering?.price || '';
    price.append(priceLabel, priceInput);

    const proposal = document.createElement('label');
    proposal.className = 'proposal-toggle';
    const proposalInput = document.createElement('input');
    proposalInput.type = 'checkbox';
    proposalInput.dataset.proposalFor = String(category.id);
    proposalInput.checked = Boolean(offering?.accepts_proposals);
    proposal.append(proposalInput, document.createTextNode('Aceito propostas para esta categoria'));
    toggle.addEventListener('change', () => { priceInput.required = toggle.checked; });
    priceInput.required = toggle.checked;
    card.append(title, price, proposal);
    return card;
  }));
}

function fillEditor() {
  for (const name of ['display_name', 'whatsapp', 'city', 'state', 'experience_years', 'instagram', 'bio', 'availability']) {
    form.elements[name].value = profile[name] ?? '';
  }
  renderCategoryEditor();
  renderPortfolio(document.getElementById('editor-portfolio'), true);
  editor.hidden = false;
}

function validateImage(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!allowed.includes(file.type)) throw new Error('Use imagens JPG, PNG, WebP ou AVIF.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Cada imagem deve ter no máximo 5 MB.');
}

function extensionFor(file) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })[file.type];
}

async function uploadImage(file, prefix) {
  validateImage(file);
  const path = `${session.user.id}/${prefix}-${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from('professional-media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('professional-media').getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function saveCategories(selectedOffers) {
  const selected = new Set(selectedOffers.map(item => item.category_id));
  const additions = [...selected].filter(id => !currentCategoryIds.has(id));
  const removals = [...currentCategoryIds].filter(id => !selected.has(id));
  if (additions.length) {
    const { error } = await supabase.from('professional_categories').insert(selectedOffers.filter(item => additions.includes(item.category_id)).map(item => ({ professional_id: profileId, ...item })));
    if (error) throw error;
  }
  for (const item of selectedOffers.filter(offer => currentCategoryIds.has(offer.category_id))) {
    const { error } = await supabase.from('professional_categories').update({ price: item.price, accepts_proposals: item.accepts_proposals }).eq('professional_id', profileId).eq('category_id', item.category_id);
    if (error) throw error;
  }
  if (removals.length) {
    const { error } = await supabase.from('professional_categories').delete().eq('professional_id', profileId).in('category_id', removals);
    if (error) throw error;
  }
  currentCategoryIds = selected;
  currentOfferings = new Map(selectedOffers.map(item => [item.category_id, item]));
}

async function uploadPortfolio(files) {
  const available = 3 - portfolio.length;
  if (available <= 0 && files.length) throw new Error('Seu portfólio já possui o limite de 3 fotos.');
  if (files.length > available) throw new Error(`Você pode adicionar mais ${available} ${available === 1 ? 'imagem' : 'imagens'} ao portfólio.`);
  const firstSortOrder = portfolio.length;
  for (const [index, file] of files.entries()) {
    const uploaded = await uploadImage(file, 'portfolio');
    const { data, error } = await supabase.from('professional_portfolio').insert({
      professional_id: profileId,
      image_url: uploaded.url,
      storage_path: uploaded.path,
      sort_order: firstSortOrder + index
    }).select('id, image_url, caption, storage_path, sort_order').single();
    if (error) {
      await supabase.storage.from('professional-media').remove([uploaded.path]);
      throw error;
    }
    portfolio.push(data);
  }
}

async function removePortfolio(item) {
  if (!confirm('Remover esta foto do portfólio?')) return;
  setEditorMessage('Removendo imagem...');
  if (item.storage_path) {
    const { error: storageError } = await supabase.storage.from('professional-media').remove([item.storage_path]);
    if (storageError) return setEditorMessage(storageError.message, 'error');
  }
  const { error } = await supabase.from('professional_portfolio').delete().eq('id', item.id).eq('professional_id', profileId);
  if (error) return setEditorMessage(error.message, 'error');
  portfolio = portfolio.filter(photo => photo.id !== item.id);
  renderPortfolio(document.getElementById('editor-portfolio'), true);
  renderPublicProfile();
  setEditorMessage('Imagem removida.');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('save-profile');
  const data = new FormData(form);
  const selectedIds = data.getAll('categories').map(Number);
  if (!selectedIds.length) return setEditorMessage('Selecione pelo menos uma categoria.', 'error');
  const portfolioFiles = [...document.getElementById('portfolio-files').files];
  const availablePhotos = 3 - portfolio.length;
  if (portfolioFiles.length > availablePhotos) {
    return setEditorMessage(`Você pode adicionar no máximo ${availablePhotos} ${availablePhotos === 1 ? 'foto' : 'fotos'} agora.`, 'error');
  }
  const selectedOffers = selectedIds.map(categoryId => ({
    category_id: categoryId,
    price: Number(document.querySelector(`[data-price-for="${categoryId}"]`).value),
    accepts_proposals: document.querySelector(`[data-proposal-for="${categoryId}"]`).checked
  }));
  if (selectedOffers.some(item => !Number.isFinite(item.price) || item.price <= 0)) {
    return setEditorMessage('Informe um valor maior que zero para cada categoria selecionada.', 'error');
  }
  button.disabled = true;
  button.textContent = 'Salvando...';
  setEditorMessage('Atualizando seu perfil...');
  try {
    let avatarUrl = profile.avatar_url;
    const avatarFile = document.getElementById('avatar-file').files[0];
    if (avatarFile) avatarUrl = (await uploadImage(avatarFile, 'avatar')).url;
    const updates = {
      display_name: String(data.get('display_name')).trim(),
      whatsapp: String(data.get('whatsapp')).trim(),
      city: String(data.get('city')).trim(),
      state: String(data.get('state')).toUpperCase(),
      experience_years: Number(data.get('experience_years')),
      instagram: String(data.get('instagram')).trim() || null,
      bio: String(data.get('bio')).trim(),
      availability: String(data.get('availability')).trim(),
      avatar_url: avatarUrl || null
    };
    const { data: updated, error } = await supabase.from('professional_profiles').update(updates).eq('id', profileId).select().single();
    if (error) throw error;
    await saveCategories(selectedOffers);
    await uploadPortfolio(portfolioFiles);
    profile = { ...profile, ...updated, professional_categories: categories.filter(category => currentCategoryIds.has(category.id)).map(category => ({ ...currentOfferings.get(category.id), categories: category })) };
    document.getElementById('avatar-file').value = '';
    document.getElementById('portfolio-files').value = '';
    renderPublicProfile();
    renderPortfolio(document.getElementById('editor-portfolio'), true);
    setEditorMessage('Perfil salvo e publicado com sucesso!');
  } catch (error) {
    setEditorMessage(error.message || 'Não foi possível salvar o perfil.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Salvar meu perfil';
  }
});

document.getElementById('preview-profile').addEventListener('click', () => {
  publicProfile.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});

async function start() {
  const { data: { session: activeSession } } = await supabase.auth.getSession();
  session = activeSession;
  const ownProfile = params.get('me') === '1';
  profileId = ownProfile ? session?.user?.id : params.get('id');
  if (!profileId) {
    setMessage(ownProfile ? 'Entre na sua conta para editar o perfil profissional.' : 'Perfil não informado.', 'error');
    return;
  }

  const { data, error } = await supabase
    .from('professional_profiles')
    .select('id, display_name, whatsapp, city, state, bio, experience_years, availability, status, avatar_url, instagram, professional_categories(category_id, price, accepts_proposals, categories(id, name, slug)), professional_portfolio(id, image_url, caption, storage_path, sort_order)')
    .eq('id', profileId)
    .single();
  if (error || !data) {
    setMessage('Este perfil profissional não está disponível.', 'error');
    return;
  }

  profile = data;
  portfolio = [...(data.professional_portfolio || [])].sort((a, b) => a.sort_order - b.sort_order);
  currentCategoryIds = new Set((data.professional_categories || []).map(item => item.category_id));
  currentOfferings = new Map((data.professional_categories || []).map(item => [item.category_id, { category_id: item.category_id, price: item.price, accepts_proposals: item.accepts_proposals }]));
  renderPublicProfile();

  if (session?.user?.id === profileId) {
    const { data: categoryData, error: categoryError } = await supabase.from('categories').select('id, name, slug').eq('active', true).order('sort_order');
    if (categoryError) return setEditorMessage('Não foi possível carregar as categorias.', 'error');
    categories = categoryData || [];
    fillEditor();
  }
}

start();
