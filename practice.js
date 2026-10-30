/* Shared round state for written/choice grammar and numeric mathematics. */
(function(root){
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function start(set,mode,catalogs,previous){
    const block=set.blocks.find(b=>b.type===(mode==='grammar'?'grammar':'mathematics'));
    let deck=previous|| (mode==='grammar'?VociGrammarData.questionsFor(block?.topicIds||[],catalogs[set.subjectId]):(block?.topicIds||[]).flatMap(id=>Array.from({length:3},()=>VociMathData.generateQuestion(id,Math.floor(Math.random()*4294967296)))));
    if(!deck.length)throw new Error('Wähle zuerst passende Themen für dieses Lernset aus.');
    deck=structuredClone(deck).sort(()=>Math.random()-.5);
    for(const question of deck)if(question.options)question.options.sort(()=>Math.random()-.5);
    return {mode,deck,index:0,answers:[],typedAnswer:'',answered:false,evaluation:null,logged:false,calculator:{expression:'',angleMode:'deg',result:null,error:''}};
  }
  function answer(session,raw){
    if(session.answered)return;
    const question=session.deck[session.index];session.typedAnswer=raw;
    session.evaluation=session.mode==='grammar'?VociGrammarData.evaluateAnswer(question,raw):VociMathData.evaluateNumber(raw,question.expected,question);
    if(session.evaluation.valid===false){session.error='Gib eine Zahl ohne Einheit ein. Dezimalpunkt oder Komma sind möglich.';return;}
    session.error='';session.answered=true;
    session.answers.push({itemId:question.id,correct:session.evaluation.correct,score:session.evaluation.correct?100:0,raw});
  }
  function next(session){if(!session.answered)return;session.index++;session.answered=false;session.typedAnswer='';session.evaluation=null;}
  function calculator(session){
    const c=session.calculator;
    const keys=['7','8','9','/','sin(','cos(','tan(','4','5','6','*','asin(','acos(','atan(','1','2','3','-','sqrt(','^','!','0','.','(',')','+','%','pi','e','log(','ln(','exp(','inv(','cbrt('];
    return `<details class="calculator"><summary>Wissenschaftlicher Taschenrechner</summary><div class="calculator-body"><label>Winkelmass<select id="calculator-angle"><option value="deg" ${c.angleMode==='deg'?'selected':''}>Grad</option><option value="rad" ${c.angleMode==='rad'?'selected':''}>Bogenmass</option></select></label><form data-practice-form="calculator"><label for="calculator-expression">Rechnung</label><input id="calculator-expression" value="${escape(c.expression)}" maxlength="300" autocomplete="off" spellcheck="false"><div class="calculator-keys">${keys.map(key=>`<button type="button" data-practice="calculator-key" data-key="${key}">${escape(key.replace('pi','π'))}</button>`).join('')}</div><div class="answer-actions"><button class="button" type="submit">Berechnen</button><button class="text-link" type="button" data-practice="calculator-clear">Löschen</button></div></form><output aria-live="polite">${escape(c.error|| (c.result===null?'':String(c.result)))}</output>${c.result!==null?'<button class="button button-secondary" data-practice="calculator-use">Ergebnis übernehmen</button>':''}<p class="subtle small">% teilt durch 100. Funktionsklammern schliessen; bei der Antwort die verlangte Rundung beachten.</p></div></details>`;
  }
  function render(session){
    const title=session.mode==='grammar'?'Grammatik üben':'Mathematik üben';
    const head=`<div class="page-top"><h1>${title}</h1><button class="back-link" data-action="dashboard">Zurück zum Lernset</button></div>`;
    if(session.index>=session.deck.length){const correct=session.answers.filter(a=>a.correct).length;return `${head}<section class="activity-card"><h2>Runde abgeschlossen</h2><p class="result-score">${correct} / ${session.deck.length}</p><p>Antworten richtig</p><div class="answer-actions"><button class="button" data-practice="repeat">Alle wiederholen</button><button class="button button-secondary" data-practice="repeat-wrong" ${correct===session.deck.length?'disabled':''}>Nur falsche wiederholen</button><button class="text-link" data-action="dashboard">Lernfortschritt ansehen</button></div></section>`;}
    const q=session.deck[session.index],evaluation=session.evaluation;
    return `${head}<section class="activity-card practice-card"><p class="subtle">Aufgabe ${session.index+1} von ${session.deck.length}</p><h2>${escape(q.prompt)}</h2>${q.diagram||''}${q.type==='choice'?`<div class="choice-list">${q.options.map(option=>`<button class="choice-button ${session.answered&&evaluation.expectedAnswers.includes(option)?'is-right':''}" data-practice="answer-choice" data-value="${escape(option)}" ${session.answered?'disabled':''}>${escape(option)}</button>`).join('')}</div>`:`<form data-practice-form="answer"><label for="practice-answer">Deine Antwort${session.mode==='mathematics'?` in ${VociMathData.unitText(q)}`:''}</label><input id="practice-answer" autocomplete="off" ${session.mode==='mathematics'?'inputmode="decimal"':''} value="${escape(session.typedAnswer)}" ${session.answered?'readonly':''}><button class="button" type="submit" ${session.answered?'disabled':''}>Antwort prüfen</button></form>`}${session.error?`<p role="alert">${escape(session.error)}</p>`:''}${session.answered?`<div class="answer-feedback ${evaluation.correct?'is-right':'is-wrong'}" role="status"><h3>${evaluation.correct?'Richtig':'Noch nicht richtig'}</h3><p>Deine Antwort: ${escape(session.typedAnswer)}</p><p>Lösung: ${escape(evaluation.expectedAnswers?.join(' / ')||evaluation.expectedText)}</p>${session.mode==='grammar'?`<p>${escape(evaluation.explanation)}</p>`:`<ol>${q.solutionSteps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol>`}</div><button class="button" data-practice="next">${session.index+1===session.deck.length?'Runde abschliessen':'Weiter'}</button>`:''}</section>${session.mode==='mathematics'?calculator(session):''}`;
  }
  root.VociPractice={start,answer,next,render};
})(globalThis);
