import { supabase } from './supabase-client.js';

const list = document.getElementById('requests');
const message = document.getElementById('dashboard-message');
let role = '';
let requests = [];
let activeFilter = 'all';
const labels = { pending: 'Pendente', accepted: 'Aceito', declined: 'Recusado', cancelled: 'Cancelado' };
const money = value => value ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado';
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

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
  await loadRequests();
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
  heading.append(eyebrow, title);
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
    ? 'id, client_name, client_phone, event_date, event_time, city, state, venue, guest_count, proposed_budget, message, status, professional_response, created_at, categories(name)'
    : 'id, event_date, event_time, city, state, venue, guest_count, proposed_budget, message, status, professional_response, created_at, categories(name), professional_profiles(display_name, whatsapp)';
  const { data, error } = await supabase.from('quote_requests').select(select).order('created_at', { ascending: false });
  if (error) {
    message.className = 'message error';
    message.textContent = 'Não foi possível carregar os pedidos agora.';
    return;
  }
  requests = data || [];
  render();
}

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
  render();
}));
document.getElementById('sign-out').addEventListener('click', async () => { await supabase.auth.signOut(); location.href = 'index.html'; });

async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    message.className = 'message error';
    message.textContent = 'Entre na sua conta para abrir o painel.';
    setTimeout(() => location.href = 'index.html', 1800);
    return;
  }
  const { data: profile, error } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single();
  if (error) return;
  role = profile.role;
  document.getElementById('dashboard-title').textContent = role === 'professional' ? 'Pedidos recebidos' : 'Meus orçamentos';
  document.getElementById('dashboard-copy').textContent = role === 'professional' ? `Olá, ${profile.full_name}. Responda aos clientes interessados no seu trabalho.` : `Olá, ${profile.full_name}. Acompanhe aqui seus pedidos e respostas.`;
  document.getElementById('edit-profile').hidden = role !== 'professional';
  await loadRequests();
}
start();
