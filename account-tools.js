import { supabase } from './supabase-client.js';
import { todayInBrazil } from './workflow.js?v=20260916-2';
const el = (tag, copy = '') => { const node = document.createElement(tag); node.textContent = copy; return node; };
export async function initAccountTools(user, role, profile) {
  const target = document.getElementById('account-tools'); target.replaceChildren();
  if (user.app_metadata?.readystaff_admin === true) {
    const link = el('a', 'Abrir administração'); link.href = 'admin.html'; link.className = 'button secondary'; target.append(link);
  }
  if (role !== 'professional') {
    const link = el('a', '♥ Meus profissionais favoritos'); link.href = 'encontrar.html?favoritos=1'; link.className = 'button secondary'; target.append(link); return;
  }
  const offers = profile?.professional_categories || [];
  const checklist = [
    ['Nome profissional', Boolean(profile?.display_name)],
    ['Apresentação com pelo menos 50 caracteres', String(profile?.bio || '').trim().length >= 50],
    ['Categorias de atuação', offers.length > 0],
    ['Valores definidos em todas as categorias', offers.length > 0 && offers.every(offer => Number(offer.price)>0)],
    ['WhatsApp de contato', Boolean(profile?.whatsapp)],
    ['Região de atendimento e disponibilidade', Boolean(profile?.availability)]
  ];
  const complete = checklist.filter(item => item[1]).length;
  const guide = el('section'); guide.className = 'profile-checklist';
  guide.append(el('h2', `Sua apresentação: ${complete} de ${checklist.length} itens preenchidos`),el('p','Seu perfil já pode receber pedidos. Estas sugestões ajudam os clientes a conhecer seu trabalho.'));
  const progress = el('progress'); progress.max = checklist.length; progress.value = complete; progress.setAttribute('aria-label','Preenchimento das informações do perfil'); guide.append(progress);
  const list = el('ul'); checklist.forEach(([name,done]) => list.append(el('li',`${done ? '✓' : '○'} ${name}`))); guide.append(list);
  guide.append(el('p','Fotos de perfil e portfólio continuam opcionais. Se quiser, use imagens do seu trabalho para enriquecer a apresentação.'));
  const edit = el('a','Melhorar meu perfil'); edit.href='perfil.html?me=1'; edit.className='button secondary'; guide.append(edit); target.append(guide);
  const panel = el('section'); panel.className='availability-panel';
  panel.append(el('h2','Minha agenda: datas indisponíveis'),el('p','Marque os dias em que você não pode atender. A busca oculta seu perfil para essas datas. Não marcar um bloqueio não confirma uma contratação.'));
  const dates = el('div'); const feedback = el('p'); feedback.setAttribute('role','status');
  async function load() {
    const { data,error } = await supabase.from('professional_unavailability').select('id,starts_on,ends_on').eq('professional_id',user.id).gte('ends_on',todayInBrazil()).order('starts_on');
    if(error){feedback.textContent='Não foi possível carregar sua agenda.';return;}
    dates.replaceChildren();
    if(!data?.length) dates.append(el('p','Você não informou datas indisponíveis.'));
    for(const date of data || []) {
      const row=el('div');row.className='blocked-date';
      row.append(el('span',`${new Date(date.starts_on+'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(date.ends_on+'T12:00:00').toLocaleDateString('pt-BR')}`));
      const remove=el('button','Liberar datas');remove.type='button';remove.className='button secondary';
      remove.addEventListener('click',async()=>{remove.disabled=true;const {error}=await supabase.from('professional_unavailability').delete().eq('id',date.id).eq('professional_id',user.id);if(error){remove.disabled=false;feedback.textContent='Não foi possível liberar as datas.';return;}await load();});row.append(remove);dates.append(row);
    }
  }
  const form=el('form');form.className='availability-form';
  const from=el('input'),to=el('input');from.type=to.type='date';from.required=to.required=true;from.min=to.min=todayInBrazil();
  const start=el('label','De'),end=el('label','Até');start.append(from);end.append(to);
  from.addEventListener('change',()=>{to.min=from.value||todayInBrazil();if(to.value<from.value)to.value=from.value;});
  const save=el('button','Bloquear estas datas');save.type='submit';save.className='button secondary';form.append(start,end,save);
  form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;const {error}=await supabase.from('professional_unavailability').insert({professional_id:user.id,starts_on:from.value,ends_on:to.value});save.disabled=false;if(error){feedback.textContent='Não foi possível salvar. Confira as datas; o período máximo é de 366 dias.';return;}form.reset();feedback.textContent='Datas bloqueadas.';await load();});
  panel.append(dates,form,feedback);target.append(panel);await load();
}
