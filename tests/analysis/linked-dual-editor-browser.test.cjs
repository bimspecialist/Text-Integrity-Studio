'use strict';
/* V8.7 real Chromium interaction/RTL regression. No model downloads,
 * no inference mocks, no untrusted user documents.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
   if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());
  });
  await page.setViewport({width:1150,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const original=Array.from({length:230},(_,i)=>
    'Section '+i+': The drawing was reviewed by the project team.').join('\n');
  await page.$eval('#source',(el,value)=>{
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  },original);
  await page.click('#tisTabHumanize');
  assert.equal(await page.$eval('#scanAI .v5-action-title',el=>el.textContent.trim()),'Analyze Text');
  assert.match(await page.$eval('#scanAI .v5-action-sub',el=>el.textContent),
    /writing|editorial|local/i,'Humanize action must not promise AI detector inference');
  assert(await page.$('#tisV8WordComparison'),'local before/after word comparison must exist');
  assert(await page.$('#tisV8ScrollLink'),'linked scrolling is an optional native checkbox');
  assert.equal(await page.$eval('#tisV8ScrollLink',el=>el.checked),false,
    'do not seize users scrolling without explicit opt-in');
  const after=original+'\nAdditional site observation with 5 mm and reference [2].';
  await page.$eval('#tisRevisedText',(el,value)=>{
    el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  },after);
  await page.waitForFunction(()=>{
    const n=document.getElementById('tisV8WordComparison');
    return n&&Number(n.dataset.afterWords)>Number(n.dataset.beforeWords);
  },{timeout:3000});
  const counts=await page.$eval('#tisV8WordComparison',el=>({
    before:Number(el.dataset.beforeWords),
    after:Number(el.dataset.afterWords),
    delta:Number(el.dataset.deltaWords),
    description:el.textContent.trim()
  }));
  assert.equal(counts.before,original.trim().split(/\s+/u).length);
  assert.equal(counts.after,after.trim().split(/\s+/u).length);
  assert.equal(counts.delta,counts.after-counts.before);
  assert(counts.description.includes('+')&&counts.description.length>10);

  const scroll=async id=>page.$eval(id,el=>({
    position:el.scrollTop,remaining:el.scrollHeight-el.clientHeight
  }));
  await page.$eval('#source',el=>{el.scrollTop=160;el.dispatchEvent(new Event('scroll'));});
  await new Promise(ok=>setTimeout(ok,110));
  assert.equal((await scroll('#tisRevisedText')).position,0,
    'independent source and draft scrolling until linked option is checked');
  await page.$eval('#tisV8ScrollLink',el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.$eval('#source',el=>{
    el.scrollTop=Math.round((el.scrollHeight-el.clientHeight)*.62);
    el.dispatchEvent(new Event('scroll'));
  });
  await new Promise(ok=>setTimeout(ok,130));
  let a=await scroll('#source'),b=await scroll('#tisRevisedText');
  assert(a.remaining>0&&b.remaining>0,'real multi-page text in both scrollable panes');
  assert(Math.abs(a.position/a.remaining-b.position/b.remaining)<.05,
    'linked scrolling maps proportional locations across panes');
  await page.$eval('#tisRevisedText',el=>{
    el.scrollTop=Math.round((el.scrollHeight-el.clientHeight)*.22);
    el.dispatchEvent(new Event('scroll'));
  });
  await new Promise(ok=>setTimeout(ok,130));
  a=await scroll('#source');b=await scroll('#tisRevisedText');
  assert(Math.abs(a.position/a.remaining-b.position/b.remaining)<.05,
    'link scroll works in both directions');
  await page.$eval('#tisV8ScrollLink',el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
  const draftBefore=(await scroll('#tisRevisedText')).position;
  await page.$eval('#source',el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
  await new Promise(ok=>setTimeout(ok,110));
  assert.equal((await scroll('#tisRevisedText')).position,draftBefore,
    'turning off linked scroll restores independent navigation');
  assert.equal(await page.$eval('#source',el=>el.value),original,
    'no scroll or word count action changes the original document');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),original);
  assert.equal(await page.$eval('#tisRevisedText',el=>el.value),after);

  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  const translation=await page.evaluate(()=>({
   main:document.querySelector('#scanAI .v5-action-title').textContent,
   subtitle:document.querySelector('#scanAI .v5-action-sub').textContent,
   label:document.getElementById('tisV8ScrollLinkLabel').textContent,
   stats:document.getElementById('tisV8WordComparison').textContent
  }));
  for(const entry of Object.values(translation))
   assert(/[\u0600-\u06ff]/u.test(entry),'mixed-locale controls must be localized: '+JSON.stringify(translation));
  await page.setViewport({width:390,height:844});
  const narrow=await page.evaluate(()=>({
   extra:document.documentElement.scrollWidth-innerWidth,
   box:document.getElementById('tisV8WordComparison').getBoundingClientRect().width
  }));
  assert(narrow.extra<=8&&narrow.box>100,'RTL phone must fit optional tool row');
  assert.equal(await page.$eval('#tisV8ScrollLink',el=>el.checked),false);
  await page.click('#tisTabDetection');
  assert.match(await page.$eval('#scanAI .v5-action-sub',el=>el.textContent),
    /[\u0600-\u06ff]/u,'Detection subtitle is Arabic');
  assert.deepEqual(remote,[],'no external code/model download just for local editing');
  assert.deepEqual(errors,[],'no unhandled browser errors');
  console.log('PASS V8.7: deliberate linked scrolling, faithful local word delta, mode-accurate one action and RTL phone labels');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
