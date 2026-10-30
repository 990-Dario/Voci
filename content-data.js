(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined') module.exports = api;
  root.VociContent = api;
})(globalThis, function () {
  const subjects = [
    { id: 'de', name: 'Deutsch', types: ['grammar'] },
    { id: 'en', name: 'Englisch', types: ['vocabulary', 'grammar'] },
    { id: 'fr', name: 'Französisch', types: ['vocabulary', 'grammar'] },
    { id: 'math', name: 'Mathematik', types: ['mathematics'] },
    { id: 'geography', name: 'Geografie', types: ['geography'] }
  ];
  const modes = { vocabulary: ['match', 'flash', 'quiz', 'test'], grammar: ['grammar'], mathematics: ['mathematics'], geography: ['geography-find', 'geography-name'] };
  const strings = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))] : [];
  const subject = id => subjects.find(s => s.id === id);
  function validateSelection(subjectId, blocks) {
    const definition = subject(subjectId);
    if (!definition) throw new Error('Dieses Fach wird noch nicht unterstützt.');
    if (!Array.isArray(blocks) || blocks.length > definition.types.length) throw new Error('Ungültige Inhaltsauswahl.');
    const seen = new Set();
    for (const block of blocks) {
      if (!block || !definition.types.includes(block.type) || seen.has(block.type)) throw new Error('Dieser Inhalt passt nicht zum Fach oder ist doppelt ausgewählt.');
      seen.add(block.type);
      if (block.type === 'geography') {
        if (!['un195', 'ioc206', 'ch26'].includes(block.catalogId)) throw new Error('Unbekannter Kartenkatalog.');
        for (const key of ['continentId','regionId']) if (block[key] != null && (typeof block[key] !== 'string' || block[key].length > 100)) throw new Error('Ungültiger Kartenfilter.');
        if (block.catalogId === 'ch26' && (block.continentId || block.regionId)) throw new Error('Kantone haben keinen Kontinentfilter.');
      } else {
        const ids = block[block.type === 'vocabulary' ? 'objectiveIds' : 'topicIds'];
        if (!Array.isArray(ids) || ids.length > 2000 || ids.some(id => typeof id !== 'string' || !id.length || id.length > 300)) throw new Error('Ungültige Lernziele.');
      }
    }
  }
  function normalizeLearningSet(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültiges Lernset.');
    if (value.version != null && value.version !== 1 && value.version !== 2) throw new Error('Diese Lernset-Version wird noch nicht unterstützt.');
    const subjectId = value.subjectId || value.language || 'en';
    const blocks = value.blocks ?? [{ type:'vocabulary', objectiveIds:strings(value.objectives) }];
    validateSelection(subjectId, blocks);
    const cleanBlocks = blocks.map(block => block.type === 'geography'
      ? {type:block.type,catalogId:block.catalogId,continentId:block.continentId || null,regionId:block.regionId || null}
      : {type:block.type,[block.type === 'vocabulary' ? 'objectiveIds' : 'topicIds']:strings(block[block.type === 'vocabulary' ? 'objectiveIds' : 'topicIds'])});
    const date = typeof value.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.examDate) && !Number.isNaN(Date.parse(value.examDate)) && new Date(value.examDate).toISOString().slice(0,10) === value.examDate ? value.examDate : '';
    const results = Array.isArray(value.results) ? value.results.filter(r => r && typeof r.type === 'string' && Number.isInteger(r.score) && Number.isInteger(r.total) && r.score >= 0 && r.total > 0 && r.score <= r.total).slice(-30).map(r=>({...r})) : [];
    const byItem = {};
    for (const [id,p] of Object.entries(value.progress?.byItem || {})) {
      if (['__proto__','constructor','prototype'].includes(id) || !p || !Number.isSafeInteger(p.attempts) || p.attempts < 0 || !Number.isSafeInteger(p.correct) || p.correct < 0 || p.correct > p.attempts || !Number.isFinite(p.lastScore) || p.lastScore < 0 || p.lastScore > 100) continue;
      byItem[id] = {attempts:p.attempts,correct:p.correct,lastScore:p.lastScore,lastPracticedAt:typeof p.lastPracticedAt === 'string' ? p.lastPracticedAt : ''};
    }
    return {version:2,id:typeof value.id === 'string' ? value.id : '',name:typeof value.name === 'string' ? value.name.slice(0,60) : '',subjectId,blocks:cleanBlocks,examDate:date,
      cards:{known:strings(value.cards?.known ?? value.mastered),practice:strings(value.cards?.practice)},quizWrong:strings(value.quizWrong),results,progress:{byItem}};
  }
  function normalizeSets(values) {
    const sets = [], unreadableSets = [];
    for (const value of values) { try { sets.push(normalizeLearningSet(value)); } catch { unreadableSets.push(value); } }
    return {sets,unreadableSets,canSave:unreadableSets.length === 0};
  }
  function modesFor(set) {
    validateSelection(set.subjectId,set.blocks);
    return [...new Set(set.blocks.filter(b => b.type === 'geography' || (b.objectiveIds || b.topicIds).length).flatMap(b=>modes[b.type]))];
  }
  function createStudySnapshot(set) {
    const {version,name,subjectId,blocks,examDate} = normalizeLearningSet(set);
    return {version,name,subjectId,blocks,examDate};
  }
  function cloneLearningSet(set, newId) { return normalizeLearningSet({...createStudySnapshot(set),id:newId}); }
  function recordStudyResult(set, result, itemResults = []) {
    const copy = normalizeLearningSet(set);
    if (!Number.isInteger(result.score) || !Number.isInteger(result.total) || result.total <= 0 || result.score < 0 || result.score > result.total) throw new Error('Ungültiges Lernergebnis.');
    const date = result.date || new Date().toISOString();
    copy.results = [...copy.results,{...result,date,subjectId:copy.subjectId,unit:result.unit === 'points' ? 'points' : 'answers'}].slice(-30);
    for (const item of itemResults) {
      if (typeof item.itemId !== 'string' || ['__proto__','constructor','prototype'].includes(item.itemId) || !Number.isFinite(item.score) || item.score < 0 || item.score > 100) throw new Error('Ungültiger Aufgabenfortschritt.');
      const previous = copy.progress.byItem[item.itemId] || {attempts:0,correct:0};
      copy.progress.byItem[item.itemId] = {attempts:previous.attempts+1,correct:previous.correct+Number(item.correct === true),lastScore:item.score,lastPracticedAt:date};
    }
    return copy;
  }
  return {subjects,subject,validateSelection,normalizeLearningSet,normalizeSets,modesFor,createStudySnapshot,cloneLearningSet,recordStudyResult};
});
