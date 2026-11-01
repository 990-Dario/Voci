import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {price} from '../supabase/functions/_shared/server.ts';
import {paidSubscriptionDetails} from '../supabase/functions/_shared/activation.ts';

export const PRICE_VERSION='2026-11-subjects-v2';
const subjects=['de','en','fr','math','geography'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const subscriptionPath=id=>`subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`;

function planChange(s,at){
  const metadata=s.metadata||{},item=s.items?.data?.[0];
  const entry={id:s.id,action:'manual',reason:'',fingerprint:fingerprint(s),oldAmount:item?.price?.unit_amount??null,newAmount:null,estimatedCredit:null};
  const scope=metadata.voci_school||metadata.voci_user;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope||'')||Boolean(metadata.voci_school)===Boolean(metadata.voci_user))return {...entry,reason:'Ungültige Kontozuordnung'};
  if((metadata.voci_plan==='individual')!==Boolean(metadata.voci_user))return {...entry,reason:'Tarif passt nicht zur Kontozuordnung'};
  try {entry.newAmount=price(metadata.voci_plan,metadata.voci_subjects?metadata.voci_subjects.split(','):[],subjects);}
  catch {return {...entry,reason:'Unbekannter Tarif oder Fächer'};}
  if(s.cancel_at_period_end||s.cancel_at||s.status==='canceled')return {...entry,reason:'Gekündigtes Abo: Enddatum und Restperiode einzeln prüfen'};
  if(s.schedule||metadata.voci_pending_plan||s.pending_update||s.pause_collection)return {...entry,reason:'Geplanter Wechsel oder pausierte Abrechnung'};
  if(s.status!=='active'||s.latest_invoice?.status!=='paid')return {...entry,reason:'Keine bestätigte bezahlte Periode'};
  if(s.items?.data?.length!==1||item.quantity!==1||item.price.currency!=='chf'||item.price.recurring?.interval!=='month'||item.price.recurring?.interval_count!==1||s.collection_method!=='charge_automatically')return {...entry,reason:'Abweichende Abrechnungskonfiguration'};
  if(s.discount||s.discounts?.length||s.default_tax_rates?.length||s.automatic_tax?.enabled||item.discounts?.length||item.tax_rates?.length)return {...entry,reason:'Rabatt oder Steuerkonfiguration: Einzelprüfung nötig'};
  if(!Number.isInteger(entry.oldAmount)||!Number.isFinite(s.current_period_start)||!Number.isFinite(s.current_period_end)||s.current_period_end<=s.current_period_start||at/1000<s.current_period_start||at/1000>=s.current_period_end)return {...entry,reason:'Abrechnungsperiode ungültig oder abgelaufen'};
  if(metadata.voci_price_version===PRICE_VERSION||entry.oldAmount===entry.newAmount)return {...entry,action:'unchanged',reason:'Preis bereits aktuell'};
  entry.estimatedCredit=Math.round(entry.oldAmount*(s.current_period_end-at/1000)/(s.current_period_end-s.current_period_start));
  return {...entry,action:'update',reason:'Neue monatliche Periode mit anteiliger Verrechnung',estimatedBalance:entry.newAmount-entry.estimatedCredit};
}

export async function createReport(io,now=Date.now()){
  const entries=[];let cursor='';let mode=null;
  do {
    const page=await io.stripe(`subscriptions?status=all&limit=100&expand[]=data.latest_invoice${cursor?`&starting_after=${encodeURIComponent(cursor)}`:''}`);
    for(const subscription of page.data){
      if(!subscription.metadata?.voci_plan)continue;
      if(mode!==null&&mode!==Boolean(subscription.livemode))throw Error('Gemischte Stripe-Umgebungen.');
      mode=Boolean(subscription.livemode);
      entries.push(planChange(subscription,now));
    }
    if(page.has_more&&!page.data.length)throw Error('Unvollständige Stripe-Liste.');
    cursor=page.has_more?page.data.at(-1).id:'';
  }while(cursor);
  return {version:PRICE_VERSION,createdAt:new Date(now).toISOString(),livemode:mode,estimateOnly:true,entries};
}

