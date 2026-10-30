const {test}=require('node:test');const assert=require('node:assert/strict');
const M=require('../math-data.js');
test('reference geometry and precision',()=>{
  assert.equal(M.calculate('rectangle-area',{a:3,b:4}),12);
  assert.equal(M.calculate('rectangle-perimeter',{a:3,b:4}),14);
  assert.equal(M.calculate('pythagoras-hypotenuse',{a:3,b:4}),5);
  assert.equal(M.evaluateNumber('4,1888',M.calculate('sphere-volume',{r:1}),{dimension:'volume',unit:'cm'}).correct,true);
  for(const raw of ['1.23','1,2300'])assert.equal(M.evaluateNumber(raw,1.23,{dimension:'area',unit:'cm'}).correct,true);
  assert.equal(M.evaluateNumber('1.2301',1.23,{dimension:'area',unit:'cm'}).correct,false);
  for(const [unit,expected] of [['mm','12'],['cm','12.3'],['m','12.346']])assert.equal(M.evaluateNumber(expected,12.3456,{dimension:'length',unit}).correct,true);
  for(const raw of ['','NaN','Infinity','1,2.3','2cm'])assert.equal(M.evaluateNumber(raw,2,{dimension:'length',unit:'cm'}).valid,false);
});
test('every topic has deterministic valid questions with diagrams and solutions',()=>{
  assert.equal(M.topics.length,25);
  for(const topic of M.topics)for(let seed=1;seed<=30;seed++){
    const q=M.generateQuestion(topic.id,seed);assert.deepEqual(q,M.generateQuestion(topic.id,seed));
    assert.ok(Number.isFinite(q.expected)&&q.expected>0,topic.id);assert.ok(q.diagram.includes('<svg'));assert.ok(q.solutionSteps.length);
    const correct=M.evaluateNumber(M.evaluateNumber('',q.expected,q).expectedText,q.expected,q);assert.equal(correct.correct,true,topic.id);
    if(q.values.c&&topic.id.startsWith('triangle'))assert.ok(q.values.a+q.values.b>q.values.c);
  }
});
