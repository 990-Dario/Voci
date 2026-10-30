-- Additive migration. Run after supabase-schema.sql. Browser access is RPC-only.
begin;
create schema if not exists voci_private;
revoke all on schema voci_private from public, anon, authenticated;

create table voci_private.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  postal_code text not null check (postal_code ~ '^[0-9]{4,6}$'),
  town text not null check (length(town) between 2 and 120),
  email_domain text,
  created_at timestamptz not null default now()
);
create unique index schools_identity on voci_private.schools(lower(trim(name)), postal_code, lower(trim(town)));
create table voci_private.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  school_id uuid references voci_private.schools,
  first_name text not null default '' check(length(first_name) <= 80),
  last_name text not null default '' check(length(last_name) <= 80),
  username text,
  preferences jsonb not null default '{"exam_created":true,"exam_changed":true,"exam_deleted":true,"subscription_cancelled":true,"admin_changed":true}'::jsonb,
  unique(school_id, username)
);
create table voci_private.staff (
  school_id uuid not null references voci_private.schools on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  is_admin boolean not null default false,
  is_teacher boolean not null default true,
  primary key(school_id, user_id),
  check(is_admin or is_teacher)
);
create index staff_user on voci_private.staff(user_id);
create table voci_private.admin_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references voci_private.schools,
  user_id uuid not null references auth.users on delete cascade,
  reason text not null check(length(reason) between 10 and 2000),
  request_kind text not null default 'admin' check(request_kind in ('admin','teacher')),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  payment_deadline timestamptz
);
create unique index admin_requests_pending on voci_private.admin_requests(school_id,user_id) where status='pending';
create table voci_private.staff_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references voci_private.schools on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  is_teacher boolean not null default true,
  expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz,
  check(is_admin or is_teacher)
);
create unique index staff_invites_open on voci_private.staff_invites(school_id,email) where accepted_at is null;
create table voci_private.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid unique references voci_private.schools,
  user_id uuid unique references auth.users on delete cascade,
  plan text not null check(plan in ('individual','school_small','school_large')),
  subjects text[] not null default '{}',
  stripe_customer text,
  stripe_subscription text unique,
  status text not null default 'inactive',
  period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  pending_plan text check(pending_plan in ('individual','school_small','school_large')),
  pending_at timestamptz,
  check((school_id is null) <> (user_id is null)),
  check((plan='individual') = (user_id is not null))
);
create table voci_private.subjects (
  id text primary key,
  name text not null,
  enabled boolean not null default true
);
insert into voci_private.subjects(id,name) values ('en','Englisch'),('fr','Französisch');
create table voci_private.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references voci_private.schools,
  name text not null check(length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table voci_private.class_teachers (
  class_id uuid not null references voci_private.classes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key(class_id,user_id)
);
create index class_teachers_user on voci_private.class_teachers(user_id);
create table voci_private.class_students (
  class_id uuid not null references voci_private.classes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(class_id,user_id)
);
create index class_students_user on voci_private.class_students(user_id);
create table voci_private.join_codes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references voci_private.classes on delete cascade,
  max_uses integer not null check(max_uses between 1 and 10000),
  uses integer not null default 0 check(uses >= 0 and uses <= max_uses),
  expires_at timestamptz not null default now()+interval '7 days'
);
create table voci_private.exams (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references voci_private.classes on delete cascade,
  title text not null check(length(title) between 1 and 100),
  exam_date date not null,
  set_data jsonb not null,
  updated_at timestamptz not null default now()
);
create table voci_private.mail_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create table voci_private.billing_events (
  id text primary key,
  received_at timestamptz not null default now()
);
create table voci_private.checkout_reservations (
  scope text primary key,
  id uuid not null default gen_random_uuid(),
  session_id text,
  expires_at timestamptz not null,
  requested_plan text not null,
  requested_subjects text[] not null default '{}'
);
create table voci_private.billing_locks (
  scope uuid primary key,
  lock_id uuid not null,
  expires_at timestamptz not null
);

-- Deny direct access, including when a schema is accidentally exposed later.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='voci_private' loop
    execute format('alter table voci_private.%I enable row level security', t.tablename);
  end loop;
