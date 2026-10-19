'use strict';
/* Regression probes for the real V12 editor integration. The source stays
 * authoritative, one edit at a time, and stale advice must disappear.
 * Run on a genuine Chrome DOM; no mock model responses or fake scores.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const ORIGINAL='The report was recieved at the site. teh structure was measured for compliance and the column strength was 25 MPa [12].';
async function open(base,browser){
 const p=await browser.newPage();
 await p.setViewport({width:1440,height:900});
 await p.goto(base+'?v12preview=1',{waitUntil:'load'});
 await p.$eval('#source',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},ORIGINAL);
 await p.click('#tisV12Write');
 assert.equal(await p.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
 await p.click('#tisV11Improve');
 await p.waitForFunction(()=>!!document.querySelector('#tisV12TipsDock #tisV11GuidedReview'),{timeout:3000});
 return p;
}
async function firstSafeSuggestion(page){
 const count=await page.$$eval('#tisV12TipsDock .tis-v11-suggestion',nodes=>nodes.length);
 for(let i=0;i<count;i++){
  const css='#tisV12TipsDock .tis-v11-suggestion:nth-child('+(i+1)+')';
  await page.click(css+' .tis-v11-preview-toggle');
  const available=await page.$eval(css+' .tis-v11-apply',el=>!el.disabled);
  if(available)return css;
 }
 throw Error('NO_REAL_APPLICABLE_SUGGESTION_FOR_FIXTURE');
}
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const issues=[];
 try{
  const base='http://127.0.0.1:'+server.address().port+'/';
  // Case 1: core editor promise, a change from a valid preview can be undone
  // without leaving the editor to hunt for its action.
  const p=await open(base,browser);
  try{
   const css=await firstSafeSuggestion(p);
   await p.click(css+' .tis-v11-apply');
   const changed=await p.$eval('#source',el=>el.value);
   assert.notEqual(changed,ORIGINAL,'A safe reviewed edit should update the source');
   if(await p.evaluate(()=>document.body.dataset.v10Screen)!=='writing'){
    // Returning to writing must still expose the same undo history.
    await p.click('#tisV11Improve');
   }
   const state=await p.evaluate(()=>{
    const undo=document.getElementById('tisV11Undo');
    const rect=undo.getBoundingClientRect();
    return {screen:document.body.dataset.v10Screen,disabled:undo.disabled,
     visible:rect.width>0&&rect.height>0&&getComputedStyle(undo).display!=='none',
     parentDisplay:getComputedStyle(undo.parentElement).display};
   });
   assert.equal(state.screen,'writing');
   assert.equal(state.disabled,false,'Real reviewed edit should be undoable');
   assert.equal(state.visible,true,'A V12 editor must not conceal available Undo: '+JSON.stringify(state));
   await p.click('#tisV11Undo');
   assert.equal(await p.$eval('#source',el=>el.value),ORIGINAL,'Undo restores original source exactly');
   console.log('PASS V12 recovery: reviewed change can be undone visibly from the editor');
  }catch(e){issues.push({case:'VISIBLE_UNDO',detail:e.stack||String(e)});}
  finally{await p.close();}

  // Case 2: direct source edits make advice revision-stale; no CSS rule may
  // override the hidden property and leave old recommendations visibly active.
  const p2=await open(base,browser);
  try{
   const before=await p2.$$eval('#tisV12TipsDock .tis-v11-suggestion',nodes=>nodes.length);
   assert(before>0,'Test requires source-linked advice');
   await p2.$eval('#source',el=>{
    el.value='This is entirely new source material without the original typos or reference.';
    el.dispatchEvent(new Event('input',{bubbles:true}));
   });
   await p2.waitForFunction(()=>document.getElementById('tisV11GuidedReview').hidden,{timeout:3000});
   const output=await p2.evaluate(()=>{
    const stage=document.getElementById('tisV11GuidedReview'),undo=document.getElementById('tisV11Undo');
    return {hidden:stage.hidden,display:getComputedStyle(stage).display,
     staleCards:document.querySelectorAll('#tisV12TipsDock .tis-v11-suggestion').length,
     source:document.getElementById('source').value,undoDisabled:undo.disabled};
   });
   assert.equal(output.display,'none','Stale guidance remains visible after source change: '+JSON.stringify(output));
   assert.equal(output.undoDisabled,true,'Outdated undo must not modify a new source revision');
   console.log('PASS V12 stale-state: old suggestions are not presented after original text changes');
  }catch(e){issues.push({case:'STALE_SUGGESTIONS',detail:e.stack||String(e)});}
  finally{await p2.close();}

  if(issues.length){for(const e of issues)console.error('FAIL '+e.case+': '+e.detail);
   throw new Error('V12 editor recovery regressions: '+issues.map(x=>x.case).join(', '));}
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
