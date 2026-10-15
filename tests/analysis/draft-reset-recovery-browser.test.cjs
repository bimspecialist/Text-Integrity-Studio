'use strict';
/* V8.13: Reset Draft must be recoverable while source revision is unchanged.
 * Browser-only local UI behavior; no simulated detector or cloud service.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  page.on('request',req=>{
   if(new URL(req.url()).hostname!=='127.0.0.1')remote.push(req.url());
  });
  await page.setViewport({width:390,height:844});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.click('#tisTabEditor');
  const original='The report contains the original site observations.';
  const draft='The report records the site observations clearly.';
  const updated='A new technical report has a different scope.';
  async function set(id,text){
   await page.$eval('#'+id,(element,value)=>{
    element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));
   },text);
  }
  await set('source',original);
  const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await set('tisRevisedText',draft);
  assert.equal(await page.$eval('#tisDraftApply',el=>el.disabled),false);
  await page.click('#tisDraftReset');
  assert.equal(await page.$eval('#tisRevisedText',el=>el.value),original);
  assert.match(await page.$eval('#tisDraftReset',el=>el.textContent),/restore/i,
   'the last discarded draft must have a discoverable recovery action');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().revision),revision);
  await page.click('#tisDraftReset');
  assert.equal(await page.$eval('#tisRevisedText',el=>el.value),draft,
   'one-click recovery must restore all previously discarded unsaved text');
  assert.equal(await page.$eval('#source',el=>el.value),original,
   'recovering an unsaved draft does not auto-apply it');
  assert.equal(await page.$eval('#tisDraftApply',el=>el.disabled),false);
  assert.match(await page.$eval('#tisDraftReset',el=>el.textContent),/reset/i);

  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  await page.click('#tisDraftReset');
  assert.match(await page.$eval('#tisDraftReset',el=>el.textContent),/استعاد/u,
   'the recovery affordance must be translated into Arabic');
  await page.click('#tisDraftReset');
  assert.equal(await page.$eval('#tisRevisedText',el=>el.value),draft);

  await page.click('#tisDraftReset'); // Create a recoverable snapshot again.
  await set('source',updated); // A newer canonical source invalidates recovery.
  const state=await page.evaluate(()=>({
   source:document.getElementById('source').value,
   draft:document.getElementById('tisRevisedText').value,
   label:document.getElementById('tisDraftReset').textContent,
   snapshot:window.TISAnalysisApp.session.read()
  }));
  assert.equal(state.snapshot.text,updated);
  assert.equal(state.source,updated);
  assert.equal(state.draft,updated,
   'a pristine draft follows the newest original after source changes');
  assert(!/استعاد/u.test(state.label),'a stale discarded draft cannot be restored');
  await page.click('#tisDraftReset');
  assert.equal(await page.$eval('#tisRevisedText',el=>el.value),updated);
  assert.deepEqual(remote,[],'reset/restore is purely local');
  assert.deepEqual(errors,[],'no browser errors');
  console.log('PASS V8.13 Chromium: recover reset draft, preserve original, bilingual action, invalidate stale recovery');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
