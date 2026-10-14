'use strict';
/* V8: REAL Chromium visual/layout/workflow contract, not detector-model quality.
 * All screenshots use synthetic public fixture text; no user documents.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const first='The engineering report describes the site observations, measurements and project scope. ';
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const shots=process.env.TIS_SCREENSHOT_DIR||'/tmp/tis-ui-screenshots';
 fs.mkdirSync(shots,{recursive:true});
 const errors=[],egress=[],broken=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(new URL(req.url()).hostname!=='127.0.0.1')egress.push(req.url());});
  page.on('response',r=>{if(r.status()>=400)broken.push(r.url()+' '+r.status());});
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready);
  assert(await page.$('link[href*="workspace-v8.css"]'),'dedicated V8 design system must load');
  assert(await page.$('#tisV8Paste'),'real local paste action must be present');
  assert(await page.$('#tisV8Context'),'new context/navigation hierarchy must be present');
  const layout=await page.evaluate(()=>{
   const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom};};
   return {width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
    top:rect('scanAI'),source:rect('source'),report:rect('reportPanel'),
    modes:rect('tisModes'),background:getComputedStyle(document.body).backgroundColor,
    sidebar:getComputedStyle(document.querySelector('aside.app-sidebar')).display};
  });
  assert(layout.overflow<=8,'no horizontal scroll on desktop');
  assert(layout.source.w>350&&layout.report.w>300,'detector offers useful split input/results');
  assert(layout.source.x<layout.report.x,'English original precedes result');
  assert(layout.top.bottom<=900,'primary Analyze Text is visible at 900px desktop height');
  assert(layout.source.y>layout.modes.y,'document follows the mode tabs');
  assert(layout.background!=='rgb(255, 255, 255)');
  assert.equal(await page.$eval('#tisLocalRewrite',n=>n.disabled),true,
   'the unverified local generator cannot be enabled by design alone');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'no pre-consent AI download');

  await page.$eval('#source',(el,txt)=>{el.value=txt;el.dispatchEvent(new Event('input',{bubbles:true}));},first.repeat(2));
  await page.click('#tisTabHumanize');
  assert.equal(await page.$eval('#tisRevisedPane',n=>getComputedStyle(n).display!=='none'),true);
  const dual=await page.evaluate(()=>{
   const a=document.getElementById('source').getBoundingClientRect();
   const b=document.getElementById('tisRevisedText').getBoundingClientRect();
   return {x1:a.x,x2:b.x,w1:a.width,w2:b.width,dy:Math.abs(a.top-b.top),
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert(dual.x2>dual.x1&&dual.w1>300&&dual.w2>300,'independent side-by-side editors');
  assert(dual.dy<130,'before and after panes align as one comparison workspace');
  assert(dual.overflow<=8);
  await page.screenshot({path:path.join(shots,'tis-v8-desktop-humanize.png')});
  await page.click('#tisTabDetection');
  await page.screenshot({path:path.join(shots,'tis-v8-desktop-detection.png')});

  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  await page.click('#tisTabEditor');
  await page.setViewport({width:390,height:844});
  const mobile=await page.evaluate(()=>{
   const rect=id=>document.getElementById(id).getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth-innerWidth,
    beforeBottom:rect('inputPanel').bottom,afterTop:rect('tisRevisedPane').top,
    afterWidth:rect('tisRevisedPane').width,
    tabCount:document.querySelectorAll('#tisModes [role=tab]').length,
    tabVisible:rect('tisModes').width<=innerWidth+3};
  });
  assert(mobile.overflow<=8,'Arabic 390px layout does not overflow');
  assert(mobile.beforeBottom<=mobile.afterTop+9,'mobile editors stack in reading order');
  assert(mobile.afterWidth<=390,'mobile revised editor fits viewport');
  assert.equal(mobile.tabCount,3);assert.equal(mobile.tabVisible,true);
  assert.equal(await page.$eval('#source',e=>e.value),first.repeat(2));
  await page.screenshot({path:path.join(shots,'tis-v8-mobile-arabic.png')});
  await page.setViewport({width:320,height:700});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,
   'narrow 320px viewport does not lose primary controls');
  // Responsive RTL laptop: hiding the sidebar must release its entire grid
  // width, not leave a giant empty column to the left of the writing panes.
  await page.setViewport({width:1150,height:730});
  const mid=await page.evaluate(()=>{
   const main=document.querySelector('main').getBoundingClientRect();
   const workspace=document.querySelector('.workspace').getBoundingClientRect();
   const shell=document.querySelector('.shell').getBoundingClientRect();
   return {mainWidth:main.width,mainLeft:main.left,
    workspaceWidth:workspace.width,shellWidth:shell.width,
    columns:getComputedStyle(document.querySelector('.shell')).gridTemplateColumns};
  });
  assert(mid.mainWidth>=1050&&mid.workspaceWidth>=1000,
   'RTL tablet/laptop must not waste half the viewport: '+JSON.stringify(mid));
  for(const id of ['scanAI','file','wordToolbar','aiEvidence','pdfTools','v5Toolbox','studioExportTop'])
   assert(await page.$('#'+id),'retain existing analysis and document flow #'+id);
  assert.deepEqual(egress,[],'no egress before a user starts model scan');
  assert.deepEqual(broken,[],'no 404 assets');
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('PASS V8 real Chromium: dark desktop, equal-pane Humanize, source/result detection, 390px Arabic RTL, 320px, no unconsented requests');
  if(process.env.TIS_V8_EMBED_VISUAL==='1'){
   await page.setViewport({width:1150,height:730});
   await page.click('#tisTabHumanize');
   const jpeg=await page.screenshot({type:'jpeg',quality:43});
   console.log('TIS_V8_VISUAL_JPEG_B64='+jpeg.toString('base64'));
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
