import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

const supabaseUrl = 'https://wsutvfonuualpckowzpv.supabase.co';
const supabaseKey = 'sb_publishable_g9DWS8l0nuhGbe4wvNZTjA_EXydGO_R';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const modal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const accountView = document.getElementById('account-view');
const message = document.getElementById('auth-message');
const tabs = [...document.querySelectorAll('[data-auth-tab]')];
const professionalFields = document.getElementById('professional-fields');
const headerButton = document.getElementById('open-auth');
let currentSession = null;

function showMessage(copy, type = 'info') {
  message.textContent = copy;
  message.className = `auth-message ${type}`;
  message.hidden = !copy;
}

function clearMessage() {
  showMessage('');
}

function translateError(error) {
  const text = String(error?.message || error || 'Não foi possível concluir a operação.');
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos.';
  if (/already registered|already exists/i.test(text)) return 'Este e-mail já possui uma conta.';
  if (/password/i.test(text) && /least|short/i.test(text)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/rate limit/i.test(text)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
  if (/email not confirmed/i.test(text)) return 'Confirme seu e-mail antes de entrar.';
  return text;
}

function setLoading(form, loading) {
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = loading;
  submit.dataset.originalText ||= submit.textContent;
  submit.textContent = loading ? 'Aguarde...' : submit.dataset.originalText;
}

function setView(view) {
  clearMessage();
  accountView.hidden = true;
  document.querySelector('.auth-tabs').hidden = false;
  loginForm.hidden = view !== 'login';
  signupForm.hidden = view !== 'signup';
  tabs.forEach(tab => {
    const active = tab.dataset.authTab === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

function setRole(role) {
  const input = signupForm.querySelector(`input[name="role"][value="${role}"]`);
  if (input) input.checked = true;
  professionalFields.hidden = role !== 'professional';
  professionalFields.querySelectorAll('textarea').forEach(field => field.required = role === 'professional');
}

async function showAccount(session) {
  currentSession = session;
  document.querySelector('.auth-tabs').hidden = true;
  loginForm.hidden = true;
  signupForm.hidden = true;
  accountView.hidden = false;
  clearMessage();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role, city, state')
    .eq('id', session.user.id)
    .single();

  if (error) {
    showMessage('Sua conta está ativa, mas não foi possível carregar o perfil agora.', 'error');
    return;
  }

  document.getElementById('account-name').textContent = profile.full_name || session.user.email;
  document.getElementById('account-role').textContent = profile.role === 'professional' ? 'Profissional' : 'Cliente';
  document.getElementById('account-copy').textContent = profile.role === 'professional'
    ? `Perfil profissional de ${profile.city || 'sua cidade'}${profile.state ? `/${profile.state}` : ''}.`
    : 'Sua conta de cliente está pronta para acompanhar a evolução da ReadyStaff.';

  const statusRow = document.getElementById('account-status-row');
  if (profile.role === 'professional') {
    const { data: professional } = await supabase
      .from('professional_profiles')
      .select('status')
      .eq('id', session.user.id)
      .maybeSingle();
    const statusLabels = { pending: 'Em análise', approved: 'Aprovado', rejected: 'Revisão necessária', suspended: 'Suspenso' };
    document.getElementById('account-status').textContent = statusLabels[professional?.status] || 'Em análise';
    statusRow.hidden = false;
  } else {
    statusRow.hidden = true;
  }

  headerButton.textContent = 'Minha conta';
}

async function openAuth(role) {
  if (!modal.open) modal.showModal();
  if (currentSession) {
    await showAccount(currentSession);
    return;
  }
  setView(role ? 'signup' : 'login');
  if (role) setRole(role);
}

document.querySelectorAll('[data-open-auth]').forEach(button => {
  button.addEventListener('click', () => openAuth(button.dataset.role));
});

document.getElementById('close-auth').addEventListener('click', () => modal.close());
tabs.forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.authTab)));
signupForm.querySelectorAll('input[name="role"]').forEach(input => {
  input.addEventListener('change', () => setRole(input.value));
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  setLoading(loginForm, true);
  const form = new FormData(loginForm);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get('email')).trim(),
    password: String(form.get('password'))
  });
  setLoading(loginForm, false);
  if (error) return showMessage(translateError(error), 'error');
  await showAccount(data.session);
});

signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  const form = new FormData(signupForm);
  const role = String(form.get('role'));
  const categories = form.getAll('categories').map(String);
  if (role === 'professional' && categories.length === 0) {
    return showMessage('Selecione pelo menos uma categoria de atuação.', 'error');
  }

  setLoading(signupForm, true);
  const metadata = {
    role,
    full_name: String(form.get('full_name')).trim(),
    display_name: String(form.get('full_name')).trim(),
    phone: String(form.get('phone')).trim(),
    whatsapp: String(form.get('phone')).trim(),
    city: String(form.get('city')).trim(),
    state: String(form.get('state')).toUpperCase(),
    terms_accepted: true,
    categories,
    bio: role === 'professional' ? String(form.get('bio') || '').trim() : '',
    experience_years: role === 'professional' ? Number(form.get('experience_years') || 0) : 0,
    price_range: role === 'professional' ? String(form.get('price_range')) : 'sob_consulta'
  };

  const { data, error } = await supabase.auth.signUp({
    email: String(form.get('email')).trim(),
    password: String(form.get('password')),
    options: { data: metadata, emailRedirectTo: `${location.origin}/` }
  });
  setLoading(signupForm, false);

  if (error) return showMessage(translateError(error), 'error');
  if (data.session) {
    signupForm.reset();
    setRole('client');
    return showAccount(data.session);
  }

  signupForm.reset();
  setRole('client');
  setView('login');
  showMessage('Cadastro recebido! Confira seu e-mail para confirmar a conta e depois faça o login.', 'success');
});

document.getElementById('sign-out').addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentSession = null;
  headerButton.textContent = 'Entrar / cadastrar';
  setView('login');
  showMessage('Você saiu da sua conta.', 'success');
});

const { data: { session } } = await supabase.auth.getSession();
currentSession = session;
if (session) headerButton.textContent = 'Minha conta';

supabase.auth.onAuthStateChange((_event, sessionValue) => {
  currentSession = sessionValue;
  headerButton.textContent = sessionValue ? 'Minha conta' : 'Entrar / cadastrar';
  if (sessionValue && modal.open) setTimeout(() => showAccount(sessionValue), 0);
});
