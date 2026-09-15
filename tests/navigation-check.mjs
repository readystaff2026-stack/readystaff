import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const pages = readdirSync(root).filter(path => path.endsWith('.html'));
for (const path of pages) {
  const html = read(path);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${path}: duplicate ID`);
  assert.match(html, /<html lang="pt-BR"/);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(https?:|data:|mailto:|tel:)/.test(value)) continue;
    const url = new URL(value, `https://readystaff.site/${path}`);
    let target = url.pathname.slice(1) || 'index.html';
    if (!existsSync(resolve(root, target)) && existsSync(resolve(root, `${target}.html`))) target += '.html';
    assert.ok(existsSync(resolve(root, target)), `${path}: missing target ${value}`);
    if (url.hash && target.endsWith('.html')) {
      assert.ok(read(target).includes(`id="${url.hash.slice(1)}"`), `${path}: missing anchor ${value}`);
    }
  }
}
const home = read('index.html');
const main = home.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
assert.doesNotMatch(main, /id="cards"|id="talent-cards"|category-image|talent-card/);
assert.match(main, /assets\/event-team\.webp/);
assert.doesNotMatch(home, /src="(?:app|professionals)\.js/);
assert.match(main, /data-role="client"/);
assert.match(main, /data-role="professional"/);
assert.doesNotMatch(pages.map(read).join(''), /Plataforma em preparação|Como vai funcionar|A ReadyStaff está chegando/);
for (const page of ['index.html', 'encontrar.html']) {
  const html = read(page);
  for (const id of ['auth-modal','entry-modal','login-form','signup-form','account-view','auth-message','professional-fields','open-auth','auth-title','auth-subtitle','account-name','account-role','account-copy','account-status-row','account-status','account-profile-link','close-auth','entry-login','entry-explore','sign-out','price-range']) {
    assert.ok(html.includes(`id="${id}"`), `${page}: missing auth hook ${id}`);
  }
  assert.match(html, /href="termos.html" target="_blank"/);
  assert.match(html, /href="privacidade.html" target="_blank"/);
}

// Exercise the real catalog filter with synthetic data; no account or API writes.
const elements = {};
const context = vm.createContext({
  Intl, URL, console,
  document: { getElementById: id => elements[id] ||= { value: '', textContent: '', removeAttribute(name) { delete this[name]; } } }
});
const source = read('professionals.js').replace(/^import .*;\n/, '').split("document.addEventListener('readystaff:search'")[0];
vm.runInContext(source, context);
vm.runInContext(`professionals = [
  { id: 'a', city: 'Brasília', state: 'DF', professional_categories: [{ price: 200, accepts_proposals: false, categories: { slug: 'garcom' } }] },
  { id: 'b', city: 'Brasília', state: 'DF', professional_categories: [{ price: 500, accepts_proposals: true, categories: { slug: 'garcom' } }] },
  { id: 'c', city: 'Goiânia', state: 'GO', professional_categories: [{ price: 150, accepts_proposals: false, categories: { slug: 'cozinheiro' } }] }
];`, context);
elements.service.value = 'garcom';
elements.budget.value = '220';
elements['city-filter'].value = 'brasilia';
assert.equal(vm.runInContext('matchingProfessionals().length', context), 2, 'Proposal-enabled profile remains available');
elements['city-filter'].value = 'goiania';
assert.equal(vm.runInContext('matchingProfessionals().length', context), 0, 'City filter respects selected category');
elements.service.value = 'cozinheiro';
assert.equal(vm.runInContext('matchingProfessionals()[0].id', context), 'c', 'City search ignores accents');
vm.runInContext('updateMinimum()', context);
assert.equal(elements.budget.min, '150', 'Minimum follows category price');
elements.service.value = 'sem-perfis';
vm.runInContext('updateMinimum()', context);
assert.equal(elements.budget.min, undefined, 'Empty category clears minimum');

// Upload regression: images that fit the bucket never require browser decoding.
const imageSource = read('image-utils.js').replaceAll('export ', '');
vm.runInContext(imageSource, context);
const file = { name: 'foto.png', type: 'image/png', size: 5242880 };
context.testImage = file;
assert.equal(await vm.runInContext('optimizeImage(testImage)', context), file);
assert.equal(vm.runInContext('imageExtension(testImage)', context), 'png');
console.log(`PASS: ${pages.length} pages, local links and anchors, auth hooks, homepage separation, category/city/budget filters, image upload regression.`);
