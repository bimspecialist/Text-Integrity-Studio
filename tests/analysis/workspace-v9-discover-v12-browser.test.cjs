'use strict';
/* Regression: a discoverable V12 entry must not discard the V9 source or draft.
 * The experimental model must remain opt-in and previews must not link to
 * themselves. This test uses real Chromium, not synthetic HTML.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function run(){
 const server=serve();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const base='http://127.0.0.1:'+server.address().port+'/';
 const errors=[],remote=[];
 try{
  for(const scenario of [
   {lang:'en',width:1440},{lang:'ar',width:1440},
   {lang:'en',width:320},{lang:'ar',width:390}
  ]){
   const page=await browser.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{
    if(new URL(r.url()).origin!==new URL(base).origin)remote.push(r.url());
   });
   await page.setViewport({width:scenario.width,height:900});
   await page.goto(base,{waitUntil:'load'});
   if(scenario.lang==='ar')await page.click('#language');
   assert.equal(await page.evaluate(()=>document.body.classList.contains('tis-v12')),false);
   const link=await page.$eval('#v12PreviewLink',node=>({
    href:node.href,target:node.target,rel:node.rel,
    name:node.innerText.trim(),display:getComputedStyle(node).display,
    rect:{left:node.getBoundingClientRect().left,
     right:node.getBoundingClientRect().right}
   }));
   assert.equal(new URL(link.href).searchParams.get('v12preview'),'1');
   assert.equal(new URL(link.href).origin,new URL(base).origin);
   assert.equal(link.target,'_blank','switching versions must not replace the current editor');
   assert(link.rel.includes('noopener')&&link.rel.includes('noreferrer'),
    'new tab must not keep an opener reference');
   assert.notEqual(link.display,'none');
   assert(link.rect.left>=0&&link.rect.right<=scenario.width+1,
    'preview link must fit '+scenario.lang+' at '+scenario.width);
   if(scenario.width>560)assert.match(link.name,
    scenario.lang==='ar'?/\u062c\u0631\u0651\u0628|\u062c\u0631\u0628/:/Try new V12/i);
   const original='Project source 25 MPa [12] '+scenario.lang;
   const draft='Unsaved reviewed draft 30 MPa '+scenario.lang;
   await page.$eval('#source',(node,text)=>{
    node.value=text;node.dispatchEvent(new Event('input',{bubbles:true}));
   },original);
   await page.$eval('#tisRevisedText',(node,text)=>{
    node.value=text;node.dispatchEvent(new Event('input',{bubbles:true}));
   },draft);
   const before=await page.evaluate(()=>({
    source:document.getElementById('source').value,
    draft:document.getElementById('tisRevisedText').value
   }));
   const newTarget=new Promise(resolve=>browser.once('targetcreated',resolve));
   await page.click('#v12PreviewLink');
   const popup=await (await newTarget).page();
   assert(popup,'opening the safe link must create a new browser tab');
   await popup.waitForSelector('#tisV12Hero',{timeout:15000});
   assert.equal(await popup.evaluate(()=>document.body.classList.contains('tis-v12')),true);
   assert.equal(await popup.$eval('#source',n=>n.value),'',
    'a new session must not silently transfer sensitive source text');
   assert.equal(await popup.$eval('#tisV12Scan',n=>n.disabled),true,
    'loading V12 must not start a model or fabricate an AI result');
   assert.equal(await popup.evaluate(()=>window.opener),null);
   assert.equal(await popup.$eval('#v12PreviewLink',n=>getComputedStyle(n).display),'none',
    'V12 must not show a self-referential preview link');
   const after=await page.evaluate(()=>({
    source:document.getElementById('source').value,
    draft:document.getElementById('tisRevisedText').value,
    location:location.href,
    overflow:document.documentElement.scrollWidth-innerWidth
   }));
   assert.deepEqual({source:after.source,draft:after.draft},before,
    'opening V12 must leave current original and draft intact');
   assert.equal(after.location,base);
   assert(after.overflow<=8,'V9 must not gain horizontal overflow');
   const externallyLoaded=await popup.evaluate(()=>performance.getEntriesByType('resource')
    .map(item=>item.name).filter(url=>new URL(url).origin!==location.origin));
   assert.deepEqual(externallyLoaded,[],'opening the preview must not load external models');
   await popup.close();
   await page.close();
   console.log('PASS V9 -> V12 entry '+scenario.lang+' '+scenario.width+
    'px: discoverable, new safe tab, drafts intact, no automatic inference');
  }
  assert.deepEqual(remote,[],'opening a local writing workspace needs no third-party requests');
  assert.deepEqual(errors,[],'no unhandled browser errors');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
