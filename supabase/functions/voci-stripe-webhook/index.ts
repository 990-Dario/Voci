import {env,rpc,stripe,subscriptionDetails} from '../_shared/server.ts';

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
Deno.serve(async(request: Request)=>{
  if(request.method!=='POST')return new Response('POST required',{status:405});
  const body=await request.text();
  if(body.length>1000000)return new Response('Too large',{status:413});
  let lock: {scope: string,id: string}|null=null;
  try {
    if(!await verifySignature(body,request.headers.get('stripe-signature')||'',env('STRIPE_WEBHOOK_SECRET')))return new Response('Invalid signature',{status:401});
    const event=JSON.parse(body);
    if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)) {
      const metadata=event.data.object.metadata;
      if(!metadata?.voci_plan)return Response.json({received:true});
      lock={scope:metadata.voci_school||metadata.voci_user,id:crypto.randomUUID()};
      if(!await rpc('voci_billing_acquire',{scope_id:lock.scope,lease_id:lock.id})){lock=null;return new Response('Retry later',{status:503});}
      // Fetch current Stripe state so delayed events cannot restore an old plan.
      const subscription=await stripe(`subscriptions/${encodeURIComponent(event.data.object.id)}`);
      if(subscription.metadata?.voci_plan)await rpc('voci_billing_sync',{event_id:event.id,details:subscriptionDetails(subscription),lease_id:lock.id});
    }
    return Response.json({received:true});
  } catch {return new Response('Webhook processing failed',{status:500});}
  finally {if(lock){try{await rpc('voci_billing_release',{scope_id:lock.scope,lease_id:lock.id});}catch{ /* Lease expires after five minutes. */ }}}
});
