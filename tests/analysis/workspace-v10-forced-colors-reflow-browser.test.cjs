'use strict';
/* V10.4: simulated OS forced-colors + stress text enlargement in real Chromium.
 * This is NOT physical Windows high-contrast, browser zoom, or AT certification.
 * Results are synthetic UI fixture evidence; no actual model predictions.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const sample='The engineering team checked the project drawing. Survey coordinates were recorded and reviewed with the structural consultant.';
const metrics=[];
const shotDir=process.env.TIS_FORCED_COLOR_SHOTS||null;
async function screenshot(page,name){
 if(shotDir){
  const fs=require('node:fs'),path=require('node:path');
  fs.mkdirSync(shotDir,{recursive:true});
  await page.screenshot({path:path.join(shotDir,name+'.png'),fullPage:true});
 }
}
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const pageErrors=[],external=[];
 try{
  for(const lang of ['en','ar'])for(const width of [320,390,1280]){
   const page=await browser.newPage();
   page.on('pageerror',err=>pageErrors.push(err.message));
   page.on('request',request=>{if(new URL(request.url()).hostname!=='127.0.0.1')external.push(request.url());});
   const cdp=await page.target().createCDPSession();
   try{
    await cdp.send('Emulation.setEmulatedMedia',{media:'screen',features:[
     {name:'forced-colors',value:'active'},
     {name:'prefers-reduced-motion',value:'reduce'}
    ]});
    await page.setViewport({width,height:820});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
    if(lang==='ar')await page.click('#language');
    // Simulate keyboard navigation, not pointer/programmatic-only focus.
    // :focus-visible intentionally does not match after a mouse click.
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>matchMedia('(forced-colors: active)').matches),true);
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    const marker=lang+'-'+width;
    const before=await page.evaluate(()=>{
     const button=document.getElementById('scanAI'),file=document.getElementById('file');
     button.focus();
     const focused=getComputedStyle(button);
     const rect=button.getBoundingClientRect();
     return {focusStyle:focused.outlineStyle,focusWidth:parseFloat(focused.outlineWidth),
      focusColor:focused.outlineColor,scanColor:focused.color,scanBackground:focused.backgroundColor,
      controlsVisible:!!button.getClientRects().length&&!!file.getClientRects().length,
      overflow:document.documentElement.scrollWidth-innerWidth,left:rect.left,right:rect.right};
    });
    metrics.push({lang,width,state:'input',...before});
    assert(before.controlsVisible,'Main actions must be present in forced colors '+marker);
    assert(before.focusStyle!=='none'&&before.focusWidth>=2,
     'Focus outline missing under simulated OS forced-colors '+marker+': '+JSON.stringify(before));
    assert(before.left>=-2&&before.right<=width+2,'Scan action is horizontally clipped '+marker);
    assert(before.overflow<=8,'Input has horizontal overflow under forced colors '+marker);

    await page.$eval('#source',(el,text)=>{
      el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));
    },sample);
    const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
    await page.evaluate(rev=>window.TISWorkspaceV10.setAnalysisState({
      status:'RESEARCH_SIGNAL',requestId:'forced-colors-fixture',revision:rev,
      evidence:{kind:'RESEARCH_SIGNAL',revision:rev,
       documentCoverageWordsPercent:26,segments:[{start:0,end:34,signal:61,words:5,tokens:7}]}
    }),revision);
    const highlight=await page.$('#tisV10ReaderBody .tis-v10-highlight');
    assert(highlight,'Measured window remains a keyboard button '+marker);
    await highlight.focus();
    const measured=await page.evaluate(()=>{
      const el=document.querySelector('#tisV10ReaderBody .tis-v10-highlight');
      const css=getComputedStyle(el);
      const rect=el.getBoundingClientRect();
      return {outline:css.outlineStyle,outlineWidth:parseFloat(css.outlineWidth),
       border:css.borderBottomStyle,borderWidth:parseFloat(css.borderBottomWidth),
       decoration:css.textDecorationLine,fg:css.color,bg:css.backgroundColor,
       left:rect.left,right:rect.right,overflow:document.documentElement.scrollWidth-innerWidth};
    });
    metrics.push({lang,width,state:'highlight',...measured});
    assert(measured.outline!=='none'&&measured.outlineWidth>=2,'Highlighted focus outline missing '+marker);
    assert(measured.border==='solid'&&measured.borderWidth>=2,
     'Highlights need a non-background-color indicator in forced colors '+marker);
    assert(measured.decoration.split(' ').includes('underline'),
     'Forced-colors mode must preserve a visible text underline after yellow highlight disappears '+marker);
    assert(measured.overflow<=8,'Results overflow under forced colors '+marker);
    await screenshot(page,'forced-colors-'+marker);

    // Stress important text with 200% author-size enlargement, NOT actual browser zoom.
    const enlarged=await page.evaluate(()=>{
      // Browser CSP deliberately blocks injected <style> tags. Change only
      // CSSOM properties on the QA fixture elements, without weakening CSP.
      const ids=['tisV10ResultHeading','tisV10HighlightLegend',
       'tisV10ExportExplanation','tisV10ExportReport','tisV10Improve','tisV10ReaderBody'];
      return ids.map(id=>{
       const element=document.getElementById(id);
       element.style.setProperty('font-size','200%','important');
       return {id,fontSize:parseFloat(getComputedStyle(element).fontSize)};
      });
    });
    assert(enlarged.every(item=>item.fontSize>=30),
      'Text-stress changes did not take effect under CSP: '+JSON.stringify(enlarged));
    const stress=await page.evaluate(()=>{
      const action=document.getElementById('tisV10ExportReport');
      const title=document.getElementById('tisV10ResultHeading');
      const a=action.getBoundingClientRect(),t=title.getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth-innerWidth,
       action:{left:a.left,right:a.right,top:a.top,width:a.width,scrollWidth:action.scrollWidth,clientWidth:action.clientWidth},
       title:{left:t.left,right:t.right,scrollWidth:title.scrollWidth,clientWidth:title.clientWidth},
       reader:document.getElementById('tisV10ReaderBody').getBoundingClientRect().width};
    });
    metrics.push({lang,width,state:'text-200pct-stress',...stress});
    assert(stress.overflow<=8,'200% text enlargement creates horizontal overflow '+marker+': '+JSON.stringify(stress));
    assert(stress.action.left>=-2&&stress.action.right<=width+2,'Export action clipped '+marker);
    assert(stress.action.scrollWidth<=stress.action.clientWidth+2,'Export label clipped '+marker);
    assert(stress.title.scrollWidth<=stress.title.clientWidth+2,'Results heading clipped '+marker);
    await screenshot(page,'text-enlargement-'+marker);
    console.log('PASS V10.4 simulated forced-colors + enlarged-text '+marker);
   }finally{await cdp.detach();await page.close();}
  }
  assert.deepEqual(pageErrors,[],'Browser JS errors');
  assert.deepEqual(external,[],'No remote inference or external URL requests');
  console.log('V10_FORCED_COLORS_METRICS='+JSON.stringify(metrics));
  console.log('PASS V10.4 simulated forced colors and text-enlargement reflow; real-device acceptance OPEN');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