end $$;
revoke all on all tables in schema voci_private from public, anon, authenticated;

create function voci_private.is_operator() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select raw_app_meta_data->>'voci_operator'='true' from auth.users where id=auth.uid()),false)
$$;
create function voci_private.is_admin(s uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from voci_private.staff where school_id=s and user_id=auth.uid() and is_admin)
$$;
create function voci_private.has_access(s uuid, u uuid, subject_id text default null) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from voci_private.subscriptions b where b.status='active' and b.period_end>now()
    and (b.school_id=s or (b.user_id=u and (subject_id is null or subject_id=any(b.subjects)))))
$$;
create function voci_private.can_teach(c uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from voci_private.classes k join voci_private.class_teachers t on t.class_id=k.id
    join voci_private.staff s on s.school_id=k.school_id and s.user_id=t.user_id and s.is_teacher
    where k.id=c and t.user_id=auth.uid() and k.deleted_at is null
      and voci_private.has_access(k.school_id,t.user_id))
$$;
create function voci_private.valid_set(d jsonb) returns boolean
language sql immutable set search_path='' as $$
  select jsonb_typeof(d)='object' and d->>'language' in ('en','fr')
    and jsonb_typeof(d->'objectives')='array'
    and jsonb_array_length(d->'objectives') between 1 and 2000
    and not exists(select 1 from jsonb_array_elements(d->'objectives') x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>300)
    and octet_length(d::text)<1000000
$$;
create function voci_private.check_staff_limit(s uuid, allow_existing_over_limit boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare n integer; a integer; cap integer;
begin
  perform 1 from voci_private.schools where id=s for update;
  delete from voci_private.staff_invites where school_id=s and expires_at<=now() and accepted_at is null;
  select count(*) filter(where is_teacher), count(*) filter(where is_admin) into n,a from voci_private.staff where school_id=s;
  select n+count(*) filter(where i.is_teacher and not coalesce(t.is_teacher,false)),
    a+count(*) filter(where i.is_admin and not coalesce(t.is_admin,false)) into n,a
    from voci_private.staff_invites i left join voci_private.profiles p on p.user_id in (select id from auth.users where lower(email)=i.email)
    left join voci_private.staff t on t.user_id=p.user_id and t.school_id=s
    where i.school_id=s and i.accepted_at is null and i.expires_at>now();
  select case when exists(select 1 from voci_private.subscriptions where school_id=s and plan='school_large' and pending_plan is distinct from 'school_small' and status='active' and period_end>now()) then 2147483647 else 50 end into cap;
  if n>cap and not allow_existing_over_limit then raise exception 'UPGRADE_REQUIRED: Für mehr als 50 Lehrpersonen ist das grosse Schulpaket nötig.'; end if;
  if a>5 then raise exception 'Höchstens fünf Administratoren pro Schule.'; end if;
end $$;

create function public.voci_find_schools(search_text text default '') returns jsonb
language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) from (
    select id,name,postal_code,town from voci_private.schools
    where length(trim(search_text))>=2 and (name ilike '%'||left(search_text,120)||'%' or postal_code=search_text or town ilike '%'||left(search_text,120)||'%')
    order by name limit 30
  ) s
$$;

