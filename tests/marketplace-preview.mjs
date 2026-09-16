// Local-only visual fixture server. Never connects to Supabase or sends notifications.
// node tests/marketplace-preview.mjs; open /painel.html?qa_role=professional or client.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
function fixtureClient() {
  const role = new URLSearchParams(location.search).get('qa_role') || 'client';
  const id = role === 'professional' ? 'professional' : 'client';
  const user = { id, email: 'fixture@example.invalid', app_metadata: {} };
  const category = { id: 1, slug: 'garcom', name: 'Garçom' };
  const professional = { id: 'professional', display_name: 'Alex · equipe de eventos', full_name: 'Alex', role: 'professional', city: 'Brasília', state: 'DF', whatsapp: '61999999999', bio: 'Atendimento profissional e organizado para casamentos e eventos corporativos.', availability: 'Atendimento em Brasília, mediante consulta.', experience_years: 5, rating_average: 4.8, rating_count: 12, status: 'approved', professional_categories: [{ category_id: 1, price: 250, accepts_proposals: true, categories: category }], professional_portfolio: [] };
  const tables = {
    profiles: [{ id, full_name: id === 'client' ? 'Cliente de demonstração' : 'Alex', role, city: 'Brasília', state: 'DF' }],
    professional_profiles: [professional], categories: [category],
    quote_requests: [{ id: 'q', client_id: 'client', professional_id: 'professional', client_name: 'Cliente de demonstração', client_phone: '61999999999', event_date: '2026-01-01', event_time: '19:00', city: 'Brasília', state: 'DF', venue: 'Espaço de eventos', guest_count: 80, proposed_budget: 250, message: 'Precisamos de atendimento aos convidados e apoio durante a recepção.', status: 'accepted', professional_response: 'Vamos alinhar os detalhes por aqui.', created_at: '2026-01-01T12:00:00Z', categories: category, professional_profiles: professional }],
    quote_completions: [], reviews: [], review_summaries: [], professional_favorites: [], professional_unavailability: [], quote_reports: [], notification_outbox: [],
    quote_messages: [{ id: 'm', quote_id: 'q', sender_id: id === 'client' ? 'professional' : 'client', body: 'Podemos combinar o atendimento para 80 convidados, das 19h às 23h?', proposed_amount: 250, created_at: '2026-01-01T13:00:00Z' }], quote_offer_responses: []
  };
  function from(table) {
    let rows = [...(tables[table] || [])]; let singular = false; let mutation = null; let total = rows.length;
    const query = {
      select() { return query; }, order() { return query; }, limit(n) { rows = rows.slice(0, n); return query; }, range(a,b) { rows=rows.slice(a,b+1);return query; },
      eq(key,value) { rows=rows.filter(row=>row[key]===value);return query; }, in(key,values) { rows=rows.filter(row=>values.includes(row[key]));return query; },
      lte(key,value) { rows=rows.filter(row=>row[key]<=value);return query; }, gte(key,value) { rows=rows.filter(row=>row[key]>=value);return query; },
      maybeSingle() { singular=true;return query; }, single() { singular=true;return query; },
      insert(value) { const record={id:crypto.randomUUID(),created_at:new Date().toISOString(),...value};(tables[table] ||= []).push(record);rows=[record];return query; },
      update(value) { mutation=value;return query; }, delete() { mutation='delete';return query; },
      then(resolve) { if(mutation==='delete')tables[table]=tables[table].filter(row=>!rows.includes(row));else if(mutation)rows.forEach(row=>Object.assign(row,mutation));resolve({data:singular?rows[0]||null:rows,error:null,count:total}); }
    }; return query;
  }
  return { from, auth: { getSession:async()=>({data:{session:{user}},error:null}), getUser:async()=>({data:{user},error:null}), onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}), signOut:async()=>({error:null}) } };
}
const mock = `export const supabase = (${fixtureClient.toString()})();`;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/supabase-client.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(mock);return;}
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{res.writeHead(200,{'Content-Type':types[extname(file)]||'text/plain','Cache-Control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
}).listen(4174,'0.0.0.0',()=>console.log('Local fixture preview on :4174 — no real accounts or external writes.'));
