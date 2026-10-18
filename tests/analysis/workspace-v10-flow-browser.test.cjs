'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(new URL(r.url()).hostname);});
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});

  const shotDir=process.env.TIS_SCREENSHOT_DIR;
  if(shotDir)require('node:fs').mkdirSync(shotDir,{recursive:true});
  const saveShot=async name=>{if(shotDir)await page.screenshot({path:require('node:path').join(shotDir,name),fullPage:true});};
  await saveShot('v10-1-desktop-input.png');
  const upload=await page.evaluate(()=>{
   const el=document.querySelector('label.file-input');
   const strong=el?.querySelector('strong');
   const rect=el?.getBoundingClientRect();
   return {found:!!el,labelVisible:!!el?.getClientRects().length,
    labelWidth:rect?.width||0,labelHeight:rect?.height||0,
    headingVisible:!!strong?.getClientRects().length,
    parent:el?.parentElement?.id||el?.parentElement?.className||'none',
    heading:strong?.textContent||''};
  });
  console.log('V10 upload affordance',JSON.stringify(upload));
  assert(upload.found&&upload.labelVisible&&upload.headingVisible&&upload.labelHeight>=45&&upload.labelWidth>=400,
   'main screen must visibly support file upload, not only text paste');

  assert.equal(await page.evaluate(()=>document.body.classList.contains('tis-v10')),true,'V10.1 activates only with the preview flag');
  const frame=await page.evaluate(()=>{
    const r=document.getElementById('inputPanel').getBoundingClientRect();
    return {width:r.width,center:r.left+r.width/2,screen:document.body.dataset.v10Screen,
      oneInput:document.querySelectorAll('#source').length,
      oneScan:document.querySelectorAll('#scanAI').length,
      oldReport:getComputedStyle(document.getElementById('reportPanel')).display};
  });
  assert.equal(frame.screen,'input');
  assert.equal(frame.oneInput,1);assert.equal(frame.oneScan,1);
  assert(frame.width<=940&&frame.width>=600,'centered input is a readable single rectangle');
  assert(Math.abs(frame.center-720)<60,'single rectangle is horizontally centered');
  assert.equal(frame.oldReport,'none','no empty dashboard on first visit');
  await page.$eval('#source',(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));},'مراجعة عربية محلية فقط دون نموذج إنجليزي.');
  await page.click('#scanAI');
  const unsupported=await page.evaluate(()=>({screen:document.body.dataset.v10Screen,
    text:document.getElementById('tisV10Eligibility')?.textContent,
    progress:document.getElementById('tisV10Progress')?.hidden,
    model:document.querySelectorAll('#tisOnDeviceModel').length}));
  assert.equal(unsupported.screen,'eligibility','unsupported input does not enter fabricated scan');
  assert.equal(unsupported.model,0,'no iframe/model request for Arabic input');
  assert.equal(unsupported.progress,true);
  assert(!/100% AI|AI-authored|AI-written: [0-9]/i.test(unsupported.text));
  await saveShot('v10-1-eligibility-arabic.png');
  await page.click('#tisV10BackToInput');
  assert.equal(await page.$eval('#source',e=>e.value),'مراجعة عربية محلية فقط دون نموذج إنجليزي.');
  await page.click('#language');
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,'RTL phone must not overflow');
  await saveShot('v10-1-mobile-input-ar.png');
  assert.deepEqual(remote,[],'unsupported scan must not request external model files');
  assert.deepEqual(errors,[],'no browser JavaScript exceptions');
  console.log('PASS V10.1 browser: centered light input, source preservation, Arabic abstention, RTL and no egress');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});