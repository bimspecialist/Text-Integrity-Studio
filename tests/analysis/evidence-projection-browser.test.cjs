'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>!!window.TISEvidenceProjection?.projectEvidence),true,
   'Readiness and results scripts must load one shared evidence projection');
  await page.evaluate(()=>{
   const original=window.TISEvidenceProjection.projectEvidence;
   window.__projectionCalls=0;
   window.TISEvidenceProjection={
    ...window.TISEvidenceProjection,
    projectEvidence(...args){window.__projectionCalls++;return original(...args);}
   };
  });
  const first=Array(80).fill('Engineers measured and reviewed structural test results.').join(' ');
  const second=Array(80).fill('An unrelated engineering paragraph was included in the document.').join(' ');
  const text=first+'\n\n'+second;
  await page.$eval('#source',(el,val)=>{
   el.value=val;
   el.dispatchEvent(new Event('input',{bubbles:true}));
  },text);
  await page.waitForFunction(()=>
   document.querySelectorAll('#studioSectionList .studio-section-item').length>=2,{timeout:5000});
  await page.evaluate(()=>{
   const t=document.getElementById('source').value;
   const firstEnd=t.indexOf('\n\n');
   window.dispatchEvent(new CustomEvent('tis:ai-evidence',{detail:{
    version:'TIS_CONSENSUS_V2_2026_10',
    calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
    model_id:'onnx-community/tmr-ai-text-detector-ONNX',
    sourceLength:t.length,status:'INSUFFICIENT_COVERAGE',
    displayedSignalPercent:null,documentCoverage:45,
    segments:[{start:0,end:firstEnd,signal:73.5,words:560,tokens:200}]
   }}));
  });
  await page.waitForFunction(()=>window.__projectionCalls>=2,{timeout:5000});
  const values=await page.$$eval('#v5BreakdownRows .v5-breakdown-row',nodes=>
   nodes.map(el=>({text:el.textContent,unscored:el.classList.contains('is-unscored')})));
  assert.equal(values.length,2,'both mapped paragraphs displayed');
  assert.equal(values[0].unscored,false,'an actually covered paragraph retains its raw model-window signal');
  assert.equal(values[1].unscored,true,'an unscanned paragraph is never assigned an AI percentage');
  assert.match(values[0].text,/73\.5/);
  assert(!/73\.5/.test(values[1].text),'model evidence must not spread into the unscanned section');
  const details=await page.$eval('#studioSectionList',el=>el.textContent);
  assert.match(details,/73\.5/,'Writing review shows same source-aligned model value');
  assert.deepEqual(errors,[],'No browser exception during shared projection');
  console.log('PASS R7: original and writing-review views use the same measured paragraph coverage');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
