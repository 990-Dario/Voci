import {stripe,rpc,price,subscriptionDetails} from './server.ts';

export function setupSessionValues(activation:any,base:string,reservation:string):Record<string,string> {
  const amount=price(activation.plan,[],[])/100;
  return {mode:'setup',customer:activation.stripe_customer,'payment_method_types[0]':'card',
    'setup_intent_data[usage]':'off_session','setup_intent_data[metadata][voci_school]':activation.school_id,
    'metadata[voci_school]':activation.school_id,'metadata[voci_plan]':activation.plan,'metadata[voci_reservation]':reservation,
    success_url:`${base}?billing=prepared`,cancel_url:`${base}?billing=cancelled`,
    'custom_text[submit][message]':`Schulabo CHF ${amount} pro Monat. Heute wird nur die Karte hinterlegt. Erste Belastung frühestens am Aktivierungstag, bei Gratismonat erst danach. Mindestens ein bezahlter Monat; danach monatlich kündbar.`};
}

export async function findActivationSubscription(a:any,request= stripe){
  if(a.stripe_subscription)return request(`subscriptions/${encodeURIComponent(a.stripe_subscription)}?expand[]=latest_invoice`);
  const list=await request(`subscriptions?customer=${encodeURIComponent(a.stripe_customer)}&status=all&limit=100&expand[]=data.latest_invoice`);
  if(list.has_more)throw new Error('Zu viele Abos zur automatischen Zuordnung. Bitte Voci kontaktieren.');
  const matches=list.data.filter((s:any)=>s.metadata?.voci_school===a.school_id&&s.metadata?.voci_activation===String(a.version));
  if(matches.length>1)throw new Error('Mehrere Abos gefunden. Voci muss die Zuordnung prüfen.');
  return matches[0]||null;
}

export async function paidSubscriptionDetails(subscription:any,request=stripe){
  const invoice=typeof subscription.latest_invoice==='string'?await request(`invoices/${encodeURIComponent(subscription.latest_invoice)}`):subscription.latest_invoice;
  const details=subscriptionDetails(subscription);
  const confirmed=subscription.status==='active'&&invoice?.status==='paid';
  return {...details,status:subscription.status==='active'&&!confirmed?'awaiting_payment':subscription.status,payment_confirmed:confirmed,
    period_start:subscription.current_period_start?new Date(subscription.current_period_start*1000).toISOString():null};
}

export async function processActivation(a:any,io={stripe,rpc},now=Date.now()){
  if(Date.parse(a.scheduled_at)>now)return {status:'scheduled'};
  if(a.free_until&&Date.parse(a.free_until)>now)return {status:'free_month'};
  if(!a.stripe_customer||!a.stripe_payment_method)return {status:'awaiting_payment'};
  try {
    let subscription=await findActivationSubscription(a,io.stripe);
    if(!subscription){
      await io.rpc('voci_activation_charge_started',{school:a.school_id,lease_id:a.lease_id});
      const product=await io.stripe('products',{name:'Voci Schulabo'},`activation-product-${a.school_id}-v${a.version}`);
      subscription=await io.stripe('subscriptions',{customer:a.stripe_customer,default_payment_method:a.stripe_payment_method,
        collection_method:'charge_automatically',payment_behavior:'error_if_incomplete',
        'items[0][price_data][currency]':'chf','items[0][price_data][product]':product.id,
        'items[0][price_data][unit_amount]':String(price(a.plan,[],[])),'items[0][price_data][recurring][interval]':'month',
        'metadata[voci_school]':a.school_id,'metadata[voci_plan]':a.plan,'metadata[voci_activation]':String(a.version),'expand[0]':'latest_invoice'
      },`activation-${a.school_id}-v${a.version}`);
    }
    let details=await paidSubscriptionDetails(subscription,io.stripe);
    if(a.cancel_requested&&details.payment_confirmed&&!subscription.cancel_at_period_end){
      subscription=await io.stripe(`subscriptions/${subscription.id}`,{cancel_at_period_end:'true'},`activation-cancel-${a.school_id}-v${a.version}`);
      details=await paidSubscriptionDetails(subscription,io.stripe);
    }
    await io.rpc('voci_billing_sync',{event_id:`activation-${a.school_id}-v${a.version}-${subscription.status}-${subscription.current_period_end}-${details.payment_confirmed}-${Boolean(subscription.cancel_at_period_end)}`,details,lease_id:a.lease_id});
    return {status:details.payment_confirmed?'active':'payment_failed',subscription_id:subscription.id,...(!details.payment_confirmed?{error:'Zahlung noch nicht bestätigt. Bitte Zahlung in Voci fortsetzen.'}:{})};
  } catch {
    return {status:'payment_failed',error:'Die Zahlung benötigt eine Prüfung oder Kartenbestätigung. Bitte in Voci fortsetzen.'};
  }
}
