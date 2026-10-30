const { test } = require('node:test');
const assert = require('node:assert/strict');
const { individualPrice, parseClassExport } = require('../school-data.js');

test('Fächerpreise: Start 3 CHF, ab dem vierten Fach +1', () => {
  assert.deepEqual([1,2,3,4,5].map(individualPrice), [3,5,7,8,9]);
  for (const value of [0,-1,1.5,NaN,6,'3']) assert.throws(() => individualPrice(value));
});
const exportData = () => ({ format:'voci-class', version:1, school_id:'11111111-1111-1111-1111-111111111111', name:'Klasse 6', students:[], teachers:[], exams:[{title:'Wörter',exam_date:'2026-12-01',set_data:{language:'en',objectives:['Unit::LZ1']}}] });
test('Klassenexport lässt sich vollständig wieder einlesen', () => {
  const data = exportData();
  assert.deepEqual(parseClassExport(JSON.parse(JSON.stringify(data))), data);
});
test('Import lehnt falsche Versionen, Daten, Kontokennungen und fehlende Listen ab', () => {
  for (const patch of [{version:3},{students:{}},{teachers:['password']},{exams:null},{name:''}]) assert.throws(() => parseClassExport({...exportData(),...patch}));
  const badDate=exportData(); badDate.exams[0].exam_date='2026-02-30';
  assert.throws(() => parseClassExport(badDate));
  const badWords=exportData(); badWords.exams[0].set_data.objectives=[{}];
  assert.throws(() => parseClassExport(badWords));
});
test('V2 import accepts new subjects and rejects private or incompatible content',()=>{
  const data={...exportData(),version:2};
  const snapshot={version:2,name:'Geometrie',subjectId:'math',blocks:[{type:'mathematics',topicIds:['rectangle-area']}],examDate:'2026-12-01'};
  data.exams[0].set_data=snapshot;assert.deepEqual(parseClassExport(data),data);
  for(const patch of [{results:[]},{subjectId:'en'},{blocks:[{type:'unknown',topicIds:['x']}]},{blocks:[]}]){
    assert.throws(()=>parseClassExport({...data,exams:[{...data.exams[0],set_data:{...snapshot,...patch}}]}));
  }
});
