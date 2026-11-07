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
    assert.equal(await page.locator('.exam-meta').isVisible(),true);
    assert.match(await page.locator('.exam-meta').innerText(),/01\.12\.2026.*Englisch/);
    await page.evaluate(async()=>{
      window.__schoolFixture.subjects=VociContent.subjects;
      window.__schoolFixture.subscriptions=[{user_id:currentUser.id,status:'active',period_end:'2099-01-01',subjects:['math']}];
      await VociSchool.refresh(false);
    });
    await page.locator('[data-school-action="new-exam"]').click();
    assert.equal(await page.locator('[name="exam_subject"]').inputValue(),'math');
    assert.equal(await page.locator('[name="exam_subject"] option[value="en"]').evaluate(el=>el.disabled),true);
    assert.match(await page.locator('[name="exam_subject"] option[value="en"]').innerText(),/nicht im Abo/);
    assert.equal(await page.locator('[name="exam_subject"] option[value="math"]').evaluate(el=>el.disabled),false);
    if(process.env.VOCI_UI_SCREENSHOTS)await page.screenshot({path:process.env.VOCI_UI_SCREENSHOTS+'/exam-subject-desktop.png',fullPage:true});
    for(const width of [320,390,768,1366]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.ok(await page.locator('#school-dialog .dialog-close').evaluate(el=>el.getBoundingClientRect().height>=44));
      assert.ok(await page.locator('#school-dialog input[name="title"]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
    }
    await page.setViewportSize({width:390,height:844});
    if(process.env.VOCI_UI_SCREENSHOTS)await page.screenshot({path:process.env.VOCI_UI_SCREENSHOTS+'/exam-subject-mobile.png',fullPage:true});
    await page.locator('[data-school-form="exam"] button[type="submit"]').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('[data-school-form="exam"] button[type="submit"]').isVisible(),true);
    await page.keyboard.press('Escape');
    await page.locator('[data-school-action="edit-exam"]').click();
    assert.equal(await page.locator('#exam-objectives').evaluate(el=>el.disabled),true);
    assert.equal(await page.locator('[data-school-form="exam"] button[type="submit"]').evaluate(el=>el.disabled),true);
    await page.locator('[name="exam_subject"]').selectOption('math');
    assert.equal(await page.locator('#exam-objectives').evaluate(el=>el.disabled),false);
    assert.equal(await page.locator('[data-school-form="exam"] button[type="submit"]').evaluate(el=>el.disabled),false);
    await page.keyboard.press('Escape');
    await page.evaluate(async()=>{
      window.__schoolFixture.subscriptions=[{school_id:window.__schoolFixture.school.id,status:'active',period_end:'2099-01-01',subjects:[]}];
      await VociSchool.refresh(false);
    });
    await page.locator('[data-school-action="new-exam"]').click();
    assert.equal(await page.locator('[name="exam_subject"] option:disabled').count(),0);
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1366,height:900});
    if(process.env.VOCI_UI_SCREENSHOTS)await page.screenshot({path:process.env.VOCI_UI_SCREENSHOTS+'/school-desktop.png',fullPage:true});
    await page.locator('[data-school-action="study"]').click();
    await page.getByRole('heading',{name:'Klassenprüfung',exact:true}).waitFor();
    assert.equal(await page.locator('[data-action="share-set"]').isVisible(),false);
    await page.locator('[data-action="start-flash"]').click();
    await page.locator('[data-action="flip-card"]').click();
    await page.locator('[data-action="flash-known"]').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(typeof localStoreKey==='undefined'?'voci-learning-state':localStoreKey)));
    assert.equal(saved.sets.length,0);assert.equal(saved.classProgress['33333333-3333-3333-3333-333333333333'].cards.known.length,1);
    await page.evaluate(async()=>{window.__schoolFixture.classes[0].exams[0].title='Aktualisierte Prüfung';window.__schoolFixture.classes[0].exams[0].updated_at='2030-01-01T00:00:00Z';await VociSchool.refresh(false);});
    assert.equal(await page.evaluate(()=>activeSet().name),'Klassenprüfung','The running round keeps its original content');
    await page.locator('#class-round-update').waitFor({state:'visible'});
    await page.locator('[data-action="dashboard"]').click();
    await page.getByRole('heading',{name:'Aktualisierte Prüfung',exact:true}).waitFor();
    await page.evaluate(async()=>{window.__schoolFixture.classes[0].exams[0].title='Klassenprüfung';await VociSchool.refresh(false);});
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
    const loadedName=await page.evaluate(async()=>{
      const pending=[];const original=supabaseClient.from;
      supabaseClient.from=()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(resolve=>pending.push(resolve))})})});
      const user=currentUser;
      const oldLoad=applySession(user);const newLoad=applySession(user);
      const state=name=>({sets:[{version:2,id:'cloud-test',name,subjectId:'en',blocks:[],examDate:''}],profile:{schoolLevel:'primary'}});
      pending[1]({data:{state:state('Neuer Stand')},error:null});await newLoad;
      pending[0]({data:{state:state('Veralteter Stand')},error:null});await oldLoad;
      supabaseClient.from=original;
      return store.sets[0].name;
    });
    assert.equal(loadedName,'Neuer Stand','A late response from an older session must not replace the latest state');
    const isolation=await page.evaluate(async()=>{
      const first=currentUser;store.sets=[normalizeSet({id:'private',name:'Privater Stand',subjectId:'en',blocks:[]})];persistLocalStore();
      await applySession({id:'other-account',user_metadata:{}});
      const otherNames=store.sets.map(set=>set.name);
      await applySession(null,true);
      const guestNames=store.sets.map(set=>set.name);
      await applySession(first);
      return {otherNames,guestNames,restored:store.sets.map(set=>set.name)};
    });
    assert.deepEqual(isolation,{otherNames:[],guestNames:[],restored:['Privater Stand']});
    const ordering=await page.evaluate(async()=>{
      const original=supabaseClient.from,calls=[],pending=[];
      supabaseClient.from=()=>({upsert:row=>{calls.push(row.state.sets[0].name);return new Promise(resolve=>pending.push(resolve));}});
      store.sets[0].name='Erster Stand';const first=saveCloudStore();
      await new Promise(resolve=>setTimeout(resolve,0));
      store.sets[0].name='Zweiter Stand';const second=saveCloudStore();
      await new Promise(resolve=>setTimeout(resolve,0));
      const simultaneous=calls.length;
      pending.shift()({});await first;await new Promise(resolve=>setTimeout(resolve,0));
      pending.shift()({});await second;supabaseClient.from=original;
      return {simultaneous,calls};
    });
    assert.deepEqual(ordering,{simultaneous:1,calls:['Erster Stand','Zweiter Stand']});
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await server.close();}
});
