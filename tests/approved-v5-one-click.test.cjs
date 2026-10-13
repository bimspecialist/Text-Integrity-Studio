'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');

const runtime=[
 '<!doctype html><html><body><script>',
 "window.addEventListener('message',event=>{",
 "if(event.origin!==location.origin||event.data?.op!=='RUN')return;",
 "const id=event.data.requestId;",
 "if(event.data.text.includes('MODEL_NETWORK_FAIL')){",
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'ERROR',requestId:id,code:'MODEL_UNAVAILABLE'},location.origin);return;}",
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'PROGRESS',requestId:id,stage:'DOWNLOADING',percent:37,model:'primary'},location.origin);",
 "const primary={model_id:'onnx-community/tmr-ai-text-detector-ONNX',score:64.2,coverage:100,sampleCount:1,",
 "range_percent:[64.2,64.2],consistency:'CONSISTENT_PASSAGES',segments:[{start:0,end:event.data.text.length,signal:64.2,words:150,tokens:210}]};",
 "const result={version:'TIS_CONSENSUS_V2_2026_10',primary,secondary:null,models:[primary],",
 "status:'SINGLE_UNCALIBRATED_MODEL',score:64.2,flags:[],calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE'};",
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'RESULT',requestId:id,result},location.origin);",
 "});window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:''},location.origin);",
 '</script></body></html>'
].join('');
async function run(){
 const server=serve(); await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const output=process.env.TIS_SCREENSHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tis-v5-'));
 fs.mkdirSync(output,{recursive:true});
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],untrusted=[],missing=[];
 try{
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:900});
  page.on('pageerror',err=>errors.push(err.message));
  page.on('request',req=>{
   const u=new URL(req.url());
   if(u.hostname!=='127.0.0.1')untrusted.push(u.hostname);
  });
  page.on('response',res=>{if(res.status()>=400)missing.push(res.status()+' '+res.url())});
  await page.setRequestInterception(true);
  page.on('request',req=>req.url().endsWith('/ai-runtime.html')
   ?req.respond({status:200,contentType:'text/html',body:runtime}):req.continue());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#scanAI',{visible:true});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.$eval('#v5Headline',n=>n.textContent.trim()),'Check your text for AI content');
  assert((await page.$eval('.v5-topbar',n=>n.textContent)).includes('Text Integrity Studio'));
  assert.equal(await page.$eval('#studioAiQuickValue',n=>n.textContent.trim()),'—');
  const initial=await page.evaluate(()=>{
   const visible=id=>{const el=document.getElementById(id);return !!el&&!el.closest('details:not([open])')&&getComputedStyle(el).display!=='none'&&el.getClientRects().length>0;};
   return {
    actionButtons:['scanAI','scan','sample','clear','studioAiQuickRun','studioOpenWritingLab','studioExportTop','quickClean','aiRun']
      .filter(visible),
    fonts:getComputedStyle(document.getElementById('source')).fontFamily,
    ring:getComputedStyle(document.getElementById('v5SignalRing')).backgroundImage,
    technicalOpen:document.getElementById('aiDetectorTechnical').open,
    mockClaims:document.body.innerText.includes('High confidence')||document.body.innerText.includes('72%')
   };
  });
  assert.deepEqual(initial.actionButtons,['scanAI'],'Only one visible main analysis button before opening advanced tools');
  assert.match(initial.fonts,/Manrope|IBM Plex Sans Arabic/);
  assert.equal(initial.technicalOpen,false);
  assert.equal(initial.mockClaims,false,'Do not hardcode a speculative AI confidence or 72%');
  assert.equal(await page.evaluate(()=>document.fonts.check('400 14px "TIS Manrope"')&&[...document.fonts].some(f=>f.family==='TIS Manrope'&&f.status==='loaded')),true,'The licensed first-party Manrope font loads');
  const tiny='teh note,which includes a verified result.';
  await page.$eval('#source',(n,t)=>{n.value=t;n.dispatchEvent(new Event('input',{bubbles:true}));},tiny);
  await page.click('#scanAI');
  await page.waitForFunction(()=>document.querySelector('#labResults .writing-card'));
  assert.equal(await page.$('#tisOnDeviceModel'),null,'Short English produces editorial checks without remote ONNX');
  assert.match(await page.$eval('#studioAiQuickStatus',n=>n.textContent),/120/);
  const ar=('ناقش الباحث قراءات التجربة ونتائج القياسات التي راجعها فريق المشروع بالتفصيل. ').repeat(21);
  await page.$eval('#source',(n,t)=>{n.value=t;n.dispatchEvent(new Event('input',{bubbles:true}));},ar);
  await page.click('#scanAI');
  assert.match(await page.$eval('#studioAiQuickStatus',n=>n.textContent),/English|Arabic/);
  assert.equal(await page.$('#tisOnDeviceModel'),null);
  const english=('This report reviews the engineering measurements and records the limitations of the documented test setup. ').repeat(19);
  await page.$eval('#source',(n,t)=>{n.value=t;n.dispatchEvent(new Event('input',{bubbles:true}));},english);
  await page.click('#scanAI');
  await page.waitForFunction(()=>document.getElementById('studioAiQuickValue')?.textContent.includes('64.2%'),{timeout:15000});
  assert((await page.$eval('#v5SignalRing',n=>getComputedStyle(n).backgroundImage)).includes('conic-gradient'));
  assert((await page.$eval('#v5BreakdownRows',n=>n.textContent)).includes('64.2%'),'Section indicator derives from actual model windows');
  assert.equal(await page.$eval('#aiDetectorTechnical',n=>n.open),false,'Scientific details remain optional');
  await page.screenshot({path:path.join(output,'approved-v5-desktop.png'),fullPage:true});
  await page.$eval('#source',n=>{n.value+=' Extra note.';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.getElementById('studioAiQuickValue')?.textContent.trim()==='—');
  assert(!(await page.$eval('#v5BreakdownRows',n=>n.textContent)).includes('64.2%'),'Old section scores cleared on edits');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  assert((await page.$eval('#scanAI',n=>n.textContent)).includes('AI'),'Unified action translates while staying clear');
  await page.setViewport({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  const geometry=await page.evaluate(()=>{
   const info=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY};};
   return {input:info('inputPanel'),results:info('reportPanel'),
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert(geometry.overflow<=8,'Arabic mobile screen has no horizontal overflow');
  assert(geometry.input.bottom<=geometry.results.top+6,'Editor never overlays the analysis results');
  await page.screenshot({path:path.join(output,'approved-v5-mobile-ar.png'),fullPage:true});
  assert.deepEqual(errors,[],'No uncaught browser errors');
  assert.deepEqual(untrusted,[],'No remote content before real opt-in; mock runtime never downloads models');
  assert.deepEqual(missing,[],'All self-hosted assets load');
  console.log('PASS approved V5 design, one main Analyze button, bilingual fonts, truthful ONNX model state, real mapped sections and mobile RTL');
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
 }
}
run().catch(err=>{console.error(err);process.exitCode=1});
