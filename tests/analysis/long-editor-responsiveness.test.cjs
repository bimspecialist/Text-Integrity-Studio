'use strict';
/* V8.3 nonblocking long-document local editing.
 * Measured on real headless Chromium. Synthetic text only, NO model weights.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',err=>errors.push(err.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const documentA=Array(20000).fill('check').join(' ');
  const documentB=Array(19980).fill('label').join(' ');
  const events=[];
  for(const value of [documentA,documentB]){
   events.push(await page.evaluate(text=>{
    const editor=document.getElementById('source');
    const start=performance.now();
    editor.value=text;
    editor.dispatchEvent(new Event('input',{bubbles:true}));
    return {ms:performance.now()-start,
     label:document.getElementById('checkedLabel').textContent,
     canonical:window.TISAnalysisApp.session.read().text===editor.value,
     revision:window.TISAnalysisApp.session.read().revision};
   },value));
  }
  assert(events.every(x=>x.canonical),'long typed source immediately updates immutable session');
  assert(events[1].revision>events[0].revision,'old source revision is not reused');
  assert(events.every(x=>/updating|تحديث/i.test(x.label)),
   'expensive 20k-word audit must be deferred instead of blocking every keystroke');
  await page.waitForFunction(()=>document.getElementById('words').textContent==='19980',
   {timeout:15000});
  assert.equal(await page.$eval('#chars',e=>Number(e.textContent)),documentB.length);
  // Last edit wins. A delayed stale audit must never overwrite a newer short edit.
  const short='Three reliable words.';
  await page.$eval('#source',(element,text)=>{
   element.value=text;element.dispatchEvent(new Event('input',{bubbles:true}));
  },short);
  assert.equal(await page.$eval('#words',n=>n.textContent),'3');
  await new Promise(ok=>setTimeout(ok,350));
  assert.equal(await page.$eval('#words',n=>n.textContent),'3');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),short);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'STALE');
  assert.deepEqual(remote,[],'local writing audits never initiate model downloads');
  assert.deepEqual(errors,[],'long editor input must not crash browser');
  console.log(JSON.stringify({
   status:'V8_3_EDITOR_DEFERRED_NOT_MODEL_PERFORMANCE',
   longWords:20000,observedDispatchMs:events.map(e=>Number(e.ms.toFixed(2))),
   newestDocumentWords:3,chromeVersion:await browser.version(),remoteRequests:remote.length
  }));
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
