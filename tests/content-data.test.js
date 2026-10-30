const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../content-data.js');
const legacy = {id:'existing',name:'English',language:'en',objectives:['a'],cards:{known:['word'],practice:[]},quizWrong:['word'],results:[{type:'Test',score:3,total:4}]};
test('five subjects; lossless, idempotent legacy normalization', () => {
  assert.deepEqual(C.subjects.map(x=>x.id), ['de','en','fr','math','geography']);
  const set=C.normalizeLearningSet(legacy);
  assert.equal(set.id,'existing'); assert.equal(set.subjectId,'en');
  assert.deepEqual(set.blocks,[{type:'vocabulary',objectiveIds:['a']}]);
  assert.deepEqual(set.cards,legacy.cards); assert.deepEqual(set.results,legacy.results);
  assert.deepEqual(C.normalizeLearningSet(set),set);
  assert.throws(()=>C.normalizeLearningSet({...legacy,version:3}),/Version/);
  assert.throws(()=>C.normalizeLearningSet({...legacy,subjectId:'unknown'}),/Fach/);
});
test('selection rejects unknown, duplicate and cross-subject blocks',()=>{
  assert.throws(()=>C.validateSelection('de',[{type:'vocabulary',objectiveIds:['a']}]));
  assert.throws(()=>C.validateSelection('en',[{type:'grammar',topicIds:['a']},{type:'grammar',topicIds:['b']}]));
  assert.throws(()=>C.validateSelection('geography',[{type:'geography',catalogId:'territories'}]));
  assert.deepEqual(C.modesFor(C.normalizeLearningSet({subjectId:'math',blocks:[]})),[]);
});
test('snapshots and independent copies exclude all private data for every subject',()=>{
  for(const [subjectId,block] of [['de',{type:'grammar',topicIds:['x']}],['en',{type:'vocabulary',objectiveIds:['x']}],['fr',{type:'grammar',topicIds:['x']}],['math',{type:'mathematics',topicIds:['x']}],['geography',{type:'geography',catalogId:'un195',continentId:null,regionId:null}]]) {
    const set=C.normalizeLearningSet({...legacy,version:2,subjectId,blocks:[block]});
    assert.deepEqual(C.normalizeLearningSet(JSON.parse(JSON.stringify(set))),set);
    const snapshot=C.createStudySnapshot(set);
    assert.deepEqual(Object.keys(snapshot).sort(),['version','name','subjectId','blocks','examDate'].sort());
    const clone=C.cloneLearningSet(set,'copy'); assert.equal(clone.id,'copy');
    assert.deepEqual(clone.cards,{known:[],practice:[]}); assert.deepEqual(clone.quizWrong,[]);
    assert.deepEqual(clone.results,[]); assert.deepEqual(clone.progress.byItem,{});
  }
});
test('mixed stores preserve unknown entries and block unsafe saves',()=>{
  const unknown={version:99,id:'future'};
  const result=C.normalizeSets([legacy,unknown]);
  assert.equal(result.sets.length,1); assert.deepEqual(result.unreadableSets,[unknown]); assert.equal(result.canSave,false);
});
test('results retain last thirty rounds and cumulative per-item progress',()=>{
  let set=C.normalizeLearningSet(legacy);
  for(let i=0;i<32;i++) set=C.recordStudyResult(set,{type:'Geografie',score:250,total:500,date:'2026-10-28T12:00:00Z',unit:'points'},[{itemId:'geo:ch',correct:i===0,score:i===0?100:75}]);
  assert.equal(set.results.length,30); assert.equal(set.results[0].score/set.results[0].total,.5);
  assert.deepEqual(set.progress.byItem['geo:ch'],{attempts:32,correct:1,lastScore:75,lastPracticedAt:'2026-10-28T12:00:00Z'});
});
