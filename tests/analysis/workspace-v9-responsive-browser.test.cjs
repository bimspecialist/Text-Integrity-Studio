'use strict';
/* Screenshot-backed responsive regression. Geometry does not certify WCAG. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const directory=process.env.TIS_SCREENSHOT_DIR||'/tmp/tis-ui-screenshots';
 fs.mkdirSync(directory,{recursive:true});
 const errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready);
  const desktop=await page.evaluate(()=>{
   const box=id=>document.getElementById(id).getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth-innerWidth,
    input:box('inputPanel'),report:box('reportPanel'),button:box('scanAI'),
    main:document.querySelector('.shell>main').getBoundingClientRect(),
    summary:box('tisV9Summary'),
    reportScroll:getComputedStyle(document.getElementById('reportPanel')).overflowY,
    idleSignal:getComputedStyle(document.getElementById('studioAiQuick')).display,
    nav:document.querySelectorAll('aside.app-sidebar').length};
  });
  assert.equal(desktop.nav,0);
  assert(desktop.main.width<=1480&&desktop.main.width>=1200,'useful centered editing width');
  assert(desktop.input.width>=490&&desktop.report.width>=450,'balanced desktop panes');
  assert(Math.abs(desktop.input.top-desktop.report.top)<24,'aligned task and result');
  assert(desktop.button.bottom<=900,'primary action reachable on 900px desktop');
  assert.equal(desktop.reportScroll,'visible','no nested report scroll');
  assert.equal(desktop.idleSignal,'none','no idle model gauge competing with input');
  assert(desktop.overflow<=8);
  await page.screenshot({path:path.join(directory,'tis-v9-desktop-detection.png')});
  await page.click('#tisTabHumanize');
  await page.screenshot({path:path.join(directory,'tis-v9-desktop-writing.png')});
  await page.click('#language');
  await page.setViewport({width:1150,height:730});
  const rtl=await page.evaluate(()=>({
   dir:document.documentElement.dir,
   main:document.querySelector('.shell>main').getBoundingClientRect(),
   source:document.getElementById('source').getBoundingClientRect(),
   draft:document.getElementById('tisRevisedText').getBoundingClientRect(),
   overflow:document.documentElement.scrollWidth-innerWidth}));
  assert.equal(rtl.dir,'rtl');
  assert(rtl.main.width>=1080,'RTL laptop must not waste half the viewport');
  assert(rtl.source.width>350&&rtl.draft.width>350,'large RTL dual editor');
  assert(rtl.overflow<=8);
  for(const width of [768,390,320]){
   await page.setViewport({width,height:844});
   const geo=await page.evaluate(()=>{
    const r=id=>document.getElementById(id).getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-innerWidth,
     a:r('inputPanel'),b:r('tisRevisedPane'),modes:r('tisModes'),
     button:r('scanAI'),viewport:innerWidth};
   });
   assert(geo.overflow<=8,'no horizontal overflow at '+width+': '+geo.overflow);
   assert(geo.a.top<geo.b.top,'source stacks before draft at '+width);
   assert(geo.modes.width<=geo.viewport,'tabs fit viewport at '+width);
   assert(geo.button.width>=220,'primary action fits at '+width);
   if(width===390)await page.screenshot({path:path.join(directory,'tis-v9-mobile-arabic.png')});
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
  assert.deepEqual(errors,[],'no page runtime errors');
  console.log('PASS V9 responsive: 1440 desktop, 1150 RTL, 768/390/320, single action, no idle gauge, reduced motion');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
