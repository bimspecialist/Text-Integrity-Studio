'use strict';
/* Keyboard/AX focus lifecycle on the preview, not physical AT certification. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const screenText='The project report records measured site elevations, a documented foundation review, and an independently checked sample from the construction schedule.';
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const issues=[];
 try{
  for(const locale of ['en','ar']){
   const page=await browser.newPage();
   page.on('pageerror',e=>issues.push(e.message));
   try{
    await page.setViewport({width:locale==='ar'?320:1024,height:780});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
    if(locale==='ar')await page.click('#language');
    await page.$eval('#source',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));},
     locale==='ar'?'هذا نص عربي محلي للتأكد من أن واجهة النتائج لا تختلق إشارة كشف.':screenText);
    await page.focus('#scanAI');await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'eligibility');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10EligibilityHeading',
     'after unsupported analysis, keyboard focus must move to visible eligibility heading');
    assert.equal(await page.$eval('#tisV10EligibilityHeading',e=>e.tabIndex),-1,
     'screen heading must be focusable programmatically but not inserted in regular tab order');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10BackToInput',
     'Tab from heading should reach back action');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'source',
     'return to editor must restore focus');
    const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
    await page.evaluate(revision=>window.TISWorkspaceV10.setAnalysisState({
      status:'LOADING',requestId:'keyboard-synthetic',revision,stage:'LOADING'
    }),revision);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10ProgressHeading',
     'model loading must announce a visible progress heading via focus');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10Cancel',
     'progress cancel must be keyboard reachable');
    await page.evaluate(revision=>window.TISWorkspaceV10.setAnalysisState({
     status:'RESEARCH_SIGNAL',revision,requestId:'keyboard-synthetic',
     evidence:{kind:'RESEARCH_SIGNAL',revision,documentCoverageWordsPercent:60,
      segments:[{start:4,end:24,signal:54,words:3,tokens:8}]}
    }),revision);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10ResultHeading',
     'completed model scan must move focus into visible results');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10Edit',
     'Edit Original button must be available after result heading');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'source');
    assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8);
   }finally{await page.close();}
  }
  assert.deepEqual(issues,[]);
  console.log('PASS V10 keyboard focus for unsupported, loading, result and return-to-editor in English/Arabic');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});