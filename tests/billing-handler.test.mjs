import {test} from 'node:test';
import assert from 'node:assert/strict';
let handler;
globalThis.Deno={env:{get:name=>({VOCI_APP_URL:'https://voci.example',SUPABASE_URL:'https://db.example',SUPABASE_ANON_KEY:'test-public',SUPABASE_SERVICE_ROLE_KEY:'test-service',STRIPE_SECRET_KEY:'test-only'})[name]},serve:fn=>{handler=fn;}};
await import('../supabase/functions/voci-billing/index.ts');
const school='11111111-1111-1111-1111-111111111111';
const user='22222222-2222-2222-2222-222222222222';
const request=body=>new Request('https://db.example/functions/v1/voci-billing',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)});

test('renewal recovery returns the existing open invoice without creating or changing an abonnement',async()=>{
  const original=fetch,calls=[];
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname;calls.push({path,method:options.method||'GET'});
    if(path==='/auth/v1/user')return Response.json({id:user,email_confirmed_at:'2026-01-01'});
    if(path.endsWith('voci_billing_context'))return Response.json({subscription:{stripe_subscription:'sub_existing',plan:'school_small',subjects:[],status:'past_due'},activation:null,subjects:['en'],teacher_count:2});
    if(path.endsWith('voci_billing_acquire'))return Response.json(true);
    if(path.endsWith('voci_billing_release'))return Response.json(null);
    if(path==='/v1/subscriptions/sub_existing')return Response.json({id:'sub_existing',status:'past_due',latest_invoice:'in_open'});
    if(path==='/v1/invoices/in_open')return Response.json({status:'open',hosted_invoice_url:'https://invoice.stripe.com/i/test'});
    throw Error(`Unexpected ${path}`);
  };
  try{
    const response=await handler(request({school_id:school,action:'resume_payment',plan:'school_small'}));
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{url:'https://invoice.stripe.com/i/test'});
    assert.equal(calls.some(c=>c.path.startsWith('/v1/')&&c.method!=='GET'),false);
  }finally{globalThis.fetch=original;}
});

test('incompatible open card setup cannot silently change the consented school price',async()=>{
  const original=fetch,mutations=[];
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname;
    if(path==='/auth/v1/user')return Response.json({id:user,email_confirmed_at:'2026-01-01'});
    if(path.endsWith('voci_billing_context'))return Response.json({subscription:null,activation:{plan:'school_small',stripe_customer:'cus_existing'},subjects:['en'],teacher_count:2});
    if(path.endsWith('voci_billing_acquire'))return Response.json(true);
    if(path.endsWith('voci_billing_release'))return Response.json(null);
    if(path==='/v1/subscriptions')return Response.json({data:[],has_more:false});
    if(path.endsWith('voci_checkout_reserve'))return Response.json({message:'Eine andere Buchung ist bereits offen.'},{status:400});
    if(path.endsWith('voci_set_activation_payment')){mutations.push(JSON.parse(options.body));return Response.json(null);}
    throw Error(`Unexpected ${path}`);
  };
  try{
    const response=await handler(request({school_id:school,action:'prepare_payment_method',plan:'school_large'}));
    assert.equal(response.status,400);assert.equal(mutations.length,0);
  }finally{globalThis.fetch=original;}
});
