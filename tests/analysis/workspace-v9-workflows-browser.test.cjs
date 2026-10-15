'use strict';
/* V9 browser: one controller, source revisions, no model download on local writing review. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[],broken=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  page.on('response',r=>{if(r.status()>=400)broken.push(r.url()+' '+r.status());});
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const view=await page.evaluate(()=>({
   state:document.getElementById('tisV9Summary')?.dataset.state,
   hasView:typeof window.TISWorkspaceV9?.setAnalysisState==='function',
   controller:typeof window.TISAnalysisApp?.controller?.getState==='function',
   sidebars:document.querySelectorAll('aside.app-sidebar').length,
   localRewriteDisabled:document.getElementById('tisLocalRewrite').disabled
  }));
  assert.equal(view.state,'EMPTY');assert(view.hasView&&view.controller);
  assert.equal(view.sidebars,0);assert.equal(view.localRewriteDisabled,true);
  const input='The engineering report records technical observations and existing project requirements.';
  await page.$eval('#source',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},input);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),input);
  await page.click('#scanAI');
  await page.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='WRITING_ONLY',{timeout:10000});
  const reviewed=await page.$eval('#tisV9Summary',el=>({state:el.dataset.state,text:el.textContent}));
  assert.equal(reviewed.state,'WRITING_ONLY');assert(/writing|model|كتابة|نموذج/i.test(reviewed.text));
  await page.$eval('#source',el=>{el.value+=' Changed.';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#tisV9Summary',el=>el.dataset.state),'STALE');
  await page.click('#tisTabHumanize');
  await page.$eval('#tisRevisedText',el=>{el.value+=' User reviewed revision.';el.dispatchEvent(new Event('input',{bubbles:true}));});
  const unsaved=await page.$eval('#tisRevisedText',el=>el.value);
  await page.click('#tisTabEditor');await page.click('#tisTabHumanize');
  assert.equal(await page.$eval('#tisRevisedText',el=>el.value),unsaved,'mode round-trip preserves unsaved draft');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),input+' Changed.');
  // V9 protects academic references, engineering units and URLs in unsaved local drafts.
  const engineering='The slab test measured 25 kPa [12]. See https://example.org/report for details.';
  await page.$eval('#source',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));},engineering);
  await page.click('#tisDraftReset');
  await page.$eval('#tisRevisedText',el=>{el.value='The slab test measured 35 kPa [12]. See https://example.org/report for details.';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#tisDraftApply',el=>el.disabled),true,'protected measurement change cannot Apply');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),engineering,'source unchanged by rejected edit');
  const protectedDraft=await page.$eval('#tisRevisedText',el=>el.value);
  await page.click('#tisTabDetection');await page.click('#tisTabEditor');
  assert.equal(await page.$eval('#tisRevisedText',el=>el.value),protectedDraft,'unsaved protected draft survives mode switches');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  assert(/[\u0600-\u06ff]/u.test(await page.$eval('#tisV9Summary',el=>el.textContent)),'V9 feedback translates to Arabic');
  await page.setViewport({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert(overflow<=8,'RTL phone avoids page overflow: '+overflow);
  assert.deepEqual(remote,[],'no user text or external model requests during local review');
  assert.deepEqual(broken,[],'all assets resolved');assert.deepEqual(errors,[],'no runtime errors');
  console.log('PASS V9 Chromium: source revisions, one analysis, stale evidence, safe unsaved draft, Arabic mobile and privacy');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
