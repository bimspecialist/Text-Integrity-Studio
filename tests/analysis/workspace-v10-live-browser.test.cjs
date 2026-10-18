'use strict';
/* Genuine on-device ONNX test of the opt-in V10 flow, not simulated evidence. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const pageErrors=[],failures=[],canary='TIS_V10_LOCAL_TEST_CANARY_6c28',requests=[];
 try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:960});
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('requestfailed',r=>failures.push({host:new URL(r.url()).hostname,reason:r.failure()?.errorText}));
  page.on('request',r=>{
   const uri=new URL(r.url());
   if(uri.hostname!=='127.0.0.1')
    requests.push({host:uri.hostname,method:r.method(),
     canaryInUrl:r.url().includes(canary)||r.url().includes(encodeURIComponent(canary)),
     canaryInPayload:!!r.postData()?.includes(canary)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('tis-v10')),true);
  const english=('The laboratory research assistant collected detailed measurements from every technical observation, '+
   'reviewed calculations with a supervising engineer, and documented the original records for independent study. ').repeat(11)+
   ' The synthetic instrument code in this reference document is '+canary+'.';
  await page.$eval('#source',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},english);
  const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.click('#scanAI');
  await page.waitForFunction(()=>['LOADING','ANALYZING'].includes(window.TISAnalysisApp.controller.getState().status),{timeout:15000});
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'progress','canonical controller starts V10 progress screen');
  await page.waitForFunction(()=>{
   const s=window.TISAnalysisApp.controller.getState().status;
   return ['RESEARCH_SIGNAL','INCONCLUSIVE','ERROR','UNSUPPORTED','WRITING_ONLY'].includes(s);
  },{timeout:320000});
  const actual=await page.evaluate(()=>{
   const controller=window.TISAnalysisApp.controller.getState();
   const session=window.TISAnalysisApp.session.read();
   const spans=[...document.querySelectorAll('#tisV10ReaderBody .tis-v10-highlight')].map(el=>({
    text:el.textContent,start:Number(el.dataset.start),end:Number(el.dataset.end)}));
   return {status:controller.status,revision:controller.revision,sourceRevision:session.revision,
    screen:document.body.dataset.v10Screen,sourceUnchanged:session.text===document.getElementById('source').value,
    sameOriginal:document.getElementById('tisV10ReaderBody').textContent===session.text,
    highlighted:spans,
    validatedSegments:controller.evidence?.segments?.map(s=>({start:s.start,end:s.end}))||[],
    notice:document.getElementById('tisV10ResultSummary').textContent};
  });
  assert(['RESEARCH_SIGNAL','INCONCLUSIVE'].includes(actual.status),
   'real validated evidence required, no fake score: '+JSON.stringify({status:actual.status,failures,pageErrors}));
  assert.equal(actual.revision,revision);assert.equal(actual.sourceRevision,revision);
  assert.equal(actual.screen,'results');assert.equal(actual.sourceUnchanged,true);
  assert.equal(actual.sameOriginal,true,'rebuild the original unchanged from validated source ranges');
  assert.match(actual.notice,/not AI-authorship probability|Inconclusive/i,'do not assert inferred authorship');
  if(actual.status==='RESEARCH_SIGNAL'){
   assert.equal(actual.highlighted.length,actual.validatedSegments.length,'only real validated windows highlighted');
   for(let i=0;i<actual.highlighted.length;i++){
    const s=actual.highlighted[i],v=actual.validatedSegments[i];
    assert.equal(s.start,v.start);assert.equal(s.end,v.end);
    assert.equal(s.text,english.slice(s.start,s.end));
   }
  }else assert.equal(actual.highlighted.length,0,'inconclusive evidence must not paint AI highlights');
  assert(requests.every(x=>x.method==='GET'&&!x.canaryInUrl&&!x.canaryInPayload),
   'source text may not be sent to the model hosting endpoints');
  assert.equal(pageErrors.length,0,'no client runtime errors');
  const dir=process.env.TIS_SCREENSHOT_DIR;
  if(dir){fs.mkdirSync(dir,{recursive:true});
   await page.screenshot({path:path.join(dir,'v10-1-live-onnx-results.png'),fullPage:true});}
  console.log('PASS V10.1 REAL ONNX: '+JSON.stringify({
   mode:'genuine_optional_local_model',status:actual.status,validatedWindows:actual.validatedSegments.length,
   highlightedWindows:actual.highlighted.length,sourceRevision:revision,
   externalModelHostnames:[...new Set(requests.map(x=>x.host))],pageErrors:pageErrors.length,
   sourceCanaryInExternalRequests:false
  }));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});