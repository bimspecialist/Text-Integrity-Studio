'use strict';
// End-to-end check against the real GitHub Pages origin, not a localhost surrogate.
// Logs must never contain the user document. The only submitted text is a public test fixture.
const puppeteer=require('puppeteer-core');
const fs=require('node:fs');
const path=require('node:path');
const {chrome}=require('./pdf-browser.test.js');
const URL_TO_TEST=process.env.TIS_TARGET_URL||'https://bimspecialist.github.io/Text-Integrity-Studio/';
const MAX_TIME=Number(process.env.TIS_SCAN_TIMEOUT_MS||270000);
const REQUIRE_V4=process.env.TIS_REQUIRE_V4==='true';
async function run(){
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 await page.setViewport({width:1380,height:840});
 const requestErrors=[],consoleErrors=[];
 page.on('requestfailed',req=>{
  if(requestErrors.length<18)requestErrors.push({
   host:new URL(req.url()).hostname,
   pathname:new URL(req.url()).pathname.slice(0,85),
   reason:req.failure()?.errorText||'unknown'
  });
 });
 page.on('console',msg=>{
  if(msg.type()==='error'&&consoleErrors.length<18)consoleErrors.push(msg.text().slice(0,350));
 });
 page.on('pageerror',err=>{if(consoleErrors.length<18)consoleErrors.push('PAGE ERROR: '+err.message.slice(0,260));});
 let diagnostics={url:URL_TO_TEST,started:false,detectorResponded:false};
 try{
  const response=await page.goto(URL_TO_TEST,{waitUntil:'domcontentloaded',timeout:60000});
  if(!response?.ok())throw Error('Cannot open public origin: '+response?.status());
  await page.waitForSelector('#source',{timeout:30000});
  if(REQUIRE_V4){
   await page.waitForSelector('#scanAI',{visible:true,timeout:15000});
   const shape=await page.evaluate(()=>({
    bigHero:getComputedStyle(document.querySelector('.hero')).display,
    wizard:getComputedStyle(document.querySelector('.steps')).display,
    advancedOpen:document.querySelector('#aiDetectorTechnical')?.open,
    scanLabel:document.querySelector('#scanAI')?.textContent?.trim()
   }));
   if(shape.bigHero!=='none'||shape.wizard!=='none'||shape.advancedOpen!==false)
    throw Error('The published domain is still serving the old UI: '+JSON.stringify(shape));
  }
  // English known-provenance development fixture. This text is not an accuracy benchmark.
  const sentence=[
   'Field engineers recorded concrete temperature at each stage of the demonstration.',
   'The observer then compared the readings against the project method statement.',
   'A second technician independently checked the instrument calibration logs.',
   'The discussion describes data entry, measurement limits and verification procedures.',
   'These observations are illustrative; they are not real project findings.'
  ];
  const english=Array.from({length:35},(_,i)=>sentence[i%5]).join(' ');
  await page.$eval('#source',(el,text)=>{
   el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));
  },english);
  const launch=await page.evaluate(()=>{
   const button=REQUIRE_V4?document.getElementById('scanAI'):
    (document.getElementById('studioAiQuickRun')||document.getElementById('aiRun'));
   if(!button)return false;
   button.click();return true;
  });
  if(!launch)throw Error('No visible AI activation button in production');
  diagnostics.started=true;
  try{
   await page.waitForFunction(()=>{
    const status=document.querySelector('#aiStatus')?.textContent||'';
    return !document.getElementById('aiEvidence')?.hidden ||
      /unavailable|unable|blocked|failed|error|تعذر|تعذّر|network|timeout|timed out/i.test(status);
   },{timeout:MAX_TIME});
  }catch(error){
   diagnostics.waitExpired=true;
  }
  const state=await page.evaluate(()=>{
   const $=x=>document.getElementById(x);
   const frame=$('tisOnDeviceModel');
   let frameState='';
   try{frameState=frame?.contentWindow?.document?.getElementById('engine-status')?.textContent||'';}catch{}
   return {
    visibleQuick:$('studioAiQuickValue')?.textContent?.trim(),
    status:$('aiStatus')?.textContent?.slice(0,350),
    quickNote:$('studioAiQuickNote')?.textContent?.slice(0,350),
    primary:$('aiShort')?.textContent?.slice(0,180),
    evidenced:!$('aiEvidence')?.hidden,
    sourceLength:$('source')?.value.length,
    framePresent:!!frame,
    frameState:frameState.slice(0,200)
   };
  });
  diagnostics={...diagnostics,...state,requireV4:REQUIRE_V4,detectorResponded:state.evidenced,requestErrors,consoleErrors};
  const output=process.env.TIS_SCREENSHOT_DIR||'/tmp/tis-ai-production';
  fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'deployed-ai-runtime.png'),fullPage:true});
  fs.writeFileSync(path.join(output,'deployed-ai-runtime.json'),JSON.stringify(diagnostics,null,2));
  console.log(JSON.stringify(diagnostics,null,2));
  if(!state.evidenced)throw Error('Deployed browser never completed an actual model inference');
 }finally{
  await browser.close();
 }
}
run().catch(e=>{console.error('LIVE_DEPLOYED_AI_CHECK_FAILED: '+e.message);process.exitCode=1});
