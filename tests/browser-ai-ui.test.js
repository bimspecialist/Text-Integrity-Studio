'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');

const modelFixture = '<!doctype html><html><body><script>'+
 "window.addEventListener('message',function(e){"+
 "if(e.origin!==location.origin || e.data.op!=='RUN')return;"+
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'RESULT',requestId:e.data.requestId,result:"+
 "{score:64.2,language:'en',sampleCount:1,words:245,confidence:'UNVALIDATED',"+
 "model_id:'onnx-community/tmr-ai-text-detector-ONNX',"+
 "calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE'}},location.origin);"+
 "});"+
 "window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:''},location.origin);"+
 '</script></body></html>';

async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const output=process.env.TIS_SCREENSHOT_DIR||path.join(os.tmpdir(),'tis-ui-screenshots');
 fs.mkdirSync(output,{recursive:true});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:1366,height:920,deviceScaleFactor:1});
  const errors=[],thirdParty=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')thirdParty.push(r.url());});
  await page.setRequestInterception(true);
  page.on('request',req=>{
   if(req.url().endsWith('/ai-runtime.html')){
    return req.respond({status:200,contentType:'text/html; charset=utf-8',body:modelFixture});
   }
   return req.continue();
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#aiRun');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'External model iframe is absent until opt-in');
  assert.equal(await page.$eval('#aiBar',e=>e.hidden),true,'No synthetic score shown by default');
  const layout=await page.evaluate(()=>{
   const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,top:r.top,width:r.width};};
   return {rail:rect('navEditor'),editor:rect('inputPanel'),results:rect('reportPanel')};
  });
  assert(layout.editor.left>layout.rail.left,'Workspace sidebar visible on desktop');
  assert(layout.results.left>layout.editor.left,'Results form a distinct right-hand column');
  await page.screenshot({path:path.join(output,'workspace-desktop.png'),fullPage:true});

  const arabic=('هذه تجربة عربية هندسية كتبها الباحث بنفسه واستعرض فيها النتائج وملاحظات القياس بشكل واضح. ').repeat(18);
  await page.$eval('#source',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},arabic);
  await page.click('#aiRun');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'Arabic input is not sent to an English model');
  assert((await page.$eval('#aiStatus',el=>el.textContent)).includes('English'),'Unsupported language explained rather than invented');

  const english=('Students documented the engineering experiment and described their measurements in independent notes. ').repeat(22);
  await page.$eval('#source',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},english);
  await page.click('#aiRun');
  await page.waitForSelector('#tisOnDeviceModel');
  await page.waitForFunction(()=>document.querySelector('#aiMeterScore')?.textContent.includes('64.2%'),{timeout:10000});
  assert.equal(await page.$eval('#aiBar',e=>e.value),64.2);
  assert((await page.$eval('#aiShort',n=>n.textContent)).includes('experimental'),'Experimental interpretation always visible');
  assert.equal(thirdParty.length,0,'No remote executable/model fetch in mock before live model download');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  assert((await page.$eval('#aiBadge',n=>n.textContent)).includes('تجريبي'));
  await page.setViewport({width:390,height:844});
  await page.screenshot({path:path.join(output,'workspace-mobile-rtl.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert(overflow<=8,'Arabic phone viewport fits without horizontal scrolling');
  assert.deepEqual(errors,[],'No uncaught errors');
  console.log('PASS real navy workspace, explicit model opt-in, Arabic abstention, model mock score, RTL/mobile');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
}
run().catch(err=>{console.error(err);process.exit(1);});
