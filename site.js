'use strict';
// Navigation only: no session, profile, or storage mutations.
document.documentElement.classList.add('js-nav');
const menu = document.querySelector('.menu-toggle');
const navigation = document.getElementById('primary-nav');
if (menu && navigation) {
  const close = () => { navigation.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => {
    const opened = menu.getAttribute('aria-expanded') !== 'true';
    navigation.classList.toggle('is-open', opened);
    menu.setAttribute('aria-expanded', String(opened));
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a,button')) close(); });
  document.addEventListener('click', event => { if (!event.target.closest('.rs-header')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { close(); menu.focus(); } });
}
const currentPage = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/index';
document.querySelectorAll('.rs-header a,.mobile-dock a').forEach(link => {
  const url = new URL(link.href, location.href);
  if (url.search) return;
  const page = url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/index';
  if (page === currentPage) link.setAttribute('aria-current', 'page');
});
// Preserve previously shared catalog links after the homepage separation.
if (document.body.classList.contains('rs-home') && ['#servicos', '#talentos'].includes(location.hash)) {
  location.replace(`encontrar.html${location.hash}`);
}
