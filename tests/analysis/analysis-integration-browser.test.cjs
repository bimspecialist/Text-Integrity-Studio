'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const runtime=`<!doctype html><html><body><script>
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.channel!=='TIS_BROWSER_AI_V1'||event.data?.op!=='RUN')return;
 const data=event.data,id=data.requestId,text=data.text;
 if(text.includes('MODEL_NETWORK_FAIL')){
  window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'ERROR',requestId:id,code:'MODEL_UNAVAILABLE'},location.origin);return;
 }
 const primary={model_id:'onnx-community/tmr-ai-text-detector-ONNX',
  revision:text.includes('BAD_REVISION')?'wrong-checkpoint':'b9aa251e5bcda7e429fcc936767d921435945b60',
  score:64.2,coverage:100,coverageRawPercent:100,sampleCount:1,wordsAnalyzed:140,
  consistency:'CONSISTENT_PASSAGES',dispersion:0.01,
  segments:[{start:0,end:text.length,signal:64.2,words:140,tokens:200}]};
 const result={version:'TIS_CONSENSUS_V2_2026_10',primary,secondary:null,models:[primary],
  status:'SINGLE_UNCALIBRATED_MODEL',score:64.2,flags:[],
  calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
  score_type:'UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY',
  processing:'CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE',
  valid_for_authorship_decisions:false,deepRequested:false,extendedScanRequested:false,
  language:'en'};
 window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'PROGRESS',requestId:id,
  stage:'ANALYZING',percent:60},location.origin);
 setTimeout(()=>window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'RESULT',
  requestId:id,result},location.origin),text.includes('LATE_RESULT')?250:0);
});
window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:''},location.origin);
</script></body></html>`;
const english=('Students measured and recorded engineering outcomes with limitations described in the project report. ').repeat(17);

async function run(){
 const server=serve();await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',req=>req.url().endsWith('/ai-runtime.html')?
   req.respond({status:200,contentType:'text/html',body:runtime}):req.continue());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>typeof window.TISAnalysisApp?.controller?.getState==='function'),true,
   'One app adapter owns the lifecycle, not legacy UI listeners');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'optional model loads on user action only');
  for(const id of ['source','scanAI','aiEvidence','studioAiQuickValue','v5BreakdownRows','file','pdfPick','wordPick'])
   assert(await page.$('#'+id),'preserve existing Word/PDF/editor UI: '+id);
  const arabic=Array(135).fill('راجع الباحث قياسات المبنى ونتائج التجربة').join(' ');
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},arabic);
  await page.click('#scanAI');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'unsupported Arabic must never trigger English model');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'UNSUPPORTED');
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—');
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},english);
  await page.click('#scanAI');
  await page.waitForSelector('#tisOnDeviceModel');
  await page.waitForFunction(()=>document.getElementById('studioAiQuickValue')?.textContent.trim()==='64.2%',{timeout:15000});
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'RESEARCH_SIGNAL');
  assert.match(await page.$eval('#v5BreakdownRows',e=>e.textContent),/64\.2/);
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},
   'LATE_RESULT '+english);
  await page.click('#scanAI');
  const before=await page.evaluate(()=>document.getElementById('source').value.length);
  await page.$eval('#source',e=>{e.value=e.value.replace('measured','recorded');
   e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>document.getElementById('source').value.length),before,
   'same-length edit must still increment session revision');
  await new Promise(done=>setTimeout(done,400));
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'STALE');
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—',
   'late score must not survive document edit');
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},
   'BAD_REVISION '+english);
  await page.click('#scanAI');
  await page.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='ERROR',{timeout:15000});
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—');
  assert.match(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().errorCode),/EVIDENCE/);
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},
   'LATE_RESULT '+english);
  await page.click('#scanAI');
  await page.click('#scanAI');
  await new Promise(done=>setTimeout(done,350));
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'CANCELLED');
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—');
  assert.deepEqual(errors,[],'no browser runtime errors in real UI wiring');
  console.log('PASS R8 unified Analyze Text lifecycle, old-response races, strict revisions and Arabic writing-only fallback');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
}
run().catch(err=>{console.error(err);process.exitCode=1;});
