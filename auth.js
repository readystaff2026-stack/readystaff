import { supabase } from './supabase-client.js';
import { optimizeImage, validateImageFile } from './image-utils.js';

const modal = document.getElementById('auth-modal');
const entryModal = document.getElementById('entry-modal');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const accountView = document.getElementById('account-view');
const message = document.getElementById('auth-message');
const tabs = [...document.querySelectorAll('[data-auth-tab]')];
const professionalFields = document.getElementById('professional-fields');
const headerButton = document.getElementById('open-auth');
document.querySelector('.auth-note').textContent = 'Cadastro gratuito com acesso imediato. As fotos são opcionais.';
const roleChoice = signupForm.querySelector('.role-options').parentElement;
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const roleNote = document.createElement('div');
roleNote.className = 'role-locked-note';
roleNote.hidden = true;
const roleNoteText = document.createElement('span');
const roleSwitch = document.createElement('button');
roleSwitch.className = 'role-switch';
roleSwitch.type = 'button';
roleSwitch.textContent = 'Trocar tipo de cadastro';
roleNote.append(roleNoteText, document.createTextNode(' · '), roleSwitch);
signupForm.prepend(roleNote);
const forgotPassword = document.createElement('button');
forgotPassword.id = 'forgot-password';
forgotPassword.className = 'entry-link';
forgotPassword.type = 'button';
forgotPassword.textContent = 'Esqueci minha senha';
loginForm.append(forgotPassword);
const dashboardLink = document.createElement('a');
dashboardLink.className = 'button teal';
dashboardLink.href = 'painel.html';
dashboardLink.textContent = 'Abrir meu painel';
accountView.querySelector('.account-actions').prepend(dashboardLink);
const recoveryForm = document.createElement('form');
recoveryForm.className = 'auth-form';
recoveryForm.hidden = true;
recoveryForm.innerHTML = `<div class="field"><label for="recovery-email">E-mail da conta</label><input id="recovery-email" name="email" type="email" autocomplete="email" required placeholder="voce@email.com"></div><button class="button teal auth-submit" type="submit">Enviar link de recuperação</button><button class="entry-link" data-back-login type="button">Voltar para entrar</button>`;
signupForm.after(recoveryForm);
const resetForm = document.createElement('form');
resetForm.className = 'auth-form';
resetForm.hidden = true;
resetForm.innerHTML = `<div class="field"><label for="new-password">Nova senha</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label for="confirm-password">Confirme a nova senha</label><input id="confirm-password" name="confirmation" type="password" autocomplete="new-password" minlength="8" required></div><button class="button teal auth-submit" type="submit">Salvar nova senha</button>`;
recoveryForm.after(resetForm);
let currentSession = null;
let currentAccountProfile = null;
let clientPreviewUrl = '';

const clientPhotoEditor = document.createElement('section');
clientPhotoEditor.id = 'client-photo-editor';
clientPhotoEditor.className = 'client-photo-editor';
clientPhotoEditor.hidden = true;
clientPhotoEditor.innerHTML = `
  <h4>Sua foto de perfil</h4>
  <p>A foto é opcional e ajuda a personalizar sua conta de contratante.</p>
  <div class="client-photo-layout">
    <div id="client-photo-preview" class="client-photo-preview" aria-label="Prévia da foto"></div>
    <label class="client-photo-input">
      <span>Escolher uma foto</span>
      <input id="client-photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif">
      <small>JPG, PNG, WebP ou AVIF. A foto será otimizada automaticamente.</small>
    </label>
  </div>
  <div class="client-photo-actions">
    <button id="save-client-photo" class="button teal" type="button">Salvar foto</button>
    <button id="remove-client-photo" class="button ghost" type="button" hidden>Remover foto</button>
  </div>
  <p id="client-photo-message" class="client-photo-message" hidden aria-live="polite"></p>`;
accountView.querySelector('.account-actions').before(clientPhotoEditor);

