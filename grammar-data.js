(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.VociGrammarData=api;})(globalThis,function(){
  const normalize=(s,sensitive)=>{const value=String(s).normalize('NFC').trim().replace(/[‘’]/g,"'").replace(/\s+/g,' ');return sensitive?value:value.toLocaleLowerCase();};
  function evaluateAnswer(question,raw){
    return {correct:question.acceptedAnswers.some(a=>normalize(raw,question.caseSensitive)===normalize(a,question.caseSensitive)),expectedAnswers:[...question.acceptedAnswers],explanation:question.explanation};
  }
  function validateCatalog(catalog){
    if(!catalog||!['de','en','fr'].includes(catalog.subjectId)||!Array.isArray(catalog.topics))throw new Error('Ungültiger Grammatikkatalog.');
    const ids=new Set();
    for(const topic of catalog.topics){
      if(!topic.id||ids.has(topic.id)||!topic.name||!topic.explanation||!Array.isArray(topic.examples)||topic.examples.length<2||!Array.isArray(topic.levels)||!topic.levels.length||topic.levels.some(x=>!['primary','secondary'].includes(x))||!Array.isArray(topic.questions)||topic.questions.length<8)throw new Error('Ein Grammatikthema ist unvollständig.');
      ids.add(topic.id);
      for(const q of topic.questions){
        if(!q.id||ids.has(q.id)||q.topicId!==topic.id||!q.prompt||!q.explanation||typeof q.caseSensitive!=='boolean'||!['choice','written'].includes(q.type)||!Array.isArray(q.acceptedAnswers)||!q.acceptedAnswers.length||q.acceptedAnswers.some(a=>typeof a!=='string'||!a.trim()))throw new Error('Eine Grammatikaufgabe ist unvollständig.');
        ids.add(q.id);
        if(q.type==='choice'&&(!Array.isArray(q.options)||q.options.length<2||new Set(q.options).size!==q.options.length||q.options.filter(option=>evaluateAnswer(q,option).correct).length!==1))throw new Error('Eine Auswahlaufgabe braucht genau eine richtige Antwort.');
      }
    }
    return catalog;
  }
  function questionsFor(topicIds,catalog){validateCatalog(catalog);return catalog.topics.filter(t=>topicIds.includes(t.id)).flatMap(t=>t.questions).map(q=>structuredClone(q));}
  return {validateCatalog,evaluateAnswer,questionsFor};
});
