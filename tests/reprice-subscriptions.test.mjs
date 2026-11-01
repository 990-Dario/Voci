import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReport,applyReport,PRICE_VERSION} from '../scripts/reprice-subscriptions.mjs';
const now=Date.parse('2026-11-01T12:00:00Z');
function fixture(patch={}){
  let subscription={id:'sub_test',status:'active',livemode:false,customer:'cus_test',collection_method:'charge_automatically',currency:'chf',current_period_start:now/1000-15*86400,current_period_end:now/1000+15*86400,cancel_at_period_end:false,cancel_at:null,schedule:null,metadata:{voci_plan:'individual',voci_user:'11111111-1111-1111-1111-111111111111',voci_subjects:'en'},items:{data:[{id:'si_test',quantity:1,price:{id:'price_old',product:'prod_test',currency:'chf',unit_amount:500,recurring:{interval:'month',interval_count:1}}}]},latest_invoice:{id:'in_test',status:'paid'},...patch};
  const calls=[];
  return {calls,get subscription(){return subscription;},
    stripe:async(path,values,key)=>{calls.push({path,values,key});if(path.startsWith('subscriptions?'))return {data:[subscription],has_more:false};if(path.startsWith('subscriptions/sub_test')){if(values){subscription={...subscription,metadata:{...subscription.metadata,voci_price_version:values['metadata[voci_price_version]']},items:{data:[{...subscription.items.data[0],price:{...subscription.items.data[0].price,unit_amount:Number(values['items[0][price_data][unit_amount]'])}}]}};}return structuredClone(subscription);}throw Error(path);},
    rpc:async(name,body)=>{calls.push({name,body});return true;}
  };
}
test('preview is read-only and estimates the remaining credit',async()=>{
  const io=fixture();const report=await createReport(io,now);
  assert.equal(report.entries[0].newAmount,300);assert.equal(report.entries[0].estimatedCredit,250);
  assert.equal(io.calls.some(c=>c.values||c.name),false);
});
test('apply twice changes once and uses confirmed server pricing',async()=>{
  const io=fixture(),report=await createReport(io,now);
  await applyReport(report,io,now);await applyReport(report,io,now);
  const writes=io.calls.filter(c=>c.values);assert.equal(writes.length,1);
  assert.equal(writes[0].values.billing_cycle_anchor,'now');assert.equal(writes[0].values.proration_behavior,'always_invoice');
  assert.equal(writes[0].values['items[0][price_data][unit_amount]'],'300');assert.equal(io.subscription.metadata.voci_price_version,PRICE_VERSION);
});
test('stale or altered reports stop before any subscription write',async()=>{
  for(const changed of ['old','price','cancel']){
    const io=fixture(),report=await createReport(io,now);
    if(changed==='price')report.entries[0].newAmount=1;
    if(changed==='cancel')io.subscription.cancel_at_period_end=true;
    await assert.rejects(applyReport(report,io,now+(changed==='old'?86400001:0)));
    assert.equal(io.calls.some(c=>c.values),false);
  }
});
test('cancellation, unpaid invoice and scheduled changes are manual cases',async()=>{
  for(const patch of [{cancel_at_period_end:true},{latest_invoice:{id:'in_test',status:'open'}},{schedule:'schedule_test'}]){
    const io=fixture(patch),report=await createReport(io,now);assert.equal(report.entries[0].action,'manual');
    await applyReport(report,io,now);assert.equal(io.calls.some(c=>c.values),false);
  }
});
test('school prices and concurrent updates are guarded',async()=>{
  for(const [plan,expected] of [['school_small',4000],['school_large',10000]]){
    const io=fixture({metadata:{voci_plan:plan,voci_school:'11111111-1111-1111-1111-111111111111'}});
    const report=await createReport(io,now);assert.equal(report.entries[0].newAmount,expected);
    io.rpc=async()=>false;await assert.rejects(applyReport(report,io,now),/bearbeitet/);assert.equal(io.calls.some(c=>c.values),false);
  }
});
