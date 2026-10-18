'use strict';
/* Automated WCAG-tagged browser regression for M2 preview/undo/read-only.
 * Physical screen readers and actual browser zoom remain manual release gates.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const axe=require('axe-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const en='teh report was recieved at the site. The value was 25 MPa [12].';
const ar='هاذا تعبير محلي مكتوب بعناية، لاكن التقرير يحتاج مراجعة.';
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const results=[];
 try{
  for(const config of [
   {lang:'en',width:1440,kind:'paste',preview:true},
   {lang:'en',width:320,kind:'docx',preview:true},
   {lang:'ar',width:390,kind:'paste',preview:true},
   {lang:'ar',width:768,kind:'paste',preview:false}
  ]){
   const page=await browser.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.setViewport({width:config.width,height:900});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
    if(config.lang==='ar')await page.click('#language');
    const sample=config.lang==='ar'?ar:en;
    await page.evaluate(({sourceText,kind})=>{
     const el=document.getElementById('source');
     if(kind==='docx'){
      window.TISAnalysisApp.session.replaceText(sourceText,'docx');el.value=sourceText;
     }else el.value=sourceText;
     el.dispatchEvent(new Event('input',{bubbles:true}));
    },{sourceText:sample,kind:config.kind});
    await page.click('#scanAI');
    const first=await page.$('#tisV11SuggestionList .tis-v11-preview-toggle');
    assert(first,'Real writing suggestion preview button must exist');
    if(config.preview){await first.focus();await page.keyboard.press('Enter');}
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
    assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,
      'Suggestion controls must not overflow '+JSON.stringify(config));
    await page.evaluate(axe.source);
    const report=await page.evaluate(async()=>window.axe.run(document,{runOnly:{
     type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']
    }}));
    const violations=report.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target).slice(0,6)}));
    const incomplete=report.incomplete.map(v=>({id:v.id,count:v.nodes.length}));
    results.push({config,violations,incomplete});
    assert.deepEqual(violations,[],'Automated WCAG violation '+JSON.stringify(config));
    assert.deepEqual(errors,[],'JS exception '+JSON.stringify(config));
    console.log('PASS V11 M2 axe '+JSON.stringify(config));
   }finally{await page.close();}
  }
  console.log('V11_M2_AXE_METRICS='+JSON.stringify(results));
  console.log('PASS V11 M2 axe tested four EN/AR mobile/desktop + DOCX states; real AT still UNVERIFIED');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
