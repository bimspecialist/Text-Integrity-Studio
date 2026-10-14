'use strict';
/* V8.5: Heavy research ONNX inference belongs to AI Detection, not routine
 * Humanize / Writing Editor review. REAL Chromium; simulated model iframe
 * only for opt-in boundary, not model-quality verification.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const english=('The engineering report describes this this construction sequence. '+
 'Its drawings preserve 5 mm, SBC 201, and citation [2]. ').repeat(17);
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const unexpected=[],errors=[];let mockFrames=0;
 try{
  const page=await browser.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  await page.setViewport({width:1365,height:900});
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.pathname.endsWith('/ai-runtime.html')){
    mockFrames++;request.respond({status:200,contentType:'text/html',
     body:'<!doctype html><html><title>intentionally paused research runtime</title></html>'});
   }else if(url.hostname!=='127.0.0.1'){
    unexpected.push(url.origin);request.abort();
   }else request.continue();
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.$eval('#source',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));},english);
  const original=await page.evaluate(()=>window.TISAnalysisApp.session.read());
  assert(original.text.length>300);
  await page.click('#tisTabHumanize');
  await page.click('#scanAI');
  await page.waitForFunction(()=>
   document.getElementById('humanizeSuggestions')?.hidden===false,{timeout:9000});
  let outcome=await page.evaluate(()=>({
   status:window.TISAnalysisApp.controller.getState().status,
   revision:window.TISAnalysisApp.session.read().revision,
   suggestions:document.querySelectorAll('#humanizeSuggestionCards article').length,
   text:document.getElementById('source').value,
   helper:document.getElementById('v5ClickNote').textContent,
   model:!!document.getElementById('tisOnDeviceModel'),
   signal:document.getElementById('studioAiQuickValue').textContent.trim()
  }));
  assert(outcome.suggestions>=1,'Humanize must reveal actual source-grounded advice');
  assert.equal(outcome.model,false,'Humanize must NOT download ONNX detection weights');
  assert.equal(outcome.revision,original.revision,'review is a read-only operation');
  assert.equal(outcome.text,original.text,'Humanize advice must not silently rewrite');
  assert.equal(mockFrames,0,'no iframe started in Humanize mode');
  assert(/local|without.*model/i.test(outcome.helper),
   'User must know Humanize does not trigger research detector');
  assert.equal(outcome.signal,'—','do not synthesize AI percentage during writing review');

  await page.click('#tisTabEditor');
  await page.click('#scanAI');
  assert.equal(mockFrames,0,'Writing Editor also stays local and fast');
  assert.equal(await page.$eval('#source',e=>e.value),original.text);
  assert((await page.$eval('#humanizeReviewStatus',e=>e.textContent)).length>5);

  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  await page.click('#tisTabHumanize');
  await page.click('#scanAI');
  outcome=await page.evaluate(()=>({
   helper:document.getElementById('v5ClickNote').textContent,
   label:document.querySelector('#humanizeSuggestions>summary').textContent,
   note:document.getElementById('tisV8WritingFeedback')?.textContent
  }));
  assert(/[\u0600-\u06ff]/u.test(outcome.helper),
   'mode copy localizes without a reload');
  assert(/[\u0600-\u06ff]/u.test(outcome.label));
  assert(/[\u0600-\u06ff]/u.test(outcome.note||''),
   'review-complete summary should appear inside the draft pane');

  // Only user selection of AI Detection + Analyze can begin the model path.
  await page.click('#tisTabDetection');
  await page.click('#scanAI');
  await page.waitForSelector('#tisOnDeviceModel',{timeout:9000});
  assert.equal(mockFrames,1,'real research model path remains opt-in in Detection');
  // In-flight run must remain cancellable after switching to an editing tab.
  await page.click('#tisTabHumanize');
  await page.click('#scanAI');
  await page.waitForFunction(()=>
   window.TISAnalysisApp.controller.getState().status==='CANCELLED',{timeout:4000});
  assert.equal(mockFrames,1,'cancel must not start another model');
  // The next click resumes lightweight editing rather than restarting the
  // model that was just canceled.
  await page.click('#scanAI');
  assert.equal(mockFrames,1,'Humanize after cancellation must stay local');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),
   'CANCELLED','reviewing locally cannot revive canceled detector evidence');
  assert.deepEqual(unexpected,[],'no external request while model iframe is paused');
  assert.deepEqual(errors,[],'no uncaught errors');
  console.log('PASS V8.5: writing modes are local without ONNX download, metadata-only review, Arabic feedback, Detection still starts model path');
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
