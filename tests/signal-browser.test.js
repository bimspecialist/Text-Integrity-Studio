'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-signal-'));
 const file=path.join(temp,'research-model.json');
 fs.writeFileSync(file,JSON.stringify({
  format:'TIS-char-tfidf-logreg-v1',status:'UNVERIFIED_RESEARCH_ONLY',
  ngram_range:[3,5],vocabulary:{the:0},weights:[2],idf:[1],intercept:0,
  calibration:{coef:1,intercept:0},declared_languages:['en'],declared_domains:['software-test'],
  word_limit_minimum:75
 }));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();const errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#researchSignal');
  assert(await page.$eval('#signalGo',e=>e.disabled),'No model, so AI score unavailable');
  await page.click('#researchTools > summary');
  await (await page.$('#signalModelFile')).uploadFile(file);
  await page.waitForFunction(()=>!document.getElementById('signalGo').disabled);
  await page.$eval('#source',el=>{el.value='the '.repeat(95);el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#signalGo');
  await page.waitForFunction(()=>document.getElementById('signalResult').textContent.includes('0.'));
  assert((await page.$eval('#signalResult',e=>e.textContent)).includes('Unverified'));
  await page.$eval('#source',el=>{el.value='short';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#signalGo');
  await page.waitForFunction(()=>document.getElementById('signalResult').textContent.includes('INCONCLUSIVE'));
  await page.click('#signalClear');
  assert(await page.$eval('#signalGo',e=>e.disabled),'Model unload removes ability to score');
  assert.deepEqual(remote,[],'No remote model or text requests');
  assert.deepEqual(errors,[],'No browser runtime errors in research lab');
  console.log('PASS user-supplied local experimental model, abstention, unload and no network');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
}
run().catch(err=>{console.error(err);process.exit(1);});
