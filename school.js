/* School data is kept out of localStorage; private study progress stays in app.js. */
globalThis.VociSchool = (() => {
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const categories = { exam_created:'Neue Klassenprüfung', exam_changed:'Prüfung geändert oder verschoben', exam_deleted:'Prüfung gelöscht', subscription_cancelled:'Schulabo gekündigt', admin_changed:'Schuladministration geändert' };
  let client, hooks, user, data=null, ready=false, selectedClass='', busy=false, generation=0;
  let searchTimer, refreshTimer, examClass='', examId='';
  let examDraft=null;
  const currentClass = () => data?.classes.find(c => c.id===selectedClass && !c.deleted_at);
  const date = value => value ? new Intl.DateTimeFormat('de-CH',{dateStyle:'medium'}).format(new Date(value.length===10 ? `${value}T12:00:00` : value)) : '–';
  const button = (label, action, attrs='', secondary=true) => `<button type="button" class="button ${secondary?'button-secondary ':''}button-small" data-school-action="${action}" ${attrs}>${label}</button>`;
  const formField = (label,name,value='',type='text',extra='') => `<label class="school-field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
  const ownSubscription = school => data?.subscriptions.find(s => school ? s.school_id===data?.school?.id : s.user_id===user?.id);
  const active = subscription => subscription?.status==='active' && new Date(subscription.period_end)>new Date();
  function init(api, callbacks) {
    client=api; hooks=callbacks;
    document.addEventListener('click', click);
    document.addEventListener('submit', submit);
    document.addEventListener('input', input);
    document.addEventListener('change', change);
    window.addEventListener('focus', () => { if(user) refresh(false); });
    refreshTimer=setInterval(() => { if(user && !document.hidden && !document.querySelector('#school-dialog[open]') && !busy) refresh(false); },30000);
  }
  async function rpc(action,payload={}) {
    if(!client || !user) throw new Error('Bitte melde dich zuerst an.');
    const result=await client.rpc('voci_school',{action,payload});
    if(result.error) throw new Error(result.error.code==='22P02'?'Die Kennung oder der Code ist ungültig.':result.error.message);
    return result.data;
  }
  async function setUser(nextUser) {
    generation++; user=nextUser; data=null; ready=false; selectedClass='';
    document.querySelector('#school-dialog')?.close();
    updateNav();
    if(!user) return;
    await refresh(false);
    const registration=user?.user_metadata?.schoolProfile;
    if(data && !data.profile.username && registration) {
      try { await rpc('profile',registration); await refresh(false); }
      catch { hooks.notify('Bitte vervollständige dein Schulprofil unter Schule & Abos.'); }
    }
  }
  async function refresh(redraw=true) {
    const expected=generation;
    if(!client || !user) return;
    const oldExams=JSON.stringify(data?.classes.map(c=>c.exams));
    const result=await client.rpc('voci_school_snapshot');
    if(expected!==generation) return;
    ready=!result.error; data=result.error?null:result.data;
    updateNav();
    const editing=Boolean(document.activeElement?.closest('[data-school-form]'));
    const examChanged=oldExams!==JSON.stringify(data?.classes.map(c=>c.exams));
    if(!result.error && examChanged)hooks.examChanged?.();
    if(redraw || (!editing && ['school','classes'].includes(hooks.stage())) || (hooks.hasClassStudy() && examChanged && (hooks.stage()!=='mode'||!getExam(hooks.classStudyId())))) hooks.render();
  }
  function updateNav() {
    const nav=document.querySelector('#learning-nav');
    if(!nav) return;
    nav.hidden=!user;
    nav.innerHTML=user?`${data?.role?.is_teacher||data?.classes.some(c=>!c.deleted_at)?'<button data-school-action="classes">Klassen</button>':''}<button data-school-action="school">Schule &amp; Abos</button>`:'';
  }
  function schoolFields(prefix='profile') {
    return `<div class="school-picker" data-prefix="${prefix}">
      <input type="hidden" name="school_id" value="${e(data?.school?.id||'')}">
      <label class="school-field"><span>Schule suchen</span><input name="school_search" placeholder="Schulname, Ort oder PLZ" autocomplete="off" value="${e(data?.school?.name||'')}"></label>
      <div class="school-search-results" role="status"></div>
      ${button('Eigene Schule hinzufügen','new-school')}
      <div class="school-new-fields" hidden>${formField('Schulname','school_name','','text','maxlength="120"')}${formField('Postleitzahl','postal_code','','text','inputmode="numeric" pattern="[0-9]{4,6}"')}${formField('Ort','town','','text','maxlength="120"')}<label class="school-check"><input name="confirm_distinct" type="checkbox">Ich habe mögliche Treffer geprüft; dies ist eine andere Schule.</label></div>
    </div>`;
  }
  function registrationFields() {
    return `<div class="school-form-grid">${formField('Vorname','first_name','','text','required maxlength="80" autocomplete="given-name"')}${formField('Nachname','last_name','','text','required maxlength="80" autocomplete="family-name"')}</div>${schoolFields('signup')}`;
  }
  function profilePayload(form) {
    const f=new FormData(form), result={};
    for(const key of ['first_name','last_name','school_id','school_name','postal_code','town']) result[key]=String(f.get(key)||'').trim();
    result.confirm_distinct=f.has('confirm_distinct');
    if(!result.first_name || !result.last_name || (!result.school_id && (!result.school_name || !result.postal_code || !result.town))) throw new Error('Bitte gib deinen Namen an und wähle deine Schule aus.');
    return result;
  }
  function renderProfile() {
    const p=data.profile;
    return `<section class="panel school-section"><h2>Dein Schulprofil</h2><p class="subtle">Dein Nutzername wird automatisch aus Vor- und Nachnamen gebildet.${p.username?` Aktuell: <strong>${e(p.username)}</strong>`:''}</p><form data-school-form="profile" class="school-form"><div class="school-form-grid">${formField('Vorname','first_name',p.first_name,'text','required maxlength="80"')}${formField('Nachname','last_name',p.last_name,'text','required maxlength="80"')}</div>${schoolFields()}<button class="button button-small">Profil speichern</button></form></section>`;
  }
  function renderSchool() {
    if(!user) return `<section class="empty-state"><h1>Deine Schule</h1><p>Melde dich an, um Klassen beizutreten oder das Lehrpersonenangebot zu nutzen.</p></section>`;
    if(!ready || !data) return `<section class="empty-state"><h1>Schule &amp; Klassen</h1><p>Die Schulfunktionen sind noch nicht eingerichtet oder gerade nicht erreichbar. Deine bisherigen Lernsets kannst du weiter verwenden.</p>${button('Erneut laden','refresh')}</section>`;
    return `<div class="page-top"><div><p class="mode-label">Dein Schulbereich</p><h1>${e(data.school?.name||'Deine Schule')}</h1><p class="subtle">${data.school?`${e(data.school.postal_code)} ${e(data.school.town)} · `:''}${e(data.profile.username||'Vervollständige dein Profil')}</p></div></div>
      <div class="school-layout"><div class="school-stack">${renderProfile()}
      ${data.profile.username?`<section class="panel school-section"><h2>Einer Klasse beitreten</h2><p class="subtle">Den Code erhältst du von deiner Lehrperson. Du kannst Klassen nicht selbst verlassen.</p><form data-school-form="join" class="school-inline">${formField('Beitrittscode','code','','text','required autocomplete="off"')}<button class="button button-small">Beitreten</button></form></section>`:''}
      ${renderStaff()}${renderReview()}</div><aside class="school-stack">${renderInvitation()}${renderBilling()}${renderAdminRequest()}</aside></div>`;
  }
  function renderAdminRequest() {
    if(!data.profile.username) return '';
    const pending=data.requests.find(r=>r.status==='pending');
    return `<section class="panel school-section"><h2>Lehrperson oder Schuladmin werden</h2>${pending?'<p>Dein Antrag wird von Voci geprüft. Wir bestätigen deine Berechtigung anhand deiner Schuladresse und Nachweise.</p>':`<p class="subtle">Beantrage deine Rolle mit deiner bestätigten E-Mail-Adresse der Schule. Voci prüft deine Berechtigung, bevor Zahlungen möglich sind.</p><form data-school-form="request" class="school-form"><label class="school-field"><span>Rolle</span><select name="request_kind"><option value="admin">Schuladministration</option><option value="teacher">Einzelne Lehrperson</option></select></label><label class="school-field"><span>Aufgabe an der Schule und Berechtigungsnachweis</span><textarea name="reason" required minlength="10" maxlength="2000" rows="3"></textarea></label><button class="button button-small">Prüfung beantragen</button></form>`}</section>`;
  }
  function renderInvitation() {
    const token=new URLSearchParams(location.search).get('invite');
    return `<section class="panel school-section"><h2>Einladung annehmen</h2><p class="subtle">Eine Einladung gilt nur für die darin angegebene E-Mail-Adresse und Schule.</p><form data-school-form="invite-accept" class="school-form">${formField('Einladungscode','token',token||'','text','required autocomplete="off"')}<button class="button button-small">Einladung annehmen</button></form></section>`;
  }
  function renderStaff() {
    if(!data.role?.is_admin) return '';
    const count=data.staff.filter(x=>x.is_teacher).length;
    return `<section class="panel school-section"><h2>Lehrpersonen &amp; Administration</h2><p class="subtle">${count} Lehrpersonen · ${data.staff.filter(x=>x.is_admin).length}/5 Administratoren. Reine Administratoren zählen nicht zum Tarif.</p><div class="school-list">${data.staff.map(m=>`<div class="school-person"><div><strong>${e(m.first_name+' '+m.last_name)}</strong><small>${e(m.username)} · ${m.is_teacher?'Lehrperson':''}${m.is_admin?' · Administrator':''}</small></div><div class="set-actions">${button('Rollen','role',`data-user="${m.user_id}"`)}${button('Entfernen','remove-staff',`data-user="${m.user_id}"`)}</div></div>`).join('')}</div><details><summary>Person einladen</summary><form data-school-form="invite" class="school-form">${formField('Schul-E-Mail-Adresse','email','','email','required')}<label class="school-check"><input name="is_teacher" type="checkbox" checked>Lehrperson</label><label class="school-check"><input name="is_admin" type="checkbox">Schuladministrator</label><button class="button button-small">Einladung erstellen</button></form></details>${data.invites.length?`<details><summary>Offene Einladungen (${data.invites.length})</summary>${data.invites.map(i=>`<p>${e(i.email)} · bis ${date(i.expires_at)}<br><code class="school-code">${e(i.id)}</code></p>`).join('')}</details>`:''}</section>`;
  }
  function renderActivation() {
    const a=data.activation;if(!a)return '';
    const labels={scheduled:'Freigegeben · Start geplant',awaiting_payment:'Zahlungsmethode fehlt',free_month:'Gratismonat aktiv',active:'Schulabo aktiv',payment_failed:'Zahlung braucht deine Bestätigung'};
    const start=new Intl.DateTimeFormat('de-CH',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Zurich'}).format(new Date(a.scheduled_at));
    return `<div class="activation-status"><h3>${e(labels[a.status]||a.status)}</h3><p>Geplanter Start: ${e(start)} Uhr (Schweiz). Ab der Freigabe können Administratoren Lehrpersonen einladen.</p><p>${a.payment_method_ready?'Karte hinterlegt.':'Bitte eine Karte für das Schulabo hinterlegen.'} Unterrichtszugriff besteht ab dem Start und nach bestätigter Zahlung oder während des Gratismonats.</p>${a.free_until?`<p>Gratismonat bis ${date(a.free_until)}. Danach beginnt der erste bezahlte Monat.</p>`:''}${a.cancel_requested?'<p>Die Kündigung ist vorgemerkt. Das Abo endet nach der bezahlten Periode, frühestens nach einem bezahlten Monat.</p>':''}${a.status==='payment_failed'&&data.role?.is_admin?button('Zahlung fortsetzen','resume-payment','',false):''}</div>`;
  }
  function renderBilling() {
    const schoolSub=ownSubscription(true), teacherSub=ownSubscription(false), count=data.staff.filter(x=>x.is_teacher).length;
    const tooLarge=schoolSub?.plan==='school_large' && count<=50 && active(schoolSub);
    const info=s=>s?`<p>${s.cancel_at_period_end?'Gekündigt, nutzbar bis':'Bezahlt bis'} ${date(s.period_end)} · ${s.status==='active'?'aktiv':e(s.status)}${s.pending_plan?`<br>Tarifreduktion geplant ab ${date(s.pending_at)}`:''}</p>`:'<p class="subtle">Noch kein aktives Abonnement.</p>';
    return `<section class="panel school-section"><h2>Abonnements</h2>${renderActivation()}${data.role?.is_admin?`<h3>Schule · alle Fächer</h3><p>Bis 50 Lehrpersonen: <strong>CHF 40.–/Monat</strong><br>Ab 51: <strong>CHF 100.–/Monat</strong><br>Beliebig viele Schüler.</p>${info(schoolSub)}${data.activation&&!data.activation.cancel_requested&&!active(schoolSub)?button('Kündigung vormerken','cancel-subscription','data-scope="school"'):''}${tooLarge?'<p class="school-alert">Ihr bezahlt aktuell mehr als nötig. Das Paket bis 50 Lehrpersonen reicht für eure Schule aus.</p>':''}<div class="set-actions school-actions">${button(active(schoolSub)?'Paket bis 50 wählen':'Bis 50 buchen','billing', 'data-plan="school_small"')}${button(active(schoolSub)?'Auf über 50 upgraden':'Über 50 buchen','billing','data-plan="school_large"')}${active(schoolSub)&&!schoolSub.cancel_at_period_end?button('Schulabo kündigen','cancel-subscription','data-scope="school"'):''}</div>`:''}
      <h3>Einzelne Lehrperson</h3><p class="subtle">1 Fach CHF 3.– · 2 Fächer CHF 5.– · 3 Fächer CHF 7.– · 4 Fächer CHF 8.– · 5 Fächer CHF 9.–.</p>${info(teacherSub)}${data.role?.is_teacher?`<form data-school-form="individual" class="school-form">${data.subjects.map(s=>`<label class="school-check"><input type="checkbox" name="subject" value="${e(s.id)}" ${teacherSub?.subjects.includes(s.id)?'checked':''}>${e(s.name)}</label>`).join('')}<output id="individual-total">Wähle deine Fächer</output><button class="button button-small">${active(teacherSub)?'Fächer ändern':'Kostenpflichtig buchen'}</button></form>${active(teacherSub)&&!teacherSub.cancel_at_period_end?button('Einzelabo kündigen','cancel-subscription','data-scope="individual"'):''}`:'<p class="subtle">Nach der Bestätigung deiner Lehrpersonenrolle kannst du Fächer buchen.</p>'}</section>`;
  }
  function renderReview() {
    if(!data.is_operator) return '';
    return `<section class="panel school-section"><h2>Voci · Berechtigungen prüfen</h2><p class="subtle">Schulberechtigung ausserhalb der App prüfen und erst danach freigeben. Eine Schuldomain allein ist kein Berechtigungsnachweis.</p>${data.review_requests.map(r=>`<form data-school-form="review" class="school-form"><input type="hidden" name="id" value="${r.id}"><strong>${e(r.school_name)} · ${e(r.postal_code)} ${e(r.town)}</strong><p>${e(r.email)} · ${e(r.request_kind||'admin')}<br>${e(r.reason)}</p>${formField('Bestätigte Schuldomain','email_domain',r.email.split('@')[1],'text','required')}${formField('Vollständige Unterlagen erhalten am','completed_at','','datetime-local')}<p class="small">Leer lassen, wenn der Antrag bereits beim Einreichen vollständig war.</p><label class="school-field"><span>Von Voci verursachte Verzögerung (nur bei mehr als 14 Tagen)</span><textarea name="delay_reason" maxlength="2000" rows="2"></textarea></label><div class="school-inline"><button class="button button-small" name="approve" value="true">Berechtigung bestätigen</button><button class="button button-secondary button-small" name="approve" value="false">Ablehnen</button></div></form>`).join('')||'<p>Keine offenen Anträge.</p>'}</section>`;
  }
  function renderClasses() {
    if(!data) return renderSchool();
    const classes=data.classes.filter(c=>!c.deleted_at), k=currentClass();
    const teacher=data.role?.is_teacher;
    return `<div class="page-top"><div><p class="mode-label">Gemeinsam vorbereitet</p><h1>${k?e(k.name):'Deine Klassen'}</h1><p class="subtle">Prüfungen bleiben hier mit den Angaben deiner Lehrperson aktuell.</p></div>${k?button('Alle Klassen','all-classes'):''}</div>${k?renderClass(k):`<div class="sets-layout">${classes.map(c=>`<article class="set-card"><div><h2>${e(c.name)}</h2><p>${c.exams.length} Prüfungen${c.is_teacher?' · Du verwaltest diese Klasse':''}</p></div>${button('Öffnen','open-class',`data-class="${c.id}"`,false)}</article>`).join('')||'<div class="empty-state"><h2>Noch keine Klasse</h2><p>Nutze den Beitrittscode deiner Lehrperson im Schulbereich.</p></div>'}</div>${teacher?`<section class="panel school-section school-new-class"><h2>Klasse erstellen</h2><form data-school-form="create-class" class="school-inline">${formField('Klassenname','name','','text','required maxlength="100"')}<button class="button button-small">Erstellen</button></form><label class="school-field"><span>Klasse aus JSON-Datei importieren</span><input type="file" accept=".json,application/json" id="class-import"></label><p class="subtle small">Nur Exporte derselben Schule. Es werden keine Login-Konten erstellt.</p></section>${data.classes.filter(c=>c.deleted_at).map(c=>`<article class="school-alert"><strong>${e(c.name)} · gelöscht</strong><p>Export noch bis ${date(new Date(new Date(c.deleted_at).getTime()+7*86400000).toISOString())} möglich.</p>${button('Klasse exportieren','export-class',`data-class="${c.id}"`)}</article>`).join('')}`:''}`}`;
  }
  function renderClass(k) {
    return `<div class="school-layout"><div class="school-stack">${k.exams.map(exam=>`<article class="panel school-section"><h2>${e(exam.title)}</h2><p class="exam-meta">${date(exam.exam_date)} · ${e(VociContent.subject(exam.set_data.subjectId||exam.set_data.language)?.name||'Fach')}</p><p class="subtle">${VociContent.normalizeLearningSet(exam.set_data).blocks.reduce((n,b)=>n+(b.objectiveIds||b.topicIds||[b]).length,0)} Lernziele · aktualisiert ${date(exam.updated_at)}</p><div class="school-inline">${button('Jetzt vorbereiten','study',`data-exam="${exam.id}"`,false)}${button('Zu meinen Lernsets','copy-exam',`data-exam="${exam.id}"`)}${k.can_teach?`${button('Bearbeiten','edit-exam',`data-exam="${exam.id}"`)}${button('Löschen','delete-exam',`data-exam="${exam.id}"`)}`:''}</div></article>`).join('')||'<section class="empty-state"><h2>Noch keine Prüfung angekündigt</h2><p>Neue Prüfungen erscheinen hier automatisch.</p></section>'}${k.can_teach?button('+ Prüfung ankündigen','new-exam','',false):''}</div><aside class="school-stack">${k.can_teach?renderClassManagement(k):'<section class="panel school-section"><h2>Dein Lernstand bleibt privat</h2><p class="subtle">Eine Prüfung in deinen Lernsets ist eine unabhängige Kopie. Spätere Änderungen deiner Lehrperson erscheinen weiterhin hier in der Klasse.</p></section>'}${k.is_teacher&&!k.can_teach?'<p class="school-alert">Zum Verwalten ist ein aktives Lehrpersonen- oder Schulabo erforderlich.</p>':''}</aside></div>`;
  }
  function renderClassManagement(k) {
    return `<section class="panel school-section"><h2>Beitrittscodes</h2><p class="subtle">Das Limit gilt pro Code. Du kannst weitere Codes erstellen. Jeder Code gilt höchstens 7 Tage.</p><form data-school-form="code" class="school-inline">${formField('Maximale Aktivierungen','max_uses','25','number','required min="1" max="10000" step="1"')}<button class="button button-small">Code erstellen</button></form>${k.codes.map(c=>`<p><code class="school-code">${e(c.id)}</code><small>${c.uses}/${c.max_uses} verwendet · bis ${date(c.expires_at)}</small></p>`).join('')}</section>
      <section class="panel school-section"><h2>Schüler · ${k.students.length}</h2><div class="school-list">${k.students.map(s=>`<div class="school-person"><div><strong>${e(s.first_name+' '+s.last_name)}</strong><small>${e(s.username)}</small></div>${button('Entfernen','remove-student',`data-user="${s.user_id}"`)}</div>`).join('')||'<p>Noch keine Schüler beigetreten.</p>'}</div></section>
      <section class="panel school-section"><h2>Lehrpersonen</h2>${k.teachers.map(id=>{const t=data.staff.find(s=>s.user_id===id);return `<div class="school-person"><span>${e(t?t.first_name+' '+t.last_name:'Lehrperson')}</span>${button('Entfernen','remove-class-teacher',`data-user="${id}"`)}</div>`;}).join('')}<form data-school-form="class-teacher" class="school-form"><label class="school-field"><span>Weitere Lehrperson</span><select name="user_id" required><option value="">Auswählen</option>${data.staff.filter(s=>s.is_teacher&&!k.teachers.includes(s.user_id)).map(s=>`<option value="${s.user_id}">${e(s.first_name+' '+s.last_name)}</option>`).join('')}</select></label><button class="button button-secondary button-small">Hinzufügen</button></form></section>
      <section class="panel school-section"><h2>Klasse sichern</h2><p class="subtle">Der Export enthält die Klasse und Prüfungen, ohne Passwörter oder private Lernstände. Nach Löschung werden Klasseninhalte nach 7 Tagen endgültig entfernt.</p><div class="school-inline">${button('Klasse exportieren','export-class')}${button('Klasse löschen','delete-class')}</div></section>`;
  }
  function getExam(id) {
    for(const k of data?.classes||[]) { const exam=k.exams.find(x=>x.id===id); if(exam&&!k.deleted_at) return exam; }
    return null;
  }
  function openDialog(title,body) {
    let dialog=document.querySelector('#school-dialog');
    if(!dialog) {dialog=document.createElement('dialog');dialog.id='school-dialog';dialog.className='auth-dialog school-dialog';document.body.append(dialog);}
    dialog.innerHTML=`<div class="school-dialog-content"><div class="auth-dialog-head"><h2 id="school-dialog-title">${e(title)}</h2><button type="button" class="dialog-close" data-school-action="close-dialog" aria-label="Schliessen">×</button></div><p id="school-dialog-status" class="auth-status" role="status" hidden></p>${body}</div>`;
    dialog.setAttribute('aria-labelledby','school-dialog-title');
    if(!dialog.open) dialog.showModal();
    dialog.querySelector('input:not([type=hidden]),select,button')?.focus();
  }
  async function editExam(exam=null) {
    examClass=selectedClass; examId=exam?.id||'';
    const available=VociSchoolData.availableSubjects(data,user.id);
    if(!available.length)return hooks.notify('Zum Ankündigen einer Prüfung brauchst du ein aktives Fach- oder Schulabo.');
    examDraft=exam?VociContent.normalizeLearningSet(exam.set_data):VociContent.normalizeLearningSet({subjectId:available.includes('en')?'en':available[0],blocks:[]});
    const locked=!available.includes(examDraft.subjectId);
    if(examDraft.subjectId==='geography')await VociGeography.load();
    openDialog(exam?'Prüfung bearbeiten':'Prüfung ankündigen',`<form data-school-form="exam" class="school-form">${formField('Titel','title',exam?.title||'','text','required maxlength="100"')}${formField('Prüfungsdatum','exam_date',exam?.exam_date||'','date','required')}<label class="school-field"><span>Fach</span><select name="exam_subject" aria-describedby="exam-subject-help">${VociContent.subjects.map(s=>`<option value="${s.id}" ${s.id===examDraft.subjectId?'selected':''} ${available.includes(s.id)?'':'disabled'}>${e(s.name)}${available.includes(s.id)?'':' · nicht im Abo'}</option>`).join('')}</select></label><p id="exam-subject-help" class="subtle small">${locked?'Das bisherige Fach ist nicht mehr in deinem Abo enthalten. Wähle ein verfügbares Fach oder passe dein Abo unter «Schule & Abos» an.':'Du kannst die Fächer deines aktiven Abos auswählen. Ein aktives Schulabo schaltet alle Fächer frei.'}</p><fieldset id="exam-objectives" class="exam-objectives" ${locked?'disabled':''}><legend class="section-label">Prüfungsinhalte</legend>${hooks.contentPicker(examDraft.subjectId,examDraft.blocks)}</fieldset><button type="submit" class="button button-small" ${locked?'disabled':''}>${exam?'Änderungen speichern':'Prüfung ankündigen'}</button></form>`);
  }
  function settingsFields() {
    if(!data) return '';
    return `<fieldset class="school-notifications"><legend>Deine E-Mail-Benachrichtigungen</legend>${Object.entries(categories).map(([key,label])=>`<label class="school-check"><input name="notify-${key}" type="checkbox" ${data.profile.preferences[key]?'checked':''}>${label}</label>`).join('')}<p class="subtle small">Konto- und Sicherheitsnachrichten bleiben erforderlich.</p></fieldset>`;
  }
  async function saveSettings(form) {
    if(!data) return;
    const payload={}; for(const key of Object.keys(categories)) payload[key]=form.elements[`notify-${key}`]?.checked||false;
    await rpc('preferences',payload); await refresh(false);
  }
  async function billing(action,plan,subjects,scope) {
    const result=await client.functions.invoke('voci-billing',{body:{action,plan,subjects,school_id:scope==='individual'||plan==='individual'?null:data.school?.id}});
    if(result.error) { let message='Die Zahlung ist noch nicht eingerichtet oder konnte nicht vorbereitet werden.'; try{message=(await result.error.context.json()).error||message;}catch{} throw new Error(message); }
    if(result.data?.url) { const url=new URL(result.data.url); if(url.protocol!=='https:'||!['checkout.stripe.com','invoice.stripe.com'].includes(url.hostname)) throw new Error('Ungültige Zahlungsadresse.'); location.assign(url.href); }
    else { await refresh(); hooks.notify(result.data?.message||'Abonnement aktualisiert. Der Zahlungsstatus wird nach Bestätigung übernommen.'); }
  }
  function showError(error) {
    const status=document.querySelector('#school-dialog[open] #school-dialog-status');
    if(status) {status.hidden=false;status.classList.add('is-error');status.textContent=error.message;}
    else hooks.notify(error.message||'Die Änderung konnte nicht gespeichert werden.');
  }
  async function click(event) {
    const b=event.target.closest('[data-school-action]'); if(!b) return;
    const a=b.dataset.schoolAction;
    if(a==='new-school') {const picker=b.closest('.school-picker');picker.querySelector('[name=school_id]').value='';picker.querySelector('.school-new-fields').hidden=false;picker.querySelector('[name=school_name]').focus();return;}
    if(a==='select-school') {const picker=b.closest('.school-picker');picker.querySelector('[name=school_id]').value=b.dataset.id;picker.querySelector('[name=school_search]').value=b.dataset.name;picker.querySelector('.school-search-results').innerHTML='';picker.querySelector('.school-new-fields').hidden=true;return;}
    if(a==='close-dialog') {document.querySelector('#school-dialog').close();return;}
    if(busy) return;
    busy=true; b.disabled=true;
    try {
      if(a==='school'||a==='classes'||a==='sets') {hooks.navigate(a);if(a!=='sets')await refresh();}
      else if(a==='refresh') await refresh();
      else if(a==='all-classes') {selectedClass='';hooks.render();}
      else if(a==='open-class') {selectedClass=b.dataset.class;hooks.render();}
      else if(a==='new-exam') await editExam();
      else if(a==='edit-exam') await editExam(getExam(b.dataset.exam));
      else if(a==='study') hooks.study(getExam(b.dataset.exam));
      else if(a==='copy-exam') {hooks.copy(getExam(b.dataset.exam));hooks.notify('Unabhängige Kopie zu deinen Lernsets hinzugefügt.');}
      else if(a==='delete-exam' && confirm('Diese Klassenprüfung für alle Schüler löschen? Eigene Kopien bleiben erhalten.')) await rpc('delete_exam',{class_id:selectedClass,id:b.dataset.exam});
      else if(a==='remove-student' && confirm('Diese Person aus der Klasse entfernen?')) await rpc('remove_student',{class_id:selectedClass,user_id:b.dataset.user});
      else if(a==='remove-class-teacher' && confirm('Diese Lehrperson aus der Klassenverwaltung entfernen?')) await rpc('remove_teacher',{class_id:selectedClass,user_id:b.dataset.user});
      else if(a==='remove-staff' && confirm('Diese Person aus der Schulorganisation entfernen?')) await rpc('remove_staff',{user_id:b.dataset.user});
      else if(a==='role') {const m=data.staff.find(s=>s.user_id===b.dataset.user);openDialog('Rollen ändern',`<form data-school-form="role" class="school-form"><input type="hidden" name="user_id" value="${m.user_id}"><label class="school-check"><input name="is_teacher" type="checkbox" ${m.is_teacher?'checked':''}>Lehrperson</label><label class="school-check"><input name="is_admin" type="checkbox" ${m.is_admin?'checked':''}>Administrator</label><button class="button button-small">Speichern</button></form>`);}
      else if(a==='export-class') {const out=await rpc('export_class',{class_id:b.dataset.class||selectedClass});const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='voci-klasse.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      else if(a==='delete-class' && confirm('Klasse löschen? Exportiere sie vorher, falls du eine Kopie brauchst. Die Serverdaten werden nach 7 Tagen endgültig entfernt.')) {await rpc('delete_class',{class_id:selectedClass});selectedClass='';}
      else if(a==='billing' && confirm(data.activation&&!active(ownSubscription(true))?'Karte für das gewählte Schulabo hinterlegen? Die erste Belastung erfolgt frühestens am Aktivierungstag beziehungsweise nach dem Gratismonat.':'Dieses kostenpflichtige Schulpaket buchen bzw. ändern?')) await billing(data.activation&&!active(ownSubscription(true))?'prepare_payment_method':'checkout',b.dataset.plan);
      else if(a==='resume-payment')await billing('resume_payment',data.activation.plan);
      else if(a==='cancel-subscription' && confirm('Abo zum Ende der bezahlten Periode kündigen? Es gibt keine anteilige Rückzahlung bei freiwilliger Kündigung.')) await billing('cancel',null,null,b.dataset.scope);
      if(!document.querySelector('#school-dialog[open]') && !['study','copy-exam','open-class','all-classes','school','classes','sets'].includes(a)) await refresh();
    } catch(error) {showError(error);} finally {busy=false;b.disabled=false;}
  }
  async function submit(event) {
    const form=event.target.closest('[data-school-form]');if(!form)return;event.preventDefault();
    if(busy)return;busy=true;const submit=event.submitter;if(submit)submit.disabled=true;
    try {
      const f=new FormData(form);const action=form.dataset.schoolForm;let result;
      if(action==='profile') await rpc('profile',profilePayload(form));
      else if(action==='join') await rpc('join_class',{code:String(f.get('code')).trim()});
      else if(action==='request') await rpc('request_admin',{reason:f.get('reason'),request_kind:f.get('request_kind')});
      else if(action==='invite-accept') {await rpc('accept_invite',{token:String(f.get('token')).trim()});const url=new URL(location.href);url.searchParams.delete('invite');history.replaceState({},'',url);}
      else if(action==='invite') result=await rpc('invite_staff',{email:f.get('email'),is_admin:f.has('is_admin'),is_teacher:f.has('is_teacher')});
      else if(action==='role') {await rpc('staff_role',{user_id:f.get('user_id'),is_admin:f.has('is_admin'),is_teacher:f.has('is_teacher')});document.querySelector('#school-dialog').close();}
      else if(action==='create-class') {result=await rpc('create_class',{name:f.get('name')});selectedClass=result.class_id;hooks.navigate('classes');}
      else if(action==='code') result=await rpc('create_code',{class_id:selectedClass,max_uses:Number(f.get('max_uses'))});
      else if(action==='class-teacher') await rpc('add_teacher',{class_id:selectedClass,user_id:f.get('user_id')});
      else if(action==='exam') {
        const blocks=examDraft.subjectId==='geography'?examDraft.blocks:[];
        if(f.getAll('objective').length)blocks.push({type:'vocabulary',objectiveIds:f.getAll('objective')});
        if(f.getAll('topic').length)blocks.push({type:examDraft.subjectId==='math'?'mathematics':'grammar',topicIds:f.getAll('topic')});
        if(!blocks.length)throw new Error('Wähle mindestens einen Inhalt für die Prüfung.');
        const set_data=VociContent.createStudySnapshot({subjectId:examDraft.subjectId,blocks,name:f.get('title'),examDate:f.get('exam_date')});
        await rpc('save_exam',{class_id:examClass,id:examId,title:f.get('title'),exam_date:f.get('exam_date'),set_data});document.querySelector('#school-dialog').close();
      }
      else if(action==='review') await rpc('review_admin',{id:f.get('id'),email_domain:f.get('email_domain'),completed_at:f.get('completed_at')?new Date(f.get('completed_at')).toISOString():null,delay_reason:f.get('delay_reason'),approve:event.submitter?.value==='true'});
      else if(action==='individual') {const subjects=f.getAll('subject');if(!subjects.length)throw new Error('Wähle mindestens ein Fach.');if(confirm(`Fächer für CHF ${VociSchoolData.individualPrice(subjects.length)}.– pro Monat buchen?`))await billing('checkout','individual',subjects,'individual');}
      await refresh();
      if(result?.token) {const link=new URL(location.href);link.search='';link.searchParams.set('invite',result.token);openDialog('Einladung erstellt',`<p>Sende diesen Link an die eingeladene Person. Er ist 7 Tage gültig und an deren E-Mail-Adresse gebunden.</p><label class="school-field"><span>Einladungslink</span><input readonly value="${e(link.href)}" onclick="this.select()"></label>`);}
      else hooks.notify('Gespeichert.');
    } catch(error){showError(error);}finally{busy=false;if(submit)submit.disabled=false;}
  }
  async function input(event) {
    const target=event.target;
    if(target.name==='school_search'||target.name==='postal_code') {
      const picker=target.closest('.school-picker');if(!picker)return;
      if(target.name==='school_search') picker.querySelector('[name=school_id]').value='';
      clearTimeout(searchTimer);
      searchTimer=setTimeout(async()=>{if(!client)return;const query=target.value.trim();const result=await client.rpc('voci_find_schools',{search_text:query});if(target.value.trim()!==query||!picker.isConnected)return;picker.querySelector('.school-search-results').innerHTML=result.error?'<p>Schulen konnten nicht geladen werden.</p>':(result.data||[]).map(s=>`<button type="button" data-school-action="select-school" data-id="${s.id}" data-name="${e(s.name)}">${e(s.name)}<small>${e(s.postal_code)} ${e(s.town)}</small></button>`).join('')||(query.length>=2?'<p>Keine Schule gefunden. Du kannst eine eigene hinzufügen.</p>':'');},300);
    }
  }
  async function change(event) {
    if(event.target.closest('[data-school-form="exam"]')) {
      try {
        if(event.target.name==='exam_subject') {
          const subjectId=event.target.value;
          if(!VociSchoolData.availableSubjects(data,user.id).includes(subjectId))throw new Error('Dieses Fach ist nicht in deinem Abo enthalten.');
          if(subjectId==='geography')await VociGeography.load();
          examDraft=VociContent.normalizeLearningSet({subjectId,blocks:subjectId==='geography'?[{type:'geography',catalogId:'un195',continentId:null,regionId:null}]:[]});
          document.querySelector('#exam-objectives').innerHTML='<legend class="section-label">Prüfungsinhalte</legend>'+hooks.contentPicker(subjectId,examDraft.blocks);
          document.querySelector('#exam-objectives').disabled=false;
          event.target.form.querySelector('button[type="submit"]').disabled=false;
          document.querySelector('#exam-subject-help').textContent='Du kannst die Fächer deines aktiven Abos auswählen. Ein aktives Schulabo schaltet alle Fächer frei.';
        }
        if(event.target.name.startsWith('geo-')) {VociGeography.updateSelection(examDraft,event.target);document.querySelector('#exam-objectives').innerHTML='<legend class="section-label">Prüfungsinhalte</legend>'+hooks.contentPicker(examDraft.subjectId,examDraft.blocks);}
      } catch(error){showError(error);}
    }
    if(event.target.name==='subject') {const n=new FormData(event.target.form).getAll('subject').length;document.querySelector('#individual-total').textContent=n?`CHF ${VociSchoolData.individualPrice(n)}.– pro Monat`:'Wähle deine Fächer';}
    if(event.target.id==='class-import') {
      const file=event.target.files[0];if(!file)return;
      try {if(file.size>2000000)throw new Error('Die Datei darf höchstens 2 MB gross sein.');const value=VociSchoolData.parseClassExport(JSON.parse(await file.text()));if(confirm(`«${value.name}» mit ${value.students.length} Schülern und ${value.exams.length} Prüfungen importieren?`)){await rpc('import_class',{data:value});await refresh();hooks.notify('Klasse importiert.');}}
      catch(error){showError(error);}finally{event.target.value='';}
    }
  }
  return {init,setUser,refresh,renderSchool,renderClasses,registrationFields,profilePayload,settingsFields,saveSettings,getExam};
})();
