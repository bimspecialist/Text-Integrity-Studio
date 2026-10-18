'use strict';
/* UI fixture only: displays a supplied already-validated research contract
 * value; this does not assert actual model accuracy or make up real results.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  for(const lang of ['en','ar']){
   const p=await browser.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
    if(lang==='ar')await p.click('#language');
    await p.$eval('#source',el=>{el.value='An eligible fixture must never be mistaken for a real reading.';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const state=await p.evaluate(()=>{
     const original=window.TISAnalysisApp;
     const snap=original.session.read();
     const frame={status:'RESEARCH_SIGNAL',requestId:'fixture-ui-only',
      revision:snap.revision,signal:73.27,
      evidence:{kind:'RESEARCH_SIGNAL',revision:snap.revision,signal:73.27,
       documentCoverageWordsPercent:84.64,segments:[]}};
     window.TISWorkspaceV11.dispose();
     const fakeApp={...original,controller:{getState:()=>window.__v11DisplayFixture}};
     window.__v11DisplayFixture=frame;
     window.__v11DisplayTest=window.TISWorkspaceV11.mount({doc:document,win:window,app:fakeApp});
     window.TISWorkspaceV10.setAnalysisState(frame);
     return {revision:snap.revision,defaultSignal:window.TISWorkspaceV11.researchDisplay(frame,snap.revision)};
    });
    assert.equal(state.defaultSignal.measured,true);
    await p.waitForFunction(()=>document.querySelector('#tisV11SignalValue')?.textContent==='73.3%',{timeout:3000});
    assert.equal(await p.$eval('#tisV11SignalCard',e=>e.hidden),false);
    assert.match(await p.$eval('#tisV11SignalCoverage',e=>e.textContent),/84\.6%/);
    const disclaimer=await p.$eval('#tisV11SignalWarning',e=>e.textContent);
    assert.match(disclaimer,lang==='ar'?/غير معايرة/:/uncalibrated/i);
    assert.match(disclaimer,lang==='ar'?/ليست نسبة/:/NOT the percentage/i);
    await p.evaluate(()=>{
     const previous=window.__v11DisplayFixture;
     window.__v11DisplayFixture={...previous,status:'INCONCLUSIVE',signal:null,
      evidence:{...previous.evidence,kind:'INCONCLUSIVE',signal:null}};
     document.body.dataset.v10Screen='progress';
     window.TISWorkspaceV10.setAnalysisState(window.__v11DisplayFixture);
    });
    await p.waitForFunction(()=>document.querySelector('#tisV11SignalValue')?.textContent==='—',{timeout:3000});
    assert.match(await p.$eval('#tisV11SignalCoverage',e=>e.textContent),
     lang==='ar'?/لا تسمح/:/No reliable/i);
    assert.deepEqual(errors,[]);
    console.log('PASS V11 model-signal presentation UI '+lang+': source-matched synthetic fixture 73.3%, 84.6% coverage, no false score when INCONCLUSIVE');
   }finally{await p.close()}
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
