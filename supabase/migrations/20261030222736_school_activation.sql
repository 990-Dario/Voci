begin;
alter table voci_private.admin_requests add column completed_at timestamptz, add column review_due_at timestamptz, add column delay_reason text;
alter table voci_private.admin_requests drop column payment_deadline;
create table voci_private.school_activations (
  school_id uuid primary key references voci_private.schools on delete cascade,
  approved_at timestamptz not null,
  scheduled_at timestamptz not null,
  activated_at timestamptz,
  free_until timestamptz,
  status text not null default 'scheduled' check(status in ('scheduled','awaiting_payment','active','free_month','payment_failed')),
  plan text not null default 'school_small' check(plan in ('school_small','school_large')),
  stripe_customer text unique,
  stripe_payment_method text,
  stripe_subscription text unique,
  setup_session_id text,
  charge_started_at timestamptz,
  version integer not null default 1,
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  first_paid_at timestamptz,
  minimum_paid_until timestamptz,
  cancel_requested boolean not null default false,
  last_error text
);
alter table voci_private.school_activations enable row level security;
revoke all on voci_private.school_activations from public,anon,authenticated;
create function voci_private.next_school_day(at_time timestamptz) returns timestamptz
language sql immutable set search_path='' as $$select ((at_time at time zone 'Europe/Zurich')::date+1)::timestamp at time zone 'Europe/Zurich'$$;

create or replace function voci_private.has_access(s uuid,u uuid,subject_id text default null) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from voci_private.subscriptions b where b.status='active' and b.period_end>now()
    and ((b.school_id=s and not exists(select 1 from voci_private.school_activations a where a.school_id=s and (a.scheduled_at>now() or a.status not in ('active','free_month'))))
      or (b.user_id=u and (subject_id is null or subject_id=any(b.subjects)))))
    or exists(select 1 from voci_private.school_activations a where a.school_id=s and a.scheduled_at<=now() and a.free_until>now() and a.status='free_month')
$$;

create function voci_private.approve_school_request(request_id uuid,confirmed_domain text,complete_at timestamptz,delay text) returns void
language plpgsql security definer set search_path='' as $$
declare r voci_private.admin_requests; domain text; starts timestamptz; free_end timestamptz; inserted boolean;
begin
  if not voci_private.is_operator() then raise exception 'Nur Voci kann diese Freigabe erteilen.'; end if;
  select * into r from voci_private.admin_requests where id=request_id and status='pending' for update;
  if not found then raise exception 'Offener Antrag nicht gefunden.'; end if;
  perform 1 from voci_private.profiles where user_id=r.user_id for update;
  perform 1 from voci_private.schools where id=r.school_id for update;
  if not exists(select 1 from voci_private.profiles where user_id=r.user_id and school_id=r.school_id) then raise exception 'Die Person hat inzwischen die Schule gewechselt.'; end if;
  select split_part(lower(email),'@',2) into domain from auth.users where id=r.user_id and email_confirmed_at is not null;
  if domain is null or domain is distinct from lower(trim(confirmed_domain)) then raise exception 'Die bestätigte Schuldomain muss zur Antragsadresse passen.'; end if;
  complete_at:=coalesce(r.completed_at,complete_at,r.created_at);
  if complete_at<r.created_at or complete_at>now() then raise exception 'Das Eingangsdatum der vollständigen Unterlagen ist ungültig.'; end if;
  if length(coalesce(delay,''))>2000 then raise exception 'Die Verzugsbegründung ist zu lang.'; end if;
  if nullif(trim(delay),'') is not null and now()<=complete_at+interval '14 days' then raise exception 'Ein Verzugsmonat setzt eine überschrittene Prüffrist voraus.'; end if;
  update voci_private.schools set email_domain=domain where id=r.school_id;
  insert into voci_private.staff(school_id,user_id,is_admin,is_teacher) values(r.school_id,r.user_id,r.request_kind='admin',r.request_kind='teacher')
    on conflict(school_id,user_id) do update set is_admin=staff.is_admin or excluded.is_admin,is_teacher=staff.is_teacher or excluded.is_teacher;
  perform voci_private.check_staff_limit(r.school_id);
  update voci_private.admin_requests set status='approved',reviewed_at=now(),completed_at=complete_at,review_due_at=complete_at+interval '14 days',delay_reason=nullif(trim(delay),'') where id=request_id;
  starts:=voci_private.next_school_day(now());
  if nullif(trim(delay),'') is not null then free_end:=((starts at time zone 'Europe/Zurich')+interval '1 month') at time zone 'Europe/Zurich'; end if;
  if r.request_kind='admin' and not exists(select 1 from voci_private.subscriptions where school_id=r.school_id and stripe_subscription is not null) then
    insert into voci_private.school_activations(school_id,approved_at,scheduled_at,free_until) values(r.school_id,now(),starts,free_end) on conflict do nothing;
    inserted:=found;
  end if;
  insert into voci_private.mail_queue(user_id,category,subject,body) values(r.user_id,'transactional','Deine Berechtigung wurde bestätigt',
    case when coalesce(inserted,false) then 'Du kannst jetzt Lehrpersonen einladen. Der Unterrichtszugriff beginnt frühestens am '||to_char(starts at time zone 'Europe/Zurich','DD.MM.YYYY')||' um 00:00 Uhr Schweizer Zeit. Hinterlege deine Karte in Voci unter Schule → Abonnement. '||case when free_end is not null then 'Wegen unserer verspäteten Prüfung erhält die Schule einen Gratismonat. Danach beginnt der erste kostenpflichtige Monat.' else 'Die erste Belastung erfolgt frühestens am Aktivierungstag; Zugriff besteht nach bestätigter Zahlung.' end
    else 'Deine Rolle wurde bestätigt. Öffne Voci für die Schulverwaltung beziehungsweise dein Lehrpersonenabo.' end);
