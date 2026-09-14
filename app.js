'use strict';
const services = [
 ['Garçom e garçonete','Atendimento aos convidados, serviço de mesas e apoio durante a recepção.'],
 ['Barman','Preparo de bebidas e coquetéis para acompanhar cada celebração.'],
 ['Segurança','Profissionais de segurança para eventos, com requisitos de qualificação a verificar na contratação.'],
 ['Recepção','Boas-vindas, orientação de convidados e organização da entrada.'],
 ['DJ','Seleção musical para dar o ritmo da festa e da pista de dança.'],
 ['Bandas e música','Apresentações ao vivo para cerimônias, festas e encontros.'],
 ['Buffet','Gastronomia e opções de alimentação para diferentes formatos de evento.'],
 ['Copeiro e apoio','Organização de utensílios e apoio à equipe de atendimento.']
];
const cards = document.getElementById('cards');
const service = document.getElementById('service');
const term = document.getElementById('term');
const modal = document.getElementById('details');
const norm = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function render() {
 cards.replaceChildren();
 const selected = services.filter(([name,copy]) => (!service.value || name === service.value) && norm(name+' '+copy).includes(norm(term.value)));
 selected.forEach(([name,copy]) => {
  const index = services.findIndex(item=>item[0]===name);
  const card = document.createElement('article'); card.className='card';
  const image = document.createElement('div'); image.className='card-image i'+index; image.setAttribute('role','img'); image.setAttribute('aria-label','Imagem ilustrativa de '+name);
  const body = document.createElement('div'); body.className='card-body';
  const number = document.createElement('span'); number.className='number'; number.textContent=String(index+1).padStart(2,'0'); number.setAttribute('aria-hidden','true');
  const title = document.createElement('h3'); title.textContent=name;
  const text = document.createElement('p'); text.textContent=copy;
  const button = document.createElement('button'); button.type='button'; button.textContent='Conhecer serviço'; button.setAttribute('aria-label','Conhecer serviço: '+name);
  button.addEventListener('click',()=>{document.getElementById('detail-title').textContent=name; document.getElementById('detail-copy').textContent=copy; modal.showModal();});
  image.append(number); body.append(title,text,button); card.append(image,body); cards.append(card);
 });
 document.getElementById('count').textContent=selected.length+' de '+services.length+' categorias';
 document.getElementById('empty').hidden=selected.length!==0;
}
document.getElementById('search').addEventListener('submit',event=>{event.preventDefault();render();document.getElementById('servicos').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
service.addEventListener('change',render);
term.addEventListener('input',render);
document.getElementById('reset').addEventListener('click',()=>{service.value='';term.value='';render();term.focus();});
document.getElementById('close').addEventListener('click',()=>modal.close());
modal.setAttribute('aria-labelledby','detail-title');
render();
