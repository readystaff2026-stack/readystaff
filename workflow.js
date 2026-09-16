import { supabase } from './supabase-client.js';

let userId = '';
let confirmations = [];
let completionsReady = false;
async function dispatchNotices(quoteId) {
  try { await supabase.functions.invoke('process-notifications', { body: { quote_id: quoteId } }); }
  catch (_) { /* The transaction has already saved the notice for a later attempt. */ }
}
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const node = (tag, copy = '', className = '') => {
  const element = document.createElement(tag);
  element.textContent = copy;
  element.className = className;
  return element;
};
export function todayInBrazil() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export async function loadCompletions(requests, id) {
  userId = id;
  confirmations = [];
  completionsReady = false;
  if (!requests.length) { completionsReady = true; return; }
  const { data, error } = await supabase.from('quote_completions').select('quote_id,user_id').in('quote_id', requests.map(q => q.id));
  if (error) throw error;
  confirmations = data || [];
  completionsReady = true;
}
export function serviceFinished(request) {
  return completionsReady && request.status === 'accepted' && request.event_date < todayInBrazil()
    && [request.client_id, request.professional_id].every(id => confirmations.some(c => c.quote_id === request.id && c.user_id === id));
}
export function completionBlock(request, refresh) {
  const box = node('section', '', 'workflow-box');
  box.append(node('h3', serviceFinished(request) ? 'Serviço concluído pelas duas partes' : 'Conclusão do serviço'));
  if (!completionsReady) {
    box.append(node('p', 'Não foi possível consultar as confirmações. Atualize os pedidos para tentar novamente.'));
  } else if (serviceFinished(request)) {
    box.append(node('p', 'Agora vocês podem compartilhar a experiência nas avaliações.'));
  } else if (request.event_date >= todayInBrazil()) {
    box.append(node('p', 'A confirmação será liberada a partir do dia seguinte ao evento. Não confirme um serviço que não aconteceu.'));
  } else if (confirmations.some(c => c.quote_id === request.id && c.user_id === userId)) {
    box.append(node('p', 'Você confirmou a conclusão. Falta a confirmação da outra pessoa para liberar as avaliações.'));
  } else {
    box.append(node('p', 'O evento aconteceu e o serviço foi realizado? Cada participante confirma a sua experiência.'));
    const button = node('button', 'Confirmar serviço realizado', 'button secondary');
    button.type = 'button';
    const feedback = node('p'); feedback.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      if (!confirm('Confirmar que este serviço foi realmente realizado? Esta confirmação não pode ser desfeita pela plataforma.')) return;
      button.disabled = true;
      const { error } = await supabase.from('quote_completions').insert({ quote_id: request.id, user_id: userId });
      if (error) { button.disabled = false; feedback.textContent = 'Não foi possível confirmar. Atualize os pedidos e tente novamente.'; return; }
      dispatchNotices(request.id);
      await refresh();
    });
    box.append(button, feedback);
  }
  return box;
}

