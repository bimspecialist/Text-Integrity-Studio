'use strict';
/* Automated WCAG inspection using an injected *test-only* axe-core runner.
 * No changes to the production CSP; no screen reader or physical device claimed.
 * Collect selectors/rules only; do not log document contents.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const axe=require('axe-core');
const {serve,chrome}=require('../pdf-browser.test.js');

const SCENARIOS=[
 {name:'desktop-english-detection',width:1440,height:900,mode:'tisTabDetection',arabic:false},
 {name:'mobile-english-writing',width:390,height:844,mode:'tisTabHumanize',arabic:false},
 {name:'small-arabic-editor',width:320,height:740,mode:'tisTabEditor',arabic:true},
 {name:'tablet-arabic-detection',width:768,height:1024,mode:'tisTabDetection',arabic:true}
];
const TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];

async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const failures=[];
 try{
  for(const s of SCENARIOS){
   const page=await browser.newPage();
   try{
    await page.setViewport({width:s.width,height:s.height});
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
    if(s.arabic)await page.click('#language');
    await page.click('#'+s.mode);
    if(s.mode==='tisTabHumanize'){
     const sample='The engineering report includes teh collected measurement results and a clear review of the methods.';
     await page.$eval('#source',(el,text)=>{
      el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));
     },sample);
     await page.click('#scanAI');
    }
    const direction=await page.evaluate(()=>document.documentElement.dir);
    assert.equal(direction,s.arabic?'rtl':'ltr',s.name+' language direction');
    // CDP evaluation is a testing method; the deployed page does not get axe.
    await page.evaluate(axe.source);
    const out=await page.evaluate(async tags=>{
      const result=await window.axe.run(document,{runOnly:{type:'tag',values:tags}});
      return {
       incomplete:result.incomplete.map(x=>({rule:x.id,count:x.nodes.length})),
       violations:result.violations.map(x=>({
        rule:x.id,impact:x.impact,count:x.nodes.length,
        selectors:x.nodes.slice(0,8).map(node=>node.target.join(' > '))
       }))
      };
    },TAGS);
    if(out.violations.length)failures.push({scenario:s.name,...out});
    console.log('WCAG '+s.name+' rules='+out.violations.length+
      ' findings='+out.violations.reduce((n,x)=>n+x.count,0)+
      ' needs_manual_review='+out.incomplete.length);
   }finally{await page.close();}
  }
  assert.deepEqual(failures,[],'WCAG A/AA violations require a code fix, not a silent waiver');
  console.log('PASS automated axe-core WCAG 2.0/2.1/2.2 A/AA on V9 English/Arabic modes at 320–1440px. Physical-device AT review remains OPEN.');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});