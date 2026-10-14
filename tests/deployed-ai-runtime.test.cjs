'use strict';
// End-to-end check against the real GitHub Pages origin, not a localhost surrogate.
// Logs must never contain the user document. The only submitted text is a public test fixture.
const puppeteer=require('puppeteer-core');
const fs=require('node:fs');
const path=require('node:path');
const {chrome}=require('./pdf-browser.test.js');
const {verifyPublishedApp,RELEASE_MARKER,PAGES}=require('../docs/analysis/public-postdeploy-contract.js');
const URL_TO_TEST=process.env.TIS_TARGET_URL||'https://bimspecialist.github.io/Text-Integrity-Studio/';
const MAX_TIME=Number(process.env.TIS_SCAN_TIMEOUT_MS||270000);
const REQUIRE_V4=process.env.TIS_REQUIRE_V4==='true';
const REQUIRE_V5=process.env.TIS_REQUIRE_V5==='true';
const REQUIRE_V6=process.env.TIS_REQUIRE_V6==='true';
const REQUIRE_S5=process.env.TIS_REQUIRE_S5==='true';
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
  await page.setCacheEnabled(false);
  let response,publishedV5=false;
  for(let attempt=0;attempt<((REQUIRE_V5||REQUIRE_S5)?28:1);attempt++){
   response=await page.goto(URL_TO_TEST,{waitUntil:'domcontentloaded',timeout:60000});
   if(!response?.ok())throw Error('Cannot open public origin: '+response?.status());
   if(!REQUIRE_V5)break;
   publishedV5=await page.evaluate(()=>{
    const title=document.querySelector('#v5Headline'),action=document.querySelector('#scanAI');
    const box=document.querySelector('#v5Toolbox'),ring=document.querySelector('#v5SignalRing');
    return !!title&&!!action&&!!box&&!!ring&&box.open===false&&
      getComputedStyle(title).display!=='none'&&getComputedStyle(action).display!=='none';
   });
   if(publishedV5&&REQUIRE_V6){
    publishedV5=await page.evaluate(()=>['v6DocumentNote','v6ConclusionReason','v6CoverageNote','v6WordTools']
      .every(id=>!!document.getElementById(id)));
   }
   if(publishedV5&&REQUIRE_S5){
    const observed=await page.$eval('meta[name="tis-release-marker"]',e=>e.content).catch(()=>null);
    publishedV5=observed===RELEASE_MARKER;
   }
   if(publishedV5)break;
   await new Promise(ok=>setTimeout(ok,8000));
  }
  if((REQUIRE_V5||REQUIRE_S5)&&!publishedV5)
   throw Error('GitHub Pages did not serve the required V7 release marker and approved layout');
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
  const launch=await page.evaluate((requireV4)=>{
   const button=requireV4?document.getElementById('scanAI'):
    (document.getElementById('studioAiQuickRun')||document.getElementById('aiRun'));
   if(!button)return false;
   button.click();return true;
  },REQUIRE_V4);
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
  // The published baseline on PR is deliberately NOT evidence for the PR.
  // On main after a Pages deployment, require two genuine pinned ONNX runs.
  let deploymentEvidence=null;
  if(REQUIRE_S5){
   const initial=await page.evaluate(()=>window.TISAnalysisApp?.controller?.getState());
   if(!initial?.evidence?.primary)
    throw Error('REAL_PRIMARY_MODEL_NOT_OBSERVED');
   const firstId=initial.requestId;
   await page.click('#aiDetectorTechnical > summary');
   await page.click('#aiAdvanced > summary');
   await page.click('#aiDeep');
   if(!await page.$eval('#aiDeep',e=>e.checked))throw Error('SECOND_MODEL_OPT_IN_NOT_ENABLED');
   await page.click('#scanAI');
   await page.waitForFunction(first=>{
    const state=window.TISAnalysisApp?.controller?.getState();
    return !!state&&state.requestId!==first &&
      ['RESEARCH_SIGNAL','INCONCLUSIVE','ERROR','UNSUPPORTED'].includes(state.status);
   },{timeout:320000},firstId);
   // Only metadata from validated controller evidence. No source text or
   // raw model output may be written to release artifacts.
   deploymentEvidence=await page.evaluate(()=>{
    const state=window.TISAnalysisApp?.controller?.getState();
    const e=state?.evidence;
    if(!e)return null;
    const model=m=>m?{model_id:m.model_id,revision:m.revision,score:m.score,
     coverage:m.coverage}:null;
    return {kind:e.kind,calibration:e.calibration,requestId:e.requestId,
     revision:e.revision,scanOptions:e.scanOptions,
     primary:model(e.primary),secondary:model(e.secondary)};
   });
  }
  const observedMarker=await page.$eval('meta[name="tis-release-marker"]',e=>e.content).catch(()=>null);
  const productionAudit=verifyPublishedApp({
   url:URL_TO_TEST,mode:REQUIRE_S5?'production':'pr-baseline',loaded:!!response?.ok(),
   expectedMarker:RELEASE_MARKER,observedMarker,
   modelInferenceObserved:REQUIRE_S5&&!!deploymentEvidence?.primary&&!!deploymentEvidence?.secondary,
   inferenceSource:REQUIRE_S5?'CHROMIUM_REAL_ONNX_DEPLOYED_ORIGIN':'PR_BASELINE_ONLY',
   evidence:deploymentEvidence,consoleErrors,
   failedNetworkHosts:requestErrors.map(x=>x.host)
  });
  diagnostics={...diagnostics,...state,requireV4:REQUIRE_V4,requireV5:REQUIRE_V5,
   requireV6:REQUIRE_V6,requireS5:REQUIRE_S5,
   releaseMarkerMatched:observedMarker===RELEASE_MARKER,
   releaseAudit:productionAudit,detectorResponded:state.evidenced,
   dualModelResponded:!!deploymentEvidence?.secondary,
   requestErrors,consoleErrors};
  const output=process.env.TIS_SCREENSHOT_DIR||'/tmp/tis-ai-production';
  fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'deployed-ai-runtime.png'),fullPage:true});
  fs.writeFileSync(path.join(output,'deployed-ai-runtime.json'),JSON.stringify(diagnostics,null,2));
  console.log(JSON.stringify(diagnostics,null,2));
  if(!state.evidenced)throw Error('Deployed browser never completed an actual model inference');
  if(REQUIRE_S5&&productionAudit.status!=='VERIFIED_DEPLOYED_CANDIDATE')
   throw Error('POST_PAGES_S5_CANDIDATE_VERIFICATION_FAILED: '+productionAudit.reasons.join(','));

 }finally{
  await browser.close();
 }
}
run().catch(e=>{console.error('LIVE_DEPLOYED_AI_CHECK_FAILED: '+e.message);process.exitCode=1});
