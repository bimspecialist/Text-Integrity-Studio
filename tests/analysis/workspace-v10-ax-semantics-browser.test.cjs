'use strict';
/* V10.3: Chromium accessibility-tree and responsive reflow smoke tests.
 * These verify semantics, not NVDA/VoiceOver speech on real devices.
 * Synthetic result passages only: no real document/model inference.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');

async function ax(page,selector){
  const client=await page.target().createCDPSession();
  try{
    await client.send('Accessibility.enable');
    const {root}=await client.send('DOM.getDocument');
    const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector});
    assert(nodeId,'Missing AX target: '+selector);
    const {nodes}=await client.send('Accessibility.getPartialAXTree',{nodeId,fetchRelatives:false});
    return nodes.find(n=>!n.ignored)||nodes[0];
  }finally{await client.detach();}
}
const extract=node=>({role:node?.role?.value,name:node?.name?.value||'',ignored:node?.ignored});
const sample='Measurements of the foundation were documented in a site record. The engineer independently checked the drawings and recorded construction tolerances.';
async function run(){
 const server=serve();
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const exceptions=[],outside=[];
 try{
  for(const lang of ['en','ar']){
   for(const width of [320,390,768,1440]){
    const page=await browser.newPage();
    page.on('pageerror',e=>exceptions.push(e.message));
    page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')outside.push(new URL(r.url()).hostname);});
    try{
     await page.setViewport({width,height:900});
     await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
     await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
     if(lang==='ar')await page.click('#language');
     assert.equal(await page.evaluate(()=>document.documentElement.lang),lang);
     const source=extract(await ax(page,'#source'));
     const expected=lang==='ar'?'النص المراد فحصه':'Text to review';
     assert.equal(source.name,expected,
      'Source accessible name should follow the visible localized label '+lang+' '+width+': '+JSON.stringify(source));
     const upload=extract(await ax(page,'#file'));
     assert(upload.name.trim().length>5,'File chooser must have a non-empty accessible name');
     const motion=await page.$eval('#scanAI',el=>getComputedStyle(el).transitionDuration);
     assert(motion.split(',').every(x=>parseFloat(x)===0),
      'Reduce motion must disable transitions: '+motion);
     assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,
      'Input has horizontal overflow at '+width+'/'+lang);

     await page.$eval('#source',(e,t)=>{
      e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));
     },sample);
     const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
     await page.evaluate(rev=>window.TISWorkspaceV10.setAnalysisState({
      status:'RESEARCH_SIGNAL',requestId:'ax-synthetic',revision:rev,
      evidence:{kind:'RESEARCH_SIGNAL',revision:rev,documentCoverageWordsPercent:26,
       segments:[{start:0,end:27,signal:60,words:4,tokens:6}]}
     }),revision);
     assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'results');
     assert.equal((await page.$$('#tisV10ReaderBody button.tis-v10-highlight')).length,1);
     if(width<=770){
      await page.focus('#tisV10ReaderBody .tis-v10-highlight');
      await page.keyboard.press('Enter');
      assert.equal(await page.$eval('#tisV10InspectorDialog',e=>e.open),true);
      const dialog=extract(await ax(page,'#tisV10InspectorDialog'));
      const title=lang==='ar'?'المقطع المقاس':'Measured passage';
      assert.equal(dialog.name,title,'Dialog must expose the localized title in the Chromium accessibility tree: '+JSON.stringify(dialog));
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tisV10CloseDialog');
      assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,
       'Modal causes horizontal overflow '+width+'/'+lang);
      await page.keyboard.press('Escape');
      assert.equal(await page.$eval('#tisV10InspectorDialog',e=>e.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('tis-v10-highlight')),true,
       'Dialog must restore focus to its triggering highlight');
     }else{
      await page.focus('#tisV10ReaderBody .tis-v10-highlight');
      await page.keyboard.press('Enter');
      const inspector=await page.$eval('#tisV10InspectorText',el=>({
       text:el.textContent,role:el.getAttribute('role'),live:el.getAttribute('aria-live')
      }));
      assert(inspector.text.startsWith(sample.slice(0,15)));
      assert(inspector.role==='status'||inspector.live==='polite',
       'Desktop highlight selection must expose its explanation via a polite live region');
      assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('tis-v10-highlight')),true,
       'Selecting a passage must not unexpectedly strand keyboard focus in the inspector');
     }
     console.log('PASS V10.3 AX '+lang.toUpperCase()+' '+width+'px: localized names, passage details, focus, reduced motion, reflow');
    }finally{await page.close();}
   }
  }
  assert.deepEqual(exceptions,[],'Unexpected Chromium JS errors');
  assert.deepEqual(outside,[],'Semantic review must not contact model or external hosts');
  console.log('PASS V10.3 Chromium accessibility tree, mobile dialog, desktop live-region and EN/AR 320-1440px; physical AT review remains OPEN');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
