import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sitemap=read('sitemap.xml');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.equal(urls.length,7);assert.equal(new Set(urls).size,7);
for(const url of urls){
  const path=new URL(url).pathname;const file=path==='/'?'index.html':path.slice(1)+'.html';
  assert.ok(existsSync(new URL('../'+file,import.meta.url)));
  const html=read(file);assert.ok(html.includes(`rel="canonical" href="${url}"`));
  assert.doesNotMatch(html,/<meta name="robots" content="[^\"]*noindex/);
  const blocks=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length);for(const block of blocks)assert.equal(JSON.parse(block[1])['@context'],'https://schema.org');
}
for(const file of ['admin.html','painel.html','perfil.html'])assert.match(read(file),/<meta name="robots" content="noindex/);
for(const url of urls)assert.doesNotMatch(url,/admin|painel|perfil|\?/);
assert.match(read('robots.txt'),/Sitemap: https:\/\/readystaff.site\/sitemap.xml/);
assert.doesNotMatch(read('robots.txt'),/^Disallow:.*(?:admin|painel|perfil)/m);
const service=read('servicos.html');
const catalog=[...read('app.js').matchAll(/\{ name: '([^']+)', slug: '([^']+)', copy: '([^']+)' \}/g)];
assert.equal(catalog.length,22);
assert.equal(new Set(catalog.map(item=>item[2])).size,22);
assert.equal([...service.matchAll(/<article id="/g)].length,catalog.length);
const list=JSON.parse(service.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).mainEntity.itemListElement;
assert.equal(list.length,catalog.length);
for(const [index,item] of catalog.entries()){
  assert.ok(service.includes(`<article id="${item[2]}"><h3>${item[1]}</h3><p>${item[3]}</p>`));
  assert.ok(service.includes(`href="#${item[2]}"`));
  assert.deepEqual(list[index],{'@type':'ListItem',position:index+1,name:item[1],url:`https://readystaff.site/servicos#${item[2]}`});
}
assert.ok(read('index.html').includes('href="servicos.html"'));
assert.doesNotMatch(service,/AggregateRating|priceCurrency|telephone/);
console.log('PASS: seven canonical public sitemap URLs, valid JSON-LD, 22 synchronized categories, navigation and private-page noindex; no fabricated ratings or contact data.');
