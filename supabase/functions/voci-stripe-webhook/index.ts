import {env,rpc,stripe} from '../_shared/server.ts';
import {paidSubscriptionDetails} from '../_shared/activation.ts';

export async function verifySignature(body: string, header: string, secret: string, now=Date.now()) {
  const parts=header.split(',').map(p=>p.split('='));
  const timestamp=parts.find(([key])=>key==='t')?.[1];
  if(!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now/1000-Number(timestamp))>300) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${body}`));
  const expected=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  return parts.filter(([key])=>key==='v1').some(([,signature])=>{
    if(signature?.length!==expected.length)return false;let difference=0;
    for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^signature.charCodeAt(i);
    return difference===0;
  });
}
export async function processStripeEvent(event:any,io={stripe,rpc}){
  let lock:{scope:string,id:string}|null=null;
  try {
    const object=event.data.object;
    if(event.type==='checkout.session.completed'&&object.mode==='setup'){
      const session=await io.stripe(`checkout/sessions/${encodeURIComponent(object.id)}`);
      const school=session.metadata?.voci_school;
      if(!school||session.status!=='complete'||session.mode!=='setup')return;
      lock={scope:school,id:crypto.randomUUID()};
      if(!await io.rpc('voci_billing_acquire',{scope_id:school,lease_id:lock.id})){lock=null;throw new Error('Retry later');}
      const intent=await io.stripe(`setup_intents/${encodeURIComponent(session.setup_intent)}`);
      if(intent.status!=='succeeded'||intent.customer!==session.customer||!intent.payment_method)throw new Error('Unconfirmed payment method');
      await io.rpc('voci_set_activation_payment',{school,lease_id:lock.id,details:{customer:session.customer,payment_method:intent.payment_method,completed_session:session.id}});
      return;
    }
    const subEvent=['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type);
    const invoiceEvent=['invoice.paid','invoice.payment_failed','invoice.payment_action_required'].includes(event.type);
    const checkoutEvent=event.type==='checkout.session.completed'&&object.mode==='subscription';
    if(!subEvent&&!invoiceEvent&&!checkoutEvent)return;
    const id=subEvent?object.id:object.subscription||object.parent?.subscription_details?.subscription;
    if(!id)return;
    let subscription=await io.stripe(`subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`);
    const metadata=subscription.metadata;
    if(!metadata?.voci_plan)return;
    lock={scope:metadata.voci_school||metadata.voci_user,id:crypto.randomUUID()};
    if(!await io.rpc('voci_billing_acquire',{scope_id:lock.scope,lease_id:lock.id})){lock=null;throw new Error('Retry later');}
    // Re-read inside the lease: delayed events never restore the event's old plan or payment state.
    subscription=await io.stripe(`subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`);
    await io.rpc('voci_billing_sync',{event_id:event.id,details:await paidSubscriptionDetails(subscription,io.stripe),lease_id:lock.id});
  } finally {if(lock)await io.rpc('voci_billing_release',{scope_id:lock.scope,lease_id:lock.id});}
}
Deno.serve(async(request: Request)=>{
  if(request.method!=='POST')return new Response('POST required',{status:405});
  const body=await request.text();
  if(body.length>1000000)return new Response('Too large',{status:413});
  try {
    if(!await verifySignature(body,request.headers.get('stripe-signature')||'',env('STRIPE_WEBHOOK_SECRET')))return new Response('Invalid signature',{status:401});
    await processStripeEvent(JSON.parse(body));
    return Response.json({received:true});
  } catch {return new Response('Webhook processing failed',{status:500});}
});
