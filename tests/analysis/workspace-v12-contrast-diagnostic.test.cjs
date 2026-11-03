'use strict';
/* Read-only WCAG contrast diagnostic for the six existing V12 Chromium states.
 * Prints the exact axe incomplete nodes plus computed text and ancestor styles.
 * These results are diagnostic evidence, NOT proof of WCAG conformance.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const axe=require('axe-core');
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
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  for(const c of cases){
   const page=await browser.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   try{
    await page.setViewport({width:c.width,height:900});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v12preview=1',{waitUntil:'load'});
    if(c.language==='ar')await page.click('#language');
    if(c.screen!=='input'){
     const text=c.language==='ar'?'هاذا أسلوب قصدته لاكن العبارة بحاجة لتصحيح مع المحافظة على المرجع [12].':
      'teh report was recieved at the site. The construction strength was 25 MPa [12].';
     await page.$eval('#source',(el,value)=>{
      el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
     },text);
     await page.click('#tisV12Write');
     if(c.screen==='writing'){
      await page.click('#tisV11Improve');
      await page.waitForFunction(()=>!!document.querySelector('#tisV12TipsDock #tisV11GuidedReview'),{timeout:3500});
     }
    }
    await page.evaluate(axe.source);
    const report=await page.evaluate(async()=>window.axe.run(document,{
     runOnly:{type:'rule',values:['color-contrast']}
    }));
    const failures=report.violations.flatMap(v=>v.nodes.map(n=>({
     rule:v.id,target:n.target,impact:v.impact,summary:n.failureSummary
    })));
    const incomplete=report.incomplete.flatMap(v=>v.nodes.map(n=>({
     rule:v.id,target:n.target,html:n.html.slice(0,260),
     checks:[...n.any,...n.all,...n.none].map(x=>({id:x.id,message:x.message,data:x.data}))
    })));
    const elements=await page.evaluate(nodes=>nodes.map(n=>{
     const el=document.querySelector(n.target[0]);if(!el)return {target:n.target,error:'MISSING_TARGET'};
     const ancestry=[];let parent=el;
     for(let level=0;parent&&level<5;parent=parent.parentElement,level++){
      const s=getComputedStyle(parent);
      ancestry.push({tag:parent.tagName,id:parent.id,className:typeof parent.className==='string'?parent.className.slice(0,120):'',
       foreground:s.color,background:s.backgroundColor,opacity:s.opacity,
       fontSize:s.fontSize,fontWeight:s.fontWeight,backgroundImage:s.backgroundImage.slice(0,90)});
     }
     const r=el.getBoundingClientRect();
     return{target:n.target,text:(el.textContent||'').trim().slice(0,70),box:{width:r.width,height:r.height},
      ancestry};
    }),incomplete);
    // Independent computed-style contrast check. axe cannot infer textarea
    // backgrounds when another element appears to overlap their paint region.
    // Inspect representative hit-tests too; a good RGB ratio is not proof
    // that the text is actually unobscured.
    // Explicitly audit core controls even if a future axe version stops
    // marking them incomplete. This keeps the regression guard non-vacuous.
    const required=c.screen==='input'?['.file-icon','#source']:
     c.screen==='writing'?['#source','#tisRevisedText','#tisV11Heading']:
     ['#tisV11Heading'];
    const auditedTargets=[...new Map([...incomplete,
     ...required.map(selector=>({target:[selector]}))].map(item=>[item.target[0],item])).values()];
    const measured=await page.evaluate(nodes=>{
     function rgb(value){
      if(!(value||'').startsWith('rgb(')&&!(value||'').startsWith('rgba('))return null;
      const nums=value.slice(value.indexOf('(')+1,value.lastIndexOf(')')).replaceAll(',',' ').replaceAll('/',' ').split(' ').filter(Boolean).map(Number);
      if(!nums||nums.length<3)return null;
      // Fail closed on semitransparent colors; compositing must be inspected
      // rather than calculating a misleading ratio for an opaque color.
      if(value.startsWith('rgba(')&&nums.length>=4&&Number(nums[3])<1)return null;
      return nums.slice(0,3).map(Number);
     }
     function luminance(color){
      const parts=color.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
      return parts[0]*.2126+parts[1]*.7152+parts[2]*.0722;
     }
     function contrast(a,b){
      if(!a||!b)return null;
      const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
      // WCAG 2.2 SC 1.4.3: compare the exact ratio, never rounded values.
      // A true ratio of 4.499 must not pass the 4.5:1 minimum.
      return (values[0]+.05)/(values[1]+.05);
     }
     // Negative control: this RGB pair is 4.49898:1 against white.
     // Rounding to two decimals would incorrectly turn it into 4.50:1.
     const nearThreshold=contrast([111,121,117],[255,255,255]);
     if(!(nearThreshold>4.495&&nearThreshold<4.5))
      throw Error('WCAG_CONTRAST_ROUNDING_NEGATIVE_CONTROL_FAILED');
     function background(el){
      for(let p=el;p;p=p.parentElement){
       const b=getComputedStyle(p).backgroundColor;
       if(b&&b!=='transparent'&&!(b.startsWith('rgba(')&&b.endsWith(', 0)')))
        return rgb(b);
      }
      return [255,255,255];
     }
     return nodes.map(n=>{
      const el=document.querySelector(n.target[0]);if(!el)return{target:n.target,error:'MISSING'};
      el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      const style=getComputedStyle(el),fg=rgb(style.color),bg=background(el);
      const placeholder=el.tagName==='TEXTAREA'?rgb(getComputedStyle(el,'::placeholder').color):null;
      const rect=el.getBoundingClientRect();
      const hitResults=[];
      for(const x of [.25,.5,.75]){
       for(const y of [.25,.5,.75]){
        const px=rect.left+rect.width*x,py=rect.top+rect.height*y;
        if(px<0||py<0||px>=innerWidth||py>=innerHeight)continue;
        const hit=document.elementFromPoint(px,py);
        hitResults.push({x,y,hit:hit?.id||hit?.className||hit?.tagName||null,
         same:hit===el||!!el.contains(hit)});
       }
      }
      return{target:n.target,fg:style.color,bg:style.backgroundColor,
       ratio:contrast(fg,bg),placeholderRatio:contrast(placeholder,bg),
       hits:hitResults};
     });
    },auditedTargets);
    console.log('V12_CONTRAST_DIAGNOSTIC '+JSON.stringify({
     language:c.language,width:c.width,screen:c.screen,
     violations:failures,incomplete,elements,measured
    }));
    assert.equal(measured.length,auditedTargets.length,'All expected contrast targets must be audited');
    for(const item of measured){
     assert(!item.error,'Missing contrast target '+JSON.stringify(item));
     assert(item.hits.length>=5,'At least five viewport hit-tests per audited target');
     assert(item.hits.every(hit=>hit.same),
      'Text element is visually obscured in browser hit testing '+JSON.stringify(item));
     // Never silently pass when a future CSS change makes measurement
     // unsupported (transparent text, custom paint, unknown background).
     assert(Number.isFinite(item.ratio),'Cannot establish opaque foreground/background contrast '+JSON.stringify(item));
     assert(item.ratio>=4.5,'Insufficient computed text contrast '+JSON.stringify(item));
     if(['#source','#tisRevisedText'].includes(item.target[0])){
      assert(Number.isFinite(item.placeholderRatio),'Cannot establish editor placeholder contrast '+JSON.stringify(item));
      assert(item.placeholderRatio>=4.5,'Insufficient placeholder contrast '+JSON.stringify(item));
     }
    }
    assert.deepEqual(failures,[],'Confirmed axe contrast violation');
    assert.deepEqual(errors,[],'Unexpected JS runtime errors');
   }finally{await page.close();}
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
