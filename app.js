const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const accountControls = document.querySelector('#account-controls');
const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const accountDialog = document.querySelector('#account-dialog');
const accountForm = document.querySelector('#account-form');
const storageNote = document.querySelector('#storage-note');
const STORAGE_KEY = 'voci-learning-state';
const cloudConfig = globalThis.VOCI_SUPABASE || {};
const supabaseClient = cloudConfig.url && cloudConfig.anonKey && globalThis.supabase?.createClient
  ? globalThis.supabase.createClient(cloudConfig.url, cloudConfig.anonKey)
  : null;
const validLanguages = new Set(['en', 'fr']);
let vocabulary = [];
let grammarCatalogs = {};
let store = loadStore();
let stage = 'intro';
let editingSetId = null;
let draft = null;
let activeMode = '';
let session = null;
let matchTimer = 0;
let currentUser = null;
let cloudReady = false;
let cloudSaveTimer = 0;
let authMode = 'login';
let showOtherSchoolLevel = false;
let latestShareLink = '';
let latestShareSetId = '';
let pendingShareToken = new URLSearchParams(window.location.search).get('share');
let shareImportChecked = false;
let classStudyId = '';
let sessionRevision = 0;

VociSchool.init(supabaseClient, {
  stage: () => stage,
  render,
  notify,
  hasClassStudy: () => Boolean(classStudyId),
  classStudyId: () => classStudyId,
  navigate: next => { stopMatchTimer(); classStudyId = ''; stage = next; render(); },
  curriculum: (language, selected) => renderCurriculum(vocabulary.filter(g => g.language === language), new Set(selected)),
  contentPicker: (subjectId, blocks) => contentPicker(subjectId,blocks,true),
  study: exam => {
    if (!exam) return notify('Diese Prüfung ist nicht mehr verfügbar.');
    stopMatchTimer(); classStudyId = exam.id; stage = 'dashboard'; render();
  },
  copy: exam => {
    if (!exam) return notify('Diese Prüfung ist nicht mehr verfügbar.');
    store.sets.push(normalizeSet({ ...exam.set_data, id: uid(), name: exam.title, examDate: exam.exam_date }));
    saveStore();
  }
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function uid() { return `set-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function todayISO() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function blankSet() {
  return normalizeSet({id:uid(),subjectId:'en',blocks:[]});
}
function normalizeSet(value) {
  const set = VociContent.normalizeLearningSet(value);
  set.id ||= uid();
  // Existing vocabulary controls use these aliases; persisted data uses only V2 blocks.
  Object.defineProperties(set, {
    language: { get() { return this.subjectId; }, set(id) { this.subjectId = id; this.blocks = []; } },
    objectives: { get() { return this.blocks.find(b=>b.type === 'vocabulary')?.objectiveIds || []; }, set(ids) { this.blocks = [...this.blocks.filter(b=>b.type !== 'vocabulary'), {type:'vocabulary',objectiveIds:ids}]; } }
  });
  return set;
}
function normalizeStore(value) {
  const normalizedSets = VociContent.normalizeSets(Array.isArray(value?.sets) ? value.sets : []);
  const sets = normalizedSets.sets.map(normalizeSet);
  const schoolLevel = value?.profile?.schoolLevel === 'secondary' ? 'secondary' : 'primary';
  const classProgress = {};
  if (value?.classProgress && typeof value.classProgress === 'object') {
    for (const [id, progress] of Object.entries(value.classProgress)) {
      const normalized = normalizeSet(progress);
      if (['__proto__','constructor','prototype'].includes(id)) continue;
      classProgress[id] = { cards: normalized.cards, quizWrong: normalized.quizWrong, results: normalized.results, progress: normalized.progress };
    }
  }
  return { sets, activeSetId: sets.some(set => set.id === value?.activeSetId) ? value.activeSetId : sets[0]?.id || '', profile: { schoolLevel }, classProgress, unreadableSets: normalizedSets.unreadableSets, canSave: normalizedSets.canSave };
}
function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '{}';
    const saved = JSON.parse(raw);
    if (raw !== '{}' && !localStorage.getItem(`${STORAGE_KEY}-before-v2`)) localStorage.setItem(`${STORAGE_KEY}-before-v2`,raw);
    if (Array.isArray(saved.sets)) {
      return normalizeStore(saved);
    }
    // Migrate the first single learning set without losing previous progress.
    if (Array.isArray(saved.objectives) || saved.examDate || Array.isArray(saved.mastered)) {
      const migrated = normalizeSet({ ...saved, id: uid(), name: 'Mein erstes Lernset', cards: { known: saved.mastered || [], practice: [] }, results: saved.lastTest ? [{ type: 'Übungstest', score: saved.lastTest.score, total: saved.lastTest.total, date: saved.lastTest.date || new Date().toISOString() }] : [] });
      return { sets: [migrated], activeSetId: migrated.id };
    }
  } catch { return {sets:[],activeSetId:'',profile:{schoolLevel:'primary'},canSave:false}; }
  return { sets: [], activeSetId: '', profile: { schoolLevel: 'primary' } };
}
function persistLocalStore() {
  if (store.canSave === false) { notify('Ein gespeichertes Lernset kann nicht gelesen werden. Die ursprünglichen Daten bleiben geschützt. Bitte exportiere deine Sicherung, bevor du weiter speicherst.'); return false; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; }
  catch { notify('Der Lernstand kann auf diesem Gerät gerade nicht gespeichert werden.'); return false; }
}
function saveStore() {
  if (persistLocalStore()) {
    notice.hidden = true;
    queueCloudSave();
  }
}
function queueCloudSave() {
  if (!currentUser || !cloudReady) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveCloudStore, 500);
}
async function saveCloudStore() {
  if (!supabaseClient || !currentUser || !cloudReady || store.canSave === false) return;
  const { error } = await supabaseClient.from('learning_states').upsert({
    user_id: currentUser.id,
    state: structuredClone(store),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) notify('Der Lernstand konnte gerade nicht online gespeichert werden. Deine Daten bleiben auf diesem Gerät.');
}
function updateAccountControls() {
  if (currentUser) {
    accountControls.innerHTML = `<span class="account-email" title="${escapeHTML(currentUser.email || '')}">${escapeHTML(currentUser.email || 'Angemeldet')}</span><button class="button button-secondary button-small account-button" data-account-action="open-settings">Konto</button><button class="button button-secondary button-small account-button" data-account-action="logout">Abmelden</button>`;
    storageNote.textContent = 'Dein Lernstand wird mit deinem Konto synchronisiert.';
  } else {
    accountControls.innerHTML = supabaseClient ? '<button class="button button-small account-button" data-account-action="open-auth">Anmelden</button>' : '';
    storageNote.textContent = 'Dein Lernstand bleibt auf diesem Gerät.';
  }
}
function updateAuthDialog() {
  const signup = authMode === 'signup';
  document.querySelector('#auth-title').textContent = signup ? 'Konto erstellen' : 'Lernstand sichern';
  document.querySelector('#auth-copy').textContent = signup ? 'Erstelle ein Konto, um Lernsets und Fortschritt auf deinen Geräten zu nutzen.' : 'Melde dich an, um deine Lernsets auf deinen Geräten zu verwenden.';
  document.querySelector('#auth-submit').textContent = signup ? 'Konto erstellen' : 'Anmelden';
  document.querySelector('#auth-switch').textContent = signup ? 'Ich habe bereits ein Konto' : 'Konto erstellen';
  document.querySelector('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
  document.querySelector('#school-level-field').hidden = !signup;
  document.querySelectorAll('input[name="school-level"]').forEach(input => { input.disabled = !signup; });
  const schoolProfile = document.querySelector('#signup-school-profile');
  schoolProfile.hidden = !signup;
  if (signup && !schoolProfile.innerHTML) schoolProfile.innerHTML = VociSchool.registrationFields();
  schoolProfile.querySelectorAll('input').forEach(input => { input.disabled = !signup; });
}
function clearAuthFields() {
  authForm.reset();
  const status = document.querySelector('#auth-status');
  status.hidden = true;
  status.textContent = '';
  status.classList.remove('is-error');
}
function showAuthStatus(message, isError = false) {
  const status = document.querySelector('#auth-status');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
  status.hidden = false;
}
function schoolLevel() {
  return store.profile?.schoolLevel === 'secondary' ? 'secondary' : 'primary';
}
function setSchoolLevel(level) {
  store.profile = { schoolLevel: level === 'secondary' ? 'secondary' : 'primary' };
  saveStore();
}
async function loadCloudStore() {
  if (!supabaseClient || !currentUser) return;
  const loadingUser = currentUser;
  cloudReady = false;
  let profileWasMissing = false;
  const { data, error } = await supabaseClient.from('learning_states').select('state').eq('user_id', loadingUser.id).maybeSingle();
  if (currentUser?.id !== loadingUser.id) return;
  if (error) {
    notify('Dein Online-Lernstand konnte nicht geladen werden. Du kannst lokal weiterlernen.');
  } else if (data?.state) {
    store = normalizeStore(data.state);
    if (!data.state.profile?.schoolLevel && currentUser.user_metadata?.schoolLevel) {
      store.profile = { schoolLevel: currentUser.user_metadata.schoolLevel === 'secondary' ? 'secondary' : 'primary' };
      profileWasMissing = true;
    }
    persistLocalStore();
  } else {
    setSchoolLevel(currentUser.user_metadata?.schoolLevel);
    cloudReady = true;
    await saveCloudStore();
  }
  cloudReady = !error && store.canSave !== false;
  if (profileWasMissing) await saveCloudStore();
}
async function applySession(user, clearOnLogout = false) {
  const revision = ++sessionRevision;
  const hadUser = Boolean(currentUser);
  const userChanged = currentUser?.id !== user?.id;
  if (userChanged) {
    clearTimeout(cloudSaveTimer); cloudReady = false; stopMatchTimer(); session = null;
    classStudyId = '';
    if (hadUser && user) { store = normalizeStore({}); stage = 'intro'; }
  }
  currentUser = user;
  if (currentUser) {
    await loadCloudStore();
    if (revision !== sessionRevision) return;
    await checkShareImport();
  }
  else if (clearOnLogout && hadUser) {
    clearTimeout(cloudSaveTimer);
    store = { sets: [], activeSetId: '', profile: { schoolLevel: 'primary' } };
    persistLocalStore();
    stage = 'intro';
    classStudyId = '';
    stopMatchTimer();
    session = null;
    if (accountDialog.open) accountDialog.close();
  }
  if (userChanged || !user) await VociSchool.setUser(user);
  if (revision !== sessionRevision) return;
  updateAccountControls();
  if (currentUser && authDialog.open) authDialog.close();
  if (vocabulary.length) render();
}
async function initializeCloud() {
  updateAccountControls();
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) notify('Die Anmeldung konnte nicht vorbereitet werden.');
  await applySession(data?.session?.user || null);
  supabaseClient.auth.onAuthStateChange((_event, sessionData) => {
    applySession(sessionData?.user || null, true);
  });
}
function activeSet() {
  if (classStudyId) {
    const exam = VociSchool.getExam(classStudyId);
    if (exam) return normalizeSet({ ...exam.set_data, ...store.classProgress?.[classStudyId], id: `class-${classStudyId}`, name: exam.title, examDate: exam.exam_date });
  }
  return store.sets.find(set => set.id === store.activeSetId) || null;
}
function replaceSet(updated) {
  if (classStudyId && updated.id === `class-${classStudyId}`) {
    store.classProgress ||= {};
    store.classProgress[classStudyId] = { cards: updated.cards, quizWrong: updated.quizWrong, results: updated.results, progress: updated.progress };
    saveStore(); return;
  }
  store.sets = store.sets.map(set => set.id === updated.id ? updated : set);
  saveStore();
}
async function deleteLearningSet(id) {
  const set = store.sets.find(item => item.id === id);
  if (!set || !window.confirm(`«${setLabel(set)}» wirklich löschen? Der Lernfortschritt und alle Teil-Links gehen verloren.`)) return;
  if (supabaseClient && currentUser) {
    const { error } = await supabaseClient.from('shared_sets').delete().eq('source_set_id', id);
    if (error) return notify('Die Teil-Links konnten nicht gelöscht werden. Das Lernset bleibt erhalten.');
  }
  store.sets = store.sets.filter(item => item.id !== id);
  store.activeSetId = store.sets[0]?.id || '';
  saveStore();
  stage = 'sets';
}
function sharedCopy(set) {
  return VociContent.createStudySnapshot(set);
}
async function shareActiveSet() {
  const set = activeSet();
  if (!set || !supabaseClient || !currentUser) return notify('Melde dich an, um ein Lernset zu teilen.');
  const { data, error } = await supabaseClient.rpc('create_shared_set', { source_set_id: set.id, set_data: sharedCopy(set) });
  const share = data?.[0];
  if (error || !share?.share_token) return notify('Der Teil-Link konnte gerade nicht erstellt werden.');
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('share', share.share_token);
  latestShareLink = url.toString();
  latestShareSetId = set.id;
  try { await navigator.clipboard.writeText(latestShareLink); notify('Teil-Link kopiert. Er läuft in 7 Tagen ab.'); }
  catch { notify('Teil-Link erstellt. Kopiere ihn aus dem Feld.'); }
}
async function copyShareLink() {
  if (!latestShareLink) return;
  try { await navigator.clipboard.writeText(latestShareLink); notify('Teil-Link kopiert.'); }
  catch { notify('Kopiere den Teil-Link aus dem Textfeld.'); }
}
async function checkShareImport() {
  if (!pendingShareToken || shareImportChecked || !supabaseClient || !currentUser) return;
  shareImportChecked = true;
  const { data, error } = await supabaseClient.rpc('get_shared_set', { share_token: pendingShareToken });
  if (error || !data) {
    notify('Dieser Teil-Link ist abgelaufen oder nicht mehr verfügbar.');
    return;
  }
  const shared = normalizeSet(data);
  if (!window.confirm(`«${setLabel(shared)}» als eigenes Lernset importieren?`)) return;
  const imported = normalizeSet({ ...sharedCopy(shared), id: uid(), name: `${setLabel(shared)} (geteilt)` });
  store.sets.push(imported);
  store.activeSetId = imported.id;
  saveStore();
  pendingShareToken = '';
  history.replaceState({}, '', window.location.pathname);
  stage = 'dashboard';
}
function validateVocabulary(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('Die Vokabelliste ist leer.');
  const ids = new Set();
  for (const group of data) {
    if (!validLanguages.has(group.language) || !group.unit || !group.objective || !Array.isArray(group.words) || !group.words.length) throw new Error('Jedes Lernziel braucht mindestens eine vollständige Vokabel.');
    for (const word of group.words) {
      if (!word.id || !word.term || !word.translation || ids.has(word.id)) throw new Error('Ein Vokabeleintrag fehlt oder ist doppelt.');
      ids.add(word.id);
    }
  }
  return data;
}
function courseFor(group) { return globalThis.VociData.getCourse(group); }
function objectiveKey(group) { return [courseFor(group).name, group.unit, group.objective].join('::'); }
function legacyObjectiveKey(group) { return [group.unit, group.objective].join('::'); }
function directionFor(mode) { return document.querySelector(`[data-direction="${mode}"]`)?.value === 'foreign' ? 'foreign' : 'german'; }
function directionSelect(mode) { return `<label class="mode-select">Antwort auf <select data-direction="${mode}" aria-label="Antwortsprache"><option value="german">Deutsch</option><option value="foreign">Fremdsprache</option></select></label>`; }
function questionFor(word, direction) { return VociData.promptForDirection(word, direction); }
function answerFor(word, direction) { return VociData.answerForDirection(word, direction); }
function wordsFor(set = activeSet()) {
  if (!set) return [];
  return vocabulary.filter(group => group.language === set.language && set.objectives.includes(objectiveKey(group))).flatMap(group => group.words);
}
function setLabel(set) { return set.name.trim() || `${VociContent.subject(set.subjectId).name} · Lernset`; }
function shuffled(items) { return [...items].sort(() => Math.random() - .5); }
function unique(items) { return [...new Set(items)]; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Kein Termin'; }
function daysUntil(value) { return value ? Math.ceil((new Date(`${value}T00:00:00`) - new Date(todayISO())) / 86400000) : null; }
function formatSeconds(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function normalizeAnswer(value) { return String(value).trim().toLocaleLowerCase('de-CH').replace(/[’']/g, "'"); }
function notify(message) { notice.textContent = message; notice.hidden = false; clearTimeout(notify.timeout); notify.timeout = setTimeout(() => { notice.hidden = true; }, 3600); }
function logResult(type, score, total, detail = '') {
  const set = activeSet();
  replaceSet(normalizeSet(VociContent.recordStudyResult(set,{type,score,total,detail})));
}
function recordCard(wordId, category) {
  const set = activeSet();
  set.cards.known = set.cards.known.filter(id => id !== wordId);
  set.cards.practice = set.cards.practice.filter(id => id !== wordId);
  set.cards[category].push(wordId);
  replaceSet(set);
}
function recordQuizAnswer(wordId, correct) {
  const set = activeSet();
  set.quizWrong = set.quizWrong.filter(id => id !== wordId);
  if (!correct) set.quizWrong.push(wordId);
  replaceSet(set);
}

function render() {
  document.body.dataset.stage=stage;
  document.querySelectorAll('[data-nav]').forEach(el=>el.setAttribute('aria-current',el.dataset.nav===stage?'page':'false'));
  document.querySelector('#page-location').textContent=({intro:'Mein Lernplatz',sets:'Lernsets',setup:'Lernset zusammenstellen',dashboard:'Dein Lernset',mode:'Üben',progress:'Lernfortschritt',school:'Schule & Abos',classes:'Klassen'})[stage] || 'Voci';
  if (classStudyId && !VociSchool.getExam(classStudyId)) { classStudyId = ''; stopMatchTimer(); stage = 'classes'; }
  app.innerHTML = stage === 'school' ? VociSchool.renderSchool() : stage === 'classes' ? VociSchool.renderClasses() : stage === 'progress' ? renderProgress() : stage === 'intro' ? renderIntro() : stage === 'sets' ? renderSets() : stage === 'setup' ? renderSetup() : stage === 'dashboard' ? renderDashboard() : renderMode();
  if (classStudyId && stage === 'dashboard') {
    app.insertAdjacentHTML('afterbegin', '<p class="school-alert">Klassenprüfung · Die Angaben werden von deiner Lehrperson aktualisiert. Dein Lernfortschritt bleibt privat.</p>');
    app.querySelectorAll('[data-action="edit-set"], .share-panel').forEach(element => { element.hidden = true; });
  }
  if (stage === 'mode' && (activeMode === 'test' || activeMode === 'quiz' && session.kind === 'write' && !session.answered)) document.querySelector('.answer-form input')?.focus();
  if (stage === 'mode' && ['grammar','mathematics'].includes(activeMode)) {
    document.querySelector(session.answered?'[data-practice="next"]':'#practice-answer')?.focus();
  }
  if(stage==='mode'&&activeMode.startsWith('geography-')){
    VociGeography.bind(session,render);
    document.querySelector(session.answered?'[data-geo-action="next"]':session.reveal?'[data-geo-action="solution"]':'#geo-answer')?.focus();
  }
}
function renderIntro() {
  const upcoming=store.sets.filter(s=>s.examDate>=todayISO()).sort((a,b)=>a.examDate.localeCompare(b.examDate))[0];
  const descriptions={de:'Sprache verstehen',en:'Voci & Grammatik',fr:'Voci & Grammatik',math:'Geometrie & Pythagoras',geography:'Länder & Kantone'};
  return `<section class="welcome"><h1>Bereit für deinen<br>nächsten Schritt.</h1><p class="lead">Wähle ein Fach, stelle deine Inhalte zusammen und lerne in deinem Tempo. Dein Lernstand bleibt für die nächste Runde gespeichert.</p></section>${upcoming?`<section class="next-step"><div><h2>${escapeHTML(setLabel(upcoming))}</h2><p>Deine nächste Prüfung · ${escapeHTML(formatDate(upcoming.examDate))}</p></div><button class="button" data-action="open-set" data-id="${escapeHTML(upcoming.id)}">Jetzt vorbereiten</button></section>`:`<section class="next-step"><div><h2>Ein Lernset. Dein Prüfungsstoff.</h2><p>Mit oder ohne Prüfungstermin – du bestimmst, was du übst.</p></div><button class="button" data-action="new-set">Erstes Lernset erstellen</button></section>`}<section class="subject-section"><h2>Deine Fächer</h2><div class="subject-list">${VociContent.subjects.map(subject=>`<button class="subject-link" data-action="new-subject" data-subject="${subject.id}" aria-label="${subject.name}"><strong>${subject.name}</strong><span>${descriptions[subject.id]}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button>`).join('')}</div></section><section class="recent-sets"><div class="section-heading"><h2>Deine Lernsets</h2><button class="text-link" data-action="sets">Alle anzeigen</button></div>${store.sets.length?store.sets.slice(-3).reverse().map(set=>`<div class="recent-row"><div><h3>${escapeHTML(setLabel(set))}</h3><p>${VociContent.subject(set.subjectId).name} · ${selectionSummary(set)}</p></div><button class="button button-secondary" data-action="open-set" data-id="${escapeHTML(set.id)}">Weiterlernen</button></div>`).join(''):'<p class="subtle">Hier findest du deine Lernsets, sobald du eines erstellt hast.</p>'}</section>`;
}
function renderProgress() {
  const results=store.sets.flatMap(set=>set.results.map(result=>({...result,set}))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return `<div class="page-top"><div><h1>Dein Lernfortschritt</h1><p class="subtle">Deine letzten Übungen – nur für dich sichtbar.</p></div></div>${results.length?`<ul class="history-list">${results.map(result=>`<li><div><strong>${escapeHTML(setLabel(result.set))}</strong><p>${VociContent.subject(result.set.subjectId).name} · ${escapeHTML(result.type)}</p></div><span>${Math.round(result.score/result.total*100)} % · ${result.score}/${result.total} ${result.unit==='points'?'Punkte':'Antworten'}</span><time>${escapeHTML(new Date(result.date||0).toLocaleDateString('de-CH'))}</time></li>`).join('')}</ul>`:'<section class="empty-state"><h2>Dein erster Schritt zählt.</h2><p>Schliesse eine Übung ab, um dein Ergebnis hier zu sehen.</p><button class="button" data-action="sets">Zu den Lernsets</button></section>'}`;
}
function renderSets() {
  const sets = store.sets;
  return `<div class="page-top"><div><h1>Meine Lernsets</h1><p class="subtle">Jede Prüfung erhält ihr eigenes Lernset und ihren eigenen Fortschritt.</p></div><button class="back-link" data-action="home">← Zur Startseite</button></div>
    <section class="sets-layout">${sets.length ? sets.map(set => {
      const words = wordsFor(set); const last = set.results.at(-1);
      return `<article class="set-card ${set.id === store.activeSetId ? 'is-active' : ''}"><div><h2>${escapeHTML(setLabel(set))}</h2><p>${VociContent.subject(set.subjectId).name} · ${selectionSummary(set)} · ${escapeHTML(formatDate(set.examDate))}</p><small>${last ? `Letzte Übung: ${last.type} ${last.score}/${last.total}` : 'Noch keine Übung abgeschlossen'}</small></div><div class="set-actions"><button class="button button-small" data-action="open-set" data-id="${set.id}">Öffnen</button><button class="button button-secondary button-small" data-action="edit-set" data-id="${set.id}">Ändern</button><button class="text-link danger-link" data-action="delete-set" data-id="${set.id}">Löschen</button></div></article>`;
    }).join('') : '<div class="empty-state"><h2>Noch kein Lernset</h2><p>Erstelle ein Lernset für deine nächste Prüfung.</p></div>'}</section>
    <div class="answer-actions"><button class="button" data-action="new-set">+ Neues Lernset</button></div>`;
}
function renderCurriculum(groups, selected) {
  const byCourse = Object.values(groups.reduce((all, group) => {
    const course = courseFor(group).name;
    (all[course] ||= []).push(group);
    return all;
  }, {}));
  return byCourse.map(groupsForCourse => {
    const course = courseFor(groupsForCourse[0]);
    const byUnit = Object.values(groupsForCourse.reduce((all, group) => { (all[group.unit] ||= []).push(group); return all; }, {}));
    return `<details class="course-folder" open><summary><span>${escapeHTML(course.name)}</span><small>${VociData.schoolLevelLabel(course.schoolLevel)}</small></summary>${byUnit.map(groupsForUnit => `<details class="unit-folder"><summary>${escapeHTML(groupsForUnit[0].unit)}<small>${groupsForUnit.reduce((total, group) => total + group.words.length, 0)} Wörter</small></summary><div class="folder-objectives">${groupsForUnit.map(group => `<label class="objective-choice"><input type="checkbox" name="objective" value="${escapeHTML(objectiveKey(group))}" ${selected.has(objectiveKey(group)) ? 'checked' : ''}><span>${escapeHTML(group.objective)}</span><small>${group.words.length} Wörter</small></label>`).join('')}</div></details>`).join('')}</details>`;
  }).join('');
}
function contentPicker(subjectId, blocks, includeOther = showOtherSchoolLevel) {
  const selected = type => blocks.find(b=>b.type === type);
  const section = (title,body) => `<fieldset class="form-section form-fieldset"><legend>${title}</legend>${body}</fieldset>`;
  let html = '';
  if (['en','fr'].includes(subjectId)) html += section('Vokabeln',renderCurriculum(VociData.visibleCourses(vocabulary.filter(g=>g.language === subjectId),schoolLevel(),includeOther),new Set(selected('vocabulary')?.objectiveIds || [])));
  const topics = subjectId === 'math' ? VociMathData.topics : grammarCatalogs[subjectId]?.topics.filter(t=>includeOther || t.levels.includes(schoolLevel()));
  if (topics) {
    const type = subjectId === 'math' ? 'mathematics' : 'grammar';
    html += section(type === 'grammar'?'Grammatik':'Mathematikthemen',`<div class="topic-options">${topics.map(t=>`<label class="objective-choice"><input type="checkbox" name="topic" data-type="${type}" value="${escapeHTML(t.id)}" ${selected(type)?.topicIds.includes(t.id)?'checked':''}><span>${escapeHTML(t.name)}</span></label>`).join('')}</div>`);
  }
  if (subjectId === 'geography') html += globalThis.VociGeography?.picker(selected('geography')) || '<p>Der Kartenkatalog wird vorbereitet.</p>';
  return html;
}
function selectionSummary(set) {
  const words = wordsFor(set).length, topics = set.blocks.reduce((n,b)=>n+(b.topicIds?.length || 0),0);
  return [words?`${words} Vokabeln`:'',topics?`${topics} Themen`:'',set.blocks.some(b=>b.type === 'geography')?'Kartenauswahl':''].filter(Boolean).join(' · ') || 'Noch keine Inhalte ausgewählt';
}
function renderSetup() {
  const current=draft || blankSet();
  return `<div class="page-top"><div><h1>${editingSetId?'Lernset ändern':'Neues Lernset'}</h1><p class="subtle">Wähle dein Fach und die Inhalte für deine nächste Übung.</p></div><button class="back-link" data-action="sets">Zurück zu den Lernsets</button></div><section class="panel setup-panel"><label class="date-field">Name des Lernsets<input id="set-name" maxlength="60" value="${escapeHTML(current.name)}" placeholder="z. B. Vorbereitung auf die Geometrieprüfung"></label><fieldset class="form-section form-fieldset"><legend>Welches Fach lernst du?</legend><div class="language-options">${VociContent.subjects.map(subject=>languageOption(subject.id,'',subject.name,current.subjectId)).join('')}</div></fieldset><div class="folder-actions"><span>${VociData.schoolLevelLabel(schoolLevel())}</span><button class="text-link" data-action="toggle-other-level">${showOtherSchoolLevel?'Nur meine Stufe zeigen':'Andere Stufe anzeigen'}</button></div>${contentPicker(current.subjectId,current.blocks)}<label class="date-field">Prüfungstermin (optional)<input id="exam-date" type="date" value="${escapeHTML(current.examDate)}"></label><div class="setup-footer"><p>${selectionSummary(current)}</p><button class="button" data-action="save-set">Lernset speichern</button></div></section>`;
}
function renderSubjectModules(set) {
  let html='';
  for(const block of set.blocks) {
    if(block.type === 'grammar' && block.topicIds.length) {
      const topics=grammarCatalogs[set.subjectId]?.topics.filter(t=>block.topicIds.includes(t.id)) || [];
      html+=`<section class="subject-module"><h2>Grammatik</h2><p>${topics.length} Themen · Erklärungen und Übungen</p><button class="button" data-action="start-practice" data-mode="grammar">Grammatik üben</button><div class="topic-explanations">${topics.map(t=>`<details><summary>${escapeHTML(t.name)}</summary><p>${escapeHTML(t.explanation)}</p><dl>${t.examples.map(x=>`<dt>${escapeHTML(x.prompt)}</dt><dd>${escapeHTML(x.answer)}</dd>`).join('')}</dl></details>`).join('')}</div></section>`;
    }
    if(block.type === 'mathematics' && block.topicIds.length)html+=`<section class="subject-module"><h2>Mathematik</h2><p>${block.topicIds.length} Themen · Drei Aufgaben je Thema mit Lösungsweg und Taschenrechner.</p><button class="button" data-action="start-practice" data-mode="mathematics">Aufgaben lösen</button></section>`;
    if(block.type === 'geography')html+=globalThis.VociGeography?.dashboard(block) || '';
  }
  return html;
}
function languageOption(code, flag, label, selected) { return `<label class="language-option"><input type="radio" name="language" value="${code}" ${selected === code ? 'checked' : ''}><span><span class="flag" aria-hidden="true">${flag}</span>${label}</span></label>`; }
function renderSharePanel() {
  if (!currentUser || !supabaseClient) return '<section class="share-panel"><div><h2>Lernset teilen</h2><p class="subtle">Melde dich an, um dieses Lernset als Link zu teilen.</p></div></section>';
  return `<section class="share-panel"><div><h2>Lernset teilen</h2><p class="subtle">Der Link importiert eine eigene Kopie und läuft nach 7 Tagen ab.</p></div><div class="share-actions"><button class="button button-small" data-action="share-set">Teil-Link erstellen</button>${latestShareLink && latestShareSetId === activeSet()?.id ? `<label class="share-link"><span class="sr-only">Teil-Link</span><input value="${escapeHTML(latestShareLink)}" readonly><button class="button button-secondary button-small" data-action="copy-share-link">Kopieren</button></label>` : ''}</div></section>`;
}
function renderDashboard() {
  const set = activeSet(); if (!set) { stage = 'sets'; return renderSets(); }
  const words = wordsFor(); const days = daysUntil(set.examDate); const deadline = !set.examDate ? 'Lerne in deinem Tempo' : days === 0 ? 'Heute ist Prüfung!' : days === 1 ? 'Noch 1 Tag bis zur Prüfung' : days > 1 ? `Noch ${days} Tage bis zur Prüfung` : 'Prüfungstermin vorbei';
  const known = set.cards.known.filter(id => words.some(word => word.id === id)).length;
  const practice = set.cards.practice.filter(id => words.some(word => word.id === id)).length;
  const wrong = set.quizWrong.filter(id => words.some(word => word.id === id)).length;
  const history = [...set.results].reverse().slice(0, 4);
  return `<div class="page-top"><div><h1>${escapeHTML(setLabel(set))}</h1><p class="subtle">${VociContent.subject(set.subjectId).name} · ${selectionSummary(set)}</p></div><button class="back-link" data-action="sets">← Meine Lernsets</button></div>
    <section class="dashboard-hero"><div><h2>${escapeHTML(deadline)}</h2><p>Prüfung: ${escapeHTML(formatDate(set.examDate))}</p></div><div class="exam-badge" ${words.length?'':'hidden'}><strong>${known}/${words.length}</strong><span>Karteikarten: Kann ich</span></div></section>
    ${renderSharePanel()}${renderSubjectModules(set)}<section aria-labelledby="modes-title" ${words.length?'':'hidden'}><h2 id="modes-title">Wie möchtest du lernen?</h2><div class="mode-grid">
      <article class="mode-card mode-card-match"><div class="mode-card-head"><span class="mode-count">${Math.min(words.length, 12)} von ${words.length} Wörtern</span></div><h3>Zuordnen auf Zeit</h3><p>Finde alle Paare. Bei einem Fehler kommt eine Strafsekunde dazu.</p><button class="button button-small" data-action="start-match">Spiel starten →</button></article>
      <article class="mode-card"><div class="mode-card-head"><span class="mode-count">${known} kann ich · ${practice} noch üben</span></div><h3>Karteikarten</h3><p>Sortiere jede Karte in «Kann ich» oder «Noch üben».</p><div class="mode-actions">${directionSelect('flash')}<button class="button button-small" data-action="start-flash">Alle wiederholen</button><button class="button button-secondary button-small" data-action="start-flash-practice" ${practice ? '' : 'disabled'}>Noch üben</button></div></article>
      <article class="mode-card"><div class="mode-card-head"><span class="mode-count">${wrong} nochmals abfragen</span></div><h3>Multiple Choice</h3><p>Wähle die richtige Antwort aus.</p><div class="mode-actions">${directionSelect('choice')}<button class="button button-small" data-action="start-quiz" data-kind="choice" data-scope="all">Alle abfragen</button>${wrong ? '<button class="text-link" data-action="start-quiz" data-kind="choice" data-scope="wrong">Nur falsche</button>' : ''}</div></article>
      <article class="mode-card"><div class="mode-card-head"><span class="mode-count">${wrong} nochmals abfragen</span></div><h3>Schreiben</h3><p>Schreibe die richtige Antwort selbst auf.</p><div class="mode-actions">${directionSelect('write')}<button class="button button-secondary button-small" data-action="start-quiz" data-kind="write" data-scope="all">Alle abfragen</button>${wrong ? '<button class="text-link" data-action="start-quiz" data-kind="write" data-scope="wrong">Nur falsche</button>' : ''}</div></article>
      <article class="mode-card mode-card-test"><div class="mode-card-head"><span class="mode-count">Ergebnis am Ende</span></div><h3>Kleiner Übungstest</h3><p>Gib die Anzahl Fragen ein. Bei einer zu hohen Zahl kommen alle Vokabeln.</p><div class="mode-actions"><label class="mode-select">Vokabeln <input id="test-count" class="mode-number-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${words.length}" aria-label="Anzahl Vokabeln im Test"></label><button class="button button-small" data-action="start-test">Test starten →</button></div></article>
    </div></section>
    <section class="history-section"><h2>Dein Lernfortschritt</h2>${history.length ? `<ul class="history-list">${history.map(result => `<li><strong>${escapeHTML(result.type)}</strong><span>${result.score}/${result.total}${result.detail ? ` · ${escapeHTML(result.detail)}` : ''}</span><time datetime="${escapeHTML(result.date)}">${new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'numeric' }).format(new Date(result.date))}</time></li>`).join('')}</ul>` : '<p class="subtle">Schliesse eine Übung oder einen Test ab, dann erscheint dein Resultat hier.</p>'}</section>`;
}
function modeHeader(title, label, index, total) { return `<div class="mode-heading"><div><p class="mode-label">${escapeHTML(label)}</p><h1>${escapeHTML(title)}</h1></div>${total ? `<span class="mode-counter">${index + 1} / ${total}</span>` : ''}</div>`; }
function renderMode() {
  if (['grammar','mathematics'].includes(activeMode)) return VociPractice.render(session);
  if (activeMode.startsWith('geography-')) return VociGeography.render(session);
  let body = activeMode === 'match' ? renderMatch() : activeMode === 'flash' ? renderFlash() : activeMode === 'quiz' ? renderQuiz() : renderTest();
  return `<div class="mode-workspace"><button class="back-link" data-action="dashboard">← Zu den Lernmodi</button>${body}</div>`;
}
function renderMatch() {
  const done = session.matched.size === session.deck.length; if (done) stopMatchTimer();
  const left = session.deck.map(word => `<button class="match-option ${session.matched.has(word.id) ? 'is-matched' : ''} ${session.selectedLeft === word.id ? 'is-selected' : ''}" data-action="match-pick" data-side="left" data-id="${word.id}" ${session.matched.has(word.id) || session.locked ? 'disabled' : ''}>${escapeHTML(word.term)}</button>`).join('');
  const right = session.translations.map(word => `<button class="match-option ${session.matched.has(word.id) ? 'is-matched' : ''} ${session.selectedRight === word.id ? 'is-selected' : ''}" data-action="match-pick" data-side="right" data-id="${word.id}" ${session.matched.has(word.id) || session.locked ? 'disabled' : ''}>${escapeHTML(word.translation)}</button>`).join('');
  return `${modeHeader('Zuordnen auf Zeit', 'Finde die Paare', 0, session.deck.length)}<section class="activity-card"><div class="timer"><span>${done ? 'Geschafft!' : 'Jeder Fehler zählt als Strafsekunde.'}</span><output id="timer">${formatSeconds(session.seconds + session.penalties)}</output></div><p class="penalty-line">Strafsekunden: <strong>+${session.penalties}</strong></p>${done ? `<div class="result-score">${formatSeconds(session.seconds + session.penalties)}</div><p class="subtle centered">Zeit: ${formatSeconds(session.seconds)} + ${session.penalties} Strafsekunde${session.penalties === 1 ? '' : 'n'}.</p><div class="answer-actions"><button class="button" data-action="restart-match">Nochmal spielen</button></div>` : `<div class="match-board"><div class="match-column">${left}</div><div class="match-column">${right}</div></div><p class="mode-feedback ${session.message.includes('Richtig') ? 'is-right' : session.message ? 'is-wrong' : ''}" aria-live="polite">${escapeHTML(session.message || 'Wähle ein Wort und seine Übersetzung.')}</p>`}</section>`;
}
function renderFlash() {
  const word = session.deck[session.index]; if (!word) return renderFlashFinish();
  const revealed = session.revealed;
  return `${modeHeader(session.scope === 'practice' ? 'Noch üben' : 'Karteikarten', 'Sortiere die Karten', session.index, session.deck.length)}<section class="activity-card"><button class="flashcard" data-action="flip-card" aria-label="Antwort aufdecken"><span><strong class="flashcard-face">${escapeHTML(revealed ? answerFor(word, session.direction) : questionFor(word, session.direction))}</strong><span class="flashcard-hint">${revealed ? escapeHTML(questionFor(word, session.direction)) : 'Tippe auf die Karte, um die Antwort aufzudecken'}</span></span></button><div class="flash-controls"><button class="button button-coral button-small" data-action="flash-practice" ${!revealed ? 'disabled' : ''}>Noch üben</button><button class="button button-small" data-action="flash-known" ${!revealed ? 'disabled' : ''}>Kann ich</button></div><p class="mode-feedback">Die Kategorien werden in diesem Lernset gespeichert.</p></section>`;
}
function renderFlashFinish() {
  const set = activeSet(); const practice = set.cards.practice.filter(id => wordsFor().some(word => word.id === id)).length;
  return `${modeHeader('Karten sortiert', 'Karteikarten', 0, 0)}<section class="activity-card"><div class="result-score">${practice}</div><p class="subtle centered">${practice ? `${practice} Karte${practice === 1 ? '' : 'n'} liegen noch in «Noch üben». Du kannst diese Runde beliebig oft wiederholen.` : 'Alle Karten sind als «Kann ich» markiert.'}</p><div class="answer-actions"><button class="button button-secondary" data-action="start-flash" data-direction="${session.direction}">Alle wiederholen</button>${practice ? `<button class="button" data-action="start-flash-practice" data-direction="${session.direction}">Noch üben wiederholen</button>` : ''}<button class="button button-secondary" data-action="dashboard">Zu den Lernmodi</button></div></section>`;
}
function renderQuiz() {
  if (session.index >= session.deck.length) return renderQuizResult();
  const word = session.deck[session.index]; const options = session.kind === 'choice' ? session.options[word.id] : [];
  const feedback = session.answered ? (session.correctCurrent ? 'Richtig! Gut gemacht.' : `Die richtige Antwort ist: ${answerFor(word, session.direction)}`) : '';
  return `${modeHeader(session.kind === 'choice' ? 'Multiple Choice' : 'Schreiben', session.scope === 'wrong' ? 'Nur falsche wiederholen' : 'Alle Vokabeln abfragen', session.index, session.deck.length)}<section class="activity-card"><div class="answer-prompt"><strong>${escapeHTML(questionFor(word, session.direction))}</strong><span>Wie heisst das in der gewählten Antwortsprache?</span></div>${session.kind === 'choice' ? `<div class="choice-list">${options.map(option => `<button class="choice-button ${session.answered && option.id === word.id ? 'is-right' : ''} ${session.answered && option.id === session.answerId && option.id !== word.id ? 'is-wrong' : ''}" data-action="quiz-answer" data-id="${option.id}" ${session.answered ? 'disabled' : ''}>${escapeHTML(answerFor(option, session.direction))}</button>`).join('')}</div>` : `<form class="answer-form" data-form="quiz-write"><label class="section-label" for="quiz-answer">Antwort schreiben</label><input id="quiz-answer" name="answer" autocomplete="off" value="${escapeHTML(session.typedAnswer || '')}" ${session.answered ? 'readonly' : ''}><div class="answer-actions"><button class="button button-small" ${session.answered ? 'disabled' : ''}>Antwort prüfen</button></div></form>`}<p class="mode-feedback ${session.answered ? (session.correctCurrent ? 'is-right' : 'is-wrong') : ''}">${escapeHTML(feedback)}</p>${session.answered ? '<div class="answer-actions"><button class="button" data-action="quiz-next">Weiter →</button></div>' : ''}</section>`;
}
function renderQuizResult() {
  const total = session.deck.length; return `${modeHeader('Runde geschafft', 'Abfragen abgeschlossen', total - 1, total)}<section class="activity-card"><div class="result-score">${session.correct}/${total}</div><p class="subtle centered">${session.correct === total ? 'Alles richtig – stark!' : 'Die falschen Vokabeln sind jetzt für die Wiederholung markiert.'}</p><div class="answer-actions">${activeSet().quizWrong.length ? `<button class="button" data-action="restart-quiz-wrong" data-kind="${session.kind}">Nur falsche wiederholen</button>` : ''}<button class="button button-secondary" data-action="dashboard">Zu den Lernmodi</button></div></section>`;
}
function renderTest() {
  if (session.index >= session.deck.length) return renderTestResult();
  const word = session.deck[session.index];
  return `${modeHeader('Kleiner Übungstest', 'Auswertung am Schluss', session.index, session.deck.length)}<section class="activity-card"><div class="test-progress"><span style="width:${Math.round(session.index / session.deck.length * 100)}%"></span></div><p class="subtle small">Übersetze die Vokabel in die Fremdsprache.</p><div class="answer-prompt"><strong>${escapeHTML(word.translation)}</strong><span>Wie heisst das im Fremdsprachen-Wortschatz?</span></div><form class="answer-form" data-form="test-answer"><label class="section-label" for="test-answer">Deine Antwort</label><input id="test-answer" name="answer" autocomplete="off" required><div class="answer-actions"><button class="button button-small">${session.index + 1 === session.deck.length ? 'Test abgeben' : 'Nächste Frage →'}</button></div></form><p class="mode-feedback">Deine Antworten werden erst nach der letzten Frage ausgewertet.</p></section>`;
}
function renderTestResult() {
  const wrong = session.answers.filter(answer => !answer.correct);
  return `${modeHeader('Dein Testergebnis', 'Übungstest · Auswertung', session.deck.length - 1, session.deck.length)}<section class="activity-card"><div class="result-score">${session.correct}/${session.deck.length}</div><p class="subtle centered">${session.correct === session.deck.length ? 'Alles richtig – du bist bereit!' : 'Schau dir die Antworten an und übe gezielt weiter.'}</p>${wrong.length ? `<h3 class="result-title">Diese Wörter kannst du nochmals üben</h3><ul class="result-list">${wrong.map(item => `<li><strong>${escapeHTML(item.prompt)}</strong><span>${escapeHTML(item.answer || 'Keine Antwort')} → ${escapeHTML(item.expected)}</span></li>`).join('')}</ul>` : ''}<div class="answer-actions"><button class="button" data-action="restart-test">Nochmal testen</button><button class="button button-secondary" data-action="dashboard">Zu den Lernmodi</button></div></section>`;
}

function startMode(mode, options = {}) {
  stopMatchTimer(); const words = options.words || wordsFor();
  if (!words.length) return notify('Wähle zuerst mindestens ein Lernziel aus.');
  activeMode = mode;
  if (mode === 'match') { const deck = shuffled(words).slice(0, 12); session = { deck, translations: shuffled(deck), matched: new Set(), selectedLeft: '', selectedRight: '', message: '', locked: false, startedAt: 0, seconds: 0, penalties: 0, logged: false }; }
  if (mode === 'flash') session = { deck: shuffled(words), index: 0, revealed: false, scope: options.scope || 'all', direction: options.direction || 'german' };
  if (mode === 'quiz') {
    if (options.kind === 'choice' && words.length < 2) return notify('Für Multiple Choice brauchst du mindestens zwei Vokabeln.');
    const deck = shuffled(words); const choiceOptions = Object.fromEntries(deck.map(word => [word.id, shuffled([word, ...shuffled(words.filter(item => item.id !== word.id)).slice(0, 3)])]));
    session = { deck, options: choiceOptions, index: 0, kind: options.kind, scope: options.scope || 'all', direction: options.direction || 'german', correct: 0, answered: false, correctCurrent: false, answerId: '', typedAnswer: '', logged: false };
  }
  if (mode === 'test') { const count = Math.min(words.length, Math.max(1, Number(options.count) || words.length)); session = { deck: shuffled(words).slice(0, count), index: 0, correct: 0, answers: [], logged: false }; }
  stage = 'mode'; render(); if (mode === 'match') startMatchTimer();
}
function stopMatchTimer() { clearInterval(matchTimer); matchTimer = 0; }
function startMatchTimer() { stopMatchTimer(); matchTimer = setInterval(() => { if (session?.startedAt) { session.seconds = Math.floor((Date.now() - session.startedAt) / 1000); const timer = document.querySelector('#timer'); if (timer) timer.textContent = formatSeconds(session.seconds + session.penalties); } }, 500); }
function handleMatchPick(side, id) {
  if (!session.startedAt) session.startedAt = Date.now();
  session[side === 'left' ? 'selectedLeft' : 'selectedRight'] = id;
  if (!session.selectedLeft || !session.selectedRight) return render();
  if (session.selectedLeft === session.selectedRight) {
    session.matched.add(id); session.message = 'Richtig zugeordnet!'; session.selectedLeft = ''; session.selectedRight = ''; session.seconds = Math.floor((Date.now() - session.startedAt) / 1000);
    if (session.matched.size === session.deck.length && !session.logged) { session.logged = true; logResult('Zuordnen', session.deck.length, session.deck.length, `${session.penalties} Strafsek.`); }
    render(); return;
  }
  session.penalties += 1; session.message = 'Nicht passend: +1 Strafsekunde.'; session.locked = true; render();
  const current = session; setTimeout(() => { if (session !== current || activeMode !== 'match') return; session.selectedLeft = ''; session.selectedRight = ''; session.locked = false; render(); }, 650);
}
function answerQuiz(answerId, typedAnswer = '') {
  if (session.answered) return; const word = session.deck[session.index]; const correct = answerId === word.id;
  session.answerId = answerId; session.typedAnswer = typedAnswer; session.answered = true; session.correctCurrent = correct; if (correct) session.correct += 1;
  recordQuizAnswer(word.id, correct); render();
}
function nextQuiz() {
  session.index += 1; session.answered = false; session.answerId = ''; session.typedAnswer = ''; session.correctCurrent = false;
  if (session.index >= session.deck.length && !session.logged) { session.logged = true; logResult(session.kind === 'choice' ? 'Multiple Choice' : 'Schreiben', session.correct, session.deck.length, session.scope === 'wrong' ? 'nur falsche' : 'alle'); }
  render();
}

function startPractice(mode, deck) {
  try {
    stopMatchTimer();
    session=VociPractice.start(activeSet(),mode,grammarCatalogs,deck);
    session.contentRevision=classStudyId?VociSchool.getExam(classStudyId)?.updated_at:null;
    activeMode=mode;stage='mode';render();
  } catch(error) { notify(error.message); }
}
function finishPractice() {
  if(session.index<session.deck.length || session.logged)return;
  session.logged=true;
  const result={type:activeMode==='grammar'?'Grammatik':'Mathematik',score:session.answers.filter(a=>a.correct).length,total:session.deck.length};
  replaceSet(normalizeSet(VociContent.recordStudyResult(activeSet(),result,session.answers)));
}
async function startGeography(mode,previous){
  try{await VociGeography.load();session=VociGeography.start(activeSet(),mode,previous);activeMode=`geography-${mode}`;stage='mode';render();}
  catch(error){notify(error.message);}
}
function finishGeography(){
  if(session.index<session.deck.length||session.logged)return;session.logged=true;
  const score=session.results.reduce((n,r)=>n+r.score,0);
  replaceSet(normalizeSet(VociContent.recordStudyResult(activeSet(),{type:session.mode==='find'?'Karte finden':'Karte benennen',score,total:session.deck.length*100,unit:'points'},session.results.map(r=>({...r,itemId:`geo:${r.itemId}`})))));
}
app.addEventListener('click',event=>{
  if(stage!=='mode'||!activeMode.startsWith('geography-'))return;
  const country=event.target.closest('[data-geo-country]'),button=event.target.closest('[data-geo-action]');
  if(!button)return;const action=button.dataset.geoAction;
  if(action==='next'){VociGeographyData.next(session);finishGeography();}
  if(action==='solution')VociGeographyData.acceptSolution(session);
  if(action==='names')session.showNames=!session.showNames;
  if(action==='repeat')return startGeography(session.mode,session.deck);
  if(action==='zoom-in')VociGeography.zoom(session,.65);
  if(action==='zoom-out')VociGeography.zoom(session,1/.65);
  if(action==='reset-view')session.viewBox=[...session.initialViewBox];
  render();
});
app.addEventListener('submit',event=>{if(!event.target.matches('[data-geo-form]'))return;event.preventDefault();VociGeographyData.answer(session,document.querySelector('#geo-answer').value);render();});
app.addEventListener('input',event=>{if(event.target.id==='geo-answer'&&session)session.typedAnswer=event.target.value;});
app.addEventListener('click',event=>{
  const button=event.target.closest('[data-practice]');if(!button || !session)return;
  const action=button.dataset.practice;
  if(action==='answer-choice')VociPractice.answer(session,button.dataset.value);
  if(action==='next'){VociPractice.next(session);finishPractice();}
  if(action==='repeat'||action==='repeat-wrong'){
    const deck=action==='repeat'?session.deck:session.deck.filter(q=>session.answers.some(a=>a.itemId===q.id&&!a.correct));
    return startPractice(activeMode,deck);
  }
  if(action==='calculator-key'){
    const input=document.querySelector('#calculator-expression');
    const value=input.value,start=input.selectionStart??value.length,end=input.selectionEnd??start;
    if(value.length-end+start+button.dataset.key.length>300)return;
    input.value=value.slice(0,start)+button.dataset.key+value.slice(end);session.calculator.expression=input.value;
    input.focus();input.setSelectionRange(start+button.dataset.key.length,start+button.dataset.key.length);return;
  }
  if(action==='calculator-clear'){session.calculator.expression='';session.calculator.result=null;session.calculator.error='';}
  if(action==='calculator-use'){
    const input=document.querySelector('#practice-answer');if(!input||session.answered)return;
    session.typedAnswer=String(session.calculator.result);input.value=session.typedAnswer;input.focus();return;
  }
  render();
  if(action.startsWith('calculator-')){const panel=document.querySelector('.calculator');panel.open=true;panel.querySelector('input')?.focus();}
});
app.addEventListener('input',event=>{
  if(!session || !['grammar','mathematics'].includes(activeMode))return;
  if(event.target.id==='practice-answer')session.typedAnswer=event.target.value;
  if(event.target.id==='calculator-expression')session.calculator.expression=event.target.value;
});
app.addEventListener('change',event=>{if(event.target.id==='calculator-angle'&&session)session.calculator.angleMode=event.target.value;});
app.addEventListener('submit',event=>{
  const form=event.target.closest('[data-practice-form]');if(!form||!session)return;event.preventDefault();
  if(form.dataset.practiceForm==='answer')VociPractice.answer(session,document.querySelector('#practice-answer').value);
  else {
    const c=session.calculator;
    try {c.result=VociCalculatorData.evaluate(c.expression,c.angleMode);c.error='';}
    catch(error){c.error=error.message;c.result=null;}
  }
  render();
  if(form.dataset.practiceForm==='calculator'){document.querySelector('.calculator').open=true;document.querySelector('#calculator-expression').focus();}
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||stage!=='mode'||!['grammar','mathematics'].includes(activeMode)||!session?.answered||event.target.closest('.calculator,dialog'))return;
  if(event.target.closest('button'))return;
  event.preventDefault();VociPractice.next(session);finishPractice();render();
});

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return; const action = button.dataset.action;
  if (['home','sets','new-set','open-set','edit-set'].includes(action)) classStudyId = '';
  if (action === 'home') { stopMatchTimer(); stage = 'intro'; }
  else if (action === 'sets') { stopMatchTimer(); stage = 'sets'; }
  else if (action === 'new-subject') { if(button.dataset.subject==='geography') { try { await VociGeography.load(); } catch(error) { return notify(error.message); } } classStudyId=''; editingSetId=null; draft=normalizeSet({id:uid(),subjectId:button.dataset.subject,blocks:button.dataset.subject==='geography'?[{type:'geography',catalogId:'un195',continentId:null,regionId:null}]:[]}); stage='setup'; }
  else if (action === 'new-set') { editingSetId = null; draft = blankSet(); stage = 'setup'; }
  else if (action === 'toggle-other-level') { showOtherSchoolLevel = !showOtherSchoolLevel; }
  else if (action === 'open-set') { store.activeSetId = button.dataset.id; saveStore(); stage = 'dashboard'; }
  else if (action === 'edit-set') { const set = store.sets.find(item => item.id === button.dataset.id); if(set.subjectId==='geography') { try { await VociGeography.load(); } catch(error) { return notify(error.message); } } editingSetId = set.id; draft = normalizeSet(structuredClone(set)); stage = 'setup'; }
  else if (action === 'delete-set') await deleteLearningSet(button.dataset.id);
  else if (action === 'share-set') await shareActiveSet();
  else if (action === 'copy-share-link') await copyShareLink();
  else if (action === 'save-set') {
    if (!draft.name.trim()) return notify('Gib deinem Lernset einen Namen.');
    if (!VociContent.modesFor(draft).length) return notify('Wähle mindestens ein Lernziel oder Thema aus.');
    if (draft.examDate && !isISODate(draft.examDate)) return notify('Wähle einen gültigen Prüfungstermin.');
    if (editingSetId) replaceSet(draft); else { store.sets.push(draft); store.activeSetId = draft.id; saveStore(); }
    store.activeSetId = draft.id; saveStore(); draft = null; stage = 'dashboard';
  }
  else if (action === 'dashboard') { stopMatchTimer(); stage = 'dashboard'; }
  else if (action === 'start-practice') startPractice(button.dataset.mode);
  else if (action === 'start-geography') startGeography(button.dataset.mode);
  else if (action === 'start-match') startMode('match');
  else if (action === 'restart-match') startMode('match');
  else if (action === 'start-flash') startMode('flash', { direction: button.dataset.direction || directionFor('flash') });
  else if (action === 'start-flash-practice') { const set = activeSet(); startMode('flash', { scope: 'practice', direction: button.dataset.direction || directionFor('flash'), words: wordsFor().filter(word => set.cards.practice.includes(word.id)) }); }
  else if (action === 'flip-card') { session.revealed = !session.revealed; }
  else if (action === 'flash-known' || action === 'flash-practice') { recordCard(session.deck[session.index].id, action === 'flash-known' ? 'known' : 'practice'); session.index += 1; session.revealed = false; }
  else if (action === 'start-quiz') { const scope = button.dataset.scope; const words = scope === 'wrong' ? wordsFor().filter(word => activeSet().quizWrong.includes(word.id)) : wordsFor(); startMode('quiz', { kind: button.dataset.kind, scope, direction: directionFor(button.dataset.kind), words }); }
  else if (action === 'restart-quiz-wrong') startMode('quiz', { kind: button.dataset.kind, scope: 'wrong', direction: session.direction, words: wordsFor().filter(word => activeSet().quizWrong.includes(word.id)) });
  else if (action === 'quiz-answer') answerQuiz(button.dataset.id);
  else if (action === 'quiz-next') nextQuiz();
  else if (action === 'start-test') startMode('test', { count: Number(document.querySelector('#test-count')?.value) });
  else if (action === 'restart-test') startMode('test', { count: session.deck.length });
  else if (action === 'match-pick') handleMatchPick(button.dataset.side, button.dataset.id);
  render();
});
app.addEventListener('change', event => {
  if (!draft || stage !== 'setup') return;
  if (event.target.name === 'language' && event.target.value==='geography') VociGeography.load().then(render).catch(error=>notify(error.message));
  if (event.target.name === 'language') { draft.language = event.target.value; if(draft.subjectId === 'geography') draft.blocks=[{type:'geography',catalogId:'un195',continentId:null,regionId:null}]; }
  if (event.target.name === 'objective') { const ids = new Set(draft.objectives); event.target.checked ? ids.add(event.target.value) : ids.delete(event.target.value); draft.objectives = [...ids]; }
  if (event.target.name === 'topic') { const type=event.target.dataset.type, block=draft.blocks.find(b=>b.type===type)||{type,topicIds:[]}; const ids=new Set(block.topicIds); event.target.checked?ids.add(event.target.value):ids.delete(event.target.value); draft.blocks=[...draft.blocks.filter(b=>b.type!==type),{type,topicIds:[...ids]}]; }
  if (event.target.name?.startsWith('geo-')) VociGeography.updateSelection(draft,event.target);
  if (event.target.id === 'exam-date') draft.examDate = event.target.value;
  if (event.target.id === 'set-name') draft.name = event.target.value;
  render();
});
app.addEventListener('input', event => {
  if (draft && event.target.id === 'set-name') draft.name = event.target.value;
  if (event.target.id === 'test-count') event.target.value = event.target.value.replace(/\D/g, '');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && stage === 'mode' && !document.querySelector('dialog[open]') && activeMode === 'quiz' && session?.answered) { event.preventDefault(); nextQuiz(); }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-account-action]');
  if (!button) return;
  const action = button.dataset.accountAction;
  if (action === 'open-auth') {
    authMode = 'login';
    clearAuthFields();
    updateAuthDialog();
    authDialog.showModal();
    document.querySelector('#auth-email').focus();
  } else if (action === 'close-auth') {
    authDialog.close();
  } else if (action === 'switch-auth') {
    authMode = authMode === 'login' ? 'signup' : 'login';
    updateAuthDialog();
    document.querySelector('#auth-email').focus();
  } else if (action === 'open-settings') {
    accountForm.elements['account-school-level'].value = schoolLevel();
    document.querySelector('#notification-settings').innerHTML = VociSchool.settingsFields();
    document.querySelector('#account-status').hidden = true;
    accountDialog.showModal();
  } else if (action === 'close-settings') {
    accountDialog.close();
  } else if (action === 'logout' && supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) notify('Du konntest gerade nicht abgemeldet werden.');
    else clearAuthFields();
  }
});
accountForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  if (button) button.disabled = true;
  try { await VociSchool.saveSettings(accountForm); }
  catch (error) { const status = document.querySelector('#account-status'); status.textContent = error.message; status.hidden = false; return; }
  finally { if (button) button.disabled = false; }
  setSchoolLevel(accountForm.elements['account-school-level'].value);
  accountDialog.close();
  render();
});
app.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault();
  const answer = String(new FormData(form).get('answer') || '');
  if (form.dataset.form === 'quiz-write') { const word = session.deck[session.index]; answerQuiz(normalizeAnswer(answer) === normalizeAnswer(answerFor(word, session.direction)) ? word.id : 'wrong', answer); }
  if (form.dataset.form === 'test-answer') {
    const word = session.deck[session.index]; const correct = normalizeAnswer(answer) === normalizeAnswer(word.term);
    session.answers.push({ prompt: word.translation, answer, expected: word.term, correct }); if (correct) session.correct += 1; session.index += 1;
    if (session.index >= session.deck.length && !session.logged) { session.logged = true; logResult('Übungstest', session.correct, session.deck.length); }
    render();
  }
});
authForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) return;
  const submit = document.querySelector('#auth-submit');
  const email = String(new FormData(authForm).get('email') || '').trim();
  const password = String(new FormData(authForm).get('password') || '');
  const schoolLevel = String(new FormData(authForm).get('school-level') || 'primary');
  let schoolProfile;
  if (authMode === 'signup') {
    try { schoolProfile = VociSchool.profilePayload(authForm); }
    catch (error) { return showAuthStatus(error.message, true); }
  }
  if (!email || password.length < 8) return showAuthStatus('Gib eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen ein.', true);
  submit.disabled = true;
  const response = authMode === 'signup'
    ? await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname, data: { schoolLevel, schoolProfile } } })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  submit.disabled = false;
  if (response.error) return showAuthStatus(response.error.message, true);
  if (authMode === 'signup' && !response.data.session) {
    authForm.reset();
    showAuthStatus('Wir haben dir eine E-Mail gesendet. Bestätige deine E-Mail-Adresse, bevor du dich anmeldest.');
  } else {
    clearAuthFields();
  }
});

Promise.all(['vocabulary','grammar/de','grammar/en','grammar/fr'].map(path=>fetch(`data/${path}.json`).then(response=>{if(!response.ok)throw new Error('Die Lerninhalte konnten nicht geladen werden.');return response.json();})))
  .then(([data,...grammar])=>{grammarCatalogs=Object.fromEntries(grammar.map(catalog=>[catalog.subjectId,VociGrammarData.validateCatalog(catalog)]));return data;})
  .then(async data => { vocabulary = validateVocabulary(data); const keys = new Set(vocabulary.map(objectiveKey)); const wordIds = new Set(vocabulary.flatMap(group => group.words.map(word => word.id))); const migrateObjective = key => {
    if (keys.has(key)) return key;
    const group = vocabulary.find(item => legacyObjectiveKey(item) === key);
    return group ? objectiveKey(group) : key;
  }; store.sets = store.sets.map(set => normalizeSet({ ...set, blocks:set.blocks.map(block=>block.type === 'vocabulary' ? {...block,objectiveIds:unique(block.objectiveIds.map(migrateObjective))} : block) })); saveStore(); render(); await initializeCloud(); })
  .catch(error => { app.innerHTML = `<section class="empty-state"><h1>Das Lernset lädt gerade nicht.</h1><p>${escapeHTML(error.message)}</p></section>`; });

document.addEventListener('click',event=>{const link=event.target.closest('[data-nav]');if(!link)return;event.preventDefault();stopMatchTimer();classStudyId='';session=null;stage=link.dataset.nav;render();document.querySelector('#app').focus();});
