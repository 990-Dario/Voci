const {test}=require('node:test');const assert=require('node:assert/strict');const {localServer}=require('./local-server.js');
test('world filters, tiny-state click, no penalty for pan, name mode and persistent score',async()=>{
  const server=await localServer();const {chromium}=require(process.env.VOCI_PLAYWRIGHT_PATH||'playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(server.url)?r.continue():r.abort());
    await page.goto(server.url);await page.getByRole('button',{name:'Geografie',exact:true}).click();
    await page.locator('#set-name').fill('Europa');await page.locator('[name="geo-continent"]').selectOption('europe');await page.locator('[name="geo-region"]').selectOption('western-europe');
    await page.getByRole('button',{name:'Lernset speichern',exact:true}).click();await page.getByRole('button',{name:'Auf der Karte finden',exact:true}).click();
    assert.ok(await page.evaluate(()=>session.viewBox[2]<600),'A regional round should start focused on the region');
    let id=await page.evaluate(()=>session.deck[session.index].id);let other=await page.evaluate(()=>session.deck.find(i=>i.id!==session.deck[session.index].id).id);
    const svg=page.locator('#geo-map'),box=await svg.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+20);await page.mouse.up();
    assert.equal(await page.evaluate(()=>session.errors),0);
    for(let i=0;i<4;i++)await page.locator(`path[data-geo-country="${other}"]`).press('Enter');
    assert.equal(await page.locator(`.geo-highlight[data-geo-country="${id}"]`).count()>0,true);
    await page.locator(`path[data-geo-country="${id}"]`).press('Enter');
    assert.equal(await page.evaluate(()=>session.results[0].score),0);
    await page.getByRole('button',{name:'Weiter',exact:true}).click();
    let markerClicks=0;
    while(await page.evaluate(()=>session.index<session.deck.length)){
      id=await page.evaluate(()=>session.deck[session.index].id);
      const marker=page.locator(`circle[data-geo-country="${id}"]`);
      if(await marker.count()){await marker.click();markerClicks++;}
      else await page.locator(`path[data-geo-country="${id}"]`).press('Enter');
      await page.locator('[data-geo-action="next"]').click();
    }
    assert.ok(markerClicks>0,'Small states can be selected with the pointer');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('voci-learning-state')).sets[0].results.at(-1).unit),'points');
    await page.screenshot({path:'.superpowers/sdd/2026-10-28-gesamtumbau/geography-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'Zurück zum Lernset',exact:true}).click();await page.getByRole('button',{name:'Namen schreiben',exact:true}).click();
    const name=await page.evaluate(()=>session.deck[0].name);await page.locator('#geo-answer').fill(name);await page.locator('#geo-answer').press('Enter');assert.equal(await page.locator('#geo-answer').inputValue(),name);
    await page.getByRole('button',{name:'Namensliste einblenden'}).click();assert.ok(await page.locator('.geo-names li').count()>0);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'.superpowers/sdd/2026-10-28-gesamtumbau/geography-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
  }finally{await browser.close();await server.close();}
});
