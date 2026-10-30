const {test}=require('node:test');
const assert=require('node:assert/strict');
const {localServer}=require('./local-server.js');

test('Klassenansicht, private Vorbereitung und unabhängige Lernsetkopie', {skip:!process.env.VOCI_PLAYWRIGHT_PATH},async()=>{
  const {chromium}=require(process.env.VOCI_PLAYWRIGHT_PATH);
  const browser=await chromium.launch({channel:process.env.VOCI_BROWSER_CHANNEL||'chrome',headless:true});
  const server=await localServer();const base=server.url;
  const context=await browser.newContext();const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    const fixture=`(()=>{
      const user={id:'00000000-0000-0000-0000-000000000002',email:'lehrer@schule.ch',user_metadata:{}};
      const school={id:'11111111-1111-1111-1111-111111111111',name:'Schule Beispiel',postal_code:'8000',town:'Zürich'};
      const state={profile:{user_id:user.id,school_id:school.id,first_name:'Alex',last_name:'Muster',username:'alex.muster',preferences:{exam_created:true,exam_changed:true,exam_deleted:true,subscription_cancelled:true,admin_changed:true}},school,role:{is_admin:true,is_teacher:true},is_operator:false,staff:[{user_id:user.id,is_admin:true,is_teacher:true,first_name:'Alex',last_name:'Muster',username:'alex.muster'}],invites:[],requests:[],review_requests:[],subjects:[{id:'en',name:'Englisch'},{id:'fr',name:'Französisch'}],subscriptions:[],classes:[]};
      window.__schoolFixture=state;window.__savedLearning=null;
      globalThis.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>{}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:async row=>{window.__savedLearning=structuredClone(row.state);return {};} }),rpc:async(name,args)=>{if(name==='voci_school_snapshot')return {data:structuredClone(state)};if(name==='voci_find_schools')return {data:[school]};return {data:{ok:true}};} })};
    })();`;
    await context.route('**/*',async route=>{
      const url=route.request().url();
      if(url.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js@2'))return route.fulfill({contentType:'text/javascript',body:fixture});
      if(url.startsWith(base))return route.continue();
      return route.abort();
    });
    await page.goto(base);
    await page.locator('[data-school-action="school"]').waitFor();
    // Use real local vocabulary keys; the mock replaces only remote account data.
    const vocabulary=await page.evaluate(async()=>await(await fetch('data/vocabulary.json')).json());
    const group=vocabulary.find(g=>g.language==='en');
    const objective=[group.course,group.unit,group.objective].join('::');
    await page.evaluate(({objective})=>{
      window.__schoolFixture.classes=[{id:'22222222-2222-2222-2222-222222222222',name:'6a',school_id:window.__schoolFixture.school.id,can_teach:true,is_teacher:true,deleted_at:null,students:[],teachers:['00000000-0000-0000-0000-000000000002'],codes:[],exams:[{id:'33333333-3333-3333-3333-333333333333',title:'Klassenprüfung',exam_date:'2026-12-01',updated_at:new Date().toISOString(),set_data:{language:'en',objectives:[objective]}}]}];
      window.dispatchEvent(new Event('focus'));
    },{objective});
    await page.locator('[data-school-action="classes"]').click();
    await page.locator('[data-school-action="open-class"]').click();
    if(process.env.VOCI_UI_SCREENSHOTS)await page.screenshot({path:process.env.VOCI_UI_SCREENSHOTS+'/school-desktop.png',fullPage:true});
    await page.locator('[data-school-action="study"]').click();
    await page.getByRole('heading',{name:'Klassenprüfung',exact:true}).waitFor();
    assert.equal(await page.locator('[data-action="share-set"]').isVisible(),false);
    await page.locator('[data-action="start-flash"]').click();
    await page.locator('[data-action="flip-card"]').click();
    await page.locator('[data-action="flash-known"]').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('voci-learning-state')));
    assert.equal(saved.sets.length,0);assert.equal(saved.classProgress['33333333-3333-3333-3333-333333333333'].cards.known.length,1);
    await page.locator('[data-school-action="classes"]').click();
    await page.locator('[data-school-action="copy-exam"]').click();
    await page.locator('[data-nav="sets"]').click();
    assert.equal(await page.getByRole('heading',{name:'Klassenprüfung',exact:true}).count(),1);
    await page.evaluate(()=>{window.__schoolFixture.classes[0].exams[0].title='Neuer Titel';window.dispatchEvent(new Event('focus'));});
    await page.locator('[data-school-action="classes"]').click();
    await page.getByRole('heading',{name:'Neuer Titel',exact:true}).waitFor();
    await page.locator('[data-nav="sets"]').click();
    await page.getByRole('heading',{name:'Klassenprüfung',exact:true}).waitFor();
    await page.locator('[data-school-action="school"]').click();
    await page.getByRole('textbox',{name:'Vorname',exact:true}).fill('Noch nicht gespeichert');
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('textbox',{name:'Vorname',exact:true}).inputValue(),'Noch nicht gespeichert');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    if(process.env.VOCI_UI_SCREENSHOTS)await page.screenshot({path:process.env.VOCI_UI_SCREENSHOTS+'/school-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await server.close();}
});
