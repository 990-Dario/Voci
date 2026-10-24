const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const accountControls = document.querySelector('#account-controls');
const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const storageNote = document.querySelector('#storage-note');
// shortcut: progress stays in this browser; upgrade when students need cross-device sync.
const STORAGE_KEY = 'voci-learning-state';
const cloudConfig = globalThis.VOCI_SUPABASE || {};
const supabaseClient = cloudConfig.url && cloudConfig.anonKey && globalThis.supabase?.createClient
  ? globalThis.supabase.createClient(cloudConfig.url, cloudConfig.anonKey)
  : null;
const validLanguages = new Set(['en', 'fr']);
let vocabulary = [];
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
  return { id: uid(), name: '', language: 'en', objectives: [], examDate: '', cards: { known: [], practice: [] }, quizWrong: [], results: [] };
}
function normalizeSet(value) {
  const set = { ...blankSet(), ...(value || {}) };
  set.id = typeof set.id === 'string' ? set.id : uid();
  set.name = typeof set.name === 'string' ? set.name.slice(0, 60) : '';
  set.language = validLanguages.has(set.language) ? set.language : 'en';
  set.objectives = Array.isArray(set.objectives) ? set.objectives.filter(item => typeof item === 'string') : [];
  set.examDate = isISODate(set.examDate) ? set.examDate : '';
  set.cards = {
    known: Array.isArray(set.cards?.known) ? set.cards.known.filter(item => typeof item === 'string') : Array.isArray(set.mastered) ? set.mastered.filter(item => typeof item === 'string') : [],
    practice: Array.isArray(set.cards?.practice) ? set.cards.practice.filter(item => typeof item === 'string') : []
  };
  set.quizWrong = Array.isArray(set.quizWrong) ? set.quizWrong.filter(item => typeof item === 'string') : [];
  set.results = Array.isArray(set.results) ? set.results.filter(result => result && typeof result.type === 'string' && Number.isInteger(result.score) && Number.isInteger(result.total)).slice(-30) : [];
  return set;
}
function normalizeStore(value) {
  const sets = Array.isArray(value?.sets) ? value.sets.map(normalizeSet) : [];
  return { sets, activeSetId: sets.some(set => set.id === value?.activeSetId) ? value.activeSetId : sets[0]?.id || '' };
}
function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(saved.sets)) {
      return normalizeStore(saved);
    }
    // Migrate the first single learning set without losing previous progress.
    if (Array.isArray(saved.objectives) || saved.examDate || Array.isArray(saved.mastered)) {
      const migrated = normalizeSet({ ...saved, id: uid(), name: 'Mein erstes Lernset', cards: { known: saved.mastered || [], practice: [] }, results: saved.lastTest ? [{ type: 'Übungstest', score: saved.lastTest.score, total: saved.lastTest.total, date: saved.lastTest.date || new Date().toISOString() }] : [] });
      return { sets: [migrated], activeSetId: migrated.id };
    }
  } catch { /* Start with an empty local state. */ }
  return { sets: [], activeSetId: '' };
}
function persistLocalStore() {
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
  if (!supabaseClient || !currentUser || !cloudReady) return;
  const { error } = await supabaseClient.from('learning_states').upsert({
    user_id: currentUser.id,
    state: structuredClone(store),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (error) notify('Der Lernstand konnte gerade nicht online gespeichert werden. Deine Daten bleiben auf diesem Gerät.');
}
function updateAccountControls() {
  if (currentUser) {
    accountControls.innerHTML = `<span class="account-email" title="${escapeHTML(currentUser.email || '')}">${escapeHTML(currentUser.email || 'Angemeldet')}</span><button class="button button-secondary button-small account-button" data-account-action="logout">Abmelden</button>`;
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
async function loadCloudStore() {
  if (!supabaseClient || !currentUser) return;
  cloudReady = false;
  const { data, error } = await supabaseClient.from('learning_states').select('state').eq('user_id', currentUser.id).maybeSingle();
  if (error) {
    notify('Dein Online-Lernstand konnte nicht geladen werden. Du kannst lokal weiterlernen.');
  } else if (data?.state) {
    store = normalizeStore(data.state);
    persistLocalStore();
  } else {
    cloudReady = true;
    await saveCloudStore();
  }
  cloudReady = true;
}
async function applySession(user, clearOnLogout = false) {
  const hadUser = Boolean(currentUser);
  currentUser = user;
  if (currentUser) await loadCloudStore();
  else if (clearOnLogout && hadUser) {
    clearTimeout(cloudSaveTimer);
    store = { sets: [], activeSetId: '' };
    persistLocalStore();
    stage = 'intro';
  }
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
function activeSet() { return store.sets.find(set => set.id === store.activeSetId) || null; }
function replaceSet(updated) {
  store.sets = store.sets.map(set => set.id === updated.id ? updated : set);
  saveStore();
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
function objectiveKey(group) { return `${group.unit}::${group.objective}`; }
function wordsFor(set = activeSet()) {
  if (!set) return [];
  return vocabulary.filter(group => group.language === set.language && set.objectives.includes(objectiveKey(group))).flatMap(group => group.words);
}
function setLabel(set) { return set.name.trim() || `${set.language === 'en' ? 'Englisch' : 'Französisch'} · ${set.objectives.length} Lernziel${set.objectives.length === 1 ? '' : 'e'}`; }
function shuffled(items) { return [...items].sort(() => Math.random() - .5); }
function unique(items) { return [...new Set(items)]; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Kein Termin'; }
function daysUntil(value) { return value ? Math.ceil((new Date(`${value}T00:00:00`) - new Date(todayISO())) / 86400000) : null; }
function formatSeconds(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function normalizeAnswer(value) { return String(value).trim().toLocaleLowerCase('de-CH').replace(/[’']/g, "'"); }
function notify(message) { notice.textContent = message; notice.hidden = false; clearTimeout(notify.timeout); notify.timeout = setTimeout(() => { notice.hidden = true; }, 3600); }
function logResult(type, score, total, detail = '') {
  const set = activeSet();
  set.results.push({ type, score, total, detail, date: new Date().toISOString() });
  set.results = set.results.slice(-30);
  replaceSet(set);
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
  app.innerHTML = stage === 'intro' ? renderIntro() : stage === 'sets' ? renderSets() : stage === 'setup' ? renderSetup() : stage === 'dashboard' ? renderDashboard() : renderMode();
  if (stage === 'mode' && (activeMode === 'test' || activeMode === 'quiz' && session.kind === 'write' && !session.answered)) document.querySelector('.answer-form input')?.focus();
}
function renderIntro() {
  return `
    <section class="intro" aria-labelledby="intro-title"><div class="intro-copy">
      <h1 id="intro-title">Prüfungsstoff.<br><em>Klar im Kopf.</em></h1>
      <p class="lead">Stelle für jede Prüfung ein eigenes Lernset aus Units, Unités und Lernzielen zusammen. Übe so, wie es für dich passt.</p>
      <div class="intro-actions"><button class="button" data-action="sets">Meine Lernsets <span aria-hidden="true">→</span></button></div>
    </div><div class="intro-art" aria-label="Beispiel einer Vokabelkarte" role="img"><div class="book-stack"><div class="book book-green"><span class="book-label">English · Unit 1</span><strong class="book-word">book</strong><div class="book-rule"></div><p class="book-note">ein Wort nach dem anderen<br>und du kommst weiter.</p></div><div class="book book-cream"><span class="book-label">Karteikarte 01</span><strong class="book-word">das Buch</strong><p class="book-translation">book</p><div class="book-rule"></div><p class="book-note">Eine Seite lernen.<br>Dann die nächste.</p></div><div class="book-sticker">Lernen<br>in deinem<br>Tempo</div></div></div></section>
    <section class="mode-strip" aria-label="Die vier Lernmodi"><div class="mode-teaser"><span><strong>Zuordnen</strong><span>Fehler kosten 1 Sekunde</span></span></div><div class="mode-teaser"><span><strong>Karteikarten</strong><span>Kann ich oder noch üben</span></span></div><div class="mode-teaser"><span><strong>Abfragen</strong><span>Alle oder nur falsche</span></span></div><div class="mode-teaser"><span><strong>Übungstest</strong><span>Ergebnis am Schluss</span></span></div></section>`;
}
function renderSets() {
  const sets = store.sets;
  return `<div class="page-top"><div><h1>Meine Lernsets</h1><p class="subtle">Jede Prüfung erhält ihr eigenes Lernset und ihren eigenen Fortschritt.</p></div><button class="back-link" data-action="home">← Zur Startseite</button></div>
    <section class="sets-layout">${sets.length ? sets.map(set => {
      const words = wordsFor(set); const last = set.results.at(-1);
      return `<article class="set-card ${set.id === store.activeSetId ? 'is-active' : ''}"><div><h2>${escapeHTML(setLabel(set))}</h2><p>${set.language === 'en' ? 'Englisch' : 'Französisch'} · ${words.length} Vokabeln · ${escapeHTML(formatDate(set.examDate))}</p><small>${last ? `Letzte Übung: ${last.type} ${last.score}/${last.total}` : 'Noch keine Übung abgeschlossen'}</small></div><div class="set-actions"><button class="button button-small" data-action="open-set" data-id="${set.id}">Öffnen</button><button class="button button-secondary button-small" data-action="edit-set" data-id="${set.id}">Ändern</button></div></article>`;
    }).join('') : '<div class="empty-state"><h2>Noch kein Lernset</h2><p>Erstelle ein Lernset für deine nächste Prüfung.</p></div>'}</section>
    <div class="answer-actions"><button class="button" data-action="new-set">+ Neues Lernset</button></div>`;
}
function renderSetup() {
  const current = draft || blankSet();
  const groups = vocabulary.filter(group => group.language === current.language);
  const byUnit = Object.values(groups.reduce((all, group) => { (all[group.unit] ||= []).push(group); return all; }, {}));
  const selected = new Set(current.objectives);
  const words = wordsFor(current);
  return `<div class="page-top"><div><h1>${editingSetId ? 'Lernset ändern' : 'Neues Lernset'}</h1><p class="subtle">Eine Unit kann mehrere Lernziele enthalten. Wähle genau die Lernziele für diese Prüfung.</p></div><button class="back-link" data-action="sets">← Zu meinen Lernsets</button></div>
    <div class="setup-layout"><section class="panel" aria-label="Lernset zusammenstellen">
      <div class="form-section"><label class="date-field"><span class="section-label">Name des Lernsets</span><input id="set-name" maxlength="60" value="${escapeHTML(current.name)}" placeholder="z. B. Englischprüfung Unit 1"></label></div>
      <fieldset class="form-section form-fieldset"><legend class="section-label">Welche Sprache lernst du?</legend><div class="language-options">${languageOption('en', '🇬🇧', 'Englisch', current.language)}${languageOption('fr', '🇫🇷', 'Französisch', current.language)}</div></fieldset>
      <fieldset class="form-section form-fieldset"><legend class="section-label">Welche Lernziele gehören zur Prüfung?</legend><p class="subtle small">Die Anzahl Wörter steht bei jedem Lernziel.</p>${byUnit.map(groupsForUnit => `<div class="unit-group"><p class="unit-title">${escapeHTML(groupsForUnit[0].unit)}</p>${groupsForUnit.map(group => `<label class="objective-choice"><input type="checkbox" name="objective" value="${escapeHTML(objectiveKey(group))}" ${selected.has(objectiveKey(group)) ? 'checked' : ''}><span>${escapeHTML(group.objective)}</span><small>${group.words.length} Wörter</small></label>`).join('')}</div>`).join('')}</fieldset>
      <div class="form-section"><label class="date-field"><span class="section-label">Wann ist deine Prüfung?</span><input id="exam-date" type="date" min="${todayISO()}" value="${escapeHTML(current.examDate)}"></label></div>
      <div class="setup-footer"><span class="subtle small">${words.length ? `${words.length} Vokabeln ausgewählt` : 'Wähle mindestens ein Lernziel.'}</span><button class="button" data-action="save-set">Lernset speichern →</button></div>
    </section><aside class="selection-side"><div class="summary-card"><div><h3>Deine Auswahl</h3><div class="count-box"><span class="count-number">${words.length}</span><span class="subtle">Vokabeln</span></div><p class="subtle small">${current.language === 'en' ? 'Englisch' : 'Französisch'} · ${current.objectives.length} Lernziel${current.objectives.length === 1 ? '' : 'e'}</p></div><ul class="word-preview">${words.slice(0, 4).map(word => `<li><strong>${escapeHTML(word.term)}</strong><span>${escapeHTML(word.translation)}</span></li>`).join('')}</ul><p class="sample-note">Die angezeigten Vokabeln sind Beispieldaten. Deine Lehrmittel-Listen werden später hier eingepflegt.</p></div></aside></div>`;
}
function languageOption(code, flag, label, selected) { return `<label class="language-option"><input type="radio" name="language" value="${code}" ${selected === code ? 'checked' : ''}><span><span class="flag" aria-hidden="true">${flag}</span>${label}</span></label>`; }
function renderDashboard() {
  const set = activeSet(); if (!set) { stage = 'sets'; return renderSets(); }
  const words = wordsFor(); const days = daysUntil(set.examDate); const deadline = days === 0 ? 'Heute ist Prüfung!' : days === 1 ? 'Noch 1 Tag bis zur Prüfung' : days > 1 ? `Noch ${days} Tage bis zur Prüfung` : 'Prüfungstermin vorbei';
  const known = set.cards.known.filter(id => words.some(word => word.id === id)).length;
  const practice = set.cards.practice.filter(id => words.some(word => word.id === id)).length;
  const wrong = set.quizWrong.filter(id => words.some(word => word.id === id)).length;
  const history = [...set.results].reverse().slice(0, 4);
  return `<div class="page-top"><div><h1>${escapeHTML(setLabel(set))}</h1><p class="subtle">${words.length} Vokabeln in ${set.objectives.length} Lernziel${set.objectives.length === 1 ? '' : 'en'}</p></div><button class="back-link" data-action="sets">← Meine Lernsets</button></div>
    <section class="dashboard-hero"><div><h2>${escapeHTML(deadline)}</h2><p>Prüfung: ${escapeHTML(formatDate(set.examDate))}</p></div><div class="exam-badge"><strong>${known}/${words.length}</strong><span>Karteikarten: Kann ich</span></div></section>
    <section aria-labelledby="modes-title"><h2 id="modes-title">Wie möchtest du lernen?</h2><div class="mode-grid">
      <article class="mode-card mode-card-match"><div class="mode-card-head"><span class="mode-count">${Math.min(words.length, 12)} von ${words.length} Wörtern</span></div><h3>Zuordnen auf Zeit</h3><p>Finde alle Paare. Bei einem Fehler kommt eine Strafsekunde dazu.</p><button class="button button-small" data-action="start-match">Spiel starten →</button></article>
      <article class="mode-card"><div class="mode-card-head"><span class="mode-count">${known} kann ich · ${practice} noch üben</span></div><h3>Karteikarten</h3><p>Sortiere jede Karte in «Kann ich» oder «Noch üben».</p><div class="mode-actions"><button class="button button-small" data-action="start-flash">Alle wiederholen</button><button class="button button-secondary button-small" data-action="start-flash-practice" ${practice ? '' : 'disabled'}>Noch üben</button></div></article>
      <article class="mode-card"><div class="mode-card-head"><span class="mode-count">${wrong} nochmals abfragen</span></div><h3>Multiple Choice</h3><p>Wähle die richtige Übersetzung aus.</p><div class="mode-actions"><button class="button button-small" data-action="start-quiz" data-kind="choice" data-scope="all">Alle abfragen</button>${wrong ? '<button class="text-link" data-action="start-quiz" data-kind="choice" data-scope="wrong">Nur falsche</button>' : ''}</div></article>
      <article class="mode-card"><div class="mode-card-head"><span class="mode-count">${wrong} nochmals abfragen</span></div><h3>Schreiben</h3><p>Schreibe die Übersetzung selbst auf.</p><div class="mode-actions"><button class="button button-secondary button-small" data-action="start-quiz" data-kind="write" data-scope="all">Alle abfragen</button>${wrong ? '<button class="text-link" data-action="start-quiz" data-kind="write" data-scope="wrong">Nur falsche</button>' : ''}</div></article>
      <article class="mode-card mode-card-test"><div class="mode-card-head"><span class="mode-count">Ergebnis am Ende</span></div><h3>Kleiner Übungstest</h3><p>Gib die Anzahl Fragen ein. Bei einer zu hohen Zahl kommen alle Vokabeln.</p><div class="mode-actions"><label class="mode-select">Vokabeln <input id="test-count" class="mode-number-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${words.length}" aria-label="Anzahl Vokabeln im Test"></label><button class="button button-small" data-action="start-test">Test starten →</button></div></article>
    </div></section>
    <section class="history-section"><h2>Dein Lernfortschritt</h2>${history.length ? `<ul class="history-list">${history.map(result => `<li><strong>${escapeHTML(result.type)}</strong><span>${result.score}/${result.total}${result.detail ? ` · ${escapeHTML(result.detail)}` : ''}</span><time datetime="${escapeHTML(result.date)}">${new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'numeric' }).format(new Date(result.date))}</time></li>`).join('')}</ul>` : '<p class="subtle">Schliesse eine Übung oder einen Test ab, dann erscheint dein Resultat hier.</p>'}</section>`;
}
function modeHeader(title, label, index, total) { return `<div class="mode-heading"><div><p class="mode-label">${escapeHTML(label)}</p><h1>${escapeHTML(title)}</h1></div>${total ? `<span class="mode-counter">${index + 1} / ${total}</span>` : ''}</div>`; }
function renderMode() {
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
  return `${modeHeader(session.scope === 'practice' ? 'Noch üben' : 'Karteikarten', 'Sortiere die Karten', session.index, session.deck.length)}<section class="activity-card"><button class="flashcard" data-action="flip-card" aria-label="Übersetzung aufdecken"><span><strong class="flashcard-face">${escapeHTML(revealed ? word.translation : word.term)}</strong><span class="flashcard-hint">${revealed ? escapeHTML(word.term) : 'Tippe auf die Karte, um die Übersetzung aufzudecken'}</span></span></button><div class="flash-controls"><button class="button button-coral button-small" data-action="flash-practice" ${!revealed ? 'disabled' : ''}>Noch üben</button><button class="button button-small" data-action="flash-known" ${!revealed ? 'disabled' : ''}>Kann ich</button></div><p class="mode-feedback">Die Kategorien werden in diesem Lernset gespeichert.</p></section>`;
}
function renderFlashFinish() {
  const set = activeSet(); const practice = set.cards.practice.filter(id => wordsFor().some(word => word.id === id)).length;
  return `${modeHeader('Karten sortiert', 'Karteikarten', 0, 0)}<section class="activity-card"><div class="result-score">${practice}</div><p class="subtle centered">${practice ? `${practice} Karte${practice === 1 ? '' : 'n'} liegen noch in «Noch üben». Du kannst diese Runde beliebig oft wiederholen.` : 'Alle Karten sind als «Kann ich» markiert.'}</p><div class="answer-actions"><button class="button button-secondary" data-action="start-flash">Alle wiederholen</button>${practice ? '<button class="button" data-action="start-flash-practice">Noch üben wiederholen</button>' : ''}<button class="button button-secondary" data-action="dashboard">Zu den Lernmodi</button></div></section>`;
}
function renderQuiz() {
  if (session.index >= session.deck.length) return renderQuizResult();
  const word = session.deck[session.index]; const options = session.kind === 'choice' ? session.options[word.id] : [];
  const feedback = session.answered ? (session.correctCurrent ? 'Richtig! Gut gemacht.' : `Die richtige Antwort ist: ${word.translation}`) : '';
  return `${modeHeader(session.kind === 'choice' ? 'Multiple Choice' : 'Schreiben', session.scope === 'wrong' ? 'Nur falsche wiederholen' : 'Alle Vokabeln abfragen', session.index, session.deck.length)}<section class="activity-card"><div class="answer-prompt"><strong>${escapeHTML(word.term)}</strong><span>Wie heisst das auf Deutsch?</span></div>${session.kind === 'choice' ? `<div class="choice-list">${options.map(option => `<button class="choice-button ${session.answered && option.id === word.id ? 'is-right' : ''} ${session.answered && option.id === session.answerId && option.id !== word.id ? 'is-wrong' : ''}" data-action="quiz-answer" data-id="${option.id}" ${session.answered ? 'disabled' : ''}>${escapeHTML(option.translation)}</button>`).join('')}</div>` : `<form class="answer-form" data-form="quiz-write"><label class="section-label" for="quiz-answer">Übersetzung schreiben</label><input id="quiz-answer" name="answer" autocomplete="off" value="${escapeHTML(session.typedAnswer || '')}" ${session.answered ? 'readonly' : ''}><div class="answer-actions"><button class="button button-small" ${session.answered ? 'disabled' : ''}>Antwort prüfen</button></div></form>`}<p class="mode-feedback ${session.answered ? (session.correctCurrent ? 'is-right' : 'is-wrong') : ''}">${escapeHTML(feedback)}</p>${session.answered ? '<div class="answer-actions"><button class="button" data-action="quiz-next">Weiter →</button></div>' : ''}</section>`;
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
  if (mode === 'flash') session = { deck: shuffled(words), index: 0, revealed: false, scope: options.scope || 'all' };
  if (mode === 'quiz') {
    if (options.kind === 'choice' && words.length < 2) return notify('Für Multiple Choice brauchst du mindestens zwei Vokabeln.');
    const deck = shuffled(words); const choiceOptions = Object.fromEntries(deck.map(word => [word.id, shuffled([word, ...shuffled(words.filter(item => item.id !== word.id)).slice(0, 3)])]));
    session = { deck, options: choiceOptions, index: 0, kind: options.kind, scope: options.scope || 'all', correct: 0, answered: false, correctCurrent: false, answerId: '', typedAnswer: '', logged: false };
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

app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button) return; const action = button.dataset.action;
  if (action === 'home') { stopMatchTimer(); stage = 'intro'; }
  else if (action === 'sets') { stopMatchTimer(); stage = 'sets'; }
  else if (action === 'new-set') { editingSetId = null; draft = blankSet(); stage = 'setup'; }
  else if (action === 'open-set') { store.activeSetId = button.dataset.id; saveStore(); stage = 'dashboard'; }
  else if (action === 'edit-set') { const set = store.sets.find(item => item.id === button.dataset.id); editingSetId = set.id; draft = normalizeSet(structuredClone(set)); stage = 'setup'; }
  else if (action === 'save-set') {
    if (!draft.name.trim()) return notify('Gib deinem Lernset einen Namen.');
    if (!wordsFor(draft).length) return notify('Wähle mindestens ein Lernziel aus.');
    if (!draft.examDate || draft.examDate < todayISO()) return notify('Wähle einen Prüfungstermin heute oder in der Zukunft.');
    if (editingSetId) replaceSet(draft); else { store.sets.push(draft); store.activeSetId = draft.id; saveStore(); }
    store.activeSetId = draft.id; saveStore(); draft = null; stage = 'dashboard';
  }
  else if (action === 'dashboard') { stopMatchTimer(); stage = 'dashboard'; }
  else if (action === 'start-match') startMode('match');
  else if (action === 'restart-match') startMode('match');
  else if (action === 'start-flash') startMode('flash');
  else if (action === 'start-flash-practice') { const set = activeSet(); startMode('flash', { scope: 'practice', words: wordsFor().filter(word => set.cards.practice.includes(word.id)) }); }
  else if (action === 'flip-card') { session.revealed = !session.revealed; }
  else if (action === 'flash-known' || action === 'flash-practice') { recordCard(session.deck[session.index].id, action === 'flash-known' ? 'known' : 'practice'); session.index += 1; session.revealed = false; }
  else if (action === 'start-quiz') { const scope = button.dataset.scope; const words = scope === 'wrong' ? wordsFor().filter(word => activeSet().quizWrong.includes(word.id)) : wordsFor(); startMode('quiz', { kind: button.dataset.kind, scope, words }); }
  else if (action === 'restart-quiz-wrong') startMode('quiz', { kind: button.dataset.kind, scope: 'wrong', words: wordsFor().filter(word => activeSet().quizWrong.includes(word.id)) });
  else if (action === 'quiz-answer') answerQuiz(button.dataset.id);
  else if (action === 'quiz-next') nextQuiz();
  else if (action === 'start-test') startMode('test', { count: Number(document.querySelector('#test-count')?.value) });
  else if (action === 'restart-test') startMode('test', { count: session.deck.length });
  else if (action === 'match-pick') handleMatchPick(button.dataset.side, button.dataset.id);
  render();
});
app.addEventListener('change', event => {
  if (!draft) return;
  if (event.target.name === 'language') { draft.language = event.target.value; draft.objectives = []; }
  if (event.target.name === 'objective') { const ids = new Set(draft.objectives); event.target.checked ? ids.add(event.target.value) : ids.delete(event.target.value); draft.objectives = [...ids]; }
  if (event.target.id === 'exam-date') draft.examDate = event.target.value;
  if (event.target.id === 'set-name') draft.name = event.target.value;
  render();
});
app.addEventListener('input', event => {
  if (draft && event.target.id === 'set-name') draft.name = event.target.value;
  if (event.target.id === 'test-count') event.target.value = event.target.value.replace(/\D/g, '');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && activeMode === 'quiz' && session?.answered) { event.preventDefault(); nextQuiz(); }
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
  } else if (action === 'logout' && supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) notify('Du konntest gerade nicht abgemeldet werden.');
    else clearAuthFields();
  }
});
app.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault();
  const answer = String(new FormData(form).get('answer') || '');
  if (form.dataset.form === 'quiz-write') { const word = session.deck[session.index]; answerQuiz(normalizeAnswer(answer) === normalizeAnswer(word.translation) ? word.id : 'wrong', answer); }
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
  if (!email || password.length < 8) return showAuthStatus('Gib eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen ein.', true);
  submit.disabled = true;
  const response = authMode === 'signup'
    ? await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
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

fetch('data/vocabulary.json')
  .then(response => { if (!response.ok) throw new Error('Die Vokabeldaten konnten nicht geladen werden.'); return response.json(); })
  .then(async data => { vocabulary = validateVocabulary(data); const keys = new Set(vocabulary.map(objectiveKey)); const wordIds = new Set(vocabulary.flatMap(group => group.words.map(word => word.id))); const migrateObjective = key => keys.has(key) ? key : vocabulary.find(group => key.startsWith(`${group.unit}::`) && group.objective.endsWith(key.slice(group.unit.length + 2))) ? objectiveKey(vocabulary.find(group => key.startsWith(`${group.unit}::`) && group.objective.endsWith(key.slice(group.unit.length + 2)))) : key; store.sets = store.sets.map(set => normalizeSet({ ...set, objectives: unique(set.objectives.map(migrateObjective).filter(key => keys.has(key))), cards: { known: set.cards.known.filter(id => wordIds.has(id)), practice: set.cards.practice.filter(id => wordIds.has(id)) }, quizWrong: set.quizWrong.filter(id => wordIds.has(id)) })); saveStore(); render(); await initializeCloud(); })
  .catch(error => { app.innerHTML = `<section class="empty-state"><h1>Das Lernset lädt gerade nicht.</h1><p>${escapeHTML(error.message)}</p></section>`; });
