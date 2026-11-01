import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.Deno={env:{get:()=>undefined}};
const {processActivation,setupSessionValues}=await import('../supabase/functions/_shared/activation.ts');
const school='11111111-1111-1111-1111-111111111111';
const job=()=>({school_id:school,scheduled_at:'2026-10-29T23:00:00Z',free_until:null,plan:'school_small',version:1,stripe_customer:'cus_test',stripe_payment_method:'pm_test',lease_id:'lease',status:'scheduled'});
function fake(){
  const calls=[];let subscription=null;
  return {calls,get subscription(){return subscription;},set subscription(v){subscription=v;},
    rpc:async(name,body)=>{calls.push({name,body});return true;},
    stripe:async(path,values,key)=>{
      calls.push({path,values,key});
      if(path.startsWith('subscriptions?'))return {data:subscription?[subscription]:[],has_more:false};
      if(path==='products')return {id:'prod_test'};
      if(path==='subscriptions'&&values){subscription={id:'sub_test',status:'active',customer:'cus_test',metadata:{voci_school:school,voci_plan:'school_small',voci_activation:'1'},latest_invoice:{id:'in_test',status:'paid'},current_period_start:1793314800,current_period_end:1795993200,cancel_at_period_end:false};return subscription;}
      if(path.startsWith('subscriptions/'))return subscription;
      throw Error(path);
    }};
}
test('no charge before activation; missing card waits; free month starts without charge',async()=>{
  for(const [patch,now,status] of [[{},'2026-10-29T22:59:59Z','scheduled'],[{stripe_payment_method:null},'2026-10-30T00:00:00Z','awaiting_payment'],[{free_until:'2026-11-29T23:00:00Z'},'2026-10-30T00:00:00Z','free_month']]){
    const io=fake();const result=await processActivation({...job(),...patch},io,Date.parse(now));assert.equal(result.status,status);assert.equal(io.calls.some(c=>c.path==='subscriptions'),false);
  }
});
test('due school charged once; retry recovers existing subscription with stable identity',async()=>{
  const io=fake();const a=job();const now=Date.parse('2026-10-30T00:00:00Z');
  assert.equal((await processActivation(a,io,now)).status,'active');
  assert.equal((await processActivation(a,io,now)).status,'active');
  const charges=io.calls.filter(c=>c.path==='subscriptions');assert.equal(charges.length,1);
  assert.equal(charges[0].values.payment_behavior,'error_if_incomplete');assert.equal(charges[0].key,`activation-${school}-v1`);
  assert.equal(charges[0].values['items[0][price_data][unit_amount]'],'4000');
});
test('additional card authentication fails closed, without active rights',async()=>{
  const io=fake(),original=io.stripe;io.stripe=async(...args)=>{if(args[0]==='subscriptions')throw Error('authentication_required');return original(...args);};
  const result=await processActivation(job(),io,Date.parse('2026-10-30T00:00:00Z'));assert.equal(result.status,'payment_failed');assert.equal(io.calls.some(c=>c.name==='voci_billing_sync'),false);
});
test('active status alone does not prove payment',async()=>{
  const io=fake();io.subscription={id:'sub_test',status:'active',customer:'cus_test',metadata:{voci_school:school,voci_plan:'school_small',voci_activation:'1'},latest_invoice:{status:'open'},current_period_end:1795993200};
  assert.equal((await processActivation(job(),io,Date.parse('2026-10-30T00:00:00Z'))).status,'payment_failed');
});
test('setup only saves card; it has no charge items',()=>{
  const values=setupSessionValues(job(),'https://voci.example/','cs_request');
  assert.equal(values.mode,'setup');assert.equal(values['setup_intent_data[usage]'],'off_session');assert.equal(Object.keys(values).some(k=>k.startsWith('line_items')),false);
  assert.match(values['custom_text[submit][message]'],/40/);
});
