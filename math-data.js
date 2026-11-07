(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.VociMathData=api;})(globalThis,function(){
  const shapes = {rectangle:'Rechteck',square:'Quadrat',rhombus:'Rhombus',parallelogram:'Rhomboid',circle:'Kreis','triangle-equilateral':'Gleichseitiges Dreieck','triangle-isosceles':'Gleichschenkliges Dreieck','triangle-right':'Rechtwinkliges Dreieck',triangle:'Allgemeines Dreieck'};
  const solids = {cuboid:'Quader',cube:'Würfel',pyramid:'Pyramide',sphere:'Kugel',prism:'Prisma'};
  const topics=[...Object.entries(shapes).flatMap(([id,name])=>[{id:`${id}-area`,name:`${name}: Fläche`,dimension:'area'},{id:`${id}-perimeter`,name:`${name}: Umfang`,dimension:'length'}]),...Object.entries(solids).map(([id,name])=>({id:`${id}-volume`,name:`${name}: Volumen`,dimension:'volume'})),{id:'pythagoras-hypotenuse',name:'Pythagoras: Hypotenuse',dimension:'length'},{id:'pythagoras-leg',name:'Pythagoras: Kathete',dimension:'length'}];
  const formulas={
    'rectangle-area':['A = a × b',v=>v.a*v.b], 'rectangle-perimeter':['U = 2 × (a + b)',v=>2*(v.a+v.b)],
    'square-area':['A = a²',v=>v.a**2], 'square-perimeter':['U = 4 × a',v=>4*v.a],
    'rhombus-area':['A = a × h',v=>v.a*v.h], 'rhombus-perimeter':['U = 4 × a',v=>4*v.a],
    'parallelogram-area':['A = a × h',v=>v.a*v.h], 'parallelogram-perimeter':['U = 2 × (a + b)',v=>2*(v.a+v.b)],
    'circle-area':['A = π × r²',v=>Math.PI*v.r**2], 'circle-perimeter':['U = 2 × π × r',v=>2*Math.PI*v.r],
    'triangle-equilateral-area':['A = √3 × a² ÷ 4',v=>Math.sqrt(3)*v.a**2/4], 'triangle-equilateral-perimeter':['U = 3 × a',v=>3*v.a],
    'triangle-isosceles-area':['h = √(b² − (a/2)²); A = a × h ÷ 2',v=>v.a*Math.sqrt(v.b**2-(v.a/2)**2)/2], 'triangle-isosceles-perimeter':['U = a + 2 × b',v=>v.a+2*v.b],
    'triangle-right-area':['A = a × b ÷ 2',v=>v.a*v.b/2], 'triangle-right-perimeter':['c = √(a² + b²); U = a + b + c',v=>v.a+v.b+Math.hypot(v.a,v.b)],
    'triangle-area':['A = a × h ÷ 2',v=>v.a*v.h/2], 'triangle-perimeter':['U = a + b + c',v=>v.a+v.b+v.c],
    'cuboid-volume':['V = a × b × h',v=>v.a*v.b*v.h], 'cube-volume':['V = a³',v=>v.a**3],
    'pyramid-volume':['V = G × h ÷ 3',v=>v.G*v.h/3], 'sphere-volume':['V = 4 × π × r³ ÷ 3',v=>4*Math.PI*v.r**3/3], 'prism-volume':['V = G × h',v=>v.G*v.h],
    'pythagoras-hypotenuse':['c = √(a² + b²)',v=>Math.hypot(v.a,v.b)], 'pythagoras-leg':['b = √(c² − a²)',v=>Math.sqrt(v.c**2-v.a**2)]
  };
  function calculate(topicId,values){const formula=formulas[topicId];if(!formula)throw new Error('Unbekanntes Mathematikthema.');const result=formula[1](values);if(!Number.isFinite(result)||result<=0)throw new Error('Die Masse ergeben keine gültige Aufgabe.');return result;}
  function precision({dimension,unit}){
    if(!['mm','cm','m'].includes(unit))throw new Error('Unbekannte Einheit.');
    if(dimension==='length')return {mm:0,cm:1,m:3}[unit];
    if(dimension==='area')return 3;if(dimension==='volume')return 4;throw new Error('Unbekannte Grössenart.');
  }
  function evaluateNumber(raw,expected,options){
    const digits=precision(options),rounded=Number(expected.toFixed(digits)),expectedText=String(rounded).replace('.',',');
    const text=String(raw).trim(),valid=/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text);
    const value=valid?Number(text.replace(',','.')):NaN;
    return {valid:valid&&Number.isFinite(value),correct:valid&&Number.isFinite(value)&&value===rounded,expectedText};
  }
  const unitText=q=>q.unit+(q.dimension==='area'?'²':q.dimension==='volume'?'³':'');
  function diagram(shape,v,unit){
    const text=(x,y,label)=>`<text x="${x}" y="${y}" text-anchor="middle">${label}</text>`;
    const line=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1}L${x2} ${y2}"/>`;
    let drawing='';
    if(shape==='circle'||shape==='sphere')drawing=`<circle cx="160" cy="110" r="70"/>${line(160,110,230,110)}${text(195,100,`r = ${v.r} ${unit}`)}`;
    else if(shape==='triangle-right'||shape.startsWith('pythagoras'))drawing=`<path d="M55 165L265 165L55 35ZM55 150H70V165"/>${text(160,192,`a = ${v.a} ${unit}`)}${text(38,100,shape==='pythagoras-leg'?'b = ?':`b = ${v.b} ${unit}`)}${text(230,98,shape==='pythagoras-leg'?`c = ${v.c} ${unit}`:'c = ?')}`;
    else if(shape.includes('triangle'))drawing=`<path d="M55 165L265 165L145 35Z"/>${text(160,192,`a = ${v.a} ${unit}`)}${text(290,98,v.b?`b = ${v.b} ${unit}`:'a')}${shape==='triangle'?`${line(145,35,145,165)}${text(175,115,`h = ${v.h} ${unit}`)}${text(40,90,`c = ${v.c} ${unit}`)}`:''}`;
    else if(shape==='pyramid')drawing=`<path d="M65 165L235 165L280 135L110 135ZM65 165L170 30L235 165M280 135L170 30L110 135"/>${line(170,30,170,150)}${text(210,90,`h = ${v.h} ${unit}`)}${text(165,195,`G = ${v.G} ${unit}²`)}`;
    else if(['cuboid','cube','prism'].includes(shape))drawing=`<path d="M65 75H235V165H65ZM65 75L110 40H280V130L235 165M235 75L280 40"/>${text(160,195,v.G?`G = ${v.G} ${unit}²`:`a = ${v.a} ${unit}`)}${text(305,105,`h = ${v.h||v.a} ${unit}`)}${v.b?text(270,170,`b = ${v.b} ${unit}`):''}`;
    else if(['rhombus','parallelogram'].includes(shape))drawing=`<path d="M50 165L100 55H280L230 165Z"/>${line(100,55,100,165)}${text(145,195,`a = ${v.a} ${unit}`)}${text(135,115,`h = ${v.h} ${unit}`)}${text(290,120,`${shape==='rhombus'?'a':'b'} = ${v.b||v.a} ${unit}`)}`;
    else drawing=`<rect x="65" y="45" width="210" height="120"/>${text(170,195,`a = ${v.a} ${unit}`)}${text(310,110,`b = ${v.b||v.a} ${unit}`)}`;
    return `<svg viewBox="0 0 380 225" role="img" aria-label="Skizze, nicht massstabsgetreu"><g fill="none" stroke="currentColor" stroke-width="2">${drawing}</g><style>text{fill:currentColor;stroke:none;font:14px sans-serif}</style></svg>`;
  }
  function generateQuestion(topicId,seed){
    const topic=topics.find(t=>t.id===topicId);if(!topic)throw new Error('Unbekanntes Mathematikthema.');
    let state=Number(seed)>>>0;const n=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return 2+state%11;};
    const a=n(),b=n(),h=n(),r=n();let values={a,b,h,r};
    const shape=topicId.replace(/-(area|perimeter|volume)$/,'');
    if(shape==='square'||shape==='cube')values={a};
    if(shape==='circle'||shape==='sphere')values={r};
    if(shape==='rhombus')values={a,h:Math.max(1,a-1)};
    if(shape==='parallelogram')values={a,b,h:Math.max(1,b-1)};
    if(shape==='rectangle')values={a,b};
    if(shape==='triangle-equilateral')values={a};
    if(shape==='triangle-isosceles')values={a,b:a+2};
    if(shape==='triangle-right'||shape==='pythagoras-hypotenuse')values={a,b};
    if(shape==='pythagoras-leg')values={a:3*a,c:5*a};
    if(shape==='triangle')values={a:14*a,b:13*a,c:15*a,h:12*a};
    if(shape==='prism'||shape==='pyramid')values={G:a*b,h};
    const unit=['mm','cm','m'][(Number(seed)>>>0)%3];
    const expected=calculate(topicId,values),dimension=topic.dimension;
    const measurements=Object.entries(values).map(([key,value])=>`${key} = ${value} ${unit}${key==='G'?'²':''}`).join(', ');
    const rounding=dimension==='length'?'Runde auf einen Millimeter.':`Runde auf ${dimension==='area'?3:4} Nachkommastellen.`;
    return {id:`math:${topicId}:${seed}`,topicId,seed,values,prompt:`${topic.name}. ${measurements}. ${shape==='pyramid'||shape==='prism'?'G ist die Grundfläche; h die senkrechte Höhe. ':''}${rounding}`,diagram:diagram(shape,values,unit),expected,dimension,unit,solutionSteps:[formulas[topicId][0],`Mit den angegebenen Massen: ${evaluateNumber('',expected,{dimension,unit}).expectedText} ${unitText({unit,dimension})}`]};
  }
  return {topics,calculate,generateQuestion,evaluateNumber,unitText};
});
