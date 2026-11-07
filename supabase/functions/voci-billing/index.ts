import {env,cors,readJSON,rpc,authenticatedUser,stripe,price,subscriptionDetails} from '../_shared/server.ts';
import {setupSessionValues,findActivationSubscription,paidSubscriptionDetails} from '../_shared/activation.ts';

Deno.serve(async (request: Request) => {
  let headers: Record<string,string> = {};
  let lock: {scope: string,id: string}|null=null;
  try {
    headers=cors(request);
    if(request.method==='OPTIONS') return new Response(null,{headers});
    if(request.method!=='POST') return Response.json({error:'POST erforderlich.'},{status:405,headers});
    const user=await authenticatedUser(request);
    const input=await readJSON(request);
    const school=input.school_id||null;
    if(school && !/^[0-9a-f-]{36}$/i.test(school)) throw new Error('Ungültige Schule.');
    await rpc('voci_billing_context',{who:user.id,school});
    lock={scope:school||user.id,id:crypto.randomUUID()};
    if(!await rpc('voci_billing_acquire',{scope_id:lock.scope,lease_id:lock.id})) {lock=null;throw new Error('Dein Abonnement wird bereits aktualisiert. Bitte kurz warten und erneut versuchen.');}
    const context=await rpc('voci_billing_context',{who:user.id,school});
    const current=context.subscription;
    let existing=current?.stripe_subscription ? await stripe(`subscriptions/${encodeURIComponent(current.stripe_subscription)}`):null;
    const activation=context.activation;
    if(!existing&&activation?.stripe_customer)existing=await findActivationSubscription(activation);
    if(input.action==='cancel') {
      if(school&&activation&&!activation.first_paid_at){
        await rpc('voci_cancel_activation',{who:user.id,school});
        return Response.json({ok:true,message:'Kündigung vorgemerkt: Das Abo endet nach dem ersten bezahlten Monat. Ein gewährter Gratismonat bleibt erhalten.'},{headers});
      }
      if(!existing || existing.status!=='active') throw new Error('Kein aktives Abo gefunden.');
      if(existing.schedule) await stripe(`subscription_schedules/${existing.schedule}/release`,{});
      const operation=crypto.randomUUID();
      const updated=await stripe(`subscriptions/${existing.id}`,{cancel_at_period_end:'true','metadata[voci_pending_plan]':'','metadata[voci_pending_at]':''},`cancel-${operation}`);
      await rpc('voci_billing_sync',{event_id:`api-cancel-${operation}`,details:await paidSubscriptionDetails(updated),lease_id:lock.id});
      return Response.json({ok:true},{headers});
    }
    if(!['checkout','prepare_payment_method','resume_payment'].includes(input.action)) throw new Error('Unbekannte Zahlungsaktion.');
    if(input.action==='resume_payment'&&existing&&!['canceled','incomplete_expired'].includes(existing.status)){
      const invoiceId=typeof existing.latest_invoice==='string'?existing.latest_invoice:existing.latest_invoice?.id;
      const invoice=invoiceId?await stripe(`invoices/${encodeURIComponent(invoiceId)}`):null;
      if(invoice?.status==='open'&&invoice.hosted_invoice_url){
        const url=new URL(invoice.hosted_invoice_url);
        if(url.protocol==='https:'&&url.hostname==='invoice.stripe.com')return Response.json({url:url.href},{headers});
      }
      if(invoice?.status==='paid')return Response.json({ok:true,message:'Die Rechnung ist bezahlt. Die Zugriffe werden nach der Zahlungsbestätigung aktualisiert.'},{headers});
      throw new Error('Für dieses Abo ist keine offene Zahlungsseite verfügbar. Bitte kontaktiere Voci.');
    }
    const plan=String(input.plan||activation?.plan), subjects=Array.isArray(input.subjects)?input.subjects.map(String).sort():[];
    if((plan==='individual')!==!school) throw new Error('Ungültiger Tarif für diese Rolle.');
    const amount=price(plan,subjects,context.subjects);
    if(plan==='school_small' && context.teacher_count>50) throw new Error('Für mehr als 50 Lehrpersonen ist das grosse Paket erforderlich.');
    const metadata: Record<string,string> = {voci_plan:plan,voci_school:school||'',voci_user:school?'':user.id,voci_subjects:subjects.join(',')};
    const name=plan==='individual'?`Voci · ${subjects.length} Fächer`:plan==='school_small'?'Voci Schule · bis 50 Lehrpersonen':'Voci Schule · über 50 Lehrpersonen';
    const base=new URL(env('VOCI_APP_URL'));base.search='';base.hash='';
    if(school&&activation&&!existing&&input.action!=='resume_payment'){
      const reservation=await paymentReservation(user.id,school,plan,subjects,'setup',lock.id);
      if(reservation.url)return Response.json({url:reservation.url},{headers});
      await rpc('voci_set_activation_payment',{school,lease_id:lock.id,details:{plan}});
      let customer=activation.stripe_customer;
      if(!customer){const created=await stripe('customers',{email:context.email,'metadata[voci_school]':school},`school-customer-${school}`);customer=created.id;await rpc('voci_set_activation_payment',{school,lease_id:lock.id,details:{customer}});}
      const values=setupSessionValues({...activation,plan,stripe_customer:customer},base.href,reservation.id);
      values.expires_at=String(Math.floor(Date.now()/1000)+23*3600);
      const session=await stripe('checkout/sessions',values,`setup-${reservation.id}`);
      await rpc('voci_set_activation_payment',{school,lease_id:lock.id,details:{session_id:session.id}});
      await rpc('voci_checkout_complete',{reservation_id:reservation.id,session_id:session.id});
      return Response.json({url:session.url},{headers});
    }
    if(school&&activation&&!existing){
      if(Date.parse(activation.scheduled_at)>Date.now()||activation.free_until&&Date.parse(activation.free_until)>Date.now())throw new Error('Die erste Zahlung ist erst am Aktivierungstag beziehungsweise nach dem Gratismonat möglich.');
      if(plan!==activation.plan)throw new Error('Bitte die begonnene Buchung zuerst abschliessen.');
      metadata.voci_activation=String(activation.version);
    }
    if(existing && !['canceled','incomplete_expired'].includes(existing.status)) {
      if(existing.status!=='active' || existing.latest_invoice && current?.status==='past_due') throw new Error('Bitte zuerst die offene Zahlung beim Zahlungsanbieter klären.');
      const item=existing.items.data[0], oldAmount=item.price.unit_amount;
      if(existing.items.data.length!==1) throw new Error('Dieses Abonnement muss durch Voci geprüft werden.');
      if(existing.latest_invoice) {
        const invoice=await stripe(`invoices/${existing.latest_invoice}`);
        if(invoice.status!=='paid') throw new Error('Bitte zuerst die offene Rechnung bezahlen, bevor du das Abo änderst.');
      }
      if(amount<oldAmount) {
        if(existing.cancel_at_period_end||existing.cancel_at)throw new Error('Für ein gekündigtes Abo wird kein neuer Tarif nach dem Enddatum geplant.');
        const nextAt=new Date(existing.current_period_end*1000).toISOString();
        if(school)await rpc('voci_schedule_capacity',{school,next_plan:plan,next_at:nextAt});
        try {
        await stripe(`subscriptions/${existing.id}`,{'metadata[voci_pending_plan]':plan,'metadata[voci_pending_at]':nextAt});
        const nextPrice=await stripe('prices',{currency:'chf',unit_amount:String(amount),product:item.price.product,'recurring[interval]':'month'});
        const schedule=existing.schedule?await stripe(`subscription_schedules/${existing.schedule}`):await stripe('subscription_schedules',{from_subscription:existing.id});
        const values: Record<string,string> = {end_behavior:'release',proration_behavior:'none',
          'phases[0][start_date]':String(existing.current_period_start),'phases[0][end_date]':String(existing.current_period_end),
          'phases[0][items][0][price]':item.price.id,'phases[0][items][0][quantity]':'1',
          'phases[1][items][0][price]':nextPrice.id,'phases[1][items][0][quantity]':'1','phases[1][iterations]':'1','phases[1][proration_behavior]':'none'
        };
        for(const [key,value] of Object.entries(metadata))values[`phases[1][metadata][${key}]`]=value;
        values['phases[1][metadata][voci_pending_plan]']='';values['phases[1][metadata][voci_pending_at]']='';
        await stripe(`subscription_schedules/${schedule.id}`,values);
        const updated=await stripe(`subscriptions/${existing.id}`);
        await rpc('voci_billing_sync',{event_id:`api-schedule-${crypto.randomUUID()}`,details:await paidSubscriptionDetails(updated),lease_id:lock.id});
        return Response.json({ok:true,message:'Die Reduktion gilt ab der nächsten Abrechnungsperiode.'},{headers});
        } catch(error) {throw new Error('Die Tarifreduktion konnte nicht vollständig bestätigt werden. Bitte Voci kontaktieren; weitere Plätze bleiben vorsorglich auf 50 begrenzt.');}
      }
      if(amount===oldAmount && JSON.stringify(subjects)===JSON.stringify(current.subjects||[]) && plan===current.plan && !existing.cancel_at_period_end && !existing.schedule && !existing.metadata.voci_pending_plan) return Response.json({ok:true},{headers});
      if(existing.schedule) await stripe(`subscription_schedules/${existing.schedule}/release`,{});
      const values: Record<string,string> = {
        'items[0][id]':item.id,'items[0][price_data][currency]':'chf',
        'items[0][price_data][product]':item.price.product,'items[0][price_data][unit_amount]':String(amount),
        'items[0][price_data][recurring][interval]':'month',
        ...(existing.cancel_at_period_end||existing.cancel_at?{cancel_at:String(existing.cancel_at||existing.current_period_end)}:{}),
        'proration_behavior':'always_invoice','payment_behavior':'error_if_incomplete',
        ...(amount>oldAmount?{'billing_cycle_anchor':'now'}:{})
      };
      for(const [key,value] of Object.entries(metadata))values[`metadata[${key}]`]=value;
      values['metadata[voci_pending_plan]']='';values['metadata[voci_pending_at]']='';
      const operation=crypto.randomUUID();
      const updated=await stripe(`subscriptions/${existing.id}`,values,`upgrade-${operation}`);
      await rpc('voci_billing_sync',{event_id:`api-upgrade-${operation}`,details:await paidSubscriptionDetails(updated),lease_id:lock.id});
      return Response.json({ok:true},{headers});
    }
    const reservation=await paymentReservation(user.id,school,plan,subjects,'subscription',lock.id);
    if(reservation.url)return Response.json({url:reservation.url},{headers});
    const values: Record<string,string> = {mode:'subscription','payment_method_types[0]':'card',
      'line_items[0][price_data][currency]':'chf','line_items[0][price_data][product_data][name]':name,
      'line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][recurring][interval]':'month','line_items[0][quantity]':'1',
      'success_url':`${base.href}?billing=success`,'cancel_url':`${base.href}?billing=cancelled`,
      'customer_email':context.email,'client_reference_id':user.id,
      'expires_at':String(Math.floor(Date.now()/1000)+23*3600)
    };
    if(school&&activation?.stripe_customer){delete values.customer_email;values.customer=activation.stripe_customer;}
    for(const [key,value] of Object.entries(metadata))values[`subscription_data[metadata][${key}]`]=value;
    const session=await stripe('checkout/sessions',values,`checkout-${reservation.id}`);
    await rpc('voci_checkout_complete',{reservation_id:reservation.id,session_id:session.id});
    return Response.json({url:session.url},{headers});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:'Zahlung konnte nicht vorbereitet werden.'},{status:400,headers});
  } finally {
    if(lock) {try {await rpc('voci_billing_release',{scope_id:lock.scope,lease_id:lock.id});}catch{ /* The lease expires if cleanup is interrupted. */ }}
  }
});

async function paymentReservation(who:string,school:string|null,plan:string,subjects:string[],mode:string,lease_id:string){
  let reservation=await rpc('voci_checkout_reserve',{who,school,requested_plan:plan,requested_subjects:subjects});
  if(reservation.session_id){
    const session=await stripe(`checkout/sessions/${reservation.session_id}`);
    if(session.status==='open'&&session.mode===mode)return {...reservation,url:session.url};
    if(session.status==='complete'&&session.mode==='subscription')throw new Error('Die vorherige Zahlung wird noch bestätigt. Bitte warte einen Moment.');
    if(session.status==='open')await stripe(`checkout/sessions/${session.id}/expire`,{});
    await rpc('voci_checkout_reset',{scope_id:school||who,lease_id,session_id:session.id});
    reservation=await rpc('voci_checkout_reserve',{who,school,requested_plan:plan,requested_subjects:subjects});
  }
  if(!reservation.claimed)throw new Error('Eine Zahlung wird bereits vorbereitet. Bitte kurz warten.');
  return reservation;
}
