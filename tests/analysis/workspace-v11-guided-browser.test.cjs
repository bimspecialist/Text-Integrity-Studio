'use strict';
/* V11 M1: real Chromium acceptance of the *opt-in* local writing review.
 * No fake model scores; source and suggestions come from the actual app.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const en='In order to complete the study, we recieved the measurments at the site. teh report includes findings.';
const ar='هاذا تعبير محلي قصدت كتابته بهاذه الطريقة، لاكن التقرير الفني يتطلب مراجعة.';
async function insert(page,text){
 await page.$eval('#source',(el,t)=>{el.value=t;el.dispatchEvent(new Event('input',{bubbles:true}));},text);
}
async function run(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-v11-m1-'));
 const saved=path.join(temp,'text-integrity-writing-review.json');
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const exceptions=[],unexpectedRequests=[],shots=process.env.TIS_SCREENSHOT_DIR;
 if(shots)fs.mkdirSync(shots,{recursive:true});
 try{
  const page=await browser.newPage();
  const cdp=await page.target().createCDPSession();
  await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:temp});
  page.on('pageerror',e=>exceptions.push(e.message));
  page.on('request',r=>{
   const url=new URL(r.url());
   if(url.hostname!=='127.0.0.1')unexpectedRequests.push(url.hostname);
   if(/ai-runtime\.html/i.test(url.pathname))unexpectedRequests.push('unexpected-model-iframe');
  });
  const save=async label=>{
   if(shots)await page.screenshot({path:path.join(shots,label+'.png'),fullPage:true});
  };
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('tis-v11')),true);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('tis-v10')),true);
  assert.equal(await page.$eval('#tisV11Research',e=>e.open),false);
  assert.equal(await page.$eval('#scanAI',e=>e.textContent.includes('Review text')),true);
  const first=await page.$eval('#scanAI',e=>({bottom:e.getBoundingClientRect().bottom,screen:innerHeight}));
  assert(first.bottom<=first.screen,'Review text must be above the first desktop fold');
  await save('v11-m1-input-en');
  await page.click('#scanAI');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'input');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'source');
  assert.equal(await page.$eval('#tisV11InputStatus',e=>e.textContent.includes('Add text')),true);
  await insert(page,en);
  const before=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.focus('#scanAI');await page.keyboard.press('Enter');
  const review=await page.evaluate(()=>({
   screen:document.body.dataset.v10Screen,
   state:window.TISAnalysisApp.controller.getState().status,
   actual:window.TISAnalysisApp.review.getSuggestions().length,
   exposed:window.TISWorkspaceV11.reviewState(),
   source:window.TISAnalysisApp.session.read().text,
   revision:window.TISAnalysisApp.session.read().revision,
   focus:document.activeElement.id,
   hasResearchNumber:/(\d+(?:\.\d+)?% AI|AI-written: \d+%)/i.test(document.getElementById('tisV11GuidedReview').textContent)
  }));
  assert.equal(review.screen,'guided-review');
  assert(!['LOADING','ANALYZING','RESEARCH_SIGNAL'].includes(review.state),
   'The primary M1 action must never invoke research model analysis');
  assert.equal(review.actual,review.exposed.suggestions);
  assert(review.actual>=2,'Known-rule sample should produce real grounded suggestions');
  assert.equal(review.exposed.revision,before);
  assert.equal(review.revision,before);
  assert.equal(review.source,en);
  assert.equal(review.focus,'tisV11Heading');
  assert.equal(review.hasResearchNumber,false);
  assert.equal(await page.$$eval('#tisV11SuggestionList li',els=>els.length),review.actual);
  assert.deepEqual(unexpectedRequests,[],'One-click local review cannot fetch remote model assets');
  await save('v11-m1-results-en');
  console.log('PASS V11 M1: one keyboard action yields real grounded EN writing observations, without model requests or edits');

  await page.focus('#tisV11Export');await page.keyboard.press('Enter');
  for(let i=0;i<80&&!fs.existsSync(saved);i++)await new Promise(ok=>setTimeout(ok,100));
  assert(fs.existsSync(saved),'Local JSON writing export must work from the guided result');
  const bytes=fs.readFileSync(saved,'utf8'),json=JSON.parse(bytes);
  assert.equal(json.application,'Text Integrity Studio');
  assert(json.analysis&&json.disclaimer);
  assert(!bytes.includes(en),'Export must exclude original source text');
  assert.equal(await page.$eval('#tisV11Status',e=>e.textContent.includes('saved locally')),true);

  await page.click('#tisV11Improve');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'writing');
  assert.equal(await page.$eval('#source',e=>e.value),en);
  await page.$eval('#tisRevisedText',e=>{e.value='Unapplied reviewer draft';e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),en,
   'Typing in the revised pane must not mutate canonical source');
  await page.click('#tisV10BackFromWriting');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
  assert.equal(await page.$eval('#source',e=>e.value),en);
  await page.click('#tisV11Edit');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'input');

  await page.click('#language');
  const switched=await page.evaluate(()=>({
   locale:document.documentElement.lang,
   visibleButton:document.querySelector('#scanAI .v5-action-title')?.textContent,
   accessibleName:document.getElementById('scanAI')?.getAttribute('aria-label'),
   view:document.body.dataset.v10Screen,
   mode:document.body.dataset.tisMode
  }));
  console.log('V11 language transition diagnostic',JSON.stringify(switched));
  await page.waitForFunction(()=>document.documentElement.lang==='ar'&&
   document.getElementById('scanAI').getAttribute('aria-label')==='مراجعة النص',{timeout:3500});
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  await insert(page,ar);
  const newRev=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.click('#scanAI');
  const arReview=await page.evaluate(()=>({
   screen:document.body.dataset.v10Screen,
   suggestions:window.TISWorkspaceV11.reviewState().suggestions,
   source:window.TISAnalysisApp.session.read().text,
   heading:document.getElementById('tisV11Heading').textContent,
   revision:window.TISWorkspaceV11.reviewState().revision,
   overflow:document.documentElement.scrollWidth-innerWidth,
   notes:[...document.querySelectorAll('#tisV11SuggestionList .tis-v11-reason')].map(e=>e.textContent)
  }));
  assert.equal(arReview.screen,'guided-review');
  assert(arReview.suggestions>=1,'Arabic sample must produce local advice');
  assert.equal(arReview.source,ar);
  assert.equal(arReview.revision,newRev);
  assert.match(arReview.heading,/مراجعة/);
  assert(arReview.notes.some(t=>/[\u0600-\u06FF]/u.test(t)),
   'Arabic writing advice must include Arabic explanations');
  assert(arReview.overflow<=8,'Arabic mobile review must not overflow horizontally');
  assert.deepEqual(unexpectedRequests,[],'Arabic review must remain local without model traffic');
  await save('v11-m1-results-ar-mobile');
  await page.click('#tisV11Edit');
  await insert(page,ar+' جملة جديدة.');
  assert.equal(await page.evaluate(()=>window.TISWorkspaceV11.reviewState().revision),null,
   'Editing must invalidate prior result revision');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'input');
  console.log('PASS V11 M1: AR/RTL mobile advice, local export, safe edit/return and source revision invalidation');

  // A separate explicit secondary research affordance remains reachable,
  // but is not invoked during one-click writing review.
  assert.equal(await page.$eval('#tisV11Research',e=>e.open),false);
  await page.click('#tisV11ResearchTitle');
  assert.equal(await page.$eval('#tisV11Research',e=>e.open),true);
  assert.equal(await page.$eval('#tisV11ResearchRun',e=>e.getClientRects().length>0),true);
  assert(/غير معايرة/.test(await page.$eval('#tisV11ResearchHelp',e=>e.textContent)));
  assert.deepEqual(unexpectedRequests,[]);

  // The older V10 view must remain unchanged behind its original flag.
  const old=await browser.newPage();
  try{
   await old.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
   assert.equal(await old.evaluate(()=>document.body.classList.contains('tis-v11')),false);
   assert.equal(await old.$('#tisV11GuidedReview'),null);
   await insert(old,'نص عربي قصير للفحص.');
   await old.click('#scanAI');
   assert.equal(await old.evaluate(()=>document.body.dataset.v10Screen),'eligibility');
  }finally{await old.close();}
  const defaultPage=await browser.newPage();
  try{
   await defaultPage.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
   assert.equal(await defaultPage.evaluate(()=>document.body.classList.contains('tis-v10')),false);
   assert.equal(await defaultPage.evaluate(()=>document.body.classList.contains('tis-v11')),false);
  }finally{await defaultPage.close();}
  assert.deepEqual(exceptions,[]);
  console.log('PASS V11 M0: existing V10 research gate and default V9 remain isolated from M1');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
  fs.rmSync(temp,{recursive:true,force:true});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
