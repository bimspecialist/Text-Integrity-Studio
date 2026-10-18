'use strict';
/* V10.2 deterministic browser failure/retry coverage.
 * Only the transport is replaced in this test page. The real app/controller,
 * click handlers, analysis eligibility, language and focus remain active.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const issues=[];
 const shotDir=process.env.TIS_SCREENSHOT_DIR;
 if(shotDir)fs.mkdirSync(shotDir,{recursive:true});
 try{
  for(const lang of ['en','ar']){
   const page=await browser.newPage();
   page.on('pageerror',e=>issues.push(e.message));
   const remote=[];
   page.on('request',req=>{if(new URL(req.url()).hostname!=='127.0.0.1')remote.push(req.url());});
   try{
    await page.evaluateOnNewDocument(()=>{
     const calls=[],cancels=[],listeners=new Set();
     window.__v10TransportProbe={calls,cancels,emit(op,id){
      for(const callback of listeners)callback({op,requestId:id,payload:{code:'MODEL_UNAVAILABLE'}});
     }};
     let wrapped=null;
     Object.defineProperty(window,'TISInferenceBridge',{
      configurable:true,
      get(){return wrapped;},
      set(api){
       wrapped={...api,createInferenceBridge({onEvent}){
        if(onEvent)listeners.add(onEvent);
        return {
         run(snapshot,options,id){
          calls.push({id,chars:snapshot.text.length,sourceKind:snapshot.sourceKind});
          return calls.length>1; // First transport unavailable; retry accepted.
         },
         cancel(id){cancels.push(id);return true;},
         subscribe(handler){listeners.add(handler);return ()=>listeners.delete(handler);},
         dispose(){listeners.clear();}
        };
       }};
      }
     });
    });
    await page.setViewport({width:lang==='ar'?390:1440,height:900});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
    if(lang==='ar')await page.click('#language');
    const text=Array(130).fill('measured').join(' ')+' PRIVATE_RETRY_CANARY';
    await page.$eval('#source',(el,source)=>{el.value=source;el.dispatchEvent(new Event('input',{bubbles:true}));},text);
    await page.focus('#scanAI');
    await page.keyboard.press('Enter'); // Real first click, deterministic bridge rejection
    await page.waitForFunction(()=>window.TISAnalysisApp.controller.getState().status==='ERROR',{timeout:5000});
    const failed=await page.evaluate(()=>({
     status:window.TISAnalysisApp.controller.getState().status,
     code:window.TISAnalysisApp.controller.getState().errorCode,
     screen:document.body.dataset.v10Screen,
     focus:document.activeElement.id,
     value:document.getElementById('source').value,
     calls:window.__v10TransportProbe.calls.length
    }));
    assert.deepEqual({status:failed.status,code:failed.code,screen:failed.screen,focus:failed.focus,calls:failed.calls},
     {status:'ERROR',code:'MODEL_TRANSPORT_BUSY',screen:'error',focus:'tisV10ErrorHeading',calls:1});
    assert.equal(failed.value,text,'Failure may not rewrite source');
    assert.equal(await page.$eval('#tisV10Meter',el=>el.hasAttribute('value')),false);
    if(shotDir)await page.screenshot({path:path.join(shotDir,'v10-2-transport-error-'+lang+'.png'),fullPage:true});

    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10ErrorBack');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'input');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'source');
    assert.equal(await page.$eval('#source',el=>el.value),text);
    await page.focus('#scanAI');await page.keyboard.press('Enter');
    const restarted=await page.evaluate(()=>({
     state:window.TISAnalysisApp.controller.getState(),
     screen:document.body.dataset.v10Screen,
     calls:window.__v10TransportProbe.calls
    }));
    assert.equal(restarted.state.status,'LOADING','User retry should start a fresh controller request');
    assert.equal(restarted.screen,'progress');
    assert.equal(restarted.calls.length,2);
    assert.notEqual(restarted.calls[0].id,restarted.calls[1].id);
    assert.equal(await page.$eval('#tisV10Meter',el=>el.hasAttribute('value')),false,
     'Accepted retry without real progress must remain indeterminate');
    await page.focus('#tisV10Cancel');await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'CANCELLED');
    await page.evaluate(id=>window.__v10TransportProbe.emit('ERROR',id),restarted.calls[1].id);
    assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'CANCELLED',
     'Late transport failure must not revive a cancelled request');
    assert.equal(await page.$eval('#source',el=>el.value),text);
    assert.deepEqual(remote,[],'Synthetic transport must not trigger a real external model request');
    console.log('PASS V10 '+lang.toUpperCase()+' real controller UI: model transport ERROR, visible retry, unique request, cancel and stale-event rejection');
   }finally{await page.close();}
  }
  assert.deepEqual(issues,[],'No browser JavaScript errors');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
