'use strict';
/* V10.2: real Chromium interaction tests for the opt-in preview only.
 * Synthetic display-only research evidence is used for export/navigation QA;
 * this test does not claim detector accuracy or contact a model provider.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function run(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-v10-accept-'));
 const downloadDir=path.join(tmp,'downloads');fs.mkdirSync(downloadDir);
 const file=path.join(tmp,'keyboard-import.txt');
 const original='Field measurements were independently checked before the foundation design review.';
 fs.writeFileSync(file,original,'utf8');
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],outside=[];
 const shotDir=process.env.TIS_SCREENSHOT_DIR;
 if(shotDir)fs.mkdirSync(shotDir,{recursive:true});
 try{
  const page=await browser.newPage();
  const cdp=await page.target().createCDPSession();
  await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{
   const host=new URL(request.url()).hostname;
   if(!['127.0.0.1'].includes(host))outside.push(host);
  });
  const save=async filename=>{
   if(shotDir)await page.screenshot({path:path.join(shotDir,filename),fullPage:true});
  };
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'input');

  // The native file picker must be reachable by keyboard, without a mouse.
  await page.focus('#file');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'file');
  assert.equal(await page.$eval('label.file-input',el=>!!el.getClientRects().length),true);
  const chooserPromise=page.waitForFileChooser({timeout:7000});
  await page.keyboard.press('Enter');
  const chooser=await chooserPromise;
  await chooser.accept([file]);
  await page.waitForFunction(text=>document.getElementById('source').value===text,{timeout:12000},original);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().sourceKind),'txt');
  assert.deepEqual(outside,[],'Text import must not make third-party model requests');
  console.log('PASS V10 keyboard: real native picker, local TXT read and canonical document session');

  // An unsupported extension and oversized TXT must not replace an existing document.
  await page.evaluate(()=>{
   const input=document.getElementById('file'),data=new DataTransfer();
   data.items.add(new File(['untrusted'],'runme.exe',{type:'application/octet-stream'}));
   input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  assert.equal(await page.$eval('#source',e=>e.value),original,'Unsupported extension replaced source');
  await page.evaluate(()=>{
   const input=document.getElementById('file'),data=new DataTransfer();
   data.items.add(new File(['x'.repeat(3000010)],'oversize.txt',{type:'text/plain'}));
   input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await new Promise(ok=>setTimeout(ok,100));
  assert.equal(await page.$eval('#source',e=>e.value),original,'Oversized text replaced source');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),original);
  console.log('PASS V10 file validation: unsupported format and >3 MB leave original intact');

  // Error screens are a view-level fixture; real transport failure behavior is
  // separately covered by analysis-controller tests.
  const rev=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.evaluate(revision=>window.TISWorkspaceV10.setAnalysisState({
   status:'ERROR',requestId:'v10-error-qa',revision,errorCode:'MODEL_UNAVAILABLE'
  }),rev);
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'error');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10ErrorHeading');
  assert.equal(await page.$eval('#tisV10ErrorBack',el=>!!el.getClientRects().length),true);
  await save('v10-2-error-desktop.png');
  await page.click('#tisV10ErrorBack');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'source');
  assert.equal(await page.$eval('#source',el=>el.value),original);
  console.log('PASS V10 error/retry entry: user returns to original editor and focus');

  // Rapid cancel goes through the actual button/controller, before a model
  // download could finish. It must not invent a verdict or alter the source.
  const eligible=Array(130).fill('measured').join(' ')+' PRIVATE_MEASUREMENT_9xQ';
  const cancel=await page.evaluate(text=>{
   const source=document.getElementById('source');
   source.value=text;source.dispatchEvent(new Event('input',{bubbles:true}));
   document.getElementById('scanAI').click();
   const during=window.TISAnalysisApp.controller.getState();
   document.getElementById('tisV10Cancel').click();
   const after=window.TISAnalysisApp.controller.getState();
   return {during:during.status,after:after.status,screen:document.body.dataset.v10Screen,
    text:window.TISAnalysisApp.session.read().text,activeStatus:after.status};
  },eligible);
  assert.equal(cancel.during,'LOADING','Eligible scan must enter actual controller loading');
  assert.equal(cancel.after,'CANCELLED','Visible cancel must cancel active controller');
  assert.equal(cancel.screen,'input');
  assert.equal(cancel.text,eligible);
  assert.equal(await page.$$eval('#tisV10ReaderBody .tis-v10-highlight',es=>es.length),0);
  console.log('PASS V10 rapid cancel: actual controller, source retained, zero stale highlights');

  // A synthetic *view-only* measured passage verifies the result UI and
  // must expose an honest, local writing-report export action.
  await page.evaluate(()=>{
   document.getElementById('scan').click(); // existing local writing review only
   const snapshot=window.TISAnalysisApp.session.read();
   window.TISWorkspaceV10.setAnalysisState({
    status:'RESEARCH_SIGNAL',requestId:'v10-export-view-fixture',revision:snapshot.revision,
    evidence:{kind:'RESEARCH_SIGNAL',revision:snapshot.revision,
     documentCoverageWordsPercent:35,segments:[{start:0,end:35,signal:61,words:5,tokens:8}]}
   });
  });
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'results');
  const exportButton=await page.$('#tisV10ExportReport');
  assert(exportButton,'Results view must expose a direct report export; hidden legacy panel is not accessible');
  assert.equal(await page.$eval('#tisV10ExportReport',el=>!!el.getClientRects().length),true);
  await page.focus('#tisV10ExportReport');await page.keyboard.press('Enter');
  const saved=path.join(downloadDir,'text-integrity-writing-review.json');
  for(let i=0;i<100&&!fs.existsSync(saved);i++)await new Promise(ok=>setTimeout(ok,100));
  assert(fs.existsSync(saved),'Existing report exporter was not triggered from visible V10 action');
  const output=JSON.parse(fs.readFileSync(saved,'utf8'));
  assert.equal(output.application,'Text Integrity Studio');
  assert(output.analysis&&output.disclaimer,'Export must include analysis and an honest disclaimer');
  assert(!fs.readFileSync(saved,'utf8').includes('PRIVATE_MEASUREMENT_9xQ'),'Export must not embed private source text');
  const feedback=await page.$eval('#tisV10ExportStatus',el=>el.textContent.trim());
  assert(feedback.length>0,'Result download feedback must be visible and accessible');
  await save('v10-2-results-export-desktop.png');
  await page.click('#language');
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  assert.equal(await page.$eval('#tisV10ExportReport',el=>!!el.getClientRects().length),true);
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,'RTL results/export must not overflow');
  await save('v10-2-results-export-mobile-ar.png');
  assert.deepEqual(errors,[],'Browser JavaScript exception');
  console.log('PASS V10 report: visible keyboard-triggerable JSON export, privacy/no original text, bilingual mobile');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
  fs.rmSync(tmp,{recursive:true,force:true});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
