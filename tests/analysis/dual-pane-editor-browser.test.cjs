'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function run(){
 const server=serve();
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage(),errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{
   const u=new URL(req.url());
   if(u.hostname!=='127.0.0.1')remote.push({method:req.method(),url:req.url()});
  });
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>typeof window.TISDualPaneEditor?.mount),'function');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp?.dualEditor?.getState().mode),'detection');
  assert.deepEqual(await page.$$eval('.tis-mode-tab',nodes=>nodes.map(x=>x.textContent.trim())),
   ['AI Detection','Improve Writing','Writing Editor']);
  assert.equal(await page.$$eval('#scanAI',nodes=>nodes.length),1);
  assert.equal(await page.$eval('#tisRevisedPane',n=>getComputedStyle(n).display),'none',
   'detection retains prominent existing model results, not a second analyze');
  assert.equal(await page.$eval('#aiDetectorTechnical',n=>n.open),false);

  await page.click('#tisTabHumanize');
  assert.equal(await page.$eval('#tisTabHumanize',n=>n.getAttribute('aria-selected')),'true');
  assert.equal(await page.$eval('#tisRevisedPane',n=>getComputedStyle(n).display==='none'),false);
  assert.equal(await page.$eval('#tisLocalRewrite',n=>n.disabled),true,
   'real local generator remains disabled without independent model verification');
  assert.match(await page.$eval('#tisGeneratorNotice',n=>n.textContent),/not (yet )?available|unavailable|verified/i);
  assert.equal(await page.$('#tisOnDeviceModel'),null,'tab switch never downloads a model');

  const text='teh report was recieved at the engineering site.';
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},text);
  assert.equal(await page.$eval('#tisRevisedText',n=>n.value),text,'initial revised draft is a local copy');
  assert.equal(await page.$eval('#tisDraftApply',n=>n.disabled),true,'no change is not an edit');
  await page.click('#scanAI');
  await page.waitForFunction(()=>document.querySelectorAll('#humanizeSuggestionCards .humanize-card').length>0,
   {timeout:10000});
  await page.click('#humanizeSuggestionCards .humanize-preview');
  assert.match(await page.$eval('#tisRevisedText',n=>n.value),/\bthe report\b/,
   'reviewing a suggestion previews proposed wording in the second pane');
  assert.equal(await page.$eval('#source',n=>n.value),text,'preview never applies itself');
  await page.click('#tisDraftApply');
  assert.match(await page.$eval('#source',n=>n.value),/^the report/);
  assert.equal(await page.$eval('#studioAiQuickValue',n=>n.textContent.trim()),'—');
  await page.click('#tisDraftUndo');
  assert.equal(await page.$eval('#source',n=>n.value),text,'undo restores full previous snapshot');

  // Hand-edited draft is independent of source; equal-length source changes invalidate it.
  await page.click('#tisTabEditor');
  assert.equal(await page.$eval('#studioReview',n=>getComputedStyle(n).display==='none'),false);
  await page.$eval('#tisRevisedText',n=>{n.value='This is a manually revised draft.';n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#source',n=>n.value),text);
  await page.$eval('#source',n=>{n.value=n.value.replace('site','room');n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#tisDraftApply',n=>n.disabled),true,'stale edits may not be applied');
  assert.match(await page.$eval('#tisDraftStatus',n=>n.textContent),/changed|stale|تغيّر/i);
  await page.click('#tisDraftReset');
  assert.equal(await page.$eval('#tisRevisedText',n=>n.value),
   await page.$eval('#source',n=>n.value),'reset explicitly reloads latest revision');

  // Changing a protected technical value is never accepted automatically.
  await page.$eval('#source',n=>{n.value='The load was 240 V in 2024 [12].';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.$eval('#tisRevisedText',n=>{n.value='The load was 250 V in 2024 [12].';n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#tisDraftApply',n=>n.disabled),true);
  assert.equal(await page.$eval('#source',n=>n.value),'The load was 240 V in 2024 [12].');

  // Import format metadata is preserved. Export remains available independently.
  await page.evaluate(()=>{
   const src=document.getElementById('source');
   src.value='Original DOCX source 240 V [12].';
   window.TISAnalysisApp.session.replaceText(src.value,'docx');
   src.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.$eval('#tisRevisedText',n=>{n.value='An alternate Word draft 240 V [12].';n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#tisDraftApply',n=>n.disabled),true);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().sourceKind),'docx');
  for(const id of ['file','pdfPick','wordPick','v5Toolbox','studioExportTop','aiEvidence'])
   assert(await page.$('#'+id),'legacy document workflow intact: '+id);

  // Keyboard tab navigation and bilingual layout, both viewport and focus order.
  await page.focus('#tisTabEditor');
  await page.keyboard.press('Home');
  assert.equal(await page.$eval('#tisTabDetection',n=>n.getAttribute('aria-selected')),'true');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  await page.click('#tisTabHumanize');
  assert.match(await page.$eval('#tisDraftApply',n=>n.textContent),/تطبيق/);
  await page.setViewport({width:390,height:844});
  const mobile=await page.evaluate(()=>{
   const input=document.getElementById('inputPanel').getBoundingClientRect();
   const output=document.getElementById('tisRevisedPane').getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth-innerWidth,
    sourceBottom:input.bottom,outputTop:output.top,
    outputWidth:output.width,viewport:innerWidth};
  });
  assert(mobile.overflow<=8,'no horizontal overflow at 390px Arabic RTL');
  assert(mobile.sourceBottom<=mobile.outputTop+6,'source stacked before revised text on phone');
  assert(mobile.outputWidth<=mobile.viewport,'revised pane fits phone');
  await page.$eval('#tisRevisedText',n=>{n.value='تجربة محلية 240 V [12].';n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#source',n=>n.value),'Original DOCX source 240 V [12].');
  assert.equal(await page.$('#tisOnDeviceModel'),null);
  assert.deepEqual(remote,[],'no cloud model or external source-text requests');
  assert.deepEqual(errors,[],'no browser exceptions during interactive dual-pane review');
  console.log('PASS L7: 3 modes, bilingual dual pane, explicit preview/apply/undo, revision/fact/DOCX guards, 390px RTL and privacy');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
