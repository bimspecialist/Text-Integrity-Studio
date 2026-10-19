'use strict';
/* Real Chromium axe on the new V12 UI. This does not replace real screen readers. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core'),axe=require('axe-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const cases=[
 {language:'en',width:1440,screen:'input'},
 {language:'ar',width:390,screen:'input'},
 {language:'en',width:1440,screen:'guided-review'},
 {language:'ar',width:390,screen:'guided-review'},
 {language:'en',width:1440,screen:'writing'},
 {language:'ar',width:390,screen:'writing'}
];
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  for(const item of cases){
   const page=await browser.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.setViewport({width:item.width,height:900});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v12preview=1',{waitUntil:'load'});
    if(item.language==='ar')await page.click('#language');
    if(item.screen!=='input'){
     const text=item.language==='ar'?'هاذا أسلوب قصدته لاكن العبارة بحاجة لتصحيح مع المحافظة على المرجع [12].':
       'teh report was recieved at the site. The construction strength was 25 MPa [12].';
     await page.$eval('#source',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},text);
     await page.focus('#tisV12Write');await page.keyboard.press('Enter');
     if(item.screen==='writing'){
      await page.click('#tisV11Improve');
      await page.waitForFunction(()=>!!document.querySelector('#tisV12TipsDock #tisV11GuidedReview'),{timeout:3000});
     }
    }
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),item.screen);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),item.language);
    await page.evaluate(axe.source);
    const report=await page.evaluate(async()=>window.axe.run(document,{runOnly:{
     type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']
    }}));
    const violations=report.violations.map(v=>({rule:v.id,impact:v.impact,
     targets:v.nodes.slice(0,4).map(n=>n.target.join(' > '))}));
    const incomplete=report.incomplete.map(v=>({rule:v.id,nodes:v.nodes.length}));
    assert.deepEqual(violations,[],'V12 axe '+JSON.stringify({case:item,violations,incomplete}));
    assert.deepEqual(errors,[]);
    console.log('PASS V12 axe '+item.language+' '+item.width+'px '+item.screen+'; incomplete='+JSON.stringify(incomplete));
   }finally{await page.close()}
  }
  console.log('PASS V12 axe six browser states; physical NVDA, VoiceOver and TalkBack remain UNVERIFIED');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
