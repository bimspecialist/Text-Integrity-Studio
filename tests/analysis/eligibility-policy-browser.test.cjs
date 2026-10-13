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
  assert.equal(await page.evaluate(()=>
   typeof window.TISAnalysisApp?.controller?.analyze==='function'),true,
   'The single AnalysisController uses the same fixed policy as the editor');
  const arabic=Array(130).fill('المبنى').join(' ');
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},arabic);
  await page.waitForFunction(()=>/English|Arabic/i.test(
   document.getElementById('studioAiQuickNote')?.textContent||''),{timeout:5000});
  assert.equal(await page.evaluate(()=>
   window.TISEligibilityPolicy.assess(document.getElementById('source').value).reason),
   'UNSUPPORTED_LANGUAGE');
  await page.click('#scanAI');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'UNSUPPORTED');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'Arabic is never sent to an English model');

  const short='A short measured engineering report with known limitations.';
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},short);
  await page.click('#scanAI');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().eligibleReason),'MIN_WORDS');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'WRITING_ONLY');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'Insufficient word count never starts inference');
  assert.match(await page.$eval('#studioAiQuickStatus',n=>n.textContent),/120/);
  const english=Array(140).fill('measured').join(' ');
  await page.$eval('#source',(n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},english);
  assert.equal(await page.evaluate(()=>
   window.TISEligibilityPolicy.assess(document.getElementById('source').value).eligible),true);
  await page.click('#scanAI');
  await page.waitForSelector('#tisOnDeviceModel');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'LOADING');
  await page.click('#scanAI');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'CANCELLED');
  assert.deepEqual(errors,[],'No exceptions during eligibility UI');
  console.log('PASS browser readiness + Analyze Text use one canonical eligibility policy, no unintended model load');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