-- One authenticated command entry point. No browser action can set billing state.
create function public.voci_school(action text, payload jsonb default '{}'::jsonb) returns jsonb
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
      if not exists(select 1 from voci_private.profiles where user_id=target and school_id=s) then raise exception 'Die Person hat inzwischen die Schule gewechselt. Bitte Antrag neu stellen lassen.'; end if;
      select split_part(lower(email),'@',2) into base from auth.users where id=target and email_confirmed_at is not null;
      if base is null or base<>lower(trim(payload->>'email_domain')) then raise exception 'Die bestätigte Schuldomain muss zur Antragsadresse passen.'; end if;
      update voci_private.schools set email_domain=base where id=s;
      select request_kind into candidate from voci_private.admin_requests where id=(payload->>'id')::uuid;
      insert into voci_private.staff(school_id,user_id,is_admin,is_teacher) values(s,target,candidate='admin',candidate='teacher')
        on conflict(school_id,user_id) do update set is_admin=staff.is_admin or excluded.is_admin,is_teacher=staff.is_teacher or excluded.is_teacher;
      perform voci_private.check_staff_limit(s);
      update voci_private.admin_requests set status='approved',reviewed_at=now(),payment_deadline=now()+interval '30 days' where id=(payload->>'id')::uuid;
      insert into voci_private.mail_queue(user_id,category,subject,body) values(target,'transactional','Deine Schule wurde freigegeben','Deine Berechtigung wurde bestätigt. Öffne Voci → Schule → Abonnement. Die Zahlungsfreigabe ist 30 Tage gültig.');
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
      if not voci_private.has_access(k.school_id,u,d->>'language') then raise exception 'Dieses Fach ist nicht in deinem Abo enthalten.'; end if;
      rid:=nullif(payload->>'id','')::uuid;
      if rid is null then
        insert into voci_private.exams(class_id,title,exam_date,set_data) values(c,trim(payload->>'title'),(payload->>'exam_date')::date,jsonb_build_object('language',d->>'language','objectives',d->'objectives')) returning id into rid;
        base:='exam_created';
      else
        update voci_private.exams set title=trim(payload->>'title'),exam_date=(payload->>'exam_date')::date,set_data=jsonb_build_object('language',d->>'language','objectives',d->'objectives'),updated_at=now() where id=rid and class_id=c;
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
      return jsonb_build_object('format','voci-class','version',1,'exported_at',now(),'school_id',k.school_id,'name',k.name,
        'students',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'username',p.username,'first_name',p.first_name,'last_name',p.last_name)) from voci_private.class_students m join voci_private.profiles p on p.user_id=m.user_id where m.class_id=c),'[]'::jsonb),
        'teachers',coalesce((select jsonb_agg(user_id) from voci_private.class_teachers where class_id=c),'[]'::jsonb),
        'exams',coalesce((select jsonb_agg(jsonb_build_object('title',title,'exam_date',exam_date,'set_data',set_data)) from voci_private.exams where class_id=c),'[]'::jsonb));
    end if;
  elsif action='import_class' then
    perform 1 from voci_private.schools where id=s for update;
    if not exists(select 1 from voci_private.staff where school_id=s and user_id=u and is_teacher) or not voci_private.has_access(s,u) then raise exception 'Lehrpersonenrechte und ein aktives Abo sind erforderlich.'; end if;
    d:=payload->'data';
    if d->>'format' is distinct from 'voci-class' or d->>'version' is distinct from '1' or d->>'school_id' is distinct from s::text or jsonb_typeof(d->'students') is distinct from 'array' or jsonb_typeof(d->'teachers') is distinct from 'array' or jsonb_typeof(d->'exams') is distinct from 'array' then raise exception 'Ungültiger Export oder Export einer anderen Schule.'; end if;
    if jsonb_array_length(d->'students')>10000 or jsonb_array_length(d->'exams')>1000 then raise exception 'Der Export enthält zu viele Einträge.'; end if;
    insert into voci_private.classes(school_id,name) values(s,trim(d->>'name')) returning id into c;
    insert into voci_private.class_teachers values(c,u);
    for item in select * from jsonb_array_elements(d->'teachers') loop
      insert into voci_private.class_teachers select c,user_id from voci_private.staff where school_id=s and user_id=(item#>>'{}')::uuid and is_teacher on conflict do nothing;
    end loop;
    for item in select * from jsonb_array_elements(d->'students') loop
      target:=(item->>'user_id')::uuid;
      if not exists(select 1 from voci_private.profiles where user_id=target and school_id=s) then raise exception 'Ein Schülerkonto fehlt oder gehört nicht zu deiner Schule. Der gesamte Import wurde abgebrochen.'; end if;
      insert into voci_private.class_students(class_id,user_id) values(c,target) on conflict do nothing;
    end loop;
    for item in select * from jsonb_array_elements(d->'exams') loop
      if not coalesce(voci_private.valid_set(item->'set_data'),false) or not voci_private.has_access(s,u,item->'set_data'->>'language') then raise exception 'Ungültige Prüfung oder Fach nicht im Abo.'; end if;
      insert into voci_private.exams(class_id,title,exam_date,set_data) values(c,item->>'title',(item->>'exam_date')::date,jsonb_build_object('language',item->'set_data'->>'language','objectives',item->'set_data'->'objectives'));
    end loop;
    return jsonb_build_object('class_id',c);
  elsif action<>'snapshot' then raise exception 'Unbekannte Aktion.';
  end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.voci_school_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s uuid; data jsonb;
begin
  perform public.voci_school('snapshot');
  select school_id into s from voci_private.profiles where user_id=u;
  select jsonb_build_object(
    'profile',(select to_jsonb(p) from voci_private.profiles p where user_id=u),
    'school',(select to_jsonb(k)-'email_domain' from voci_private.schools k where id=s),
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
create function public.voci_billing_context(who uuid, school uuid default null) returns jsonb
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
    'payment_allowed',school is null or exists(select 1 from voci_private.admin_requests where school_id=school and status='approved' and payment_deadline>now())
      or exists(select 1 from voci_private.subscriptions where school_id=school and stripe_subscription is not null)) into r;
  return r;
end $$;
create function public.voci_billing_acquire(scope_id uuid, lease_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  insert into voci_private.billing_locks(scope,lock_id,expires_at) values(scope_id,lease_id,now()+interval '5 minutes')
    on conflict(scope) do update set lock_id=excluded.lock_id,expires_at=excluded.expires_at where billing_locks.expires_at<=now();
  return found;
end $$;
create function public.voci_billing_release(scope_id uuid, lease_id uuid) returns void
language sql security definer set search_path='' as $$
  delete from voci_private.billing_locks where scope=scope_id and lock_id=lease_id
$$;
create function public.voci_billing_sync(event_id text, details jsonb, lease_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare prev voci_private.subscriptions; s uuid:=nullif(details->>'school_id','')::uuid; u uuid:=nullif(details->>'user_id','')::uuid;
begin
  if not exists(select 1 from voci_private.billing_locks where scope=coalesce(s,u) and lock_id=lease_id and expires_at>now()) then raise exception 'Zahlungsaktualisierung bitte erneut versuchen.'; end if;
  insert into voci_private.billing_events(id) values(event_id) on conflict do nothing;
  if not found then return; end if;
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
  if s is not null and coalesce((details->>'cancel_at_period_end')::boolean,false) and not coalesce(prev.cancel_at_period_end,false) then
    insert into voci_private.mail_queue(user_id,category,subject,body) select user_id,'subscription_cancelled','Schulabo gekündigt','Das Schulabo wurde gekündigt. Es läuft bis zum Ende der bezahlten Periode weiter: '||coalesce(details->>'period_end','') from voci_private.staff where school_id=s and is_teacher;
  end if;
end $$;

create function public.voci_schedule_capacity(school uuid, next_plan text, next_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from voci_private.schools where id=school for update;
  update voci_private.subscriptions set pending_plan=next_plan,pending_at=next_at where school_id=school;
  perform voci_private.check_staff_limit(school);
end $$;

create function public.voci_checkout_reserve(who uuid, school uuid, requested_plan text, requested_subjects text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scope_key text:=coalesce(school,who)::text; reservation voci_private.checkout_reservations;
begin
  perform public.voci_billing_context(who,school);
  insert into voci_private.checkout_reservations(scope,expires_at,requested_plan,requested_subjects)
    values(scope_key,now()+interval '2 minutes',requested_plan,requested_subjects) on conflict do nothing;
  if found then select * into reservation from voci_private.checkout_reservations where scope=scope_key; return to_jsonb(reservation)||'{"claimed":true}'::jsonb; end if;
  select * into reservation from voci_private.checkout_reservations where scope=scope_key for update;
  if reservation.expires_at<=now() then
    update voci_private.checkout_reservations set id=gen_random_uuid(),session_id=null,expires_at=now()+interval '2 minutes',requested_plan=voci_checkout_reserve.requested_plan,requested_subjects=voci_checkout_reserve.requested_subjects
      where scope=scope_key returning * into reservation;
    return to_jsonb(reservation)||'{"claimed":true}'::jsonb;
  end if;
  if reservation.requested_plan<>requested_plan or reservation.requested_subjects<>requested_subjects then raise exception 'Es besteht bereits eine Zahlungsseite für eine andere Auswahl. Bitte diese zuerst abschliessen oder nach Ablauf erneut versuchen.'; end if;
  return to_jsonb(reservation)||'{"claimed":false}'::jsonb;
end $$;
create function public.voci_checkout_complete(reservation_id uuid, session_id text) returns void
language sql security definer set search_path='' as $$
  update voci_private.checkout_reservations set session_id=voci_checkout_complete.session_id,expires_at=now()+interval '23 hours' where id=reservation_id
$$;

create function public.voci_claim_mail(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
  with batch as (
    select q.id from voci_private.mail_queue q join voci_private.profiles p on p.user_id=q.user_id
    where sent_at is null and attempts<5 and (claimed_at is null or claimed_at<now()-interval '10 minutes')
      and (q.category='transactional' or coalesce((p.preferences->>q.category)::boolean,false))
    order by created_at for update of q skip locked limit least(greatest(batch_size,1),20)
  ), claimed as (
    update voci_private.mail_queue set claimed_at=now(),attempts=attempts+1 where id in(select id from batch) returning *
  ) select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('email',u.email)),'[]'::jsonb) into r from claimed c join auth.users u on u.id=c.user_id;
  return r;
end $$;
create function public.voci_finish_mail(mail_id uuid, failure text default null) returns void
language sql security definer set search_path='' as $$
  update voci_private.mail_queue set sent_at=case when failure is null then now() else null end,last_error=left(failure,300) where id=mail_id
$$;
create function public.voci_cleanup() returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from voci_private.classes where deleted_at<=now()-interval '7 days';
  delete from voci_private.join_codes where expires_at<now()-interval '7 days';
  delete from voci_private.staff_invites where expires_at<now()-interval '7 days';
  delete from voci_private.mail_queue where created_at<now()-interval '30 days';
  delete from voci_private.billing_events where received_at<now()-interval '90 days';
  delete from voci_private.checkout_reservations where expires_at<now()-interval '1 day';
  delete from voci_private.billing_locks where expires_at<now();
end $$;

revoke all on all functions in schema voci_private from public,anon,authenticated;
revoke all on function public.voci_find_schools(text),public.voci_school(text,jsonb),public.voci_school_snapshot() from public,anon,authenticated;
grant execute on function public.voci_find_schools(text) to anon,authenticated;
grant execute on function public.voci_school(text,jsonb),public.voci_school_snapshot() to authenticated;
revoke all on function public.voci_billing_context(uuid,uuid),public.voci_billing_sync(text,jsonb,uuid),public.voci_claim_mail(integer),public.voci_finish_mail(uuid,text),public.voci_cleanup() from public,anon,authenticated;
grant execute on function public.voci_billing_context(uuid,uuid),public.voci_billing_sync(text,jsonb,uuid),public.voci_claim_mail(integer),public.voci_finish_mail(uuid,text),public.voci_cleanup() to service_role;
revoke all on function public.voci_billing_acquire(uuid,uuid),public.voci_billing_release(uuid,uuid) from public,anon,authenticated;
grant execute on function public.voci_billing_acquire(uuid,uuid),public.voci_billing_release(uuid,uuid) to service_role;
revoke all on function public.voci_checkout_reserve(uuid,uuid,text,text[]),public.voci_checkout_complete(uuid,text) from public,anon,authenticated;
grant execute on function public.voci_checkout_reserve(uuid,uuid,text,text[]),public.voci_checkout_complete(uuid,text) to service_role;
revoke all on function public.voci_schedule_capacity(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.voci_schedule_capacity(uuid,text,timestamptz) to service_role;
commit;

-- pg_cron is already enabled by supabase-schema.sql; this job never sends mail.
select cron.unschedule(jobid) from cron.job where jobname='voci-school-cleanup';
select cron.schedule('voci-school-cleanup','25 3 * * *',$$select public.voci_cleanup()$$);
