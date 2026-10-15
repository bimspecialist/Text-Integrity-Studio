'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const remote=[],errors=[];
 try{
  const page=await browser.newPage();
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const title=()=>page.$eval('#scanAI .v5-action-title',el=>el.textContent.trim());
  assert.equal(await title(),'Analyze Text');
  await page.click('#tisTabHumanize');
  assert.equal(await title(),'Review writing');
  assert.match(await page.$eval('#scanAI',el=>el.getAttribute('aria-label')),/Review writing/);
  await page.$eval('#source',el=>{el.value='Technical documents need review.';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#scanAI');
  assert.equal(await page.$eval('#tisV9Summary',el=>el.dataset.state),'WRITING_ONLY');
  await page.click('#tisTabEditor');
  assert.equal(await title(),'Review writing');
  await page.click('#language');
  assert.equal(await title(),'\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0643\u062a\u0627\u0628\u0629');
  await page.click('#tisTabDetection');
  assert.equal(await title(),'\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0646\u0635');
  assert.deepEqual(remote,[],'local writing review never triggers an external model download');
  assert.deepEqual(errors,[],'no browser runtime exceptions');
  console.log('PASS V9 mode-accurate primary action in EN/AR: writing-only stays local');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});