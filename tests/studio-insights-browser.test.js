'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');
async function run(){
 const server=serve();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tis-v3-'));
 const output=process.env.TIS_SCREENSHOT_DIR||dir;fs.mkdirSync(output,{recursive:true});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:1400,height:900});
  const errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#studioReviewCards');
  assert.equal(await page.$eval('#studioEvidence',n=>n.hidden),true,'No fabricated highlights before model inference');
  assert.equal(await page.$eval('#studioAiQuickValue',n=>n.textContent.trim()),'—','Research summary is unscored by default');
  assert.equal(await page.$eval('#studioAiQuickProgress',n=>n.hidden),true,'No invented model processing progress');
  assert.equal(await page.$eval('#aiBar',n=>n.hidden),true,'No invented calibrated number');
  assert.equal(await page.$eval('#studioReviewCards',n=>n.children.length),0,'No false notes before text');
  const all=Array.from({length:45},(_,i)=>'measurement'+(i%5)).join(' ');
  const input=all+'. The field readings must be checked.\n\n'+('Measurement data measurement outcome. ').repeat(18);
  await page.$eval('#source',(n,t)=>{n.value=t;n.dispatchEvent(new Event('input',{bubbles:true}));},input);
  await page.$eval('#scan',button=>button.click());
  await page.waitForFunction(()=>document.querySelector('#studioReviewCards .studio-suggestion')&&document.querySelector('#studioDocumentStats')?.textContent.includes('2'));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(output,'studio-v4-desktop.png'),fullPage:true});
  assert((await page.$eval('#studioReviewCards',n=>n.textContent)).includes('sentence'),'Real editorial guidance shown');
  assert.equal(await page.$eval('#source',n=>n.value),input,'Analysis cannot silently rewrite source');
  await page.click('.studio-suggestion button[data-studio-focus]');
  assert((await page.$eval('#source',n=>n.selectionEnd))>0,'Focus control navigates to actual text');
  assert.equal(await page.$eval('#source',n=>n.value),input,'Focusing cannot mutate text');
  const initial=await page.$eval('#aiMeterScore',n=>n.textContent);
  assert(!initial.includes('%'),'Style heuristics never generate an AI percentage');
  await page.evaluate(()=>{
   window.dispatchEvent(new CustomEvent('tis:ai-evidence',{detail:{
    version:'TIS_CONSENSUS_V2_2026_10',model_id:'onnx-community/tmr-ai-text-detector-ONNX',
    calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
    sourceLength:document.getElementById('source').value.length,
    segments:[{start:0,end:90,signal:89},{start:120,end:220,signal:18}],
    displayedSignalPercent:67.2,status:'SINGLE_UNCALIBRATED_MODEL'
   }}));
  });
  await page.waitForFunction(()=>!document.querySelector('#studioEvidence').hidden);
  assert.equal(await page.$eval('#studioAiQuickValue',n=>n.textContent.trim()),'67.2%','Quick summary can only show valid actual model signal');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tis:ai-progress',{detail:{stage:'DOWNLOADING',percent:35}})));
  assert.equal(await page.$eval('#studioAiQuickProgress',n=>n.value),35,'Download progress is measured, not fabricated');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tis:ai-progress',{detail:{stage:'IDLE'}})));
  assert.equal(await page.$eval('#studioAiQuickProgress',n=>n.hidden),true);
  await page.click('#studioEvidence > summary');
  assert((await page.$$('#studioHeatmap mark')).length>0,'Only real supplied model spans receive color');
  assert((await page.$eval('#studioHeatmap',n=>n.textContent)).includes('measurement'));
  assert((await page.$eval('#studioEvidenceNotice',n=>n.textContent)).includes('model'),'No authorship proof presented');
  await page.$eval('#source',n=>{n.value+=' Updated.';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.getElementById('studioEvidence').hidden,'Editing invalidates stale model highlights');
  assert.equal(await page.$eval('#studioAiQuickValue',n=>n.textContent.trim()),'—','Stale AI number is removed immediately on text edits');
  await page.evaluate(()=>{
   const original=URL.createObjectURL.bind(URL);
   URL.createObjectURL=blob=>{window.__studioExportBlob=blob;return original(blob)};
  });
  await page.click('#studioExportReview');
  const exported=await page.evaluate(async()=>JSON.parse(await window.__studioExportBlob.text()));
  assert.equal(exported.application,'Text Integrity Studio');
  assert.equal(exported.analysis.sections.length,2);
  assert(!JSON.stringify(exported).includes('The field readings must be checked'),'Export never embeds source text');
  assert(!JSON.stringify(exported).includes('private-contract'),'Export never embeds a source filename');
  const downloadLabels=await page.$eval('#studioExportStatus',n=>n.textContent);
  assert(downloadLabels.length>0,'Report export action has feedback');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  assert((await page.$eval('#studioReviewTitle',n=>n.textContent)).includes('ملاحظات'));
  await page.setViewport({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  const mobileGeometry=await page.evaluate(()=>{
   const box=id=>{const r=document.getElementById(id).getBoundingClientRect();
    return {top:r.top+scrollY,bottom:r.bottom+scrollY,width:r.width};};
   return {input:box('inputPanel'),report:box('reportPanel'),writing:box('writingTools'),
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert(mobileGeometry.input.top<mobileGeometry.report.top,
   'Editor must precede detector on every phone viewport: '+JSON.stringify(mobileGeometry));
  assert(mobileGeometry.input.bottom<=mobileGeometry.report.top+5,
   'Editor must not overlap AI detector on phone: '+JSON.stringify(mobileGeometry));
  assert(mobileGeometry.report.bottom<=mobileGeometry.writing.top+5,
   'Optional writing tools follow the AI results without overlap: '+JSON.stringify(mobileGeometry));

  await page.screenshot({path:path.join(output,'studio-v4-mobile-rtl.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert(overflow<=8,'Mobile right-to-left editor fits narrow screens');
  const file=path.join(dir,'notes.log');fs.writeFileSync(file,'A human-authored maintenance note recorded at the site.');
  await (await page.$('#file')).uploadFile(file);
  await page.waitForFunction(()=>document.getElementById('source').value.includes('maintenance note'),{timeout:10000});
  assert((await page.$eval('#studioDocumentFormat',n=>n.textContent)).includes('LOG'),'Text-only LOG file imports as text');
  assert.deepEqual(errors,[],'No browser runtime errors');
  assert.deepEqual(remote,[],'Local review must not leak user text to third-party services');
  console.log('PASS dark editor, local suggestions, focus/edit safety, real ONNX window heatmap, stale invalidation, privacy and RTL/mobile');
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});
 }
}
run().catch(e=>{console.error(e);process.exit(1);});
