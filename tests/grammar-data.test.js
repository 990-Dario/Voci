const {test}=require('node:test');const assert=require('node:assert/strict');const G=require('../grammar-data.js');
test('accents, explicit variants, case and apostrophes',()=>{
  const q={acceptedAnswers:["J'ai été à Paris."],caseSensitive:false,explanation:'Passé composé'};
  assert.equal(G.evaluateAnswer(q,"j’ai été à Paris.").correct,true);
  assert.equal(G.evaluateAnswer(q,"J'ai ete a Paris.").correct,false);
  assert.equal(G.evaluateAnswer({...q,caseSensitive:true},"j'ai été à Paris.").correct,false);
  assert.equal(G.evaluateAnswer({...q,acceptedAnswers:['I am not.','I’m not.']},"I'm not.").correct,true);
});
test('all six language-stage catalogs contain examples and at least eight questions per topic',()=>{
  for(const language of ['de','en','fr']){
    const catalog=require(`../data/grammar/${language}.json`);G.validateCatalog(catalog);
    for(const level of ['primary','secondary'])assert.ok(catalog.topics.some(t=>t.levels.includes(level)));
    for(const topic of catalog.topics)for(const question of topic.questions)assert.equal(G.evaluateAnswer(question,question.acceptedAnswers[0]).correct,true);
    assert.equal(G.questionsFor(catalog.topics.map(t=>t.id),catalog).length,catalog.topics.reduce((sum,t)=>sum+t.questions.length,0));
  }
});
