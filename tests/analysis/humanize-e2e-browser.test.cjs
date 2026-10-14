'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const runtime=`<!doctype html><html><body><script>
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.data?.channel!=='TIS_BROWSER_AI_V1'||e.data.op!=='RUN')return;
 const text=e.data.text,requestId=e.data.requestId;
 const unscored=text.includes('INCONCLUSIVE_FIXTURE'),score=text.includes('teh ')?70:64.2;
 window.parent.postMessage({channel:'TIS_TEST_ONLY',op:'COUNT'},location.origin);
 const primary={model_id:'onnx-community/tmr-ai-text-detector-ONNX',
 revision:'b9aa251e5bcda7e429fcc936767d921435945b60',
 score,coverage:unscored?45:100,coverageRawPercent:unscored?45:100,
 segments:[{start:0,end:text.length,words:155,tokens:240,signal:score}]};
 const result={version:'TIS_CONSENSUS_V2_2026_10',primary,secondary:null,models:[primary],
 status:unscored?'INSUFFICIENT_COVERAGE':'SINGLE_UNCALIBRATED_MODEL',
 score:unscored?null:score,flags:[],
 calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
 valid_for_authorship_decisions:false,score_type:'UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY',
 processing:'CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE',
 deepRequested:false,extendedScanRequested:false,language:'en'};
 setTimeout(()=>window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',
 op:'RESULT',requestId,result},location.origin),20);
});
window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:''},location.origin);
</script></body></html>`;
const paragraph=('Engineers recorded the measurement results and reviewed the limitations of each documented test. ').repeat(16);
const text='teh source was measured. '+paragraph;
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage(),errors=[],offsite=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')offsite.push(r.url());});
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().endsWith('/ai-runtime.html')?
   r.respond({status:200,contentType:'text/html',body:runtime}):r.continue());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.evaluate(()=>{window.__fakeModelRuns=0;
   window.addEventListener('message',event=>{
    if(event.data?.channel==='TIS_TEST_ONLY'&&event.data.op==='COUNT')window.__fakeModelRuns++;
   });
  });
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},text);
  await page.click('#scanAI');
  await page.waitForFunction(()=>window.TISAnalysisApp?.controller.getState().status==='RESEARCH_SIGNAL',{timeout:15000});
  assert.equal(await page.evaluate(()=>window.__fakeModelRuns),1);
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'70.0%');
  assert.equal(await page.$eval('#humanizeComparison',e=>e.hidden),true,
   'first scan alone is not a comparison and must not make an authorship claim');
  await page.click('#humanizeSuggestionCards .humanize-apply');
  assert.equal(await page.$eval('#source',e=>e.value.startsWith('the source')),true);
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—');
  await new Promise(ok=>setTimeout(ok,180));
  assert.equal(await page.evaluate(()=>window.__fakeModelRuns),1,'accepted edit must never auto-rescan or run optimization loops');
  assert.equal(await page.$eval('#humanizeComparison',e=>e.hidden),true);
  await page.click('#scanAI');
  await page.waitForFunction(()=>window.TISAnalysisApp?.controller.getState().status==='RESEARCH_SIGNAL'&&window.__fakeModelRuns===2,{timeout:15000});
  await page.waitForFunction(()=>!document.querySelector('#humanizeComparison')?.hidden,{timeout:5000});
  const result=await page.$eval('#humanizeComparison',e=>e.textContent);
  assert.match(result,/uncalibrated research signal/i);
  assert.match(result,/-5\.8/,'signed change in model signal, not percentage human');
  assert.doesNotMatch(result,/more human|authorship probability|bypass/i);

  // Unsupported/conflicting evidence must withhold numerical comparison.
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},
    'teh INCONCLUSIVE_FIXTURE '+paragraph);
  await page.click('#scanAI');
  await page.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='INCONCLUSIVE',{timeout:15000});
  assert.equal(await page.$eval('#humanizeComparison',e=>e.hidden),true,
   'no valid before/after pair survives a new document');
  assert.deepEqual(errors,[]);
  assert.deepEqual(offsite,[]);
  console.log('PASS H4: only manually requested rescans compare uncalibrated research signals; no automatic retry or human percent');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
