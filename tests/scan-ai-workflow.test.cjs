'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');
const fixture=[
 '<!doctype html><html><body><script>',
 "window.addEventListener('message',e=>{",
 "if(e.origin!==location.origin||e.data?.op!=='RUN')return;",
 'const id=e.data.requestId;',
 "if(e.data.text.includes('MODEL_NETWORK_FAIL')){",
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'ERROR',requestId:id,code:'MODEL_UNAVAILABLE'},location.origin);return;}",
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'PROGRESS',requestId:id,stage:'DOWNLOADING',percent:42,model:'primary'},location.origin);",
 "const primary={model_id:'onnx-community/tmr-ai-text-detector-ONNX',revision:'b9aa251e5bcda7e429fcc936767d921435945b60',score:64.2,coverage:96,coverageRawPercent:96,",
 "segments:[{start:0,end:80,signal:64.2,words:15,tokens:26}],sampleCount:1,consistency:'CONSISTENT_PASSAGES'};",
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'RESULT',requestId:id,",
 "result:{version:'TIS_CONSENSUS_V2_2026_10',primary,secondary:null,models:[primary],score:64.2,",
 "status:'SINGLE_UNCALIBRATED_MODEL',flags:[],calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',"+
 "valid_for_authorship_decisions:false,score_type:'UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY',"+
 "processing:'CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE',deepRequested:false,extendedScanRequested:false,language:'en'}},location.origin);});",
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:''},location.origin);",
 '</script></body></html>'
].join('');
async function run(){
 const server=serve();await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[];
 try{
  const page=await browser.newPage();await page.setViewport({width:1365,height:910});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().endsWith('/ai-runtime.html')
   ?r.respond({status:200,contentType:'text/html',body:fixture}):r.continue());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#scanAI',{visible:true});
  assert.equal(await page.$eval('.hero',n=>getComputedStyle(n).display),'none',
   'The huge welcome hero is replaced by a focused document editor');
  assert.equal(await page.$eval('.steps',n=>getComputedStyle(n).display),'none',
   'No distracting numbered wizard strip on top of the editor');
  assert.equal(await page.$eval('#aiDetectorTechnical',n=>n.open),false,
   'Long model comparison and warnings are behind an optional details section');
  const short='This human test is too short to meet the research model contract.';
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},short);
  await page.click('#scanAI');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'Short text cannot download the model');
  assert.match(await page.$eval('#studioAiQuickStatus',n=>n.textContent),/120/,
   'The main result card explains how many words are required');
  const arabic=('ناقش الباحث قراءات التجربة ونتائج القياس والتغييرات التي لاحظها فريق العمل. ').repeat(20);
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},arabic);
  await page.click('#scanAI');
  assert.match(await page.$eval('#studioAiQuickStatus',n=>n.textContent),/English|Arabic/i,
   'Arabic input reports the unsupported language in the main result area');
  assert.equal(await page.$('#tisOnDeviceModel'),null);
  const english=('This engineering report reviews the known measurements and records the limitations of the test setup. ').repeat(18);
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},english);
  await page.click('#scanAI');
  await page.waitForSelector('#tisOnDeviceModel');
  await page.waitForFunction(()=>document.getElementById('studioAiQuickValue')?.textContent.trim()==='64.2%',{timeout:10000});
  assert.equal(await page.$eval('#aiMeterScore',n=>n.textContent.trim().startsWith('64.2%')),true);
  assert.equal(await page.$eval('#aiDetectorTechnical',n=>n.open),false,
   'The full research view does not overwhelm first-time visitors after a scan');
  await page.click('#aiDetectorTechnical > summary');
  assert.equal(await page.$eval('#aiEvidence',n=>n.hidden),false);
  await page.$eval('#source',n=>{n.value+=' Updated.';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.getElementById('studioAiQuickValue')?.textContent.trim()==='—');
  const failed='MODEL_NETWORK_FAIL '+english;
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},failed);
  await page.click('#scanAI');
  await page.waitForFunction(()=>/retry|network|connection|download|حاول/i.test(document.getElementById('studioAiQuickStatus')?.textContent||''),{timeout:10000});
  assert.equal(await page.$eval('#scanAI',n=>n.disabled),false,'Failed requests remain retryable');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  assert((await page.$eval('#scanAI',n=>n.textContent)).includes('AI'),'Main AI action stays discoverable in Arabic');
  await page.setViewport({width:390,height:844});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,'Mobile RTL has no horizontal overflow');
  assert.deepEqual(errors,[],'No runtime errors');
  console.log('PASS: primary AI control, opt-in model, error recovery, language validation, compact editor, advanced details and RTL');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
