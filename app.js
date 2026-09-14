'use strict';
const services = [
 ['Garçons e atendimento','Serviço de salão, atendimento aos convidados e apoio durante toda a recepção.'],
 ['Bartenders e coquetelaria','Drinks, coquetéis e serviço de bar preparados para o estilo do seu evento.'],
 ['Segurança de eventos','Controle de acesso, orientação do público e suporte à operação do evento.'],
 ['Recepção e credenciamento','Boas-vindas, confirmação de convidados, credenciamento e organização da entrada.'],
 ['DJs e sonorização','Seleção musical, pista de dança e soluções de som para cada momento da festa.'],
 ['Bandas e música ao vivo','Apresentações para cerimônias, recepções, festas e encontros corporativos.'],
 ['Buffet e gastronomia','Cardápios, serviço de alimentação e experiências gastronômicas para diferentes formatos.'],
 ['Produção e apoio','Montagem, organização, copa e suporte operacional antes, durante e após o evento.']
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
