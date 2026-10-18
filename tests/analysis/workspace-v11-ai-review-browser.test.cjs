'use strict';
/* V11 Chrome QA uses real writing rules and real analysis controller.
 * The optional iframe is inert to avoid an unapproved model download:
 * this test never fabricates or evaluates AI classifier scores.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const en='teh report was recieved at the site. The concrete strength was 25 MPa [12].';
const ar='هاذا تقرير مكتوب للمراجعة المحلية، لاكن ليس لإثبات مؤلف النص.';
const longText=Array.from({length:20},(_,i)=>
 'In this engineering study the design team evaluated the measured column strength, documentation, and the referenced floor plan in section '+(i+1)+'.').join(' ');
async function insert(p,s){await p.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},s)}
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],shots=process.env.TIS_V11_UX_SCREENSHOTS;
 if(shots)fs.mkdirSync(shots,{recursive:true});
 try{
  for(const lang of ['en','ar']){
   const p=await browser.newPage(),frames=[];
   p.on('pageerror',e=>errors.push(e.message));
   p.on('request',req=>{if(/ai-runtime\.html/.test(req.url()))frames.push(req.url())});
   try{
    await p.setViewport({width:lang==='ar'?390:1440,height:900});
    await p.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
    if(lang==='ar')await p.click('#language');
    assert.equal(await p.$eval('#tisV11IncludeAI',e=>e.checked),false);
    await insert(p,lang==='ar'?ar:en);
    await p.click('#scanAI');
    assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
    assert.equal(frames.length,0,'Unselected Review text must never launch an AI model');
    await p.click('#tisV11Edit');
    await p.click('#tisV11IncludeAI');
    assert.equal(await p.$eval('#tisV11IncludeAI',e=>e.checked),true);
    const primary=await p.$eval('#scanAI .v5-action-title',e=>e.textContent);
    assert(primary.includes('AI'),primary);
    await p.click('#scanAI');
    assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'guided-review',
     'Ineligible opted-in document still gets local editorial results');
    assert.equal(frames.length,0);
    assert.match(await p.$eval('#tisV11Status',e=>e.textContent),
     lang==='ar'?/غير مؤهل/:/not eligible/);
    await p.click('#tisV11Improve');
    assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'writing');
    assert.equal(await p.$eval('#tisV11WritingIntro',e=>getComputedStyle(e).display!=='none'),true);
    assert.match(await p.$eval('#tisV11WritingTitle',e=>e.textContent),lang==='ar'?/حسّن/:/Refine/);
    const g=await p.evaluate(()=>{
     const left=document.querySelector('#source').getBoundingClientRect();
     const right=document.querySelector('#tisRevisedText').getBoundingClientRect();
     return {ly:left.top,ry:right.top,overflow:document.documentElement.scrollWidth-innerWidth,
       uploadHidden:getComputedStyle(document.querySelector('#inputPanel .file-input')).display==='none'};
    });
    assert(g.uploadHidden,'Refine writing should not repeat the file picker');
    assert(g.overflow<=8,'No horizontal overflow in '+lang);
    if(lang==='en')assert(Math.abs(g.ly-g.ry)<95,'Desktop editor panes should share a row');
    else assert(Math.abs(g.ly-g.ry)>65,'Mobile editor panes should stack');
    const original=lang==='ar'?ar:en;
    await p.$eval('#tisRevisedText',e=>{e.value='An unsaved draft stays independent';e.dispatchEvent(new Event('input',{bubbles:true}))});
    assert.equal(await p.$eval('#source',e=>e.value),original);
    if(shots)await p.screenshot({path:path.join(shots,'refine-'+lang+'.png'),fullPage:true});
    await p.click('#tisV10BackFromWriting');
    assert.equal(await p.$eval('#source',e=>e.value),original);
    console.log('PASS V11 Refine '+lang+' actual browser layout, draft safety and research consent');
   }finally{await p.close()}
  }
  const p=await browser.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  let frameStarted=0;
  await p.setRequestInterception(true);
  p.on('request',req=>{
   if(/ai-runtime\.html/.test(req.url())){
    frameStarted++;
    return req.respond({status:200,contentType:'text/html',body:'<!doctype html><title>Intentional empty runtime test fixture</title>'});
   }
   return req.continue();
  });
  try{
   await p.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
   await insert(p,longText);
   const eligible=await p.evaluate(()=>window.TISEligibilityPolicy.assess(document.getElementById('source').value,'paste'));
   assert(eligible.eligible,'Genuine eligibility policy must accept the long English fixture');
   await p.click('#scanAI');
   assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
   assert.equal(frameStarted,0);
   await p.click('#tisV11Edit');
   await p.click('#tisV11IncludeAI');
   assert.match(await p.$eval('#tisV11ScanEligibility',e=>e.textContent),/eligible/);
   await p.focus('#scanAI');await p.keyboard.press('Enter');
   await p.waitForFunction(()=>['LOADING','ANALYZING'].includes(window.TISAnalysisApp.controller.getState().status),{timeout:4000});
   assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'progress');
   await p.waitForFunction(()=>!!document.querySelector('iframe[src*="ai-runtime.html"]'),{timeout:4000});
   assert(frameStarted>0,'Research checkbox must activate canonical lazy iframe');
   assert.equal(await p.$eval('#tisV10Meter',e=>e.hasAttribute('value')),false,'No fake model progress');
   await p.click('#tisV10Cancel');
   assert.equal(await p.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'CANCELLED');
   assert.equal(await p.$eval('#source',e=>e.value),longText);
   console.log('PASS V11 opted-in English Review text enters canonical model progress, cancel and source preservation');
  }finally{await p.close()}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