export function conversationBlock(request) {
  const details = node('details', '', 'workflow-box conversation');
  details.append(node('summary', 'Mensagens e propostas deste orçamento'));
  const history = node('div', '', 'conversation-history');
  const feedback = node('p'); feedback.setAttribute('role', 'status');
  const refreshButton = node('button', 'Atualizar conversa', 'button secondary'); refreshButton.type = 'button';
  let loading = false;
  let messageLimit = 50;
  const olderButton = node('button', 'Carregar mensagens anteriores', 'button secondary'); olderButton.type = 'button'; olderButton.hidden = true;
  async function load() {
    if (loading) return;
    loading = true; refreshButton.disabled = true;
    feedback.textContent = 'Carregando conversa...';
    try {
      const { data, error } = await supabase.from('quote_messages').select('id,sender_id,body,proposed_amount,created_at').eq('quote_id', request.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(messageLimit);
      if (error) throw error;
      const messages = [...(data || [])].reverse();
      const responsesResult = messages.length ? await supabase.from('quote_offer_responses').select('message_id,decision').in('message_id', messages.map(m => m.id)) : { data: [], error: null };
      if (responsesResult.error) throw responsesResult.error;
      const responses = new Map((responsesResult.data || []).map(r => [r.message_id, r.decision]));
      history.replaceChildren();
      if (!messages.length) history.append(node('p', 'Comece a conversa para alinhar tarefas, horários e valores.'));
      for (const message of messages) {
        const own = message.sender_id === userId;
        const bubble = node('article', '', `chat-bubble${own ? ' own' : ''}`);
        bubble.append(node('strong', own ? 'Você' : 'Outra pessoa deste pedido'), node('p', message.body));
        const time = node('time', new Date(message.created_at).toLocaleString('pt-BR')); time.dateTime = message.created_at; bubble.append(time);
        if (message.proposed_amount) {
          bubble.append(node('p', `Proposta: ${currency.format(Number(message.proposed_amount))}`, 'offer-amount'));
          const decision = responses.get(message.id);
          if (decision) bubble.append(node('strong', decision === 'accepted' ? 'Proposta aceita pelo destinatário' : 'Proposta recusada'));
          else if (!own && ['pending', 'accepted'].includes(request.status)) {
            const actions = node('div', '', 'card-actions');
            for (const [value, label] of [['accepted', 'Aceitar proposta'], ['declined', 'Recusar proposta']]) {
              const button = node('button', label, 'button secondary'); button.type = 'button';
              button.addEventListener('click', async () => {
                if (!confirm(`${label}? Alinhe também o escopo e as condições do serviço na conversa.`)) return;
                actions.querySelectorAll('button').forEach(b => b.disabled = true);
                const { error } = await supabase.from('quote_offer_responses').insert({ message_id: message.id, responder_id: userId, decision: value });
                if (error) { feedback.textContent = 'Não foi possível responder. Atualize a conversa.'; actions.querySelectorAll('button').forEach(b => b.disabled = false); return; }
                dispatchNotices(request.id);
                await load();
              }); actions.append(button);
            } bubble.append(actions);
          }
        }
        history.append(bubble);
      }
      olderButton.hidden = messages.length < messageLimit || messageLimit >= 1000;
      feedback.textContent = messages.length === messageLimit ? `Mostrando as ${messageLimit} mensagens mais recentes.` : 'Conversa atualizada.';
    } catch (_) { feedback.textContent = 'Não foi possível carregar a conversa. Tente atualizar.'; }
    finally { loading = false; refreshButton.disabled = false; }
  }
  refreshButton.addEventListener('click', load);
  olderButton.addEventListener('click', () => { messageLimit = Math.min(messageLimit + 50, 1000); load(); });
  details.addEventListener('toggle', () => { if (details.open) load(); });
  details.append(olderButton, history, refreshButton);
  if (['pending', 'accepted'].includes(request.status)) {
    const form = node('form', '', 'conversation-form');
    const label = node('label', 'Sua mensagem');
    const input = node('textarea'); input.name = 'body'; input.required = true; input.maxLength = 2000; input.rows = 3; label.append(input);
    const priceLabel = node('label', 'Propor um valor total (opcional)');
    const amount = node('input'); amount.type = 'number'; amount.name = 'amount'; amount.min = '0.01'; amount.max = '9999999'; amount.step = '0.01'; amount.inputMode = 'decimal'; priceLabel.append(amount);
    const button = node('button', 'Enviar mensagem', 'button'); button.type = 'submit';
    form.append(label, priceLabel, node('small', 'Uma proposta aceita registra o combinado, mas não altera o pedido original nem processa pagamento.'), button);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!input.value.trim()) return;
      button.disabled = true; feedback.textContent = 'Enviando...';
      const { error } = await supabase.from('quote_messages').insert({ quote_id: request.id, sender_id: userId, body: input.value.trim(), proposed_amount: amount.value ? Number(amount.value) : null });
      button.disabled = false;
      if (error) { feedback.textContent = 'Não foi possível enviar. Sua mensagem foi mantida para tentar novamente.'; return; }
      dispatchNotices(request.id);
      form.reset(); await load();
    }); details.append(form);
  } else details.append(node('p', 'Este pedido está encerrado. O histórico continua disponível, mas não aceita novas mensagens.'));
  details.append(feedback);
  // Poll only an open conversation on a visible page; stop when its card leaves the DOM.
  const timer = setInterval(() => {
    if (!details.isConnected) { clearInterval(timer); return; }
    if (details.open && !document.hidden && !details.querySelector('textarea:focus')) load();
  }, 30000);
  return details;
}

export function reportBlock(request) {
  const details = node('details', '', 'report-box'); details.append(node('summary', 'Relatar um problema com este pedido'));
  const form = node('form', '', 'conversation-form');
  const label = node('label', 'Descreva o problema, sem senhas ou dados sensíveis');
  const reason = node('textarea'); reason.required = true; reason.minLength = 10; reason.maxLength = 1000; reason.rows = 3; label.append(reason);
  const button = node('button', 'Enviar relato', 'button secondary'); button.type = 'submit';
  const feedback = node('p'); feedback.setAttribute('role', 'status'); form.append(label,button,feedback); details.append(form);
  form.addEventListener('submit', async event => {
    event.preventDefault(); button.disabled = true;
    const { error } = await supabase.from('quote_reports').insert({quote_id:request.id,reporter_id:userId,reason:reason.value.trim()});
    button.disabled = false; feedback.textContent = error ? 'Não foi possível enviar o relato.' : 'Relato registrado. A equipe responsável poderá analisá-lo. Em caso de emergência, procure as autoridades competentes.';
    if (!error) form.reset();
  }); return details;
}
