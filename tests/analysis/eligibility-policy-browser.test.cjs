'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function run(){
 const server=serve();
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  // Never download large models in a fast eligibility-contract UI regression.
  await page.setRequestInterception(true);
  page.on('request',req=>req.url().endsWith('/ai-runtime.html')?
   req.respond({status:200,contentType:'text/html',body:'<!doctype html><title>Mock transport for unsupported eligibility only</title>'}):
   req.continue());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#scanAI',{visible:true});
  assert(await page.evaluate(()=>Boolean(window.TISEvidenceCore&&window.TISEligibilityPolicy)),
   'Page must load the same eligibility evidence core and canonical policy');
  await page.evaluate(()=>{
   const original=window.TISEligibilityPolicy;
   window.__policyCalls=0;
   window.TISEligibilityPolicy={
    ...original,
    assess(text,kind){
     window.__policyCalls++;
     const decision=original.assess(text,kind);
     // Force an explicit gate to demonstrate both consumer UIs delegate
     // rather than quietly reimplementing independent English/Arabic checks.
     return {...decision,eligible:false,reason:'UNSUPPORTED_LANGUAGE'};
    }
   };
  });
  const english=Array(140).fill('measured').join(' ');
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},english);
  await page.waitForFunction(()=>window.__policyCalls>=1,{timeout:5000});
  assert.match(await page.$eval('#studioAiQuickNote',n=>n.textContent),/English|Arabic/i,
   'Inline readiness note must derive from canonical policy');
  await page.click('#scanAI');
  assert((await page.evaluate(()=>window.__policyCalls))>=2,
   'The click handler must consult the canonical policy independently of view notes');
  assert.equal(await page.$('#tisOnDeviceModel'),null,
   'A canonical rejection must not create or download a model runtime');
  assert.match(await page.$eval('#studioAiQuickStatus',n=>n.textContent),/English|Arabic/i);
  assert.deepEqual(errors,[],'No exceptions during eligibility UI');
  console.log('PASS browser readiness + Analyze Text use one canonical eligibility policy, no unintended model load');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
