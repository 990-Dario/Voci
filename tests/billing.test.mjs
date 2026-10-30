import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'local-test-only'})[name]},serve:()=>{}};
const {price,rpc}=await import('../supabase/functions/_shared/server.ts');
const {verifySignature}=await import('../supabase/functions/voci-stripe-webhook/index.ts');

test('Server erzwingt Fächerpreise und lässt keine fremden oder doppelten Fächer zu',()=>{
  const all=['de','en','fr','math','geography'];
  assert.deepEqual([1,2,3,4,5].map(n=>price('individual',all.slice(0,n),all)),[300,500,700,800,900]);
  assert.equal(price('school_small',[],all),4000);assert.equal(price('school_large',[],all),10000);
  for(const subjects of [[],['en','en'],['unknown']])assert.throws(()=>price('individual',subjects,all));
});
test('Webhook lehnt falsche, manipulierte und alte Signaturen ab',async()=>{
  const body='{"id":"evt_test"}',secret='local-signature-test',now=Date.now(),timestamp=String(Math.floor(now/1000));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body));
  const hex=Buffer.from(digest).toString('hex'),header=`t=${timestamp},v1=${hex}`;
  assert.equal(await verifySignature(body,header,secret,now),true);
  assert.equal(await verifySignature(body+' ',header,secret,now),false);
  assert.equal(await verifySignature(body,header,secret,now+301000),false);
  assert.equal(await verifySignature(body,header,'wrong',now),false);
});
test('Server-RPC verarbeitet leere 204-Antworten und zeigt Datenbankfehler an',async()=>{
  const previous=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(null,{status:204});
    assert.equal(await rpc('voci_finish_mail',{}),null);
    globalThis.fetch=async()=>Response.json({message:'Nicht berechtigt'},{status:403});
    await assert.rejects(rpc('voci_billing_context',{}),/Nicht berechtigt/);
  } finally {globalThis.fetch=previous;}
});
