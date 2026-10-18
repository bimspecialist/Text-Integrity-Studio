'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],outside=[];
 try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:900});
  page.on('pageerror',err=>errors.push(err.message));
  page.on('request',request=>{if(new URL(request.url()).hostname!=='127.0.0.1')outside.push(new URL(request.url()).hostname);});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});

  const shotDir=process.env.TIS_SCREENSHOT_DIR;
  if(shotDir)require('node:fs').mkdirSync(shotDir,{recursive:true});
  const saveShot=async name=>{if(shotDir)await page.screenshot({path:require('node:path').join(shotDir,name),fullPage:true});};
  assert.equal(await page.$eval('#source',el=>el.getAttribute('dir')),'auto','mixed technical text needs own bidi direction');
  const passage='Measured source sentence with 25 kPa [12] values.';
  const original='The first test summary was recorded.\n'+passage+'\nThe remaining paragraph stays unchanged.';
  await page.$eval('#source',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));},original);
  const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.evaluate(rev=>window.TISWorkspaceV10.setAnalysisState({status:'LOADING',stage:'LOADING',requestId:'test-v10',revision:rev}),revision);
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'progress');
  assert.equal(await page.$eval('#tisV10Meter',el=>el.hasAttribute('value')),false,'indeterminate model startup cannot claim progress');
  assert.equal(await page.$eval('#tisV10Meter',el=>el.hasAttribute('aria-valuenow')),false);
  const wrong=await page.evaluate(()=>window.TISWorkspaceV10.setProgress({stage:'ANALYZING',percent:85,requestId:'different'}));
  assert.equal(wrong,false,'reject stale window progress');
  await page.evaluate(()=>window.TISWorkspaceV10.setProgress({stage:'ANALYZING',percent:25,requestId:'test-v10'}));
  assert.equal(await page.$eval('#tisV10Meter',el=>el.getAttribute('aria-valuenow')),'25');
  assert.equal(await page.$eval('#tisV10Meter',el=>Number(el.value)),25);
  await saveShot('v10-1-desktop-progress-synthetic.png');
  const begin=original.indexOf(passage),end=begin+passage.length;
  await page.evaluate(({revision,begin,end})=>window.TISWorkspaceV10.setAnalysisState({
   status:'RESEARCH_SIGNAL',requestId:'test-v10',revision,
   evidence:{kind:'RESEARCH_SIGNAL',revision,documentCoverageWordsPercent:70,
    segments:[{start:begin,end,signal:51,words:10,tokens:13}]}
  }),{revision,begin,end});
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'results');
  assert.equal(await page.$eval('#tisV10ReaderBody',el=>el.textContent),original,'reader must preserve every original character');
  assert.equal(await page.$eval('#tisV10ReaderBody .tis-v10-highlight',els=>els.length),1);
  assert.match(await page.$eval('#tisV10HighlightLegend',el=>el.textContent),/highlight.*evaluated|evaluated.*window/i,'legend must say that yellow does not mean proven AI authorship');
  assert.match(await page.$eval('#tisV10ResultSummary',el=>el.textContent),/not AI-authorship probability/i);
  await saveShot('v10-1-desktop-results-synthetic.png');
  await page.click('#language'); // Arabic UI with English source
  assert.equal(await page.$eval('#tisV10ReaderBody',el=>el.getAttribute('dir')),'auto');
  assert.match(await page.$eval('#tisV10HighlightLegend',el=>el.textContent),/مقاطع|النوافذ/u,'legend must be translated in Arabic');
  assert.match(await page.$eval('#tisV10ReaderBody',el=>el.getAttribute('aria-label')),/\p{Script=Arabic}/u,'result reader accessible label translated');
  await page.setViewport({width:390,height:844});
  await page.click('#tisV10ReaderBody .tis-v10-highlight');
  assert.equal(await page.$eval('#tisV10InspectorDialog',el=>el.open),true,'mobile passage details use native dialog');

  const modalGeometry=await page.evaluate(()=>{
   const dlg=document.getElementById('tisV10InspectorDialog');
   const rect=dlg.getBoundingClientRect();
   return {left:rect.left,right:rect.right,width:rect.width,
    vw:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    scrollX,dir:document.documentElement.dir};
  });
  console.log('V10.1 mobile modal geometry',JSON.stringify(modalGeometry));
  assert(modalGeometry.left>=-2&&modalGeometry.right<=modalGeometry.vw+2,
   'mobile modal must stay entirely inside phone viewport');
  assert(modalGeometry.scrollWidth-modalGeometry.vw<=8,
   'opening mobile modal must not introduce page horizontal overflow');

  await saveShot('v10-1-mobile-inspector-synthetic.png');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#tisV10InspectorDialog',el=>el.open),false);
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('tis-v10-highlight')),true,'focus returns to selected window');
  await page.click('#tisV10Edit');
  assert.equal(await page.$eval('#source',el=>el.value),original,'return to editor preserves original');
  await page.$eval('#source',el=>{el.value+=' A revision was added.';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$$eval('#tisV10ReaderBody .tis-v10-highlight',els=>els.length),0,'source revision immediately clears stale highlights');
  assert.deepEqual(errors,[],'no script exceptions');
  assert.deepEqual(outside,[],'no external requests needed to display synthetic fixture evidence');
  console.log('PASS V10.1 browser: honest scoped progress, revision-safe highlights, Arabic inspector and keyboard focus');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});