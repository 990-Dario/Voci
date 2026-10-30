(function(root){
  let catalog=null;
  const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options=(items,selected)=>items.map(i=>`<option value="${e(i.id)}" ${selected===i.id?'selected':''}>${e(i.name)}</option>`).join('');
  async function load(){if(catalog)return catalog;const response=await fetch('data/geography/catalog.json');if(!response.ok)throw new Error('Die Kartendaten konnten nicht geladen werden. Versuche es nochmals.');catalog=VociGeographyData.validateCatalog(await response.json());return catalog;}
  function picker(block={type:'geography',catalogId:'un195',continentId:null,regionId:null}){
    if(!catalog)return '<p>Die Karte lädt …</p>';
    const swiss=block.catalogId==='ch26',all=VociGeographyData.itemsFor({catalogId:block.catalogId,continentId:block.continentId},catalog);
    const regions=catalog.regions.filter(r=>all.some(i=>i.regionId===r.id));
    return `<fieldset class="form-section form-fieldset"><legend>Welche Karte möchtest du lernen?</legend><div class="geo-filters"><label>Katalog<select name="geo-catalog">${options(catalog.catalogs,block.catalogId)}</select></label>${swiss?'':`<label>Kontinent<select name="geo-continent"><option value="">Ganze Welt</option>${options(catalog.continents,block.continentId)}</select></label><label>Region<select name="geo-region"><option value="">Alle Regionen</option>${options(regions,block.regionId)}</select></label>`}</div><p class="subtle">${VociGeographyData.itemsFor(block,catalog).length} ${swiss?'Kantone':'Einträge'} ausgewählt · Datenstand ${e(catalog.date)}</p><p class="small">UN-Mitglieder und Beobachterstaaten: 195. Olympische Komitees: 206, einschliesslich eigenständiger Komitees einiger Gebiete.</p></fieldset>`;
  }
  function updateSelection(set,input){
    const block={...(set.blocks.find(b=>b.type==='geography')||{type:'geography',catalogId:'un195',continentId:null,regionId:null})};
    if(input.name==='geo-catalog'){block.catalogId=input.value;block.continentId=null;block.regionId=null;}
    if(input.name==='geo-continent'){block.continentId=input.value||null;block.regionId=null;}
    if(input.name==='geo-region')block.regionId=input.value||null;
    VociContent.validateSelection('geography',[block]);set.blocks=[block];
  }
  function dashboard(block){return `<section class="subject-module"><h2>Geografie</h2><p>${e(catalog?.catalogs.find(c=>c.id===block.catalogId)?.name||'Kartenübung')} · ${catalog?VociGeographyData.itemsFor(block,catalog).length:''} Einträge</p><div class="mode-actions"><button class="button" data-action="start-geography" data-mode="find">Auf der Karte finden</button><button class="button button-secondary" data-action="start-geography" data-mode="name">Namen schreiben</button></div></section>`;}
  function start(set,mode,previous){
    const selection=set.blocks.find(b=>b.type==='geography');
    const session=VociGeographyData.start(previous||VociGeographyData.itemsFor(selection,catalog),mode);
    session.selection=structuredClone(selection);session.viewBox=[...(selection.catalogId==='ch26'?catalog.swissViewBox:catalog.worldViewBox)];session.initialViewBox=[...session.viewBox];
    if(selection.catalogId!=='ch26'&&(selection.continentId||selection.regionId)){
      // Representative points keep overseas territories from pulling a regional view across the globe.
      const xs=session.deck.map(i=>i.point[0]),ys=session.deck.map(i=>i.point[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      const ratio=session.viewBox[2]/session.viewBox[3],width=Math.max(90,(right-left)*1.5,(bottom-top)*1.5*ratio),height=width/ratio;
      session.viewBox=[(left+right-width)/2,(top+bottom-height)/2,width,height];
    }
    return session;
  }
  function render(session){
    const current=session.deck[session.index],finished=!current,swiss=session.selection.catalogId==='ch26';
    const results=new Map(session.results.map(r=>[r.itemId,r]));
    const label=swiss?'Kanton':'Land';
    const header=`<div class="page-top"><div><h1>${finished?'Dein Kartenergebnis':session.mode==='find'?`Finde: ${e(current.name)}`:`Wie heisst dieser ${label}?`}</h1><p class="subtle">${finished?`${session.deck.length} Einträge abgeschlossen`:`${session.index+1} von ${session.deck.length} · ${session.errors} Fehler bei dieser Aufgabe`}</p></div><button class="back-link" data-action="dashboard">Zurück zum Lernset</button></div>`;
    const mapItems=session.deck.map(item=>{
      const result=results.get(item.id),highlight=current?.id===item.id&&!session.answered&&(session.mode==='name'||session.reveal);
      const cls=`geo-country ${result?`geo-score-${result.score}`:''} ${highlight?'geo-highlight':''}`;
      const attrs=`data-geo-country="${e(item.id)}" class="${cls}" role="button" tabindex="${session.mode==='find'&&!finished?'0':'-1'}" aria-label="${e(item.name)}${result?` · ${result.score} Punkte`:''}"`;
      return {shape:`<path d="${item.path}" ${attrs}/>`,marker:item.small?`<line class="geo-leader" data-geo-leader="${e(item.id)}" x1="${item.point[0]}" y1="${item.point[1]}" x2="${item.point[0]}" y2="${item.point[1]}"/><circle ${attrs} data-geo-marker="${e(item.id)}" data-x="${item.point[0]}" data-y="${item.point[1]}" cx="${item.point[0]}" cy="${item.point[1]}" r="5"/>`:''};
    });
    const map=`<div class="geo-toolbar"><div class="geo-zoom"><button class="button button-secondary" data-geo-action="zoom-in" aria-label="Karte vergrössern">+</button><button class="button button-secondary" data-geo-action="zoom-out" aria-label="Karte verkleinern">−</button><button class="text-link" data-geo-action="reset-view">Ganze Karte</button></div><p class="small">Ziehen verschiebt die Karte. Kleine Einträge sind als Punkte markiert.</p></div><div class="geo-map-wrap"><svg id="geo-map" viewBox="${session.viewBox.join(' ')}" role="group" aria-label="${swiss?'Karte der Schweizer Kantone':'Weltkarte'}" tabindex="0"><path class="geo-background" d="${swiss?'':catalog.background}"/>${mapItems.map(i=>i.shape).join('')}${mapItems.map(i=>i.marker).join('')}</svg></div>`;
    const input=!finished&&session.mode==='name'?`<form data-geo-form class="geo-answer"><label for="geo-answer">Name des markierten ${swiss?'Kantons':'Landes'}</label><input id="geo-answer" autocomplete="off" value="${e(session.typedAnswer)}" ${session.answered||session.reveal?'readonly':''}><button class="button" ${session.answered||session.reveal?'disabled':''}>Antwort prüfen</button></form><button class="text-link" data-geo-action="names" aria-expanded="${session.showNames}">${session.showNames?'Namensliste ausblenden':'Namensliste einblenden'}</button>${session.showNames?`<ul class="geo-names">${[...session.deck].sort((a,b)=>a.name.localeCompare(b.name,'de')).map(i=>`<li>${e(i.name)}</li>`).join('')}</ul>`:''}`:'';
    const legend=`<ul class="geo-legend" aria-label="Punktewertung">${[100,75,50,25,0].map(score=>`<li><span class="geo-dot geo-score-${score}"></span>${score} % · ${e(VociGeographyData.scoreLabels[score])}</li>`).join('')}</ul>`;
    return `${header}${finished?`<div class="geo-result"><p class="result-score">${Math.round(VociGeographyData.percentage(session))} %</p><p>${session.results.reduce((n,r)=>n+r.score,0)} von ${session.deck.length*100} Punkten</p><button class="button" data-geo-action="repeat">Alle wiederholen</button></div>`:''}${map}${input}<p class="mode-feedback" role="status">${e(session.message)}</p>${session.reveal&&!session.answered&&session.mode==='name'?`<p>Die Lösung ist <strong>${e(current.name)}</strong>.</p><button class="button" data-geo-action="solution">Lösung übernehmen</button>`:''}${session.answered?`<button class="button" data-geo-action="next">${session.index+1===session.deck.length?'Runde abschliessen':'Weiter'}</button>`:''}${legend}${finished?`<details><summary>Alle Ergebnisse</summary><ul class="history-list">${session.results.map(r=>`<li><strong>${e(r.name)}</strong><span>${r.score} Punkte · ${e(VociGeographyData.scoreLabels[r.score])}</span></li>`).join('')}</ul></details>`:''}<p class="small geo-source">Karten: Natural Earth (Public Domain), Kantone © swisstopo, Ausgabe 2026. Die UN-Regionen dienen der geografischen Einteilung; IOC-Komittees bilden einen eigenen Fragenkatalog.</p>`;
  }
  function positionMarkers(svg,session){
    const scale=session.viewBox[2]/Math.max(1,svg.getBoundingClientRect().width),radius=7*scale,placed=[];
    for(const marker of svg.querySelectorAll('[data-geo-marker]')){
      const x=Number(marker.dataset.x),y=Number(marker.dataset.y);let px=x,py=y;
      for(let step=0;step<160&&placed.some(p=>Math.hypot(p[0]-px,p[1]-py)<radius*2.5);step++){
        const angle=step*2.39996,distance=radius*1.5*Math.sqrt(step+1);px=x+Math.cos(angle)*distance;py=y+Math.sin(angle)*distance;
      }
      placed.push([px,py]);marker.setAttribute('cx',px);marker.setAttribute('cy',py);marker.setAttribute('r',radius);
      const leader=svg.querySelector(`[data-geo-leader="${marker.dataset.geoMarker}"]`);leader.setAttribute('x2',px);leader.setAttribute('y2',py);
    }
  }
  function bind(session,changed){
    const svg=document.querySelector('#geo-map');if(!svg)return;
    let drag=null;
    const update=()=>{svg.setAttribute('viewBox',session.viewBox.join(' '));positionMarkers(svg,session);};
    positionMarkers(svg,session);
    svg.addEventListener('pointerdown',event=>{if(event.button!==0)return;session.dragged=false;drag={x:event.clientX,y:event.clientY,box:[...session.viewBox],pointer:event.pointerId,country:event.target.closest('[data-geo-country]')?.dataset.geoCountry};svg.setPointerCapture(event.pointerId);});
    svg.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>5)session.dragged=true;if(session.dragged){const ratio=drag.box[2]/svg.getBoundingClientRect().width;session.viewBox=[drag.box[0]-dx*ratio,drag.box[1]-dy*ratio,...drag.box.slice(2)];update();}});
    svg.addEventListener('pointerup',event=>{if(!drag)return;const country=drag.country;svg.releasePointerCapture(event.pointerId);drag=null;if(!session.dragged&&country&&session.mode==='find'){VociGeographyData.pick(session,country);changed();}});
    svg.addEventListener('pointercancel',()=>{drag=null;session.dragged=true;});
    svg.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){const country=event.target.closest('[data-geo-country]');if(country){event.preventDefault();VociGeographyData.pick(session,country.dataset.geoCountry);changed();}return;}
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},delta=directions[event.key];
      if(delta){event.preventDefault();session.viewBox[0]+=delta[0]*session.viewBox[2]/10;session.viewBox[1]+=delta[1]*session.viewBox[3]/10;update();}
    });
  }
  function zoom(session,factor){const [x,y,w,h]=session.viewBox;const nw=Math.min(2400,Math.max(15,w*factor)),nh=h*nw/w;session.viewBox=[x+(w-nw)/2,y+(h-nh)/2,nw,nh];}
  root.VociGeography={load,picker,updateSelection,dashboard,start,render,bind,zoom};
})(globalThis);
