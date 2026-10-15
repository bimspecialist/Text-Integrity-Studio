'use strict';
/* V8.12 regression: Undo of an applied revision must never discard a newer
 * unsaved manual draft. Real Chromium, no AI inference or fixture model.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const original='teh report was recieved at the engineering site.';
const first='the report was recieved at the engineering site.';
const second='the report was received at the engineering site.';
const pending='The report was received at the engineering office.';
async function main(){
 const server=serve();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],external=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{
   if(new URL(req.url()).hostname!=='127.0.0.1')external.push(req.url());
  });
  await page.setViewport({width:1150,height:730});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.click('#tisTabEditor');
  const edit=async(id,value)=>page.$eval('#'+id,(el,v)=>{
   el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
  await edit('source',original);
  for(const text of [first,second]){
   await edit('tisRevisedText',text);
   assert.equal(await page.$eval('#tisDraftApply',e=>e.disabled),false,
    'unprotected edited draft should allow deliberate Apply');
   await page.click('#tisDraftApply');
   assert.equal(await page.$eval('#source',e=>e.value),text);
  }
  const base=await page.evaluate(()=>window.TISAnalysisApp.session.read());
  await edit('tisRevisedText',pending);
  assert.equal(await page.$eval('#tisDraftUndo',e=>e.disabled),true,
   'Undo must be unavailable while a newer unsaved draft exists');
  assert.match(await page.$eval('#tisDraftStatus',e=>e.textContent),/draft|unsaved|المسودة/i);
  // A scripted event should not bypass the UI-level protection.
  await page.$eval('#tisDraftUndo',e=>e.dispatchEvent(new Event('click',{bubbles:true})));
  let state=await page.evaluate(()=>({
   source:document.getElementById('source').value,
   draft:document.getElementById('tisRevisedText').value,
   revision:window.TISAnalysisApp.session.read().revision
  }));
  assert.equal(state.source,second);
  assert.equal(state.draft,pending);
  assert.equal(state.revision,base.revision);
  await page.click('#language');
  assert.match(await page.$eval('#tisDraftStatus',e=>e.textContent),/[\u0600-\u06ff]/u);
  assert.equal(await page.$eval('#tisDraftUndo',e=>e.disabled),true);
  await page.click('#tisDraftReset');
  assert.equal(await page.$eval('#tisRevisedText',e=>e.value),second);
  assert.equal(await page.$eval('#tisDraftUndo',e=>e.disabled),false,
   'Undo restores availability after user explicitly discards unsaved draft');
  await page.click('#tisDraftUndo');
  assert.equal(await page.$eval('#source',e=>e.value),first);
  assert.equal(await page.$eval('#tisDraftUndo',e=>e.disabled),false,
   'multiple applied revisions remain independently undoable');
  await page.click('#tisDraftUndo');
  assert.equal(await page.$eval('#source',e=>e.value),original);
  assert.equal(await page.$eval('#tisDraftUndo',e=>e.disabled),true);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),original);
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—',
   'no old AI score becomes valid after undo');
  assert.deepEqual(external,[],'review/apply/reset/undo stays offline');
  assert.deepEqual(errors,[],'no runtime exception');
  console.log('PASS V8.12 Chromium: unsaved draft blocks destructive undo, Arabic state, explicit reset and two-step revision history');
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
