'use strict';
/* M5 accessibility stress. Simulated forced-colors and CSS 200% text
 * enlargement ARE NOT real Windows high contrast, browser 400% zoom or
 * NVDA/VoiceOver/TalkBack. Those remain explicit physical review gates.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const english='teh report was recieved at the site. The measurements included 25 MPa and reference [12].';
const arabic='هاذا تقرير مكتوب لأغراض المراجعة. لاكن النص يحتاج إلى تدقيق ومراجعة واضحة.';
const sizes=[320,390,768,1440];
const shots=process.env.TIS_M5_SCREENSHOTS||null;
async function save(page,label){
 if(shots){
  fs.mkdirSync(shots,{recursive:true});
  await page.screenshot({path:path.join(shots,label+'.png'),fullPage:true});
 }
}
async function run(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],results=[];
 try{
  for(const lang of ['en','ar']){
   for(const width of sizes){
    const page=await browser.newPage();
    const cdp=await page.createCDPSession();
    page.on('pageerror',e=>errors.push(e.message));
    try{
     await page.setViewport({width,height:920});
     await cdp.send('Emulation.setEmulatedMedia',{media:'screen',features:[
      {name:'forced-colors',value:'active'},
      {name:'prefers-reduced-motion',value:'reduce'}]});
     await page.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
     if(lang==='ar')await page.click('#language');
     await page.evaluate(sample=>{
      const source=document.getElementById('source');
      source.value=sample;source.dispatchEvent(new Event('input',{bubbles:true}));
     },lang==='ar'?arabic:english);
     await page.focus('#scanAI');await page.keyboard.press('Enter');
     assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'guided-review');
     const preview=await page.$('#tisV11SuggestionList .tis-v11-preview-toggle');
     assert(preview,'Need an actual writing suggestion in '+lang+'/'+width);
     await preview.focus();await page.keyboard.press('Enter');
     const state=await page.evaluate(()=>{
      const button=document.querySelector('#tisV11SuggestionList .tis-v11-preview-toggle');
      const region=document.getElementById(button.getAttribute('aria-controls'));
      const computed=getComputedStyle(button);
      return {
       expanded:button.getAttribute('aria-expanded'),label:button.getAttribute('aria-label'),
       regionExists:!!region,hidden:region?.hidden,
       focused:document.activeElement===button,dir:document.documentElement.dir,
       prefersReduced:matchMedia('(prefers-reduced-motion:reduce)').matches,
       forcedColors:matchMedia('(forced-colors:active)').matches,
       outlineStyle:computed.outlineStyle,outlineWidth:parseFloat(computed.outlineWidth),
       overflow:document.documentElement.scrollWidth-innerWidth
      };
     });
     assert.equal(state.expanded,'true');
     assert.equal(state.regionExists,true);
     assert.equal(state.hidden,false);
     assert.equal(state.focused,true);
     assert.equal(state.prefersReduced,true);
     assert.equal(state.forcedColors,true);
     assert.equal(state.dir,lang==='ar'?'rtl':'ltr');
     assert(state.outlineStyle!=='none'&&state.outlineWidth>=2,
      'Keyboard preview focus must have a visible outline '+lang+'/'+width+': '+JSON.stringify(state));
     assert(state.overflow<=8,'Horizontal overflow after preview '+lang+'/'+width);
     assert(state.label.includes(lang==='ar'?'إغلاق المعاينة':'Close preview'),
      'Expanded preview must have a localized Close label, '+JSON.stringify(state));

     // Synthetic 200% text enlargement of critical M5 elements: CSP-safe
     // CSSOM changes rather than injecting styles or reducing site security.
     const resized=await page.evaluate(()=>{
      const elements=[document.getElementById('tisV11Heading'),
       ...document.querySelectorAll('#tisV11GuidedReview .tis-v11-suggestion .tis-v11-reason'),
       ...document.querySelectorAll('#tisV11GuidedReview .tis-v11-suggestion-actions button'),
       document.getElementById('tisV11Undo'),document.getElementById('tisV11Export')];
      for(const el of elements)el.style.setProperty('font-size','200%','important');
      const buttons=[...document.querySelectorAll('#tisV11GuidedReview button')].filter(el=>!el.disabled);
      const clipped=buttons.filter(el=>{
       const rect=el.getBoundingClientRect();
       return rect.left < -2||rect.right>innerWidth+2||el.scrollWidth>el.clientWidth+2;
      }).map(el=>({text:el.textContent.slice(0,60),size:el.getBoundingClientRect().width}));
      return {overflow:document.documentElement.scrollWidth-innerWidth,
       clipped,headingScroll:document.getElementById('tisV11Heading').scrollWidth,
       headingClient:document.getElementById('tisV11Heading').clientWidth};
     });
     assert(resized.overflow<=8,'200% text-stress overflow '+lang+'/'+width+': '+JSON.stringify(resized));
     assert.deepEqual(resized.clipped,[],'200% text-stress clips actionable buttons '+lang+'/'+width);
     assert(resized.headingScroll<=resized.headingClient+2,'Heading clip after text stress');
     await save(page,'m5-'+lang+'-'+width+'-forced-colors-text200');
     results.push({lang,width,forcedColors:state.forcedColors,
      outline:state.outlineWidth,overflow:resized.overflow,clipped:resized.clipped.length});
     console.log('PASS V11 M5 forced-colors + CSS text-stress '+lang+' '+width+'px');
    }finally{await cdp.detach();await page.close();}
   }
  }
  assert.deepEqual(errors,[]);
  console.log('M5_REFLOW_METRICS='+JSON.stringify(results));
  console.log('PASS V11 M5 8 Chromium responsive forced-color/keyboard/CSS text-stress fixtures; real device review remains OPEN');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