function safeImageUrl(value) {
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

function showClientPhotoMessage(copy, type = '') {
  const target = document.getElementById('client-photo-message');
  target.textContent = copy;
  target.className = `client-photo-message ${type}`.trim();
  target.hidden = !copy;
}

function renderClientPhoto(profile, temporaryUrl = '') {
  const preview = document.getElementById('client-photo-preview');
  const url = temporaryUrl || safeImageUrl(profile?.avatar_url);
  preview.replaceChildren();
  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = `Foto de ${profile?.full_name || 'contratante'}`;
    preview.append(image);
  } else {
    preview.textContent = initials(profile?.full_name);
  }
  document.getElementById('remove-client-photo').hidden = !profile?.avatar_url;
}

function setClientPhotoLoading(loading) {
  const save = document.getElementById('save-client-photo');
  const remove = document.getElementById('remove-client-photo');
  save.disabled = loading;
  remove.disabled = loading;
  save.textContent = loading ? 'Salvando...' : 'Salvar foto';
}

async function saveClientPhoto() {
  const input = document.getElementById('client-photo-file');
  const file = input.files[0];
  if (!file) return showClientPhotoMessage('Escolha uma foto antes de salvar.', 'error');
  try {
    validateImageFile(file);
    setClientPhotoLoading(true);
    showClientPhotoMessage('Otimizando e enviando sua foto...');
    const optimized = await optimizeImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.82 });
    const path = `${currentSession.user.id}/client-avatar-${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from('professional-media').upload(path, optimized, { cacheControl: '3600', contentType: 'image/webp', upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = supabase.storage.from('professional-media').getPublicUrl(path);
    const previousPath = currentAccountProfile.avatar_storage_path;
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl.publicUrl, avatar_storage_path: path })
      .eq('id', currentSession.user.id)
      .select('avatar_url, avatar_storage_path')
      .single();
    if (updateError) {
      await supabase.storage.from('professional-media').remove([path]);
      throw updateError;
    }
    if (previousPath && previousPath !== path) await supabase.storage.from('professional-media').remove([previousPath]);
    currentAccountProfile = { ...currentAccountProfile, ...updated };
    input.value = '';
    if (clientPreviewUrl) URL.revokeObjectURL(clientPreviewUrl);
    clientPreviewUrl = '';
    renderClientPhoto(currentAccountProfile);
    showClientPhotoMessage('Foto salva com sucesso!');
  } catch (error) {
    showClientPhotoMessage(error.message || 'Não foi possível salvar a foto.', 'error');
  } finally {
    setClientPhotoLoading(false);
  }
}

async function removeClientPhoto() {
  if (!currentAccountProfile?.avatar_url || !confirm('Remover sua foto de perfil?')) return;
  try {
    setClientPhotoLoading(true);
    showClientPhotoMessage('Removendo sua foto...');
    const previousPath = currentAccountProfile.avatar_storage_path;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null, avatar_storage_path: null })
      .eq('id', currentSession.user.id);
    if (error) throw error;
    if (previousPath) await supabase.storage.from('professional-media').remove([previousPath]);
    currentAccountProfile = { ...currentAccountProfile, avatar_url: null, avatar_storage_path: null };
    renderClientPhoto(currentAccountProfile);
    showClientPhotoMessage('Foto removida.');
  } catch (error) {
    showClientPhotoMessage(error.message || 'Não foi possível remover a foto.', 'error');
  } finally {
    setClientPhotoLoading(false);
  }
}

document.getElementById('client-photo-file').addEventListener('change', event => {
  const file = event.target.files[0];
  showClientPhotoMessage('');
  if (!file) return renderClientPhoto(currentAccountProfile);
  try {
    validateImageFile(file);
    if (clientPreviewUrl) URL.revokeObjectURL(clientPreviewUrl);
    clientPreviewUrl = URL.createObjectURL(file);
    renderClientPhoto(currentAccountProfile, clientPreviewUrl);
  } catch (error) {
    event.target.value = '';
    showClientPhotoMessage(error.message, 'error');
  }
});
document.getElementById('save-client-photo').addEventListener('click', saveClientPhoto);
document.getElementById('remove-client-photo').addEventListener('click', removeClientPhoto);

async function configureProfessionalSignup() {
  const oldPrice = document.getElementById('price-range');
  const priceField = oldPrice.closest('.field');
  const priceLabel = document.createElement('label');
  priceLabel.htmlFor = 'starting-price';
  priceLabel.textContent = 'Valor inicial do serviço';
  const priceInput = document.createElement('input');
  priceInput.id = 'starting-price';
  priceInput.name = 'starting_price';
  priceInput.type = 'number';
  priceInput.min = '1';
  priceInput.step = '0.01';
  priceInput.inputMode = 'decimal';
  priceInput.placeholder = 'Ex.: 180,00';
  const priceHelp = document.createElement('small');
  priceHelp.textContent = 'Depois você poderá definir um valor diferente para cada categoria.';
  priceField.replaceChildren(priceLabel, priceInput, priceHelp);

  const proposal = document.createElement('label');
  proposal.className = 'terms proposal-choice';
  const proposalInput = document.createElement('input');
  proposalInput.type = 'checkbox';
  proposalInput.name = 'accepts_proposals';
  const proposalText = document.createElement('span');
  proposalText.textContent = 'Aceito receber propostas de valores dos contratantes.';
  proposal.append(proposalInput, proposalText);
  priceField.after(proposal);

  const target = professionalFields.querySelector('.category-options');
  target.textContent = 'Carregando categorias...';
  const { data, error } = await supabase.from('categories').select('name, slug').eq('active', true).order('sort_order');
  if (error) return showMessage('Não foi possível carregar as categorias agora.', 'error');
  target.replaceChildren(...data.map(category => {
    const label = document.createElement('label');
    label.className = 'category-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'categories';
    input.value = category.slug;
    label.append(input, document.createTextNode(category.name));
    return label;
  }));
}

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
  if (/email not confirmed/i.test(text)) return 'O acesso imediato ainda não foi ativado nas configurações do sistema.';
  return text;
}

function setLoading(form, loading) {
  const submit = form.querySelector('[type="submit"]');
  if (loading) submit.dataset.originalText = submit.textContent;
  submit.disabled = loading;
  submit.textContent = loading ? 'Aguarde...' : submit.dataset.originalText;
}

function setView(view) {
  clearMessage();
  accountView.hidden = true;
  document.querySelector('.auth-tabs').hidden = false;
  loginForm.hidden = view !== 'login';
  signupForm.hidden = view !== 'signup';
  recoveryForm.hidden = view !== 'recovery';
  resetForm.hidden = view !== 'reset';
  tabs.forEach(tab => {
    const active = tab.dataset.authTab === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  if (view === 'login') {
    authTitle.textContent = 'Entre na sua conta';
    authSubtitle.textContent = 'Acesse seu cadastro de contratante ou profissional.';
  }
  if (view === 'recovery') {
    document.querySelector('.auth-tabs').hidden = true;
    authTitle.textContent = 'Recuperar sua senha';
    authSubtitle.textContent = 'Enviaremos um link seguro para o e-mail da sua conta.';
  }
  if (view === 'reset') {
    document.querySelector('.auth-tabs').hidden = true;
    authTitle.textContent = 'Crie uma nova senha';
    authSubtitle.textContent = 'Use pelo menos 8 caracteres para proteger sua conta.';
  }
}

function setRole(role) {
  const input = signupForm.querySelector(`input[name="role"][value="${role}"]`);
  if (input) input.checked = true;
  professionalFields.hidden = role !== 'professional';
  professionalFields.querySelectorAll('textarea').forEach(field => field.required = role === 'professional');
  const startingPrice = document.getElementById('starting-price');
  if (startingPrice) startingPrice.required = role === 'professional';
  signupForm.querySelector('.auth-submit').textContent = role === 'professional'
    ? 'Enviar cadastro profissional'
    : 'Criar cadastro de contratante';
}

function unlockRoleChoice() {
  roleChoice.hidden = false;
  roleNote.hidden = true;
  authTitle.textContent = 'Crie sua conta';
  authSubtitle.textContent = 'Escolha como você quer usar a ReadyStaff e preencha seus dados.';
}

function lockRoleChoice(role) {
  setRole(role);
  roleChoice.hidden = true;
  roleNote.hidden = false;
  const professional = role === 'professional';
  authTitle.textContent = professional ? 'Cadastro profissional' : 'Cadastro de contratante';
  authSubtitle.textContent = professional
    ? 'Apresente seu trabalho, escolha suas categorias e publique seu perfil.'
    : 'Crie sua conta para encontrar profissionais e organizar seu evento.';
  roleNoteText.textContent = professional ? 'Você está criando um perfil profissional' : 'Você está criando uma conta de contratante';
}

function markEntrySeen() {
  try { sessionStorage.setItem('readystaff-entry-seen', 'true'); } catch (_error) { /* Navegação privada pode bloquear o armazenamento. */ }
}

function hasSeenEntry() {
  try { return sessionStorage.getItem('readystaff-entry-seen') === 'true'; } catch (_error) { return false; }
}

function openEntry() {
  if (modal.open) modal.close();
  if (!entryModal.open) entryModal.showModal();
}

async function showAccount(session) {
  currentSession = session;
  authTitle.textContent = 'Minha conta';
  authSubtitle.textContent = 'Acompanhe seu cadastro e as novidades da ReadyStaff.';
  document.querySelector('.auth-tabs').hidden = true;
  loginForm.hidden = true;
  signupForm.hidden = true;
  recoveryForm.hidden = true;
  resetForm.hidden = true;
  accountView.hidden = false;
  clearMessage();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role, city, state, avatar_url, avatar_storage_path')
    .eq('id', session.user.id)
    .single();

  if (error) {
    showMessage('Sua conta está ativa, mas não foi possível carregar o perfil agora.', 'error');
    return;
  }

  document.getElementById('account-name').textContent = profile.full_name || session.user.email;
  currentAccountProfile = profile;
  document.getElementById('account-role').textContent = profile.role === 'professional' ? 'Profissional' : 'Cliente';
  document.getElementById('account-copy').textContent = profile.role === 'professional'
    ? `Perfil profissional de ${profile.city || 'sua cidade'}${profile.state ? `/${profile.state}` : ''}.`
    : 'Sua conta de cliente está pronta para acompanhar a evolução da ReadyStaff.';

  const statusRow = document.getElementById('account-status-row');
  const profileLink = document.getElementById('account-profile-link');
  if (profile.role === 'professional') {
    clientPhotoEditor.hidden = true;
    const { data: professional } = await supabase
      .from('professional_profiles')
      .select('status')
      .eq('id', session.user.id)
      .maybeSingle();
    const statusLabels = { pending: 'Publicado', approved: 'Publicado', rejected: 'Revisão necessária', suspended: 'Suspenso' };
    document.getElementById('account-status').textContent = statusLabels[professional?.status] || 'Publicado';
    statusRow.hidden = false;
    profileLink.hidden = false;
  } else {
    statusRow.hidden = true;
    profileLink.hidden = true;
    clientPhotoEditor.hidden = false;
    renderClientPhoto(profile);
  }

  headerButton.textContent = 'Minha conta';
}

async function openAuth(role) {
  if (entryModal.open) entryModal.close();
  if (!modal.open) modal.showModal();
  if (currentSession) {
    await showAccount(currentSession);
    return;
  }
  setView(role ? 'signup' : 'login');
  if (role) lockRoleChoice(role);
}

document.querySelectorAll('[data-open-auth]').forEach(button => {
  button.addEventListener('click', () => openAuth(button.dataset.role));
});

document.getElementById('close-auth').addEventListener('click', () => modal.close());
tabs.forEach(tab => tab.addEventListener('click', () => {
  setView(tab.dataset.authTab);
  if (tab.dataset.authTab === 'signup') unlockRoleChoice();
}));
signupForm.querySelectorAll('input[name="role"]').forEach(input => {
  input.addEventListener('change', () => setRole(input.value));
});
document.querySelectorAll('[data-entry-role]').forEach(button => {
  button.addEventListener('click', () => {
    markEntrySeen();
    openAuth(button.dataset.entryRole);
  });
});
document.getElementById('entry-login').addEventListener('click', () => {
  markEntrySeen();
  openAuth();
});
document.getElementById('entry-explore').addEventListener('click', () => {
  markEntrySeen();
  entryModal.close();
});
roleSwitch.addEventListener('click', openEntry);

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

forgotPassword.addEventListener('click', () => {
  document.getElementById('recovery-email').value = document.getElementById('login-email').value;
  setView('recovery');
});
recoveryForm.querySelector('[data-back-login]').addEventListener('click', () => setView('login'));
recoveryForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  setLoading(recoveryForm, true);
  const email = String(new FormData(recoveryForm).get('email')).trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/?reset=1` });
  setLoading(recoveryForm, false);
  if (error) return showMessage(translateError(error), 'error');
  showMessage('Se esse e-mail estiver cadastrado, você receberá o link para criar uma nova senha.', 'success');
});
resetForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  const data = new FormData(resetForm);
  const password = String(data.get('password'));
  if (password !== String(data.get('confirmation'))) return showMessage('As duas senhas precisam ser iguais.', 'error');
  setLoading(resetForm, true);
  const { error } = await supabase.auth.updateUser({ password });
  setLoading(resetForm, false);
  if (error) return showMessage(translateError(error), 'error');
  history.replaceState({}, '', location.pathname);
  resetForm.reset();
  showMessage('Senha alterada com sucesso! Sua conta já está conectada.', 'success');
  const { data: { session: updatedSession } } = await supabase.auth.getSession();
  if (updatedSession) setTimeout(() => showAccount(updatedSession), 900);
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
    starting_price: role === 'professional' ? Number(form.get('starting_price') || 0).toFixed(2) : '',
    accepts_proposals: role === 'professional' && form.get('accepts_proposals') === 'on'
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
    unlockRoleChoice();
    return showAccount(data.session);
  }

  signupForm.reset();
  setRole('client');
  unlockRoleChoice();
  setView('login');
  showMessage('Cadastro criado! Entre com seu e-mail e senha.', 'success');
});

document.getElementById('sign-out').addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentSession = null;
  currentAccountProfile = null;
  clientPhotoEditor.hidden = true;
  headerButton.textContent = 'Entrar / cadastrar';
  setView('login');
  showMessage('Você saiu da sua conta.', 'success');
});

const { data: { session } } = await supabase.auth.getSession();
configureProfessionalSignup();
currentSession = session;
if (session) headerButton.textContent = 'Minha conta';
if (new URLSearchParams(location.search).get('reset') === '1') {
  if (!modal.open) modal.showModal();
  setView('reset');
} else if (!session && !hasSeenEntry()) setTimeout(openEntry, 250);

supabase.auth.onAuthStateChange((event, sessionValue) => {
  currentSession = sessionValue;
  headerButton.textContent = sessionValue ? 'Minha conta' : 'Entrar / cadastrar';
  if (event === 'PASSWORD_RECOVERY') {
    if (!modal.open) modal.showModal();
    setView('reset');
  } else if (sessionValue && modal.open && !new URLSearchParams(location.search).has('reset')) {
    setTimeout(() => showAccount(sessionValue), 0);
  }
});
