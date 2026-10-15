'use strict';
/* V9 consent boundary in actual Chromium; no artificial detector signal. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const unexpected=[],pageErrors=[],allRequests=[];
 try{
  const page=await browser.newPage();
  page.on('request',r=>{allRequests.push(r.url());if(new URL(r.url()).hostname!=='127.0.0.1')unexpected.push({method:r.method(),url:r.url()});});
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  assert.equal(await page.$eval('#tisLocalRewrite',e=>e.disabled),true,'never advertise unverified generative rewriting as working');
  const arabic='هذه تجربة محلية لمراجعة كتابة تقرير هندسي عن مشروع مساحته 25 m² [12].';
  await page.$eval('#source',(e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},arabic);
  assert.equal(await page.$eval('#tisV9Summary',e=>e.dataset.state),'READY','typing before first scan must not show stale research evidence');
  await page.click('#tisTabHumanize');
  await page.click('#scanAI');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),arabic);
  assert.equal(await page.$eval('#tisV9Summary',e=>e.dataset.state),'WRITING_ONLY');
  await page.click('#tisTabDetection');
  await page.click('#scanAI');
  await page.waitForFunction(()=>['WRITING_ONLY','UNSUPPORTED'].includes(document.querySelector('#tisV9Summary').dataset.state),{timeout:10000});
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),arabic);
  assert.equal(allRequests.every(u=>new URL(u).hostname==='127.0.0.1'),true,'only local static document assets accessed');
  await page.click('#tisTabHumanize');
  await page.evaluate(()=>window.TISWorkspaceV9.setAnalysisState({status:'ERROR'}));
  const err=await page.$eval('#tisV9Summary',e=>({text:e.textContent,state:e.dataset.state}));
  assert.equal(err.state,'ERROR','presentation retains explicit failure even inside writing mode');
  assert.match(err.text,/model could not finish/i,'writing mode does not bury analysis errors');
  await page.click('#language');
  await page.evaluate(()=>window.TISWorkspaceV9.setAnalysisState({status:'STALE'}));
  const stale=await page.$eval('#tisV9Summary',e=>({text:e.textContent,state:e.dataset.state}));
  assert.equal(stale.state,'STALE');
  assert.match(stale.text,/تغيّر النص/u);
  assert.deepEqual(unexpected,[],'no document text or model requests egress before consent');
  assert.deepEqual(pageErrors,[],'no browser runtime exceptions');
  console.log('PASS V9 privacy: local writing review, Arabic abstention, blocked generator, state clarity, zero external requests');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
