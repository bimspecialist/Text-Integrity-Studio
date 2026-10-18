'use strict';
/* Only execute after intentionally publishing the PREVIEW assets on Pages.
 * Real hosted origin verification, not a model-quality or device-AT test.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {chrome}=require('../pdf-browser.test.js');
const origin=process.env.TIS_PUBLIC_ORIGIN||'https://bimspecialist.github.io/Text-Integrity-Studio/';
const sample='teh building report was recieved at the site. This is a harmless public test sentence.';
async function run(){
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],thirdParty=[];
 try{
  const main=await browser.newPage();
  main.on('pageerror',e=>errors.push(e.message));
  await main.goto(origin,{waitUntil:'load',timeout:25000});
  assert.equal(await main.evaluate(()=>document.body.classList.contains('tis-v11')),false,
   'The public default site must remain V9');
  await main.close();
  const preview=await browser.newPage();
  preview.on('pageerror',e=>errors.push(e.message));
  preview.on('request',r=>{
   const url=new URL(r.url());
   if(url.hostname!=='bimspecialist.github.io')thirdParty.push(url.origin);
  });
  await preview.goto(origin+'?v11preview=1',{waitUntil:'load',timeout:25000});
  assert.equal(await preview.evaluate(()=>document.body.classList.contains('tis-v11')),true,
   'Hosted V11 query parameter is not serving the published preview yet');
  assert(await preview.$('#tisV11QaInput'));
  await preview.$eval('#source',(e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},sample);
  await preview.click('#scanAI');
  assert.equal(await preview.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
  assert.equal(await preview.$eval('#source',e=>e.value),sample);
  assert(await preview.$('#tisV11QaResults'));
  await preview.close();
  const qa=await browser.newPage();
  qa.on('pageerror',e=>errors.push(e.message));
  qa.on('request',r=>{
   const url=new URL(r.url());if(url.hostname!=='bimspecialist.github.io')thirdParty.push(url.origin);
  });
  await qa.setViewport({width:390,height:820});
  await qa.goto(origin+'quality/v11-manual-acceptance.html',{waitUntil:'load',timeout:25000});
  assert.equal(await qa.$eval('#statNotRun',e=>e.textContent),'18');
  assert.equal(await qa.$eval('#statSamples',e=>e.textContent),'0 / 60');
  assert.equal(await qa.evaluate(()=>document.documentElement.lang),'ar');
  assert((await qa.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8);
  assert.deepEqual(thirdParty,[],'Site QA entry must not call third-party inference');
  assert.deepEqual(errors,[],'Browser script errors in published preview');
  await qa.close();
  console.log('PASS LIVE GitHub Pages: V9 default preserved, V11 local review via query, QA 18/60 Arabic desk served on actual public domain');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
