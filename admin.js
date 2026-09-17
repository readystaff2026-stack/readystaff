import { supabase } from './supabase-client.js';
const el=(tag,copy='')=>{const node=document.createElement(tag);node.textContent=copy;return node;};
const feedback=document.getElementById('admin-message');
const date=value=>new Date(value).toLocaleString('pt-BR');
const roles={client:'Contratante',professional:'Profissional',admin:'Administrador'};
async function list(table,fields,targetId,describe,actions) {
  const target=document.getElementById(targetId);let offset=0;
  const more=el('button','Carregar mais');more.type='button';more.className='button secondary';
  async function load() {
    more.disabled=true;
    const {data,error}=await supabase.from(table).select(fields).order('created_at',{ascending:false}).range(offset,offset+49);
    if(error){target.append(el('p','Não foi possível carregar esta seção.'));more.disabled=false;return;}
    more.remove();
    if(!data?.length && !offset)target.append(el('p','Nenhum registro nesta seção.'));
    for(const item of data||[]){const card=el('article');card.className='admin-item';for(const text of describe(item))card.append(el('p',text));if(actions)actions(item,card);target.append(card);}
    offset+=(data||[]).length; if(data?.length===50)target.append(more);more.disabled=false;
  }
  more.addEventListener('click',load);await load();
}
async function start(){
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user||user.app_metadata?.readystaff_admin!==true){feedback.textContent='Esta área está disponível apenas para administradores autorizados. Ter uma conta de profissional ou contratante não concede acesso administrativo.';return;}
  document.getElementById('admin-content').hidden=false;feedback.textContent='Acesso administrativo confirmado. Não compartilhe dados pessoais obtidos neste painel.';
  const settings=el('section');settings.className='admin-item';settings.append(el('h2','Configuração dos avisos'));
  const statusCopy=el('p','Consultando a configuração de envio...');settings.append(statusCopy);document.getElementById('admin-content').prepend(settings);
  const {data:deliveryStatus,error:deliveryError}=await supabase.functions.invoke('process-notifications',{body:{operation:'status'}});
  statusCopy.textContent=deliveryError?'Não foi possível consultar a configuração.':`E-mail: ${deliveryStatus?.email_configured?'configurado':'configuração pendente'}.`;
  settings.append(el('p','Os avisos respeitam as preferências do destinatário e são tentados após as ações no site. Falhas ficam registradas para novas tentativas ao usar o painel; não há rotina agendada de reenvio independente. “sent” significa aceito pela API de envio, não confirmação de entrega ou leitura.'));
  const stats=document.getElementById('admin-stats');
  for(const [table,label] of [['profiles','Contas cadastradas'],['reviews','Avaliações'],['quote_reports','Relatos registrados']]){
    const {count,error}=await supabase.from(table).select('id',{count:'exact',head:true});const card=el('article');card.append(el('strong',error?'—':String(count||0)),el('span',label));stats.append(card);
  }
  await Promise.all([
    list('profiles','id,full_name,role,city,state,created_at','users-list',item=>[`${item.full_name} — ${roles[item.role]||item.role}`,[item.city,item.state].filter(Boolean).join(' / '),`Cadastro: ${date(item.created_at)}`]),
    list('reviews','id,rating,comment,quote_id,created_at','reviews-list',item=>[`${item.rating} de 5 estrelas`,item.comment||'Sem comentário.',`Pedido: ${item.quote_id} · ${date(item.created_at)}`]),
    list('quote_reports','id,quote_id,reason,status,created_at','reports-list',item=>[item.reason,`Pedido: ${item.quote_id}`,`${item.status==='open'?'Aguardando análise':'Triagem registrada'} · ${date(item.created_at)}`],(item,card)=>{
      if(item.status!=='open')return;const button=el('button','Marcar relato como analisado');button.type='button';button.className='button secondary';button.addEventListener('click',async()=>{button.disabled=true;const {data,error}=await supabase.from('quote_reports').update({status:'resolved'}).eq('id',item.id).select('id');if(error||!data?.length){button.disabled=false;button.textContent='Não foi possível atualizar. Tentar novamente';return;}button.textContent='Triagem registrada';});card.append(button);
    }),
    list('notification_outbox','id,event_type,status,attempt_count,last_error,created_at','notifications-list',item=>[`${item.event_type} — ${item.status}`,`Tentativas: ${item.attempt_count} (até 5 antes de intervenção)`,item.last_error||'Sem erro informado.',date(item.created_at)],(item,card)=>{
      if(!['failed','configuration_pending'].includes(item.status))return;
      const button=el('button','Tentar enviar este aviso novamente');button.type='button';button.className='button secondary';
      button.addEventListener('click',async()=>{button.disabled=true;const {data,error}=await supabase.functions.invoke('process-notifications',{body:{operation:'retry',notification_id:item.id}});if(error||!data?.queued){button.disabled=false;button.textContent='Não foi possível solicitar. Atualize o painel';return;}button.textContent='Nova tentativa solicitada. Atualize para conferir o resultado.';});card.append(button);
    })
  ]);
}
start().catch(()=>{feedback.textContent='Não foi possível abrir a administração. Entre novamente e tente atualizar.';});
