const {test}=require('node:test');const assert=require('node:assert/strict');const G=require('../geography-data.js');
test('all catalogs are complete, unique and every item has a map location',()=>{
  const catalog=require('../data/geography/catalog.json');G.validateCatalog(catalog);
  for(const [id,count] of [['un195',195],['ioc206',206],['ch26',26]]){
    const items=G.itemsFor({catalogId:id},catalog);assert.equal(items.length,count);assert.equal(new Set(items.map(i=>i.id)).size,count);
    for(const item of items){assert.ok(item.path&&item.path.startsWith('M'));assert.ok(item.point.every(Number.isFinite));assert.ok(item.name&&item.aliases.length);}
  }
  assert.ok(G.itemsFor({catalogId:'un195'},catalog).some(i=>i.id==='VA'));
  assert.equal(G.itemsFor({catalogId:'ioc206'},catalog).some(i=>i.id==='VA'),false);
  assert.ok(G.itemsFor({catalogId:'ioc206'},catalog).some(i=>i.id==='XK'));
  assert.equal(G.itemsFor({catalogId:'un195',regionId:'western-europe'},catalog).some(i=>i.id==='CH'),true);
});
test('five scoring stages, target reveal and ignored background',()=>{
  for(let wrong=0;wrong<5;wrong++){
    const session=G.start([{id:'CH',name:'Schweiz',aliases:['Schweiz']},{id:'DE',name:'Deutschland',aliases:['Deutschland']}],'find');
    const target=session.deck[0],other=session.deck[1];
    G.pick(session,null);assert.equal(session.errors,0);
    for(let i=0;i<wrong;i++)G.pick(session,other.id);
    assert.equal(session.results.length,0);assert.equal(session.reveal,wrong>=4);
    G.pick(session,target.id);assert.equal(session.results[0].score,Math.max(0,100-wrong*25));
    assert.equal(session.results.length,1);assert.equal(session.index,0);G.next(session);assert.equal(session.index,1);assert.equal(session.errors,0);
  }
});
test('name mode accepts only defined aliases and all black equals zero percent',()=>{
  const session=G.start([{id:'CH',name:'Schweiz',aliases:['Schweiz','Suisse']}],'name');
  for(let i=0;i<4;i++)G.answer(session,'Deutschland');
  assert.equal(session.reveal,true);G.acceptSolution(session);assert.equal(G.percentage(session),0);
  const correct=G.start([{id:'CH',name:'Schweiz',aliases:['Schweiz','Suisse']}],'name');G.answer(correct,' suisse ');assert.equal(G.percentage(correct),100);
});
