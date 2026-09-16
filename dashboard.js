import { supabase } from './supabase-client.js';

const list = document.getElementById('requests');
const message = document.getElementById('dashboard-message');
let role = '';
let requests = [];
let activeFilter = 'all';
let currentSession = null;
let reviews = [];
const labels = { pending: 'Pendente', accepted: 'Aceito', declined: 'Recusado', cancelled: 'Cancelado' };
const money = value => value ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado';
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

function ratingCopy(summary) {
  return summary.count
    ? `★ ${summary.average.toFixed(1).replace('.', ',')} · ${summary.count} ${summary.count === 1 ? 'avaliação' : 'avaliações'}`
    : 'Ainda sem avaliações';
}

function renderStars(value) {
  const stars = document.createElement('span');
  stars.className = 'stars-readonly';
  stars.textContent = `${'★'.repeat(Number(value) || 0)}${'☆'.repeat(5 - (Number(value) || 0))}`;
  stars.setAttribute('aria-label', `${value} de 5 estrelas`);
  return stars;
}

async function processNotifications(quoteId = '') {
  try {
    await supabase.functions.invoke('process-notifications', { body: quoteId ? { quote_id: quoteId } : {} });
  } catch (_error) {
    // O evento permanece na fila do banco para uma nova tentativa.
  }
}

function detail(label, value) {
  const box = document.createElement('div');
  box.className = 'detail';
  const title = document.createElement('b');
  title.textContent = label;
  const copy = document.createElement('span');
  copy.textContent = value || 'Não informado';
  box.append(title, copy);
  return box;
}

function contactLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const link = document.createElement('a');
  link.className = 'contact';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.href = `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
  link.textContent = `Falar pelo WhatsApp: ${phone}`;
  return link;
}

async function updateRequest(id, status, response = null) {
  const buttonList = [...document.querySelectorAll(`[data-request="${id}"] button`)];
  buttonList.forEach(button => button.disabled = true);
  const changes = role === 'professional' ? { status, professional_response: response || null } : { status };
  const { error } = await supabase.from('quote_requests').update(changes).eq('id', id);
  if (error) {
    buttonList.forEach(button => button.disabled = false);
    alert(error.message || 'Não foi possível atualizar o pedido.');
    return;
  }
  await processNotifications(id);
  await loadRequests();
}

async function submitReview(event, request, reviewedId) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = form.querySelector('.review-feedback');
  const button = form.querySelector('[type="submit"]');
  const data = new FormData(form);
  const rating = Number(data.get('rating'));
  const comment = String(data.get('comment') || '').trim();
  if (!rating) {
    feedback.textContent = 'Escolha de 1 a 5 estrelas.';
    return;
  }
  if (comment && comment.length < 3) {
    feedback.textContent = 'O comentário precisa ter pelo menos 3 caracteres.';
    return;
  }
  button.disabled = true;
  feedback.textContent = 'Publicando sua avaliação...';
  const { error } = await supabase.from('reviews').insert({
    quote_id: request.id,
    reviewer_id: currentSession.user.id,
    reviewed_id: reviewedId,
    rating,
    comment: comment || null
  });
  if (error) {
    button.disabled = false;
    feedback.textContent = error.code === '23505'
      ? 'Você já avaliou este serviço.'
      : 'Não foi possível publicar. Confirme se o pedido foi aceito.';
    return;
  }
  feedback.textContent = 'Avaliação publicada. Obrigado!';
  await loadRequests();
}

function reviewBlock(request) {
  const block = document.createElement('section');
  block.className = 'review-block';
  const heading = document.createElement('div');
  heading.className = 'review-heading';
  const title = document.createElement('strong');
  const targetName = role === 'professional'
    ? request.client_name
    : request.professional_profiles?.display_name || 'este profissional';
  title.textContent = `Avalie ${targetName}`;
  const note = document.createElement('span');
  note.textContent = 'Sua experiência ajuda a construir uma comunidade mais confiável.';
  heading.append(title, note);
  block.append(heading);

  if (request.myReview) {
    const published = document.createElement('div');
    published.className = 'review-published';
    published.append(renderStars(request.myReview.rating));
    const copy = document.createElement('span');
    copy.textContent = request.myReview.comment || 'Avaliação enviada sem comentário.';
    published.append(copy);
    block.append(published);
    return block;
  }

  const form = document.createElement('form');
  form.className = 'review-form';
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Sua nota';
  const options = document.createElement('div');
  options.className = 'star-options';
  for (let value = 5; value >= 1; value -= 1) {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'rating';
    input.value = String(value);
    input.id = `rating-${request.id}-${value}`;
    input.required = true;
    input.setAttribute('aria-label', `${value} ${value === 1 ? 'estrela' : 'estrelas'}`);
    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = '★';
    label.title = `${value} ${value === 1 ? 'estrela' : 'estrelas'}`;
    options.append(input, label);
  }
  fieldset.append(legend, options);
  const comment = document.createElement('textarea');
  comment.name = 'comment';
  comment.maxLength = 600;
  comment.rows = 3;
  comment.placeholder = 'Conte como foi a experiência (opcional)';
  comment.setAttribute('aria-label', 'Comentário sobre a experiência (opcional)');
  const actions = document.createElement('div');
  actions.className = 'review-actions';
  const button = document.createElement('button');
  button.className = 'button secondary';
  button.type = 'submit';
  button.textContent = 'Publicar avaliação';
  const feedback = document.createElement('span');
  feedback.className = 'review-feedback';
  feedback.setAttribute('role', 'status');
  actions.append(button, feedback);
  form.append(fieldset, comment, actions);
  form.addEventListener('submit', event => submitReview(event, request, role === 'professional' ? request.client_id : request.professional_id));
  block.append(form);
  return block;
}

function renderCard(request) {
  const card = document.createElement('article');
  card.className = 'request-card';
  card.dataset.request = request.id;
  const top = document.createElement('div');
  top.className = 'request-top';
  const heading = document.createElement('div');
  const eyebrow = document.createElement('span');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = request.categories?.name || 'Serviço para evento';
  const title = document.createElement('h2');
  title.textContent = role === 'professional' ? request.client_name : request.professional_profiles?.display_name || 'Profissional';
  const counterpartRating = document.createElement('span');
  counterpartRating.className = 'counterpart-rating';
  counterpartRating.textContent = ratingCopy(request.counterpartRating);
  heading.append(eyebrow, title, counterpartRating);
  const status = document.createElement('span');
  status.className = `status ${request.status}`;
  status.textContent = labels[request.status];
  top.append(heading, status);

  const details = document.createElement('div');
  details.className = 'request-details';
  details.append(
    detail('Data', date(request.event_date)),
    detail('Horário', request.event_time?.slice(0, 5)),
    detail('Local', `${request.city}/${request.state}`),
    detail('Proposta', money(request.proposed_budget))
  );
  const text = document.createElement('p');
  text.className = 'request-message';
  text.textContent = request.message;
  card.append(top, details, text);
  if (request.venue || request.guest_count) {
    const extra = document.createElement('p');
    extra.textContent = [request.venue && `Local: ${request.venue}`, request.guest_count && `${request.guest_count} convidados`].filter(Boolean).join(' · ');
    card.append(extra);
  }
  if (request.professional_response) {
    const response = document.createElement('p');
    response.className = 'response';
    response.textContent = `Resposta: ${request.professional_response}`;
    card.append(response);
  }
  if (role === 'professional') {
    const contact = contactLink(request.client_phone);
    if (contact) card.append(contact);
  } else if (request.status === 'accepted') {
    const contact = contactLink(request.professional_profiles?.whatsapp);
    if (contact) card.append(contact);
  }
  if (request.status === 'pending') {
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    if (role === 'professional') {
      const field = document.createElement('label');
      field.className = 'response-field';
      field.innerHTML = '<span>Mensagem para o contratante (opcional)</span><textarea maxlength="1000" placeholder="Confirme disponibilidade ou explique sua resposta."></textarea>';
      card.append(field);
      const accept = document.createElement('button');
      accept.className = 'button accept'; accept.textContent = 'Aceitar pedido';
      accept.addEventListener('click', () => updateRequest(request.id, 'accepted', field.querySelector('textarea').value.trim()));
      const decline = document.createElement('button');
      decline.className = 'button decline'; decline.textContent = 'Recusar pedido';
      decline.addEventListener('click', () => updateRequest(request.id, 'declined', field.querySelector('textarea').value.trim()));
      actions.append(accept, decline);
    } else {
      const cancel = document.createElement('button');
      cancel.className = 'button cancel'; cancel.textContent = 'Cancelar pedido';
      cancel.addEventListener('click', () => confirm('Cancelar este pedido de orçamento?') && updateRequest(request.id, 'cancelled'));
      actions.append(cancel);
    }
    card.append(actions);
  }
  if (request.status === 'accepted') card.append(reviewBlock(request));
  return card;
}

function render() {
  const visible = requests.filter(item => activeFilter === 'all' || item.status === activeFilter);
  list.replaceChildren(...visible.map(renderCard));
  message.hidden = visible.length > 0;
  if (!visible.length) message.textContent = activeFilter === 'all' ? 'Nenhum pedido de orçamento por aqui ainda.' : 'Nenhum pedido com este status.';
}

async function loadRequests() {
  message.hidden = false;
  message.textContent = 'Atualizando pedidos...';
  const select = role === 'professional'
    ? 'id, client_id, professional_id, client_name, client_phone, event_date, event_time, city, state, venue, guest_count, proposed_budget, message, status, professional_response, created_at, categories(name)'
    : 'id, client_id, professional_id, event_date, event_time, city, state, venue, guest_count, proposed_budget, message, status, professional_response, created_at, categories(name), professional_profiles(display_name, whatsapp)';
  const { data, error } = await supabase.from('quote_requests').select(select).order('created_at', { ascending: false });
  if (error) {
    message.className = 'message error';
    message.textContent = 'Não foi possível carregar os pedidos agora.';
    return;
  }
  requests = data || [];
  const counterpartIds = [...new Set(requests.map(item => role === 'professional' ? item.client_id : item.professional_id).filter(Boolean))];
  const quoteIds = requests.map(item => item.id);
  const [counterpartResult, requestResult, ownResult] = await Promise.all([
    counterpartIds.length
      ? supabase.from('review_summaries').select('reviewed_id, rating_average, rating_count').in('reviewed_id', counterpartIds)
      : Promise.resolve({ data: [], error: null }),
    quoteIds.length
      ? supabase.from('reviews').select('id, quote_id, reviewer_id, reviewed_id, rating, comment, created_at').in('quote_id', quoteIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('review_summaries').select('reviewed_id, rating_average, rating_count').eq('reviewed_id', currentSession.user.id)
  ]);
  reviews = requestResult.data || [];
  const summaryRows = [...(counterpartResult.data || []), ...(ownResult.data || [])];
  const summaries = new Map(summaryRows.map(item => [item.reviewed_id, {
    average: Number(item.rating_average || 0),
    count: Number(item.rating_count || 0)
  }]));
  requests.forEach(item => {
    const counterpartId = role === 'professional' ? item.client_id : item.professional_id;
    item.counterpartRating = summaries.get(counterpartId) || { average: 0, count: 0 };
    item.myReview = reviews.find(review => review.quote_id === item.id && review.reviewer_id === currentSession.user.id) || null;
  });
  const ownSummary = summaries.get(currentSession.user.id) || { average: 0, count: 0 };
  document.getElementById('my-rating').textContent = ownSummary.count
    ? ownSummary.average.toFixed(1).replace('.', ',')
    : '—';
  document.getElementById('my-rating-count').textContent = ownSummary.count
    ? `${ownSummary.count} ${ownSummary.count === 1 ? 'avaliação recebida' : 'avaliações recebidas'}`
    : 'Sua reputação aparecerá aqui após a primeira avaliação.';
  document.getElementById('pending-count').textContent = String(requests.filter(item => item.status === 'pending').length);
  document.getElementById('total-count').textContent = String(requests.length);
  render();
}

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
  render();
}));
const notificationForm = document.getElementById('notification-form');
const notificationMessage = document.getElementById('notification-message');

async function loadNotificationPreferences() {
  const { data, error } = await supabase.from('notification_preferences').select('email_enabled, whatsapp_enabled').eq('user_id', currentSession.user.id).maybeSingle();
  if (error) {
    notificationMessage.textContent = 'Não foi possível carregar as preferências.';
    return;
  }
  notificationForm.elements.email_enabled.checked = data?.email_enabled !== false;
  notificationForm.elements.whatsapp_enabled.checked = Boolean(data?.whatsapp_enabled);
}

notificationForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = notificationForm.querySelector('[type="submit"]');
  const whatsappEnabled = notificationForm.elements.whatsapp_enabled.checked;
  button.disabled = true;
  notificationMessage.textContent = 'Salvando...';
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: currentSession.user.id,
    email_enabled: notificationForm.elements.email_enabled.checked,
    whatsapp_enabled: whatsappEnabled,
    whatsapp_opted_in_at: whatsappEnabled ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  button.disabled = false;
  notificationMessage.textContent = error ? 'Não foi possível salvar agora.' : 'Preferências salvas.';
  if (!error) processNotifications();
});
document.getElementById('sign-out').addEventListener('click', async () => { await supabase.auth.signOut(); location.href = 'index.html'; });
const deleteDialog = document.getElementById('delete-dialog');
const deleteForm = document.getElementById('delete-form');
document.getElementById('open-delete-account').addEventListener('click', () => {
  deleteForm.reset();
  document.getElementById('delete-message').hidden = true;
  deleteDialog.showModal();
});
document.getElementById('close-delete').addEventListener('click', () => deleteDialog.close());
deleteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const confirmation = String(new FormData(deleteForm).get('confirmation')).trim();
  const errorBox = document.getElementById('delete-message');
  if (confirmation !== 'EXCLUIR') {
    errorBox.textContent = 'Digite EXCLUIR exatamente como mostrado.';
    errorBox.hidden = false;
    return;
  }
  const button = deleteForm.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Excluindo conta...';
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error || !data?.deleted) {
    errorBox.textContent = data?.error || error?.message || 'Não foi possível excluir a conta.';
    errorBox.hidden = false;
    button.disabled = false;
    button.textContent = 'Excluir minha conta definitivamente';
    return;
  }
  await supabase.auth.signOut({ scope: 'local' });
  location.replace('index.html?account=deleted');
});

async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    message.className = 'message error';
    message.textContent = 'Entre na sua conta para abrir o painel.';
    location.replace('index.html?entrar=1');
    return;
  }
  currentSession = session;
  const { data: profile, error } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single();
  if (error) return;
  await loadNotificationPreferences();
  role = profile.role;
  const professional = role === 'professional';
  document.getElementById('dashboard-title').textContent = professional ? 'Minha área profissional' : 'Meus orçamentos';
  document.getElementById('dashboard-copy').textContent = professional ? `Olá, ${profile.full_name}. Gerencie seu perfil e responda aos clientes interessados no seu trabalho.` : `Olá, ${profile.full_name}. Encontre profissionais e acompanhe aqui seus pedidos.`;
  document.getElementById('area-label').textContent = professional ? 'Painel do profissional' : 'Painel do contratante';
  document.getElementById('edit-profile').hidden = !professional;
  document.getElementById('browse-professionals').hidden = professional;
  document.getElementById('professional-overview').hidden = !professional;
  if (professional) {
    document.getElementById('brand-link').href = 'painel.html';
    const headerLink = document.getElementById('header-link');
    headerLink.href = 'perfil.html?me=1';
    headerLink.textContent = 'Meu perfil público →';
    const { data: professionalProfile } = await supabase.from('professional_profiles').select('display_name, bio, avatar_url, professional_categories(category_id)').eq('id', session.user.id).maybeSingle();
    const categoryCount = professionalProfile?.professional_categories?.length || 0;
    const complete = Boolean(professionalProfile?.display_name && professionalProfile?.bio && categoryCount);
    document.getElementById('profile-state').textContent = complete ? 'Publicado' : 'Complete agora';
  }
  await loadRequests();
  processNotifications();
}
start();