end $$;

create function public.voci_claim_activations(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a voci_private.school_activations; lease uuid; jobs jsonb:='[]';
begin
  for a in select * from voci_private.school_activations where scheduled_at<=now() and next_attempt_at<=now()
    and (status in ('scheduled','awaiting_payment') or (status='free_month' and free_until<=now())
      or (status='active' and cancel_requested and exists(select 1 from voci_private.subscriptions b where b.school_id=school_activations.school_id and not b.cancel_at_period_end)))
    order by next_attempt_at limit greatest(1,least(batch_size,20)) for update skip locked loop
    lease:=gen_random_uuid();
    if public.voci_billing_acquire(a.school_id,lease) then
      update voci_private.school_activations set next_attempt_at=now()+interval '5 minutes',attempts=attempts+1 where school_id=a.school_id;
      jobs:=jobs||jsonb_build_array(to_jsonb(a)||jsonb_build_object('lease_id',lease));
    end if;
  end loop;
  return jobs;
end $$;

create function public.voci_finish_activation(school_id uuid,outcome jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a voci_private.school_activations; state text:=outcome->>'status';
begin
  if not exists(select 1 from voci_private.billing_locks l where l.scope=school_id and l.lock_id=(outcome->>'lease_id')::uuid and l.expires_at>now()) then raise exception 'Aktivierungsreservierung abgelaufen.'; end if;
  select * into a from voci_private.school_activations where school_activations.school_id=voci_finish_activation.school_id for update;
  if a.scheduled_at>now() then raise exception 'Aktivierung erst am Folgetag.'; end if;
  if state='free_month' and (a.free_until is null or a.free_until<=now()) then raise exception 'Kein gültiger Freimonat.'; end if;
  if state='active' and not exists(select 1 from voci_private.subscriptions b where b.school_id=a.school_id and b.status='active' and b.period_end>now()) then raise exception 'Zahlung noch nicht bestätigt.'; end if;
  if state not in ('free_month','active','awaiting_payment','payment_failed') or state is null then raise exception 'Ungültiger Aktivierungsstatus.'; end if;
  update voci_private.school_activations set status=state,activated_at=case when state in ('active','free_month') then coalesce(activated_at,now()) else activated_at end,
    stripe_subscription=coalesce(outcome->>'subscription_id',stripe_subscription),last_error=left(outcome->>'error',300),next_attempt_at=now()+interval '1 hour'
    where school_activations.school_id=a.school_id;
  if state='payment_failed' and a.status is distinct from state then
    insert into voci_private.mail_queue(user_id,category,subject,body) select user_id,'transactional','Aktion für dein Schulabo erforderlich','Die Zahlung konnte noch nicht bestätigt werden. Öffne Voci → Schule → Abonnement, um die Zahlung zu prüfen. Unterrichtszugriff besteht erst nach bestätigter Zahlung oder während eines gewährten Freimonats.' from voci_private.staff where staff.school_id=a.school_id and is_admin;
  end if;
  perform public.voci_billing_release(a.school_id,(outcome->>'lease_id')::uuid);
end $$;

create or replace function public.voci_school(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid(); s uuid; c uuid; target uuid; rid uuid; d jsonb; item jsonb;
  profile_row voci_private.profiles; k voci_private.classes; inv voci_private.staff_invites; code voci_private.join_codes;
  email_addr text; base text; candidate text; suffix integer:=0; staff_count integer; is_a boolean; is_t boolean;
begin
  if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'Bitte zuerst deine E-Mail bestätigen und anmelden.'; end if;
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>2000000 then raise exception 'Ungültige Anfrage.'; end if;
  insert into voci_private.profiles(user_id) values(u) on conflict do nothing;
  select * into profile_row from voci_private.profiles where user_id=u for update;
  select lower(email) into email_addr from auth.users where id=u;
  s:=profile_row.school_id;

  if action='profile' then
    if length(trim(payload->>'first_name')) not between 1 and 80 or length(trim(payload->>'last_name')) not between 1 and 80 then raise exception 'Bitte Vor- und Nachnamen angeben.'; end if;
    if exists(select 1 from voci_private.class_students where user_id=u) and profile_row.school_id is distinct from nullif(payload->>'school_id','')::uuid then raise exception 'Eine Schuländerung muss die Lehrperson vornehmen, solange du in einer Klasse bist.'; end if;
    if nullif(payload->>'school_id','') is not null then
      s:=(payload->>'school_id')::uuid;
    else
      if coalesce(payload->>'postal_code','') !~ '^[0-9]{4,6}$' or coalesce(length(trim(payload->>'school_name')),0) not between 2 and 120 or coalesce(length(trim(payload->>'town')),0) not between 2 and 120 then raise exception 'Bitte Schule, Postleitzahl und Ort angeben.'; end if;
      if exists(select 1 from voci_private.schools where postal_code=payload->>'postal_code') and coalesce(payload->>'confirm_distinct','false')<>'true' then raise exception 'SCHOOL_DUPLICATE: Bitte prüfe zuerst die Schulen mit dieser Postleitzahl.'; end if;
      insert into voci_private.schools(name,postal_code,town) values(trim(payload->>'school_name'),payload->>'postal_code',trim(payload->>'town'))
        on conflict (lower(trim(name)),postal_code,lower(trim(town))) do update set name=excluded.name returning id into s;
    end if;
    perform 1 from voci_private.schools where id=s for update;
    if not found then raise exception 'Schule nicht gefunden.'; end if;
    if profile_row.school_id is distinct from s and exists(select 1 from voci_private.staff where user_id=u) then raise exception 'Bitte zuerst deine Schulmitgliedschaft durch einen Administrator klären lassen.'; end if;
    base:=regexp_replace(lower(trim(payload->>'first_name')), '[^[:alnum:]]+', '', 'g')||'.'||regexp_replace(lower(trim(payload->>'last_name')), '[^[:alnum:]]+', '', 'g');
    if base='.' then raise exception 'Der Name muss Buchstaben enthalten.'; end if;
    candidate:=base;
    while exists(select 1 from voci_private.profiles where school_id=s and username=candidate and user_id<>u) loop suffix:=suffix+1; candidate:=base||suffix; end loop;
    update voci_private.profiles set school_id=s,first_name=trim(payload->>'first_name'),last_name=trim(payload->>'last_name'),username=candidate where user_id=u;
  elsif action='preferences' then
    if exists(select 1 from jsonb_each(payload) x where x.key not in ('exam_created','exam_changed','exam_deleted','subscription_cancelled','admin_changed') or jsonb_typeof(x.value)<>'boolean') then raise exception 'Ungültige Benachrichtigungseinstellung.'; end if;
    update voci_private.profiles set preferences=preferences||payload where user_id=u;
  elsif action='request_admin' then
    if s is null then raise exception 'Bitte zuerst deine Schule im Profil auswählen.'; end if;
    if split_part(email_addr,'@',2) in ('gmail.com','googlemail.com','outlook.com','hotmail.com','gmx.ch','gmx.de','bluewin.ch','icloud.com','yahoo.com','proton.me') then raise exception 'Verwende für den Antrag eine E-Mail-Adresse deiner Schule.'; end if;
    insert into voci_private.admin_requests(school_id,user_id,reason,request_kind) values(s,u,trim(payload->>'reason'),coalesce(payload->>'request_kind','admin')) returning id into rid;
    return jsonb_build_object('request_id',rid);
  elsif action='review_admin' then
    if not voci_private.is_operator() then raise exception 'Nur Voci kann diese Freigabe erteilen.'; end if;
    select school_id,user_id into s,target from voci_private.admin_requests where id=(payload->>'id')::uuid and status='pending' for update;
    if not found then raise exception 'Offener Antrag nicht gefunden.'; end if;
    perform 1 from voci_private.profiles where user_id=target for update;
    perform 1 from voci_private.schools where id=s for update;
    if payload->>'approve'='true' then
      perform voci_private.approve_school_request((payload->>'id')::uuid,payload->>'email_domain',nullif(payload->>'completed_at','')::timestamptz,payload->>'delay_reason');
    else update voci_private.admin_requests set status='rejected',reviewed_at=now() where id=(payload->>'id')::uuid; end if;
  elsif action in ('invite_staff','staff_role','remove_staff') then
    perform 1 from voci_private.schools where id=s for update;
    if not voci_private.is_admin(s) then raise exception 'Nur Schuladministratoren können Lehrpersonen verwalten.'; end if;
    if action='invite_staff' then
      email_addr:=lower(trim(payload->>'email'));
      if email_addr !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(email_addr)>254 or split_part(email_addr,'@',2)<>(select email_domain from voci_private.schools where id=s) then raise exception 'Die Einladung benötigt eine gültige Adresse der bestätigten Schuldomain.'; end if;
      is_a:=coalesce((payload->>'is_admin')::boolean,false); is_t:=coalesce((payload->>'is_teacher')::boolean,true);
      delete from voci_private.staff_invites where school_id=s and email=email_addr and accepted_at is null and expires_at<=now();
      insert into voci_private.staff_invites(school_id,email,is_admin,is_teacher) values(s,email_addr,is_a,is_t) returning id into rid;
      perform voci_private.check_staff_limit(s);
      return jsonb_build_object('token',rid,'expires_at',now()+interval '7 days');
    end if;
    target:=(payload->>'user_id')::uuid;
    select is_admin into is_a from voci_private.staff where school_id=s and user_id=target;
    select count(*) into staff_count from voci_private.staff where school_id=s and is_teacher;
    if (action='remove_staff' or payload->>'is_teacher'='false') and exists(
      select 1 from voci_private.class_teachers t join voci_private.classes x on x.id=t.class_id
      where x.school_id=s and x.deleted_at is null and t.user_id=target
        and not exists(select 1 from voci_private.class_teachers other where other.class_id=t.class_id and other.user_id<>target)
    ) then raise exception 'Bitte zuerst eine weitere Lehrperson für die betroffenen Klassen zuweisen.'; end if;
    if action='remove_staff' then delete from voci_private.staff where school_id=s and user_id=target;
    else update voci_private.staff set is_admin=(payload->>'is_admin')::boolean,is_teacher=(payload->>'is_teacher')::boolean where school_id=s and user_id=target; end if;
    if not exists(select 1 from voci_private.staff where school_id=s and is_admin) then raise exception 'Mindestens ein Schuladministrator muss erhalten bleiben.'; end if;
    perform voci_private.check_staff_limit(s,(select count(*) from voci_private.staff where school_id=s and is_teacher)<=staff_count);
    delete from voci_private.class_teachers t using voci_private.classes x where t.class_id=x.id and x.school_id=s and t.user_id=target
      and not exists(select 1 from voci_private.staff where school_id=s and user_id=target and is_teacher);
    if coalesce(is_a,false) is distinct from exists(select 1 from voci_private.staff where school_id=s and user_id=target and is_admin) then
      insert into voci_private.mail_queue(user_id,category,subject,body)
        select user_id,'admin_changed','Administration deiner Schule geändert','Die Rollen in der Schuladministration wurden geändert. Details findest du in Voci.' from voci_private.staff where school_id=s and is_teacher;
    end if;
  elsif action='accept_invite' then
    select * into inv from voci_private.staff_invites where id=(payload->>'token')::uuid for update;
    if inv.id is null or inv.accepted_at is not null or inv.expires_at<=now() or inv.email<>email_addr then raise exception 'Die Einladung ist abgelaufen oder gehört zu einer anderen E-Mail-Adresse.'; end if;
    if profile_row.school_id is distinct from inv.school_id then raise exception 'Wähle zuerst die Schule der Einladung in deinem Profil.'; end if;
    perform 1 from voci_private.schools where id=inv.school_id for update;
    update voci_private.staff_invites set accepted_at=now() where id=inv.id;
    insert into voci_private.staff(school_id,user_id,is_admin,is_teacher) values(inv.school_id,u,inv.is_admin,inv.is_teacher)
      on conflict(school_id,user_id) do update set is_admin=staff.is_admin or excluded.is_admin,is_teacher=staff.is_teacher or excluded.is_teacher;
    perform voci_private.check_staff_limit(inv.school_id);
    if inv.is_admin then insert into voci_private.mail_queue(user_id,category,subject,body) select user_id,'admin_changed','Neue Schuladministration','Eine weitere Person verwaltet nun deine Schule.' from voci_private.staff where school_id=inv.school_id and is_teacher; end if;
  elsif action='create_class' then
    perform 1 from voci_private.schools where id=s for update;
    if not exists(select 1 from voci_private.staff where user_id=u and school_id=s and is_teacher) or not voci_private.has_access(s,u) then raise exception 'Eine bestätigte Lehrpersonenrolle und ein aktives Abo sind erforderlich.'; end if;
    insert into voci_private.classes(school_id,name) values(s,trim(payload->>'name')) returning id into c;
    insert into voci_private.class_teachers values(c,u);
    return jsonb_build_object('class_id',c);
  elsif action='join_class' then
    select * into code from voci_private.join_codes where id=(payload->>'code')::uuid for update;
    select * into k from voci_private.classes where id=code.class_id for update;
    if code.id is null or code.expires_at<=now() or code.uses>=code.max_uses or k.deleted_at is not null or k.school_id is distinct from s or profile_row.username is null then raise exception 'Der Code ist ungültig, aufgebraucht, abgelaufen oder gehört zu einer anderen Schule.'; end if;
    if not exists(select 1 from voci_private.class_teachers t where t.class_id=k.id and voci_private.has_access(k.school_id,t.user_id)) then raise exception 'Das Klassenabo ist nicht aktiv.'; end if;
    insert into voci_private.class_students(class_id,user_id) values(k.id,u) on conflict do nothing;
    if found then update voci_private.join_codes set uses=uses+1 where id=code.id; end if;
  elsif action in ('create_code','remove_student','add_teacher','remove_teacher','save_exam','delete_exam','delete_class','export_class') then
    c:=(payload->>'class_id')::uuid;
    perform 1 from voci_private.schools where id=(select school_id from voci_private.classes where id=c) for update;
    if action='export_class' then
      if not exists(select 1 from voci_private.classes x join voci_private.class_teachers t on t.class_id=x.id join voci_private.staff st on st.school_id=x.school_id and st.user_id=t.user_id and st.is_teacher
        where x.id=c and t.user_id=u and (x.deleted_at is null or x.deleted_at>now()-interval '7 days')) then raise exception 'Kein Zugriff auf diesen Klassenexport.'; end if;
    elsif not voci_private.can_teach(c) then raise exception 'Für diese Klasse fehlen dir die Lehrpersonenrechte oder ein aktives Abo.'; end if;
    select * into k from voci_private.classes where id=c for update;
    if action='create_code' then
      insert into voci_private.join_codes(class_id,max_uses) values(c,(payload->>'max_uses')::integer) returning id into rid;
      return jsonb_build_object('code',rid,'expires_at',now()+interval '7 days');
    elsif action='remove_student' then delete from voci_private.class_students where class_id=c and user_id=(payload->>'user_id')::uuid;
    elsif action='add_teacher' then
      target:=(payload->>'user_id')::uuid;
      if not exists(select 1 from voci_private.staff where school_id=k.school_id and user_id=target and is_teacher) then raise exception 'Diese Person ist keine Lehrperson deiner Schule.'; end if;
      insert into voci_private.class_teachers values(c,target) on conflict do nothing;
    elsif action='remove_teacher' then
      delete from voci_private.class_teachers where class_id=c and user_id=(payload->>'user_id')::uuid;
      if not exists(select 1 from voci_private.class_teachers where class_id=c) then raise exception 'Mindestens eine Lehrperson muss die Klasse verwalten.'; end if;
    elsif action='delete_class' then update voci_private.classes set deleted_at=now() where id=c;
    elsif action='save_exam' then
      d:=payload->'set_data';
      if not coalesce(voci_private.valid_set(d),false) then raise exception 'Wähle mindestens ein gültiges Lernziel.'; end if;
      if not voci_private.has_access(k.school_id,u,coalesce(d->>'subjectId',d->>'language')) then raise exception 'Dieses Fach ist nicht in deinem Abo enthalten.'; end if;
      rid:=nullif(payload->>'id','')::uuid;
      if rid is null then
        insert into voci_private.exams(class_id,title,exam_date,set_data) values(c,trim(payload->>'title'),(payload->>'exam_date')::date,d) returning id into rid;
        base:='exam_created';
      else
        update voci_private.exams set title=trim(payload->>'title'),exam_date=(payload->>'exam_date')::date,set_data=d,updated_at=now() where id=rid and class_id=c;
        if not found then raise exception 'Prüfung nicht gefunden.'; end if;
        base:='exam_changed';
      end if;
      insert into voci_private.mail_queue(user_id,category,subject,body)
        select user_id,base,case when base='exam_created' then 'Neue Klassenprüfung' else 'Klassenprüfung geändert' end,
          k.name||': '||trim(payload->>'title')||' am '||(payload->>'exam_date')||'. Öffne Voci → Klassen, um dich vorzubereiten.' from voci_private.class_students where class_id=c;
    elsif action='delete_exam' then
      delete from voci_private.exams where id=(payload->>'id')::uuid and class_id=c returning title into base;
      if found then insert into voci_private.mail_queue(user_id,category,subject,body) select user_id,'exam_deleted','Klassenprüfung gelöscht',k.name||': Die Prüfung «'||base||'» wurde gelöscht.' from voci_private.class_students where class_id=c; end if;
    elsif action='export_class' then
      return jsonb_build_object('format','voci-class','version',2,'exported_at',now(),'school_id',k.school_id,'name',k.name,
        'students',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'username',p.username,'first_name',p.first_name,'last_name',p.last_name)) from voci_private.class_students m join voci_private.profiles p on p.user_id=m.user_id where m.class_id=c),'[]'::jsonb),
        'teachers',coalesce((select jsonb_agg(user_id) from voci_private.class_teachers where class_id=c),'[]'::jsonb),
        'exams',coalesce((select jsonb_agg(jsonb_build_object('title',title,'exam_date',exam_date,'set_data',set_data)) from voci_private.exams where class_id=c),'[]'::jsonb));
    end if;
  elsif action='import_class' then
    perform 1 from voci_private.schools where id=s for update;
    if not exists(select 1 from voci_private.staff where school_id=s and user_id=u and is_teacher) or not voci_private.has_access(s,u) then raise exception 'Lehrpersonenrechte und ein aktives Abo sind erforderlich.'; end if;
    d:=payload->'data';
    if d->>'format' is distinct from 'voci-class' or coalesce(d->>'version','') not in ('1','2') or d->>'school_id' is distinct from s::text or jsonb_typeof(d->'students') is distinct from 'array' or jsonb_typeof(d->'teachers') is distinct from 'array' or jsonb_typeof(d->'exams') is distinct from 'array' then raise exception 'Ungültiger Export oder Export einer anderen Schule.'; end if;
    if jsonb_array_length(d->'students')>10000 or jsonb_array_length(d->'exams')>1000 then raise exception 'Der Export enthält zu viele Einträge.'; end if;
    insert into voci_private.classes(school_id,name) values(s,trim(d->>'name')) returning id into c;
    insert into voci_private.class_teachers values(c,u);
    for item in select * from jsonb_array_elements(d->'teachers') loop
      if not exists(select 1 from voci_private.staff where school_id=s and user_id=(item#>>'{}')::uuid and is_teacher) then raise exception 'Eine Lehrperson fehlt oder gehört nicht zu deiner Schule.'; end if;
      insert into voci_private.class_teachers select c,user_id from voci_private.staff where school_id=s and user_id=(item#>>'{}')::uuid and is_teacher on conflict do nothing;
    end loop;
    for item in select * from jsonb_array_elements(d->'students') loop
      target:=(item->>'user_id')::uuid;
      if not exists(select 1 from voci_private.profiles where user_id=target and school_id=s) then raise exception 'Ein Schülerkonto fehlt oder gehört nicht zu deiner Schule. Der gesamte Import wurde abgebrochen.'; end if;
      insert into voci_private.class_students(class_id,user_id) values(c,target) on conflict do nothing;
    end loop;
    for item in select * from jsonb_array_elements(d->'exams') loop
      if not coalesce(voci_private.valid_set(item->'set_data'),false) or not voci_private.has_access(s,u,coalesce(item->'set_data'->>'subjectId',item->'set_data'->>'language')) then raise exception 'Ungültige Prüfung oder Fach nicht im Abo.'; end if;
      insert into voci_private.exams(class_id,title,exam_date,set_data) values(c,item->>'title',(item->>'exam_date')::date,item->'set_data');
    end loop;
    return jsonb_build_object('class_id',c);
  elsif action<>'snapshot' then raise exception 'Unbekannte Aktion.';
  end if;
  return jsonb_build_object('ok',true);
end $$;


create or replace function public.voci_school_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s uuid; data jsonb;
begin
  perform public.voci_school('snapshot');
  select school_id into s from voci_private.profiles where user_id=u;
  select jsonb_build_object(
    'profile',(select to_jsonb(p) from voci_private.profiles p where user_id=u),
    'school',(select to_jsonb(k)-'email_domain' from voci_private.schools k where id=s),
    'activation',(select jsonb_build_object('status',a.status,'approved_at',a.approved_at,'scheduled_at',a.scheduled_at,'activated_at',a.activated_at,'free_until',a.free_until,'first_paid_at',a.first_paid_at,'minimum_paid_until',a.minimum_paid_until,'cancel_requested',a.cancel_requested,'payment_method_ready',a.stripe_payment_method is not null,'plan',a.plan) from voci_private.school_activations a where a.school_id=s and exists(select 1 from voci_private.staff where school_id=s and user_id=u)),
    'role',(select to_jsonb(t) from voci_private.staff t where school_id=s and user_id=u),
    'is_operator',voci_private.is_operator(),
    'subjects',coalesce((select jsonb_agg(to_jsonb(x)) from voci_private.subjects x where enabled),'[]'::jsonb),
    'subscriptions',coalesce((select jsonb_agg(to_jsonb(b)-'stripe_customer'-'stripe_subscription') from voci_private.subscriptions b where b.user_id=u or (b.school_id=s and voci_private.is_admin(s))),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'first_name',p.first_name,'last_name',p.last_name,'username',p.username,'is_admin',t.is_admin,'is_teacher',t.is_teacher)) from voci_private.staff t join voci_private.profiles p on p.user_id=t.user_id where t.school_id=s and (voci_private.is_admin(s) or exists(select 1 from voci_private.staff where user_id=u and school_id=s and is_teacher))),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(to_jsonb(i)) from voci_private.staff_invites i where school_id=s and voci_private.is_admin(s) and accepted_at is null and expires_at>now()),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(to_jsonb(r)) from voci_private.admin_requests r where r.user_id=u),'[]'::jsonb),
    'review_requests',case when voci_private.is_operator() then coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('email',a.email,'school_name',k.name,'postal_code',k.postal_code,'town',k.town)) from voci_private.admin_requests r join auth.users a on a.id=r.user_id join voci_private.schools k on k.id=r.school_id where r.status='pending'),'[]'::jsonb) else '[]'::jsonb end,
    'classes',coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'name',k.name,'school_id',k.school_id,'deleted_at',k.deleted_at,
      'can_teach',voci_private.can_teach(k.id),'is_teacher',exists(select 1 from voci_private.class_teachers where class_id=k.id and user_id=u),
      'exams',coalesce((select jsonb_agg(to_jsonb(e) order by exam_date) from voci_private.exams e where e.class_id=k.id and k.deleted_at is null),'[]'::jsonb),
      'students',case when voci_private.can_teach(k.id) then coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'first_name',p.first_name,'last_name',p.last_name,'username',p.username)) from voci_private.class_students m join voci_private.profiles p on p.user_id=m.user_id where m.class_id=k.id),'[]'::jsonb) else '[]'::jsonb end,
      'teachers',coalesce((select jsonb_agg(user_id) from voci_private.class_teachers where class_id=k.id),'[]'::jsonb),
      'codes',case when voci_private.can_teach(k.id) then coalesce((select jsonb_agg(to_jsonb(j)) from voci_private.join_codes j where class_id=k.id and expires_at>now() and uses<max_uses),'[]'::jsonb) else '[]'::jsonb end)) from voci_private.classes k where
        (k.deleted_at is null or (k.deleted_at>now()-interval '7 days' and exists(select 1 from voci_private.class_teachers where class_id=k.id and user_id=u))) and
        (exists(select 1 from voci_private.class_teachers where class_id=k.id and user_id=u) or (k.deleted_at is null and exists(select 1 from voci_private.class_students where class_id=k.id and user_id=u)))),'[]'::jsonb)
  ) into data;
  return data;
