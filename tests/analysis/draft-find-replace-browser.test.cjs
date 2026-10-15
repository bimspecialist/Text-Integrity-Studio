'use strict';
/* V8.8 — true local draft find/replace without mutating canonical source.
 * Real Chromium, no model weights, no synthetic detection scores.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],egress=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')egress.push(r.url());});
  await page.setViewport({width:1360,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const original='The structural scope covers a+b and a+b. Measurements 5 mm [2].';
  await page.$eval('#source',(el,value)=>{
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  },original);
  await page.click('#tisTabEditor');
  assert(await page.$('#tisV8FindPanel'),'draft find-and-replace must be a native details control');
  assert.equal(await page.$eval('#tisV8FindPanel',n=>n.open),false,
   'advanced editor controls collapsed until requested');
  await page.click('#tisV8FindPanel > summary');
  await page.type('#tisV8FindText','a+b');
  await page.waitForFunction(()=>document.getElementById('tisV8FindCount').dataset.count==='2',{timeout:3000});
  // An untouched draft automatically follows a new original revision. Its
  // open search count must not continue describing the previous document.
  await page.$eval('#source',el=>{
   el.value='Temporary separate original without search terms.';
   el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.getElementById('tisRevisedText').value===
   'Temporary separate original without search terms.',{timeout:4000});
  await page.waitForFunction(()=>document.getElementById('tisV8FindCount').dataset.count==='0',
   {timeout:4000});
  await page.$eval('#source',(el,value)=>{
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  },original);
  await page.waitForFunction(()=>document.getElementById('tisV8FindCount').dataset.count==='2',
   {timeout:4000});
  const sourceRevision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.click('#tisV8FindNext');
  let preview=await page.$eval('#tisRevisedText',el=>({
    selected:el.value.slice(el.selectionStart,el.selectionEnd),
    text:el.value
  }));
  assert.equal(preview.selected,'a+b','Find next selects literal substring, no regex semantics');
  assert.equal(preview.text,original);
  await page.type('#tisV8ReplaceText','q$&');
  await page.click('#tisV8ReplaceNext');
  const once=await page.evaluate(()=>({
   original:document.getElementById('source').value,
   draft:document.getElementById('tisRevisedText').value,
   revision:window.TISAnalysisApp.session.read().revision,
   nextCount:document.getElementById('tisV8FindCount').dataset.count
  }));
  assert.equal(once.original,original);
  assert.equal(once.revision,sourceRevision,'editing draft is not Applying changes');
  assert.equal(once.draft,'The structural scope covers q$& and a+b. Measurements 5 mm [2].');
  assert.equal(once.nextCount,'1');
  await page.click('#tisV8ReplaceAll');
  const after=await page.evaluate(()=>({
   original:document.getElementById('source').value,
   revised:document.getElementById('tisRevisedText').value,
   count:document.getElementById('tisV8FindCount').dataset.count,
   note:document.getElementById('tisV8FindStatus').textContent
  }));
  assert.equal(after.original,original);
  assert.equal(after.revised,'The structural scope covers q$& and q$&. Measurements 5 mm [2].',
   '$& in user replacement must stay literal');
  assert.equal(after.count,'0');
  assert(after.note.length>9,'announce reviewed local edit, no automatic Apply');

  await page.$eval('#tisV8FindText',el=>{
   el.value='[2]';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.$eval('#tisV8ReplaceText',el=>{el.value='[3]';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#tisV8ReplaceAll');
  assert.equal(await page.$eval('#source',n=>n.value),original);
  assert.equal(await page.$eval('#tisDraftApply',n=>n.disabled),true,
   'existing protected-fact review still blocks applying changed citations');
  await page.click('#tisDraftReset');
  assert.equal(await page.$eval('#tisRevisedText',n=>n.value),original);

  await page.click('#language');
  const arabic='تم قياس الجدار في المخطط مع مراجعة الجدار [2] و 5 mm.';
  await page.$eval('#source',(el,value)=>{
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  },arabic);
  await page.click('#tisDraftReset');
  await page.$eval('#tisV8FindText',el=>{
   el.value='الجدار';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.$eval('#tisV8ReplaceText',el=>{el.value='الحائط';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.getElementById('tisV8FindCount').dataset.count==='2',{timeout:3000});
  assert(/[\u0600-\u06ff]/u.test(await page.$eval('#tisV8FindPanel > summary',n=>n.textContent)));
  await page.click('#tisV8ReplaceAll');
  assert.equal(await page.$eval('#tisRevisedText',n=>n.value),
   arabic.replaceAll('الجدار','الحائط'));
  assert.equal(await page.$eval('#source',n=>n.value),arabic);
  await page.setViewport({width:390,height:844});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,
   'Arabic narrow viewport must not clip Find/Replace controls');
  if(process.env.TIS_V8_EMBED_VISUAL==='1'){
   await page.setViewport({width:1150,height:900});
   const jpeg=await page.screenshot({type:'jpeg',quality:45});
   console.log('TIS_V8_FIND_REPLACE_JPEG_B64='+jpeg.toString('base64'));
  }
  assert.deepEqual(egress,[],'draft editing never starts external inference');
  assert.deepEqual(errors,[],'no JS runtime exceptions in Arabic/English flows');
  console.log('PASS V8.8: literal find/next/replace all, no regex or $& corruption, citation Apply protection, Arabic RTL/mobile, no upload');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
