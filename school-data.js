(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined') module.exports = api;
  root.VociSchoolData = api;
})(globalThis, function () {
  function individualPrice(count) {
    if (!Number.isInteger(count) || count < 1 || count > 5) throw new Error('Wähle ein bis fünf Fächer.');
    return 3 + Math.min(count - 1, 2) * 2 + Math.max(count - 3, 0);
  }
  function parseClassExport(value) {
    if (!value || value.format !== 'voci-class' || ![1,2].includes(value.version) || typeof value.school_id !== 'string' ||
        typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100 ||
        !Array.isArray(value.students) || value.students.length > 10000 ||
        !Array.isArray(value.teachers) || !Array.isArray(value.exams) || value.exams.length > 1000) {
      throw new Error('Diese Datei ist kein unterstützter Voci-Klassenexport.');
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(value.school_id) || value.students.some(s => !s || !uuid.test(s.user_id)) || value.teachers.some(t => !uuid.test(t))) throw new Error('Die Kontoverknüpfungen im Export sind ungültig.');
    for (const exam of value.exams) {
      const date = new Date(`${exam?.exam_date}T00:00:00Z`);
      if (!exam || typeof exam.title !== 'string' || !exam.title.trim() || exam.title.length > 100 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(exam.exam_date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== exam.exam_date ||
          !validSnapshot(exam.set_data)) {
        throw new Error('Der Export enthält eine ungültige Prüfung.');
      }
    }
    return value;
  }
  function validSnapshot(data) {
    try {
      const content=typeof module!=='undefined'?require('./content-data.js'):globalThis.VociContent;
      const allowed=data?.version===2?['version','name','subjectId','blocks','examDate']:['language','objectives','name','examDate'];
      if(!data||Object.keys(data).some(k=>!allowed.includes(k))||JSON.stringify(data).length>=1000000)return false;
      if(data.version!==2&&(!['en','fr'].includes(data.language)||!Array.isArray(data.objectives)||!data.objectives.length))return false;
      if(data.version===2&&(!Array.isArray(data.blocks)||!data.blocks.length))return false;
      if(data.version===2)for(const block of data.blocks){
        const keys=block.type==='geography'?['type','catalogId','continentId','regionId']:['type',block.type==='vocabulary'?'objectiveIds':'topicIds'];
        if(Object.keys(block).some(k=>!keys.includes(k)))return false;
        if(block.type!=='geography'&&!(block.objectiveIds||block.topicIds)?.length)return false;
      }
      content.validateSelection(data.subjectId||data.language,data.blocks||[{type:'vocabulary',objectiveIds:data.objectives}]);
      return true;
    } catch {return false;}
  }
  return { individualPrice, parseClassExport };
});
