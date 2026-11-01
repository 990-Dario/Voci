const {test}=require('node:test');const assert=require('node:assert/strict');
const {localServer}=require('./local-server.js');
test('subject navigation, saved mathematics, calculator Enter, correction and reload',async()=>{
  const server=await localServer(),base=server.url;
  const {chromium}=require(process.env.VOCI_PLAYWRIGHT_PATH||'playwright');
  const browser=await chromium.launch({channel:process.env.VOCI_BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  try{
    await page.goto(base);await page.getByRole('button',{name:'Mathematik',exact:true}).click();
    await page.locator('#set-name').fill('Geometrie');await page.getByLabel('Rechteck: Fläche',{exact:true}).check();
    await page.getByRole('button',{name:'Lernset speichern',exact:true}).click();
    await page.getByRole('button',{name:'Aufgaben lösen'}).click();
    await page.locator('#practice-answer').fill('123');await page.locator('#practice-answer').press('Enter');
    assert.equal(await page.locator('#practice-answer').inputValue(),'123');
    await page.getByRole('button',{name:'Weiter',exact:true}).press('Enter');
    assert.equal(await page.locator('#practice-answer').inputValue(),'');
    assert.equal(await page.locator('#practice-answer').evaluate(el=>el===document.activeElement),true);
    await page.getByText('Wissenschaftlicher Taschenrechner',{exact:true}).click();
    await page.locator('#calculator-expression').fill('sin(30)');await page.locator('#calculator-expression').press('Enter');
    assert.equal(await page.locator('[data-practice="next"]').count(),0);
    assert.ok(Math.abs(Number(await page.locator('.calculator output').innerText())-.5)<1e-10);
    await page.getByRole('button',{name:'Ergebnis übernehmen'}).click();
    assert.ok(Number(await page.locator('#practice-answer').inputValue())>.49);
    await page.reload();await page.getByRole('button',{name:'Lernsets',exact:true}).click();
    await page.getByRole('heading',{name:'Geometrie',exact:true}).waitFor();
    for(const width of [320,390,768,1366,1920]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);}
    const invalidCounts=await page.evaluate(()=>{
      const group=vocabulary.find(g=>g.language==='en');const set=normalizeSet({id:'voci-test',language:'en',objectives:[objectiveKey(group)]});
      store.sets.push(set);store.activeSetId=set.id;
      return [0,-1,1.5,NaN].map(count=>{stage='dashboard';startMode('test',{count});return stage;});
    });
    assert.deepEqual(invalidCounts,['dashboard','dashboard','dashboard','dashboard']);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await server.close();}
});
