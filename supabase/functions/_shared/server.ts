export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Konfiguration fehlt: ${name}`);
  return value;
}
export function cors(request: Request): Record<string,string> {
  const allowed = new URL(env('VOCI_APP_URL')).origin;
  const origin = request.headers.get('origin');
  if (origin && origin !== allowed) throw new Error('Diese Website ist nicht freigegeben.');
  return { 'Access-Control-Allow-Origin':allowed, 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Vary':'Origin' };
}
export async function readJSON(request: Request, max = 20000) {
  const body = await request.text();
  if (body.length > max) throw new Error('Anfrage zu gross.');
  return JSON.parse(body);
}
export async function rpc(name: string, body: unknown) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method:'POST', headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' }, body:JSON.stringify(body), signal:AbortSignal.timeout(20000)
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(result?.message || 'Datenbankanfrage fehlgeschlagen.');
  return result;
}
export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Anmeldung erforderlich.');
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {headers:{ apikey:env('SUPABASE_ANON_KEY'), Authorization:authorization },signal:AbortSignal.timeout(10000)});
  const user = await response.json();
  if (!response.ok || !user.id || !user.email_confirmed_at) throw new Error('Bitte mit bestätigter E-Mail anmelden.');
  return user;
}
export async function stripe(path: string, values?: Record<string,string>, idempotencyKey?: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method:values?'POST':'GET',
    headers:{ Authorization:`Bearer ${env('STRIPE_SECRET_KEY')}`, 'Stripe-Version':'2025-02-24.acacia', ...(values?{'Content-Type':'application/x-www-form-urlencoded'}:{}), ...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{}) },
    body:values?new URLSearchParams(values):undefined, signal:AbortSignal.timeout(25000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Der Zahlungsanbieter ist gerade nicht erreichbar.');
  return result;
}
export function price(plan: string, subjects: string[], allowed: string[]) {
  if (plan === 'school_small') return 4000;
  if (plan === 'school_large') return 10000;
  if (plan !== 'individual' || !Array.isArray(subjects) || !subjects.length || subjects.length>5 || new Set(subjects).size!==subjects.length || subjects.some(s=>!allowed.includes(s))) throw new Error('Ungültige Fächerauswahl.');
  return (3 + Math.min(subjects.length-1,2)*2 + Math.max(subjects.length-3,0))*100;
}
export function subscriptionDetails(subscription: any) {
  const m = subscription.metadata;
  if (!m?.voci_plan || (!m.voci_school && !m.voci_user)) throw new Error('Kein Voci-Abonnement.');
  return { school_id:m.voci_school||null, user_id:m.voci_user||null, plan:m.voci_plan,
    subjects:m.voci_subjects?m.voci_subjects.split(','):[], stripe_customer:subscription.customer,
    stripe_subscription:subscription.id, status:subscription.status,
    period_end:new Date(subscription.current_period_end*1000).toISOString(), cancel_at_period_end:subscription.cancel_at_period_end,
    pending_plan:m.voci_pending_plan||null,pending_at:m.voci_pending_at||null };
}
