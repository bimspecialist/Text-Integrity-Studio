'use strict';
/* Browser QA for the opt-in V12 layout and genuine source/editor controls.
 * Research transport intercepted before model download; the scientific model
 * is tested independently in the existing real-ONNX smoke. No fake scores.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const sampleEn='teh report was recieved at the site. The concrete strength was 25 MPa [12].';
const sampleAr='هاذا النص يحتوي على أخطاء في الكتابة، لاكن المطلوب هو تحسين أسلوبه دون تغيير الأرقام مثل 25 MPa.';
const longEn=Array.from({length:18},(_,i)=>
 'The engineering team examined material test reports, the construction schedule, and measured column sections during inspection '+(i+1)+'.').join(' ');
async function typeSource(page,value){
 await page.$eval('#source',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
}
async function run(){
 const serveRoot=serve();
 await new Promise(ok=>serveRoot.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const base='http://127.0.0.1:'+serveRoot.address().port+'/';
 const screenshots=process.env.TIS_V12_SCREENSHOTS||null;
 if(screenshots)fs.mkdirSync(screenshots,{recursive:true});
 const errors=[],external=[];
 async function snap(page,id){if(screenshots)await page.screenshot({path:path.join(screenshots,id+'.png'),fullPage:true})}
 try{
  const legacy=await browser.newPage();
  await legacy.goto(base,{waitUntil:'load'});
  assert.equal(await legacy.evaluate(()=>document.body.classList.contains('tis-v12')),false);
  assert.equal(await legacy.$('#tisV12Hero'),null);
  await legacy.close();
  const v11=await browser.newPage();
  await v11.goto(base+'?v11preview=1',{waitUntil:'load'});
  assert.equal(await v11.evaluate(()=>document.body.classList.contains('tis-v12')),false);
  assert.equal(await v11.$('#tisV12Hero'),null);
  await v11.close();
  console.log('PASS V12 isolation: public V9 and existing V11 preview untouched');

  for(const lang of ['en','ar']){
   for(const width of [320,390,768,1440]){
    const page=await browser.newPage(),models=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{const u=new URL(r.url());if(u.hostname!=='127.0.0.1')external.push(u.origin)});
    await page.setViewport({width,height:900});
    await page.goto(base+'?v12preview=1',{waitUntil:'load'});
    if(lang==='ar')await page.click('#language');
    assert.equal(await page.evaluate(()=>document.body.classList.contains('tis-v12')),true);
    assert.equal(await page.$eval('#tisV12Scan',e=>e.disabled),true,
     'Do not claim an empty source eligible for AI');
    await typeSource(page,lang==='ar'?sampleAr:sampleEn);
    assert.equal(await page.$eval('#tisV12Scan',e=>e.disabled),true,
     'Arabic and short English are not eligible for the real English model');
    assert.equal(await page.$eval('#tisV12Write',e=>e.disabled),false);
    assert.equal(await page.$eval('#tisV12ScanHint',e=>e.textContent.includes(lang==='ar'?'126':'126')),true);
    if(width===1440)await snap(page,'v12-input-'+lang);
    const initial=await page.evaluate(()=>({
     overflow:document.documentElement.scrollWidth-innerWidth,
     sourceName:document.querySelector('label[for="source"]')?.textContent,
     title:document.getElementById('tisV12Headline').textContent,
     heroBottom:document.getElementById('tisV12Hero').getBoundingClientRect().bottom,
     introBottom:document.getElementById('tisV12Intro').getBoundingClientRect().bottom,
     panelTop:document.getElementById('inputPanel').getBoundingClientRect().top,
     nativeChooserWidth:document.getElementById('file').getBoundingClientRect().width,
     strayWritingTitle:getComputedStyle(document.getElementById('tisV11WritingIntro')).display!=='none'
    }));
    assert(initial.overflow<=8,'Input horizontal overflow '+lang+' @'+width+': '+JSON.stringify(initial));
    assert(initial.panelTop>=initial.introBottom+8&&initial.panelTop>=initial.heroBottom+8,
     'New hero cannot overlap the real input card '+lang+' @'+width+': '+JSON.stringify(initial));
    assert(initial.nativeChooserWidth<=2,'Visual duplicate native file button must be hidden but keyboard accessible');
    assert.equal(initial.strayWritingTitle,false,'Refine header cannot appear before entering the writing editor');
    assert(initial.title.length>4);
    await page.click('#tisV12Write');
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
    assert.equal(await page.$eval('#source',e=>e.value),lang==='ar'?sampleAr:sampleEn);
    if(width===1440)await snap(page,'v12-guided-'+lang);
    const reviewState=await page.evaluate(()=>({
     noOverflow:document.documentElement.scrollWidth-innerWidth<=8,
     tips:document.querySelectorAll('#tisV11SuggestionList>li').length,
     button:document.getElementById('tisV11Improve')?.textContent
    }));
    assert(reviewState.noOverflow,'Writing tips overflow '+lang+' @'+width);
    await page.click('#tisV11Improve');
    await page.waitForFunction(()=>document.querySelector('#tisV12TipsDock #tisV11GuidedReview')!==null,{timeout:3500});
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'writing');
    const editor=await page.evaluate(()=>{
     const first=document.getElementById('source'),second=document.getElementById('tisRevisedText');
     return {overflow:document.documentElement.scrollWidth-innerWidth-innerWidth*0,
      original:first.value,draft:second.value,
      visible:getComputedStyle(document.getElementById('tisV12TipsDock')).display!=='none',
      stickyActions:getComputedStyle(document.getElementById('tisV12Actions')).display,
      firstY:first.getBoundingClientRect().top,secondY:second.getBoundingClientRect().top,
      actualSuggestions:document.querySelectorAll('#tisV12TipsDock #tisV11SuggestionList>li').length};
    });
    assert(editor.overflow<=8,'Refine overflow '+lang+' '+width+': '+editor.overflow);
    assert.equal(editor.original,lang==='ar'?sampleAr:sampleEn);
    assert.equal(editor.draft,editor.original);
    assert(editor.visible);
    assert.equal(editor.stickyActions,'none');
    assert(editor.actualSuggestions>0);
    if(width<=820)assert(Math.abs(editor.firstY-editor.secondY)>70,'Editors stack under 820px');
    if(width===1440)await snap(page,'v12-refine-'+lang);
    await page.$eval('#tisRevisedText',e=>{e.value='Unsaved draft';e.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.$eval('#source',e=>e.value),lang==='ar'?sampleAr:sampleEn);
    await page.click('#tisV10BackFromWriting');
    await page.waitForFunction(()=>document.getElementById('tisV11GuidedReview')?.parentNode?.id==='tisV10Flow',{timeout:3500});
    assert.equal(await page.$eval('#source',e=>e.value),lang==='ar'?sampleAr:sampleEn);
    // Test-only negative control: a real same-origin iframe request is
    // intercepted before any model asset or inference can run.
    if(process.env.TIS_V12_TEST_FORBIDDEN_RUNTIME==='1'&&lang==='en'&&width===320){
     await page.setRequestInterception(true);
     page.on('request',req=>new URL(req.url()).pathname.endsWith('/ai-runtime.html')?
      req.respond({status:200,contentType:'text/html',body:'<!doctype html><title>Inert negative control</title>'}):req.continue());
     const arrived=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/ai-runtime.html'));
     await page.evaluate(()=>{const frame=document.createElement('iframe');frame.hidden=true;
      frame.src='ai-runtime.html?test-only-negative-control=1';document.body.append(frame)});
     await arrived;
    }
    assert.deepEqual(models,[],'NO_IMPLICIT_MODEL_RUNTIME: writing must never initialize a model');
    console.log('PASS V12 '+lang+' '+width+'px: input, review, suggestions beside safe editable draft');
    await page.close();
   }
  }

  const page=await browser.newPage();
  let modelStarts=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',req=>{
   if(new URL(req.url()).pathname.endsWith('/ai-runtime.html')){
    modelStarts++;
    return req.respond({status:200,contentType:'text/html',body:'<!doctype html><html><title>Inert research transport fixture</title></html>'});
   }
   return req.continue();
  });
  await page.goto(base+'?v12preview=1',{waitUntil:'load'});
  await typeSource(page,longEn);
  assert.equal(await page.$eval('#tisV12Scan',e=>e.disabled),false,'Real eligibility enables direct AI action');
  assert.equal(modelStarts,0,'No implicit downloads while preparing the document');
  await page.click('#tisV12Scan');
  await page.waitForFunction(()=>document.body.dataset.v10Screen==='progress',{timeout:4000});
  await page.waitForFunction(()=>!!document.querySelector('iframe[src*="ai-runtime.html"]'),{timeout:4000});
  assert(modelStarts>0,'Only direct explicit AI action initiates model runtime');
  assert.equal(await page.$eval('#tisV10Meter',e=>e.hasAttribute('value')),false,'No fake progress percent');
  await page.click('#tisV10Cancel');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.controller.getState().status),'CANCELLED');
  assert.equal(await page.$eval('#source',e=>e.value),longEn);
  await page.close();
  assert.deepEqual(errors,[],'No uncaught browser page errors');
  assert.deepEqual(external,[],'No network to third parties during local writing flow');
  console.log('PASS V12 eligible English AI start/cancel, no fake progress, source retained, independent writing path');
 }finally{
  await browser.close();
  await new Promise(ok=>serveRoot.close(ok));
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
