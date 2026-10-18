'use strict';
/* Automated WCAG checks only; real devices/assistive technology remain manual. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const axe=require('axe-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const tags=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
const cases=[
 ['input-EN-1440',1440,900,'en','input'],
 ['input-AR-320',320,740,'ar','input'],
 ['eligibility-AR-390',390,844,'ar','eligibility'],
 ['progress-EN-768',768,1024,'en','progress'],
 ['results-EN-1440',1440,900,'en','results'],
 ['results-AR-390',390,844,'ar','results'],
 ['writing-AR-320',320,740,'ar','writing']
];
const sample='An engineering researcher recorded site measurements and reviewed a sample of structural calculations before writing the technical report. These original notes support later quality review.';
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const failures=[],metrics=[];
 try{
  for(const [name,width,height,lang,state] of cases){
   const page=await browser.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.setViewport({width,height});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
    if(lang==='ar')await page.click('#language');
    if(state!=='input')await page.$eval('#source',(el,t)=>{el.value=t;el.dispatchEvent(new Event('input',{bubbles:true}));},sample);
    if(state==='eligibility'){
     await page.$eval('#source',el=>{el.value='هذه مسودة عربية للتجربة دون ادعاء الكشف الآلي.';el.dispatchEvent(new Event('input',{bubbles:true}));});
     await page.click('#scanAI');
    }else if(state==='progress'){
     const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
     await page.evaluate(revision=>window.TISWorkspaceV10.setAnalysisState({status:'LOADING',requestId:'axe-probe',revision,stage:'LOADING'}),revision);
    }else if(state==='results'||state==='writing'){
     const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
     await page.evaluate(revision=>window.TISWorkspaceV10.setAnalysisState({
      status:'RESEARCH_SIGNAL',requestId:'axe-probe',revision,
      evidence:{kind:'RESEARCH_SIGNAL',revision,documentCoverageWordsPercent:52,
       segments:[{start:10,end:62,signal:51,words:8,tokens:12}]}
     }),revision);
     if(state==='writing')await page.click('#tisV10Improve');
    }
    assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),state,'screen '+name);
    const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
     viewport:innerWidth,language:document.documentElement.lang,direction:document.documentElement.dir}));
    assert.equal(bounds.language,lang);
    assert.equal(bounds.direction,lang==='ar'?'rtl':'ltr');
    assert(bounds.scroll-bounds.viewport<=8,'horizontal overflow '+name+' '+JSON.stringify(bounds));
    await page.evaluate(axe.source);
    const checks=await page.evaluate(async tags=>{
     const out=await window.axe.run(document,{runOnly:{type:'tag',values:tags}});
     return {violations:out.violations.map(x=>({
      rule:x.id,impact:x.impact,count:x.nodes.length,
      selectors:x.nodes.slice(0,8).map(n=>n.target.join(' > '))
     })),incomplete:out.incomplete.map(x=>({rule:x.id,count:x.nodes.length}))};
    },tags);
    metrics.push({name,violations:checks.violations.length,incomplete:checks.incomplete.length});
    if(checks.violations.length||errors.length)failures.push({name,...checks,errors:errors.slice(0,5)});
   }finally{await page.close();}
  }
  console.log('V10 automated axe metrics '+JSON.stringify(metrics));
  if(failures.length)console.error('V10 violations '+JSON.stringify(failures));
  assert.deepEqual(failures,[],'Automated WCAG A/AA failures require correction');
  console.log('PASS V10 seven EN/AR automated WCAG 2.0/2.1/2.2 A/AA views; physical-device review remains OPEN');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});