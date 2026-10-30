(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.VociGeographyData=api;})(globalThis,function(){
  const catalogs={un195:195,ioc206:206,ch26:26};
  const scoreLabels={100:'Beim ersten Versuch richtig',75:'Nach einem Fehler richtig',50:'Nach zwei Fehlern richtig',25:'Nach drei Fehlern richtig',0:'Mit Lösungshilfe'};
  function itemsFor(selection,catalog){
    if(!Object.hasOwn(catalogs,selection.catalogId))throw new Error('Unbekannter Kartenkatalog.');
    return catalog.items.filter(i=>i.catalogs.includes(selection.catalogId)&&(!selection.continentId||i.continentId===selection.continentId)&&(!selection.regionId||i.regionId===selection.regionId));
  }
  function validateCatalog(catalog){
    if(catalog?.version!==1||!Array.isArray(catalog.items))throw new Error('Ungültiger Kartenkatalog.');
    const ids=new Set();
    for(const item of catalog.items){
      if(!/^[A-Z]{2}(?:-[A-Z]{2})?$/.test(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name||!Array.isArray(item.aliases)||!item.aliases.length||item.aliases.some(a=>typeof a!=='string'||!a)||!Array.isArray(item.catalogs)||item.catalogs.some(id=>!Object.hasOwn(catalogs,id))||!/^M[-0-9.,MLZ]+$/i.test(item.path)||item.point?.length!==2||item.point.some(x=>!Number.isFinite(x))||item.bounds?.length!==4||item.bounds.some(x=>!Number.isFinite(x)))throw new Error('Ein Karteneintrag ist unvollständig.');
      ids.add(item.id);
      if(!item.catalogs.includes('ch26')&&(!catalog.continents.some(c=>c.id===item.continentId)||!catalog.regions.some(r=>r.id===item.regionId)))throw new Error('Einem Land fehlt seine Region.');
    }
    for(const [id,count] of Object.entries(catalogs))if(itemsFor({catalogId:id},catalog).length!==count)throw new Error('Ein Kartenkatalog ist nicht vollständig.');
    return catalog;
  }
  function start(items,mode){
    if(!items.length||!['find','name'].includes(mode))throw new Error('Diese Auswahl enthält keine Kartenaufgaben.');
    const deck=structuredClone(items);
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    return {mode,deck,index:0,errors:0,reveal:false,answered:false,results:[],typedAnswer:'',message:'',showNames:false,logged:false};
  }
  function attempt(session,correct){
    if(session.answered||session.index>=session.deck.length)return;
    if(correct){
      const score=Math.max(0,100-25*session.errors),item=session.deck[session.index];
      session.results.push({itemId:item.id,correct:score===100,score,name:item.name});session.answered=true;
      session.message=`${item.name}: ${scoreLabels[score]} · ${score} Punkte.`;
    }else if(!session.reveal){session.errors++;session.reveal=session.errors>=4;session.message=session.reveal?'Die Lösung wird markiert. Wähle sie aus, um weiterzulernen.':`Noch nicht richtig. ${session.errors} ${session.errors===1?'Fehler':'Fehler'} – versuche es nochmals.`;}
  }
  function pick(session,id){if(session.mode!=='find'||!session.deck.some(i=>i.id===id))return;attempt(session,id===session.deck[session.index]?.id);}
  const normalize=value=>String(value).normalize('NFC').trim().toLocaleLowerCase('de-CH').replace(/[‘’]/g,"'").replace(/\s+/g,' ');
  function answer(session,raw){
    if(session.mode!=='name'||session.reveal)return;
    session.typedAnswer=String(raw);if(!session.typedAnswer.trim()){session.message='Gib zuerst einen Namen ein.';return;}
    attempt(session,session.deck[session.index].aliases.some(a=>normalize(a)===normalize(raw)));
  }
  function acceptSolution(session){if(session.reveal)attempt(session,true);}
  function next(session){if(!session.answered)return;session.index++;session.errors=0;session.reveal=false;session.answered=false;session.typedAnswer='';session.message='';}
  function percentage(session){return session.results.length?session.results.reduce((n,r)=>n+r.score,0)/(session.results.length*100)*100:0;}
  return {itemsFor,validateCatalog,start,pick,answer,acceptSolution,next,percentage,scoreLabels};
});
