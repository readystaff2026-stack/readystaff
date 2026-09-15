'use strict';

const services = [
  { name: 'Garçom', slug: 'garcom', copy: 'Atendimento de salão, serviço de mesas e apoio aos convidados durante o evento.' },
  { name: 'Garçonete', slug: 'garconete', copy: 'Atendimento de salão, serviço de mesas e cuidado com os convidados.' },
  { name: 'Recepcionista', slug: 'recepcionista', copy: 'Recepção, orientação e atendimento ao público em diferentes ocasiões.' },
  { name: 'Bartender', slug: 'bartender', copy: 'Criação e preparo de coquetéis, drinks e experiências de bar.' },
  { name: 'Barman', slug: 'barman', copy: 'Serviço de bar, organização de bebidas e atendimento aos convidados.' },
  { name: 'Auxiliar de cozinha', slug: 'auxiliar-de-cozinha', copy: 'Apoio no pré-preparo, organização e rotina operacional da cozinha.' },
  { name: 'Copeiro', slug: 'copeiro', copy: 'Organização de louças, bebidas, copa e suporte ao serviço do evento.' },
  { name: 'Cozinheiro', slug: 'cozinheiro', copy: 'Preparo de refeições e execução de cardápios para eventos.' },
  { name: 'Promotor', slug: 'promotor', copy: 'Abordagem, divulgação, ativação de marca e relacionamento com o público.' },
  { name: 'Segurança', slug: 'seguranca', copy: 'Controle de acesso, orientação e proteção do público e da operação.' },
  { name: 'Auxiliar de Limpeza', slug: 'auxiliar-de-limpeza', copy: 'Limpeza, conservação e organização antes, durante e após o evento.' },
  { name: 'Fotógrafo', slug: 'fotografo', copy: 'Cobertura fotográfica de eventos, convidados, ambientes e momentos especiais.' },
  { name: 'Cerimonialista', slug: 'cerimonialista', copy: 'Planejamento do cerimonial, protocolo e coordenação dos momentos do evento.' },
  { name: 'Produtor de eventos', slug: 'produtor-de-eventos', copy: 'Planejamento, fornecedores, cronograma e coordenação geral do evento.' },
  { name: 'Churrasqueiro', slug: 'churrasqueiro', copy: 'Preparo de carnes, acompanhamentos e operação de churrasco no local.' },
  { name: 'Brigadista', slug: 'brigadista', copy: 'Prevenção, primeiros atendimentos e apoio à segurança contra emergências.' },
  { name: 'Videomaker', slug: 'videomaker', copy: 'Captação e produção de vídeos profissionais para eventos e celebrações.' },
  { name: 'Recepcionista de eventos', slug: 'recepcionista-de-eventos', copy: 'Credenciamento, lista de convidados e recepção especializada em eventos.' },
  { name: 'Confeiteiro', slug: 'confeiteiro', copy: 'Bolos, doces e sobremesas personalizadas para festas e eventos.' },
  { name: 'Salgadeiro', slug: 'salgadeiro', copy: 'Produção e serviço de salgados, petiscos e opções para recepções.' },
  { name: 'Barista', slug: 'barista', copy: 'Preparo de cafés e bebidas especiais para experiências e eventos.' }
];

const cards = document.getElementById('cards');
const service = document.getElementById('service');
const term = document.getElementById('term');
const modal = document.getElementById('details');
const categoryButton = document.createElement('button');
categoryButton.id = 'view-category-professionals';
categoryButton.className = 'button teal';
categoryButton.type = 'button';
categoryButton.textContent = 'Buscar profissionais desta categoria';
modal.append(categoryButton);
const norm = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const moreCategories = document.getElementById('more-categories');
let showAllCategories = false;

services.forEach(item => {
  const option = document.createElement('option');
  option.value = item.slug;
  option.textContent = item.name;
  service.append(option);
});

function imagePosition(index) {
  const column = index % 7;
  const row = Math.floor(index / 7);
  return `${column * (100 / 6)}% ${row * 50}%`;
}

function openCategory(item) {
  document.getElementById('detail-title').textContent = item.name;
  document.getElementById('detail-copy').textContent = item.copy;
  categoryButton.dataset.category = item.slug;
  modal.showModal();
}

function render() {
  cards.replaceChildren();
  const selected = services.filter(item => (!service.value || item.slug === service.value) && norm(`${item.name} ${item.copy}`).includes(norm(term.value)));
  const limited = !showAllCategories && !service.value && !term.value;
  (limited ? selected.slice(0, 6) : selected).forEach(item => {
    const index = services.indexOf(item);
    const card = document.createElement('article');
    card.className = 'card';
    const body = document.createElement('div');
    body.className = 'card-body';
    const number = document.createElement('span');
    number.className = 'number';
    number.textContent = String(index + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h3');
    title.textContent = item.name;
    const text = document.createElement('p');
    text.textContent = item.copy;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Ver profissionais';
    button.setAttribute('aria-label', `Ver profissionais: ${item.name}`);
    button.addEventListener('click', () => openCategory(item));
    body.append(title, text, button);
    card.append(body);
    cards.append(card);
  });
  document.getElementById('count').textContent = `${selected.length} de ${services.length} categorias`;
  document.getElementById('empty').hidden = selected.length !== 0;
  if (moreCategories) {
    moreCategories.hidden = Boolean(service.value || term.value || selected.length <= 6);
    moreCategories.textContent = showAllCategories ? 'Mostrar menos categorias' : `Ver todas as ${services.length} categorias`;
    moreCategories.setAttribute('aria-expanded', String(showAllCategories));
  }
}

document.getElementById('search').addEventListener('submit', event => {
  event.preventDefault();
  render();
  document.dispatchEvent(new CustomEvent('readystaff:search'));
  const talents = document.getElementById('talentos');
  (talents.hidden ? document.getElementById('access-gate') : talents).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
service.addEventListener('change', () => {
  render();
  document.dispatchEvent(new CustomEvent('readystaff:filters-changed'));
});
term.addEventListener('input', render);
document.getElementById('reset').addEventListener('click', () => {
  service.value = '';
  term.value = '';
  document.getElementById('budget').value = '';
  document.getElementById('city-filter').value = '';
  showAllCategories = false;
  render();
  document.dispatchEvent(new CustomEvent('readystaff:filters-changed'));
  term.focus();
});
document.getElementById('close').addEventListener('click', () => modal.close());
categoryButton.addEventListener('click', () => {
  service.value = categoryButton.dataset.category;
  modal.close();
  document.getElementById('search').requestSubmit();
});
modal.setAttribute('aria-labelledby', 'detail-title');
modal.querySelector('p:last-of-type').textContent = 'Escolha esta categoria para comparar profissionais, valores e disponibilidade.';
moreCategories?.addEventListener('click', () => {
  showAllCategories = !showAllCategories;
  render();
  if (!showAllCategories) document.getElementById('servicos').scrollIntoView({ behavior: 'auto' });
});
render();
