'use strict';
/* Opt-in GitHub Pages preview and independent browser QA desk acceptance.
 * This tests software behavior, NEVER simulates physical NVDA/TalkBack/VoiceOver
 * or fabricated human editorial evaluation.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const source='teh engineering report was recieved at the site. The column strength was 25 MPa [12].';
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-v11-site-'));
 const errors=[],outside=[];
 const imageDir=process.env.TIS_SITE_PREVIEW_SHOTS||'';
 if(imageDir)fs.mkdirSync(imageDir,{recursive:true});
 async function shot(page,name){if(imageDir)await page.screenshot({path:path.join(imageDir,name+'.png'),fullPage:true});}
 try{
  const base='http://127.0.0.1:'+server.address().port+'/';
  const v9=await browser.newPage();
  v9.on('pageerror',e=>errors.push(e.message));
  await v9.goto(base,{waitUntil:'load'});
  assert.equal(await v9.evaluate(()=>document.body.classList.contains('tis-v11')),false);
  assert.equal(await v9.evaluate(()=>document.body.classList.contains('tis-v10')),false);
  assert.equal(await v9.$('#tisV11QaInput'),null);
  await v9.close();
  console.log('PASS V11 Pages preview: unflagged public route stays V9');

  const preview=await browser.newPage();
  preview.on('pageerror',e=>errors.push(e.message));
  preview.on('request',r=>{
   const u=new URL(r.url());if(u.hostname!=='127.0.0.1')outside.push(u.href);
  });
  await preview.setViewport({width:1440,height:900});
  await preview.goto(base+'?v11preview=1',{waitUntil:'load'});
  assert.equal(await preview.evaluate(()=>document.body.classList.contains('tis-v11')),true);
  assert.equal(await preview.$eval('#scanAI',e=>e.textContent.includes('Review text')),true);
  assert.equal(await preview.$eval('#tisV11QaInput',e=>e.getAttribute('href')),'quality/v11-manual-acceptance.html');
  await preview.$eval('#source',(e,s)=>{e.value=s;e.dispatchEvent(new Event('input',{bubbles:true}));},source);
  await preview.focus('#scanAI');await preview.keyboard.press('Enter');
  assert.equal(await preview.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
  assert(await preview.$('#tisV11QaResults'),'Results must link to the real QA desk');
  assert.equal(await preview.$eval('#source',e=>e.value),source);
  await shot(preview,'v11-online-preview-en');
  await preview.close();
  console.log('PASS V11 Pages preview: one-click local review and visible QA links');

  const qa=await browser.newPage();
  qa.on('pageerror',e=>errors.push(e.message));
  qa.on('request',r=>{
   const u=new URL(r.url());if(u.hostname!=='127.0.0.1')outside.push(u.href);
  });
  const cdp=await qa.createCDPSession();
  await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:temp});
  await qa.setViewport({width:390,height:850});
  await qa.goto(base+'quality/v11-manual-acceptance.html',{waitUntil:'load'});
  const initial=await qa.evaluate(()=>({
   lang:document.documentElement.lang,dir:document.documentElement.dir,
   cases:document.querySelectorAll('#caseList button').length,
   samples:document.getElementById('sampleSelect').options.length,
   unrun:document.getElementById('statNotRun').textContent,
   passed:document.getElementById('statPass').textContent,
   headCsp:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
   anchor:document.getElementById('livePreview').getAttribute('href'),
   local:localStorage.length,session:sessionStorage.length
  }));
  assert.deepEqual({lang:initial.lang,dir:initial.dir,cases:initial.cases,samples:initial.samples,unrun:initial.unrun,passed:initial.passed},
   {lang:'ar',dir:'rtl',cases:18,samples:60,unrun:'18',passed:'0'});
  assert.equal(initial.anchor,'../?v11preview=1');
  assert(!initial.headCsp.includes('unsafe-inline'),'QA site must not weaken CSP');
  assert(initial.headCsp.includes("connect-src 'none'"),'QA site must block outbound app connections');
  assert.equal(initial.local,0);assert.equal(initial.session,0);
  assert((await qa.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8);
  await shot(qa,'v11-online-manual-desk-ar');

  await qa.select('#caseStatus','PASS');
  await qa.click('#saveCase');
  assert.equal(await qa.$eval('#statPass',e=>e.textContent),'0','Blank PASS must be rejected');
  await qa.type('#caseTester','QA-01');
  await qa.type('#caseDevice','Windows 11 / Chrome / NVDA fixture note');
  await qa.type('#caseObservation','Observed example only: this test verifies form validation, not real NVDA.');
  await qa.type('#caseEvidence','TEST-FIXTURE-NOT-A-PHYSICAL-RESULT');
  await qa.select('#caseStatus','PASS');
  await qa.click('#saveCase');
  assert.equal(await qa.$eval('#statPass',e=>e.textContent),'1');
  const literal='<img src="https://attacker.invalid/no.png" onerror="alert(1)">';
  await qa.$eval('#caseObservation',(e,value)=>{e.value=value;},literal);
  await qa.click('#saveCase');
  assert.equal(await qa.$$eval('img',nodes=>nodes.length),0,'Untrusted observations must never become executable markup');
  await qa.click('#toggleLanguage');
  assert.equal(await qa.evaluate(()=>document.documentElement.lang),'en');
  assert.equal(await qa.$eval('#statPass',e=>e.textContent),'1');
  await qa.click('#tabSamples');
  await qa.type('#reviewerA','R1');
  await qa.type('#reviewerB','R1'); // Same reviewer must be rejected
  await qa.type('#sampleSource','licensed-test-source-001');
  await qa.click('#sampleVerified');
  for(const [id,value] of [['sampleTotal','2'],['aReviewed','2'],['aUseful','2'],['aRisk','0'],['bReviewed','2'],['bUseful','2'],['bRisk','0']]){
   await qa.type('#'+id,value);
  }
  await qa.click('#saveSample');
  assert.equal(await qa.$eval('#statSamples',e=>e.textContent),'0 / 60','Duplicate reviewer codes must not count');
  await qa.$eval('#reviewerB',e=>{e.value='R2';});
  await qa.click('#saveSample');
  assert.equal(await qa.$eval('#statSamples',e=>e.textContent),'1 / 60');
  await qa.click('#tabSummary');
  assert.match(await qa.$eval('#releaseWarning',e=>e.textContent),/separate explicit approval/i);
  await shot(qa,'v11-online-summary-en');
  await qa.click('#exportEvidence');
  const out=path.join(temp,'tis-v11-manual-evidence-'+new Date().toISOString().slice(0,10)+'.json');
  for(let i=0;i<60&&!fs.existsSync(out);i++)await new Promise(done=>setTimeout(done,100));
  assert(fs.existsSync(out),'Evidence download must be a real browser download');
  const json=JSON.parse(fs.readFileSync(out,'utf8'));
  assert.equal(json.schema,'tis-v11-m5-manual-v1');
  assert.equal(json.releaseStatus,'HOLD');
  assert.equal(json.summary.pass,1);
  assert.equal(json.samples.length,60);
  assert.equal(json.samples[0].id,'EN001');
  assert(!fs.readFileSync(out,'utf8').includes(source),'Do not export unrelated document source');
  await qa.reload({waitUntil:'load'});
  assert.equal(await qa.$eval('#statNotRun',e=>e.textContent),'18','Refresh resets unsaved evidence memory');
  await qa.$eval('#evidenceFile',(el,value)=>{
   const data=new DataTransfer();
   data.items.add(new File([value],'saved.json',{type:'application/json'}));
   el.files=data.files;el.dispatchEvent(new Event('change',{bubbles:true}));
  },fs.readFileSync(out,'utf8'));
  await qa.waitForFunction(()=>document.getElementById('statPass').textContent==='1',{timeout:5000});
  assert.equal(await qa.$eval('#statSamples',e=>e.textContent),'1 / 60');
  assert.deepEqual(outside,[]);
  assert.deepEqual(errors,[]);
  await qa.close();
  console.log('PASS V11 Pages QA desk: 18 unrun, 60 blanks, strict CSP, bilingual, PASS evidence validation, independent raters, JSON download/import, no external requests');
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
  fs.rmSync(temp,{force:true,recursive:true});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