export async function applyReport(report,io,now=Date.now()){
  const at=Date.parse(report?.createdAt);
  if(report?.version!==PRICE_VERSION||!Number.isFinite(at)||at>now||now-at>24*3600000||!Array.isArray(report.entries))throw Error('Ungültiger oder veralteter Bericht. Neue Vorschau erstellen.');
  const entries=report.entries.filter(e=>e.action==='update');
  if(new Set(entries.map(e=>e.id)).size!==entries.length||entries.some(e=>!/^sub_[A-Za-z0-9]+$/.test(e.id)))throw Error('Ungültige Aboauswahl.');
  const validate=(current,entry)=>{
    if(Boolean(current.livemode)!==report.livemode)throw Error('Falsche Stripe-Umgebung.');
    if(current.metadata?.voci_price_version===PRICE_VERSION)return;
    if(JSON.stringify(canonical(planChange(current,at)))!==JSON.stringify(canonical(entry)))throw Error(`Stand für ${entry.id} geändert. Neue Vorschau erforderlich.`);
    if(current.current_period_end<=now/1000)throw Error('Abrechnungsperiode inzwischen abgelaufen.');
  };
  // Validate the full selection before the first change, then recheck under each billing lease.
  for(const entry of entries)validate(await io.stripe(subscriptionPath(entry.id)),entry);
  const results=[];
  for(const entry of entries){
    let current=await io.stripe(subscriptionPath(entry.id));validate(current,entry);
    const scope=current.metadata.voci_school||current.metadata.voci_user,lease=randomUUID();
    if(!await io.rpc('voci_billing_acquire',{scope_id:scope,lease_id:lease}))throw Error('Abonnement wird bereits bearbeitet. Später erneut versuchen.');
    try {
      current=await io.stripe(subscriptionPath(entry.id));validate(current,entry);
      const already=current.metadata.voci_price_version===PRICE_VERSION;
      if(!already){
        const item=current.items.data[0];
        current=await io.stripe(`subscriptions/${entry.id}`,{
          'items[0][id]':item.id,'items[0][price_data][currency]':'chf',
          'items[0][price_data][product]':typeof item.price.product==='string'?item.price.product:item.price.product.id,
          'items[0][price_data][unit_amount]':String(entry.newAmount),'items[0][price_data][recurring][interval]':'month',
          billing_cycle_anchor:'now',proration_behavior:'always_invoice',payment_behavior:'error_if_incomplete',
          'metadata[voci_price_version]':PRICE_VERSION,'expand[0]':'latest_invoice'
        },`reprice-${PRICE_VERSION}-${entry.id}`);
      }
      await io.rpc('voci_billing_sync',{event_id:`reprice-${PRICE_VERSION}-${entry.id}`,details:await paidSubscriptionDetails(current,io.stripe),lease_id:lease});
      results.push({id:entry.id,status:already?'already_applied':'applied'});
    } finally {await io.rpc('voci_billing_release',{scope_id:scope,lease_id:lease});}
  }
  return results;
}

async function main(){
  const args=process.argv.slice(2),dry=args.includes('--dry-run'),apply=args.includes('--apply');
  if(dry===apply||args.some((x,i)=>!['--dry-run','--apply','--report'].includes(x)&&args[i-1]!=='--report'))throw Error('Aufruf: --dry-run oder --apply, jeweils mit --report <Datei>.');
  const reportArg=args.indexOf('--report'),file=resolve(reportArg>=0?args[reportArg+1]||'':'.private/reprice-report.json');
  if(reportArg>=0&&!args[reportArg+1])throw Error('Berichtsdatei fehlt.');
  const required=name=>{if(!process.env[name])throw Error(`Konfiguration fehlt: ${name}`);return process.env[name];};
  const key=required('STRIPE_SECRET_KEY');
  const request=async(url,options)=>{const r=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});const body=await r.text();const data=body?JSON.parse(body):null;if(!r.ok)throw Error(`Serveranfrage fehlgeschlagen (${r.status}). Zustand prüfen und denselben Bericht erneut verwenden.`);return data;};
  const io={
    stripe:(path,values,idempotencyKey)=>request(`https://api.stripe.com/v1/${path}`,{method:values?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2025-02-24.acacia',...(values?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:values?new URLSearchParams(values):undefined}),
    rpc:(name,body)=>{const secret=required('SUPABASE_SERVICE_ROLE_KEY'),url=new URL(required('SUPABASE_URL'));if(url.protocol!=='https:')throw Error('Supabase benötigt HTTPS.');return request(`${url.origin}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${secret}`,apikey:secret,'Content-Type':'application/json'},body:JSON.stringify(body)});}
  };
  if(dry){const report=await createReport(io);await mkdir(dirname(file),{recursive:true,mode:0o700});await writeFile(file,JSON.stringify(report,null,2),{mode:0o600,flag:'wx'});console.log(`Vorschau gespeichert: ${file}. ${report.entries.length} Voci-Abos. Keine Abos geändert.`);}
  else {if(reportArg<0)throw Error('--apply benötigt --report <Datei>.');const report=JSON.parse(await readFile(file,'utf8'));console.log(JSON.stringify(await applyReport(report,io),null,2));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
