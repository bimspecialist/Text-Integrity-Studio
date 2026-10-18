'use strict';
/* V11 M1 axe-core acceptance. Chromium automation is not physical AT certification. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const axe=require('axe-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const tests=[
 {name:'input-en',width:1440,lang:'en',review:false},
 {name:'input-ar',width:320,lang:'ar',review:false},
 {name:'review-en',width:1440,lang:'en',review:true},
 {name:'review-ar',width:390,lang:'ar',review:true},
 {name:'writing-en',width:768,lang:'en',review:true,writing:true}
];
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const reports=[];
 try{
  for(const item of tests){
   const page=await browser.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.setViewport({width:item.width,height:900});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
    if(item.lang==='ar')await page.click('#language');
    if(item.review){
     const sample=item.lang==='ar'?'هاذا تعبير محلي قصدت كتابته بهاذه الطريقة، لاكن التقرير الفني يتطلب مراجعة.':
       'In order to complete the study, we recieved the measurments at the site. teh report includes findings.';
     await page.$eval('#source',(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));},sample);
     await page.click('#scanAI');
     if(item.writing)await page.click('#tisV11Improve');
    }
    assert.equal(await page.evaluate(()=>document.documentElement.lang),item.lang);
    const expected=item.writing?'writing':item.review?'guided-review':'input';
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),expected);
    assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,
     'Unexpected horizontal overflow in '+item.name);
    await page.evaluate(axe.source);
    const result=await page.evaluate(async()=>window.axe.run(document,{runOnly:{
     type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']
    }}));
    const violations=result.violations.map(x=>({id:x.id,impact:x.impact,selectors:x.nodes.slice(0,6).map(n=>n.target.join(' > '))}));
    const incomplete=result.incomplete.map(x=>({id:x.id,count:x.nodes.length}));
    reports.push({case:item.name,violations,incomplete,errors});
    assert.deepEqual(violations,[],'Axe found WCAG-tagged violations in '+item.name);
    assert.deepEqual(errors,[],'Browser errors in '+item.name);
    console.log('PASS V11 M1 axe '+item.name);
   }finally{await page.close();}
  }
  console.log('V11 M1 axe results '+JSON.stringify(reports));
  console.log('PASS V11 M1 five EN/AR axe-core states; physical NVDA/TalkBack/VoiceOver still UNVERIFIED');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
