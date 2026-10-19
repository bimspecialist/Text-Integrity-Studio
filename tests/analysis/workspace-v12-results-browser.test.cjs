'use strict';
/* Actual V12 DOM, controller, transport and evidence validator. Only the iframe
 * model is a synthetic test fixture. Its numbers are NOT inference or accuracy
 * measurements and must never be published as real detector results. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const EN=('The engineering team measured the columns and reviewed the site records. '+
 'The report was recieved with a concrete strength of 25 MPa [12]. ').repeat(7).trim();
const AR='\u0647\u0627\u0630\u0627 \u062a\u0642\u0631\u064a\u0631 \u0644\u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0644\u0627\u0643\u0646 \u0628\u062f\u0648\u0646 \u062a\u063a\u064a\u064a\u0631 25 MPa [12].';
const runtime=`<!doctype html><html><title>SYNTHETIC V12 transport test only</title><script>
'use strict';
const channel='TIS_BROWSER_AI_V1';
function send(op,extra={}){parent.postMessage({channel,op,requestId:window.fixtureRun?.requestId||'',...extra},location.origin)}
window.completeFixture=kind=>{
 const run=window.fixtureRun;if(!run)throw Error('TEST_RUN_NOT_RECEIVED');
 if(kind==='error'){send('ERROR',{code:'MODEL_UNAVAILABLE'});return;}
 const text=run.text,words=Array.from(text.matchAll(/\\S+/gu));
 const split=words[Math.floor(words.length/2)].index;
 const segment=(start,end)=>({start,end,signal:64.2,words:text.slice(start,end).trim().split(/\\s+/u).length,tokens:200});
 const segments=[segment(0,split)];
 if(kind!=='inconclusive')segments.push(segment(split,text.length));
 const count=segments.reduce((sum,s)=>sum+s.words,0),coverage=100*count/words.length;
 const primary={model_id:'onnx-community/tmr-ai-text-detector-ONNX',
  revision:kind==='invalid'?'untrusted-test-revision':'b9aa251e5bcda7e429fcc936767d921435945b60',
  score:64.2,coverage,coverageRawPercent:coverage,segments,sampleCount:segments.length,
  wordsAnalyzed:count,consistency:'CONSISTENT_PASSAGES',dispersion:0};
 const result={version:'TIS_CONSENSUS_V2_2026_10',primary,secondary:null,models:[primary],
  status:kind==='inconclusive'?'INSUFFICIENT_COVERAGE':'SINGLE_UNCALIBRATED_MODEL',
  score:kind==='inconclusive'?null:64.2,flags:kind==='inconclusive'?['LOW_DOCUMENT_COVERAGE']:[],
  calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
  score_type:'UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY',
  processing:'CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE',valid_for_authorship_decisions:false,
  deepRequested:run.deep===true,extendedScanRequested:run.full===true,language:'en'};
 send('PROGRESS',{stage:'ANALYZING',percent:100});send('RESULT',{result});
};
addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.channel!==channel||event.data.op!=='RUN')return;
 window.fixtureRun=event.data;send('PROGRESS',{stage:'DOWNLOADING',percent:42,model:'primary'});
});
send('READY');
</script></html>`;
async function insert(p,text){await p.$eval('#source',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},text)}
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const base='http://127.0.0.1:'+server.address().port+'/',failures=[];
 async function check(name,body){
  const p=await browser.newPage(),errors=[],external=[];let starts=0;
  p.on('pageerror',e=>errors.push(e.message));
  await p.setRequestInterception(true);
  p.on('request',r=>{
   const u=new URL(r.url());
   if(u.origin!==new URL(base).origin)external.push(u.origin);
   if(u.pathname.endsWith('/ai-runtime.html')){starts++;return r.respond({status:200,contentType:'text/html',body:runtime})}
   return r.continue();
  });
  try{
   await p.setViewport({width:name.includes(' AR')?390:1440,height:900});
   await p.goto(base+'?v12preview=1',{waitUntil:'load'});
   if(name.includes(' AR'))await p.click('#language');
   await body(p,()=>starts);
   assert.deepEqual(errors,[],'No page errors');assert.deepEqual(external,[],'Fixture journeys never call external inference');
   console.log('PASS '+name);
  }catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+': '+e.stack)}
  finally{await p.close()}
 }
 async function start(p){
  await p.click('#tisV12Scan');
  await p.waitForFunction(()=>document.getElementById('tisV10Meter').value===42&&document.body.dataset.v10Screen==='progress');
  const frame=p.frames().find(f=>new URL(f.url()||base).pathname.endsWith('/ai-runtime.html'));
  assert(frame,'Explicit scan creates a real same-origin fixture iframe');
  await frame.waitForFunction(()=>!!window.fixtureRun);return frame;
 }
 async function backState(p){return p.$eval('#tisV12BackToModel',el=>el.disabled)}
 try{
  for(const lang of ['EN','AR']){
   await check('V12 writing-only '+lang,async(p,starts)=>{
    await insert(p,lang==='AR'?AR:EN);await p.click('#tisV12Write');
    assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
    assert.equal(await backState(p),true,'NO_CURRENT_RESULT: return action must be disabled without model evidence');
    await p.$eval('#tisV12BackToModel',el=>el.click());
    assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
    assert.equal(starts(),0,'Local writing must not initialize the model');
    await p.click('#tisV11Improve');
    await p.waitForFunction(()=>!!document.querySelector('#tisV12TipsDock #tisV11GuidedReview'));
    assert.equal(await backState(p),true,'No-result return action stays disabled inside Refine');
   });
   for(const kind of ['signal','inconclusive'])await check('V12 completed '+kind+' '+lang,async(p,starts)=>{
    await insert(p,EN);const frame=await start(p);
    assert.equal(await backState(p),true,'RUNNING_RESULT: return action is unavailable during scan');
    await frame.evaluate(value=>window.completeFixture(value),kind);
    const expected=kind==='signal'?'RESEARCH_SIGNAL':'INCONCLUSIVE';
    await p.waitForFunction(status=>window.TISAnalysisApp.controller.getState().status===status,{},expected);
    await p.waitForFunction(value=>document.getElementById('tisV11SignalValue').textContent===value,{},kind==='signal'?'64.2%':'\u2014');
    const result=await p.evaluate(()=>({state:window.TISAnalysisApp.controller.getState(),
     spans:Array.from(document.querySelectorAll('.tis-v10-highlight'),el=>({start:+el.dataset.start,end:+el.dataset.end,text:el.textContent})),
     source:document.getElementById('source').value}));
    assert.equal(result.source,EN);assert.equal(result.state.signal,kind==='signal'?64.2:null);
    if(kind==='signal'){
     assert.equal(result.spans.length,2,'Validated fixture produces both expected windows');
     for(const span of result.spans)assert.equal(span.text,EN.slice(span.start,span.end),'Exact source offsets preserved');
     await p.click('.tis-v10-highlight');
     const excerpt=await p.$eval(lang==='AR'?'#tisV10DialogText':'#tisV10InspectorText',el=>el.textContent);
     assert.equal(excerpt,result.spans[0].text,'Passage explanation shows the selected source range');
     if(lang==='AR')await p.click('#tisV10CloseDialog');
    }else assert.equal(result.spans.length,0,'Existing fail-closed policy: no highlights for INCONCLUSIVE');
    await p.click('#tisV12Tips');
    await p.waitForFunction(()=>document.body.dataset.v10Screen==='guided-review');
    assert.equal(await backState(p),false,'CURRENT_RESULT: return is available for same-revision result, including INCONCLUSIVE');
    await p.focus('#tisV12BackToModel');await p.keyboard.press('Enter');
    await p.waitForFunction(()=>document.body.dataset.v10Screen==='results');
    assert.equal(await p.evaluate(()=>document.activeElement.id),'tisV10ResultHeading','Return restores result heading focus');
    assert.equal(starts(),1,'Navigating results must not rerun or redownload the model');
    await p.click('#tisV12Tips');
    const prior=await p.evaluate(()=>window.TISAnalysisApp.session.read().revision);
    await insert(p,EN.replace('measured','recorded'));
    assert.equal(EN.length,EN.replace('measured','recorded').length);
    await p.waitForFunction(()=>document.getElementById('tisV12BackToModel').disabled);
    assert.equal(await p.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'STALE');
    assert((await p.evaluate(()=>window.TISAnalysisApp.session.read().revision))>prior);
    assert.equal((await p.$$('.tis-v10-highlight')).length,0,'Stale highlights removed from DOM');
    await p.click('#tisV12Write');
    assert.equal(await backState(p),true,'STALE_RESULT: writing cannot revive stale evidence');
   });
  }
  await check('V12 error retry cancellation and rejected evidence EN',async(p,starts)=>{
   await insert(p,EN);let frame=await start(p);await frame.evaluate(()=>window.completeFixture('error'));
   await p.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='ERROR');
   assert.equal(await backState(p),true);assert.equal(await p.$eval('#source',el=>el.value),EN);
   await p.click('#tisV10ErrorBack');frame=await start(p);await frame.evaluate(()=>window.completeFixture('invalid'));
   await p.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='ERROR');
   assert.match(await p.evaluate(()=>window.TISAnalysisApp.controller.getState().errorCode),/INVALID_EVIDENCE/);
   assert.equal(await backState(p),true);
   await p.click('#tisV10ErrorBack');await start(p);await p.click('#tisV10Cancel');
   assert.equal(await p.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'CANCELLED');
   assert.equal(await backState(p),true);assert.equal(await p.$eval('#source',el=>el.value),EN);
   frame=await start(p);await frame.evaluate(()=>window.completeFixture('signal'));
   await p.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='RESEARCH_SIGNAL');
   assert.equal(starts(),4,'Error/cancel discard failed runtime and allow new explicit scans');
  });
  if(failures.length)throw Error(failures.join('\n'));
  console.log('PASS V12 result lifecycle: synthetic transport only, NOT classifier accuracy');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
