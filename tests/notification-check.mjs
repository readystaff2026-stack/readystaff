// In-memory integration tests: never connect to a provider or real account.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const source = stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/process-notifications/index.ts',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
async function run(options={}) {
  const now=new Date(Date.now()-3600000).toISOString();
  const job={id:'11111111-1111-4111-8111-111111111111',quote_id:'q',recipient_id:'recipient',event_type:options.event||'new_message',attempt_count:options.attempts||0,status:options.initialStatus||'pending',created_at:now,next_attempt_at:now};
  const tables={notification_outbox:[job],quote_requests:[{id:'q',client_name:'Client',city:'Brasília',state:'DF',categories:{name:'Garçom'},professional_profiles:{display_name:'Professional'}}],profiles:[{id:'recipient',full_name:'<script>unsafe</script>',phone:'61999999999'}],notification_preferences:[{user_id:'recipient',email_enabled:options.email!==false,whatsapp_enabled:options.whatsapp!==false,whatsapp_opted_in_at:options.consent===false?null:now}]};
  const outbound=[],background=[];
  function query(table, userScope=false) {
    const filters=[];let change=null,limit=1000,single=false;
    const q={
      select(){return q;},order(){return q;},limit(n){limit=n;return q;},
      eq(k,v){filters.push(row=>row[k]===v);return q;},in(k,v){filters.push(row=>v.includes(row[k]));return q;},
      lt(k,v){filters.push(row=>row[k]!=null&&row[k]<v);return q;},lte(k,v){filters.push(row=>row[k]!=null&&row[k]<=v);return q;},
      update(value){change=value;return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},
      then(resolve){
        if(options.preferenceError&&table==='notification_preferences'){resolve({data:null,error:{message:'Synthetic error'}});return;}
        const rows=(userScope&&options.invisible?[]:tables[table]||[]).filter(row=>filters.every(f=>f(row))).slice(0,limit);
        if(change)rows.forEach(row=>Object.assign(row,change));
        resolve({data:structuredClone(single?rows[0]||null:rows),error:null});
      }
    };return q;
  }
  const dummy={SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',RESEND_API_KEY:'dummy-email',READYSTAFF_EMAIL_FROM:'ReadyStaff <test@example.invalid>',WHATSAPP_ACCESS_TOKEN:'dummy-whatsapp',WHATSAPP_PHONE_NUMBER_ID:'dummy-phone-id',WHATSAPP_TEMPLATE_NEW_QUOTE:'new_quote',WHATSAPP_TEMPLATE_QUOTE_UPDATE:'quote_update'};
  if(options.noConfig)for(const key of Object.keys(dummy).filter(k=>!k.startsWith('SUPABASE')))delete dummy[key];
  let handler;
  const context=vm.createContext({Response,AbortSignal,Date,Set,console,createClient(_url,key){return {from:table=>query(table,key==='anon'),auth:{getUser:async()=>({data:{user:options.invalid?null:{id:'sender',app_metadata:options.admin?{readystaff_admin:true}:{},user_metadata:{readystaff_admin:true}}},error:options.invalid?{}:null}),admin:{getUserById:async()=>({data:{user:{email:'recipient@example.invalid'}},error:null})}}};},Deno:{env:{get:key=>dummy[key]},serve(fn){handler=fn;}},EdgeRuntime:{waitUntil(p){background.push(p);}},fetch:async(url,init)=>{
    outbound.push({url,init,body:JSON.parse(init.body)});
    if(url.includes('facebook')){if(options.whatsappThrows)throw Error('Synthetic network error');return new Response('{}',{status:options.whatsappFailure?400:200});}
    return new Response('{}',{status:options.emailFailure?503:200});
  }});
  vm.runInContext(source,context);
  const headers=new Headers({'Content-Type':'application/json'});if(!options.noAuth)headers.set('Authorization','Bearer synthetic');
  const response=await handler(new Request('https://example.invalid/functions/process-notifications',{method:'POST',headers,body:JSON.stringify(options.operation?{operation:options.operation,notification_id:job.id}:{quote_id:'q'})}));
  await Promise.all(background);
  return {response,job,outbound,data:await response.json()};
}
assert.equal((await run({noAuth:true})).response.status,401);
assert.equal((await run({invalid:true})).response.status,401);
assert.equal((await run({invisible:true})).response.status,404);
const forbidden=await run({operation:'status'});assert.equal(forbidden.response.status,403);assert.equal(forbidden.outbound.length,0);
const status=await run({operation:'status',admin:true});assert.equal(status.response.status,200);assert.equal(status.outbound.length,0);assert.equal(status.data.whatsapp_credentials_configured,true);assert.equal(JSON.stringify(status.data).includes('dummy-'),false);
const whatsapp=await run();assert.equal(whatsapp.job.channel,'whatsapp');assert.equal(whatsapp.outbound.length,1);assert.equal(whatsapp.outbound[0].body.to,'5561999999999');
for(const opts of [{whatsappFailure:true},{whatsappThrows:true}]){const r=await run(opts);assert.equal(r.job.channel,'email');assert.equal(r.outbound.length,2);assert.equal(r.outbound[1].init.headers['Idempotency-Key'],`readystaff-${r.job.id}`);assert.equal(r.outbound[1].body.html.includes('<script>'),false);}
const noConsent=await run({consent:false});assert.equal(noConsent.job.channel,'email');assert.equal(noConsent.outbound.length,1);
const disabled=await run({whatsapp:false,email:false});assert.equal(disabled.job.status,'skipped');assert.equal(disabled.outbound.length,0);
const prefError=await run({preferenceError:true});assert.equal(prefError.job.status,'failed');assert.equal(prefError.outbound.length,0,'Do not send when consent lookup fails');
const unconfigured=await run({noConfig:true});assert.equal(unconfigured.job.status,'configuration_pending');assert.equal(unconfigured.outbound.length,0);
const failure=await run({whatsappFailure:true,emailFailure:true});assert.equal(failure.job.status,'failed');assert.ok(Date.parse(failure.job.next_attempt_at)>Date.now());
for(const event of ['new_quote','quote_accepted','quote_declined','quote_cancelled','new_message','new_proposal','proposal_accepted','proposal_declined','service_completion']){const r=await run({event,whatsapp:false});assert.equal(r.job.status,'sent',event);assert.equal(r.outbound.length,1);}
assert.equal((await run({operation:'retry',initialStatus:'failed'})).response.status,403);
const retry=await run({operation:'retry',admin:true,initialStatus:'failed',attempts:5});assert.equal(retry.response.status,200);assert.equal(retry.outbound.length,1);assert.equal(retry.job.status,'sent');
const sent=await run({operation:'retry',admin:true,initialStatus:'sent'});assert.equal(sent.response.status,409);assert.equal(sent.outbound.length,0);
assert.equal((await run({attempts:5})).outbound.length,0);
console.log('PASS: auth, participant/admin gates, every notification event, WhatsApp consent, email fallback, opt-outs, safe HTML and bounded/admin retries; zero real sends.');
