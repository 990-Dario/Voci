begin;
insert into voci_private.subjects(id,name) values ('de','Deutsch'),('math','Mathematik'),('geography','Geografie') on conflict(id) do update set name=excluded.name;

create or replace function voci_private.valid_set(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare b jsonb; ids jsonb; t text; seen text[]:='{}'; subject_id text; allowed text[];
begin
  if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>=1000000 then return false; end if;
  if d ? 'version' then
    if d->'version'<>'2'::jsonb or (d - array['version','name','subjectId','blocks','examDate'])<>'{}'::jsonb then return false; end if;
    subject_id:=d->>'subjectId';
    if subject_id is null or subject_id not in ('de','en','fr','math','geography') or jsonb_typeof(d->'blocks') is distinct from 'array' then return false; end if;
    if jsonb_array_length(d->'blocks') not between 1 and 2 then return false; end if;
    if d ? 'name' and (jsonb_typeof(d->'name')<>'string' or length(d->>'name')>100) then return false; end if;
    if d ? 'examDate' and (jsonb_typeof(d->'examDate')<>'string' or (d->>'examDate'<>'' and (d->>'examDate' !~ '^\d{4}-\d{2}-\d{2}$' or (d->>'examDate')::date::text<>d->>'examDate'))) then return false; end if;
    for b in select * from jsonb_array_elements(d->'blocks') loop
      if jsonb_typeof(b)<>'object' then return false; end if;
      t:=b->>'type';
      if t is null or t=any(seen) then return false; end if;
      seen:=array_append(seen,t);
      if not ((t='vocabulary' and subject_id in ('en','fr')) or (t='grammar' and subject_id in ('de','en','fr')) or (t='mathematics' and subject_id='math') or (t='geography' and subject_id='geography')) then return false; end if;
      if t='geography' then
        if (b-array['type','catalogId','continentId','regionId'])<>'{}'::jsonb or coalesce(b->>'catalogId','') not in ('un195','ioc206','ch26') then return false; end if;
        if (b->'continentId' is not null and b->'continentId'<>'null'::jsonb and (jsonb_typeof(b->'continentId')<>'string' or length(b->>'continentId') not between 1 and 100)) or
           (b->'regionId' is not null and b->'regionId'<>'null'::jsonb and (jsonb_typeof(b->'regionId')<>'string' or length(b->>'regionId') not between 1 and 100)) then return false; end if;
        if b->>'catalogId'='ch26' and (b->>'continentId' is not null or b->>'regionId' is not null) then return false; end if;
      else
        allowed:=array['type',case when t='vocabulary' then 'objectiveIds' else 'topicIds' end];
        if (b-allowed)<>'{}'::jsonb then return false; end if;
        ids:=b->allowed[2];
        if jsonb_typeof(ids) is distinct from 'array' then return false; end if;
        if jsonb_array_length(ids) not between 1 and 2000 or exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 300) then return false; end if;
      end if;
    end loop;
  else
    if (d-array['language','objectives','name','examDate'])<>'{}'::jsonb or coalesce(d->>'language','') not in ('en','fr') or jsonb_typeof(d->'objectives') is distinct from 'array' then return false; end if;
    if jsonb_array_length(d->'objectives') not between 1 and 2000 or exists(select 1 from jsonb_array_elements(d->'objectives') x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 300) then return false; end if;
  end if;
  return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
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


create or replace function public.create_shared_set(source_set_id text, set_data jsonb)
returns table (share_token uuid, expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or source_set_id is null or length(source_set_id) not between 1 and 300 or not voci_private.valid_set(set_data) then raise exception 'Invalid shared learning set'; end if;
  return query insert into public.shared_sets(owner_id,source_set_id,set_data) values(auth.uid(),source_set_id,set_data) returning id,shared_sets.expires_at;
end $$;
revoke all on function public.create_shared_set(text,jsonb) from public,anon,authenticated;
grant execute on function public.create_shared_set(text,jsonb) to authenticated;
revoke all on function public.voci_set_updated_at() from public,anon,authenticated;
commit;