end $$;

-- Server-only billing bridge. The browser cannot access these functions.
create or replace function public.voci_billing_context(who uuid, school uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; n integer;
begin
  if school is not null and not exists(select 1 from voci_private.staff where school_id=school and user_id=who and is_admin) then raise exception 'Schuladmin erforderlich.'; end if;
  if school is null and not exists(select 1 from voci_private.staff where user_id=who and is_teacher) then raise exception 'Eine bestätigte Lehrpersonenrolle ist erforderlich.'; end if;
  select count(*) into n from voci_private.staff where school_id=school and is_teacher;
  select n+count(*) into n from voci_private.staff_invites i where i.school_id=school and i.is_teacher and i.accepted_at is null and i.expires_at>now()
    and not exists(select 1 from auth.users a join voci_private.staff t on t.user_id=a.id where lower(a.email)=i.email and t.school_id=school and t.is_teacher);
  select jsonb_build_object('email',(select email from auth.users where id=who),'teacher_count',n,
    'subjects',coalesce((select jsonb_agg(id) from voci_private.subjects where enabled),'[]'::jsonb),
    'subscription',(select to_jsonb(b) from voci_private.subscriptions b where case when school is null then b.user_id=who else b.school_id=school end),
    'activation',(select to_jsonb(a) from voci_private.school_activations a where a.school_id=school),
    'payment_allowed',true) into r;
  return r;
end $$;

revoke all on all functions in schema voci_private from public,anon,authenticated;
revoke all on function public.voci_claim_activations(integer),public.voci_finish_activation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.voci_claim_activations(integer),public.voci_finish_activation(uuid,jsonb) to service_role;
create function public.voci_set_activation_payment(school uuid,lease_id uuid,details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a voci_private.school_activations;
begin
  if not exists(select 1 from voci_private.billing_locks where scope=school and lock_id=lease_id and expires_at>now()) then raise exception 'Zahlungsreservierung abgelaufen.'; end if;
  select * into a from voci_private.school_activations where school_id=school for update;
  if not found then raise exception 'Schulaktivierung fehlt.'; end if;
  if details ? 'plan' then
    if details->>'plan' not in ('school_small','school_large') or details->>'plan' is null then raise exception 'Ungültiger Tarif.'; end if;
    if a.charge_started_at is not null and details->>'plan'<>a.plan then raise exception 'Bitte zuerst die angefangene Zahlung abschliessen.'; end if;
    update voci_private.school_activations set plan=details->>'plan' where school_id=school;
  end if;
  if details ? 'customer' then
    if coalesce(details->>'customer','') !~ '^cus_[A-Za-z0-9]+$' or (a.stripe_customer is not null and a.stripe_customer<>details->>'customer') then raise exception 'Ungültige Kundenzuordnung.'; end if;
    update voci_private.school_activations set stripe_customer=details->>'customer' where school_id=school;
  end if;
  if details ? 'session_id' then
    update voci_private.school_activations set setup_session_id=details->>'session_id' where school_id=school;
  end if;
  if details ? 'payment_method' then
    if a.setup_session_id is distinct from details->>'completed_session' then return; end if;
    if coalesce(details->>'payment_method','') !~ '^pm_[A-Za-z0-9]+$' then raise exception 'Ungültige Kartenbestätigung.'; end if;
    update voci_private.school_activations set stripe_payment_method=details->>'payment_method',next_attempt_at=now() where school_id=school;
  end if;
end $$;

create function public.voci_activation_charge_started(school uuid,lease_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from voci_private.billing_locks where scope=school and lock_id=lease_id and expires_at>now()) then raise exception 'Zahlungsreservierung abgelaufen.'; end if;
  update voci_private.school_activations set charge_started_at=coalesce(charge_started_at,now()) where school_id=school and scheduled_at<=now() and (free_until is null or free_until<=now()) and stripe_payment_method is not null;
  if not found then raise exception 'Erste Belastung noch nicht freigegeben.'; end if;
end $$;

create function public.voci_cancel_activation(who uuid,school uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from voci_private.staff where school_id=school and user_id=who and is_admin) then raise exception 'Schuladmin erforderlich.'; end if;
  update voci_private.school_activations set cancel_requested=true,next_attempt_at=now() where school_id=school and not cancel_requested;
  if found then insert into voci_private.mail_queue(user_id,category,subject,body) select user_id,'subscription_cancelled','Schulabo gekündigt','Die Kündigung ist vorgemerkt. Das Schulabo läuft bis zum Ende der bezahlten Periode weiter. Bei einem noch nicht aktivierten Abo endet es nach dem ersten bezahlten Monat; ein Gratismonat ersetzt diesen Monat nicht.' from voci_private.staff where school_id=school and is_teacher; end if;
end $$;
revoke all on function public.voci_set_activation_payment(uuid,uuid,jsonb),public.voci_activation_charge_started(uuid,uuid),public.voci_cancel_activation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.voci_set_activation_payment(uuid,uuid,jsonb),public.voci_activation_charge_started(uuid,uuid),public.voci_cancel_activation(uuid,uuid) to service_role;
create or replace function public.voci_billing_sync(event_id text, details jsonb, lease_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare prev voci_private.subscriptions; s uuid:=nullif(details->>'school_id','')::uuid; u uuid:=nullif(details->>'user_id','')::uuid;
begin
  if not exists(select 1 from voci_private.billing_locks where scope=coalesce(s,u) and lock_id=lease_id and expires_at>now()) then raise exception 'Zahlungsaktualisierung bitte erneut versuchen.'; end if;
  insert into voci_private.billing_events(id) values(event_id) on conflict do nothing;
  if not found then return; end if;
  if details->>'status'='active' and not coalesce((details->>'payment_confirmed')::boolean,false) then raise exception 'Zahlungsnachweis fehlt.'; end if;
  if s is not null then perform 1 from voci_private.schools where id=s for update; end if;
  select * into prev from voci_private.subscriptions where case when s is null then user_id=u else school_id=s end for update;
  if prev.stripe_subscription is not null and prev.stripe_subscription<>details->>'stripe_subscription' and prev.status='active' and prev.period_end>now() then
    raise exception 'Ein anderes Abonnement ist bereits aktiv; manuelle Prüfung erforderlich.';
  end if;
  if prev.id is not null then
    update voci_private.subscriptions set plan=details->>'plan',subjects=array(select jsonb_array_elements_text(coalesce(details->'subjects','[]'))),
      stripe_customer=details->>'stripe_customer',stripe_subscription=details->>'stripe_subscription',status=details->>'status',period_end=(details->>'period_end')::timestamptz,
      cancel_at_period_end=coalesce((details->>'cancel_at_period_end')::boolean,false),pending_plan=nullif(details->>'pending_plan',''),pending_at=nullif(details->>'pending_at','')::timestamptz where id=prev.id;
  else
  insert into voci_private.subscriptions(school_id,user_id,plan,subjects,stripe_customer,stripe_subscription,status,period_end,cancel_at_period_end)
    values(s,u,details->>'plan',array(select jsonb_array_elements_text(coalesce(details->'subjects','[]'))),details->>'stripe_customer',details->>'stripe_subscription',details->>'status',(details->>'period_end')::timestamptz,coalesce((details->>'cancel_at_period_end')::boolean,false));
  end if;
  if s is not null then
    update voci_private.school_activations set stripe_subscription=details->>'stripe_subscription',
      status=case when scheduled_at>now() then 'scheduled' when free_until>now() then 'free_month' when details->>'status'='active' then 'active' else 'payment_failed' end,
      activated_at=case when scheduled_at<=now() and details->>'status'='active' then coalesce(activated_at,now()) else activated_at end,
      first_paid_at=case when details->>'status'='active' then coalesce(first_paid_at,(details->>'period_start')::timestamptz,now()) else first_paid_at end,
      minimum_paid_until=case when details->>'status'='active' then coalesce(minimum_paid_until,(details->>'period_end')::timestamptz) else minimum_paid_until end,
      next_attempt_at=now()
      where school_id=s;
  end if;
  if s is not null and not exists(select 1 from voci_private.school_activations where school_id=s and cancel_requested) and coalesce((details->>'cancel_at_period_end')::boolean,false) and not coalesce(prev.cancel_at_period_end,false) then
    insert into voci_private.mail_queue(user_id,category,subject,body) select user_id,'subscription_cancelled','Schulabo gekündigt','Das Schulabo wurde gekündigt. Es läuft bis zum Ende der bezahlten Periode weiter: '||coalesce(details->>'period_end','') from voci_private.staff where school_id=s and is_teacher;
  end if;
end $$;


create function public.voci_checkout_reset(scope_id uuid,lease_id uuid,session_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from voci_private.billing_locks where scope=scope_id and lock_id=lease_id and expires_at>now()) then raise exception 'Zahlungsreservierung abgelaufen.'; end if;
  delete from voci_private.checkout_reservations r where r.scope=scope_id::text and r.session_id=voci_checkout_reset.session_id;
end $$;
revoke all on function public.voci_checkout_reset(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.voci_checkout_reset(uuid,uuid,text) to service_role;
commit;
