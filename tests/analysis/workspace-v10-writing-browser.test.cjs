'use strict';
const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
  const original='Engineering project record, source values 25 kPa [12], retained without edits.';
  await page.$eval('#source',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));},original);
  const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  const start=original.indexOf('source values'),end=start+'source values 25 kPa'.length;
  await page.evaluate(({revision,start,end})=>window.TISWorkspaceV10.setAnalysisState({
   status:'RESEARCH_SIGNAL',requestId:'v10-writing-fixture',revision,
   evidence:{kind:'RESEARCH_SIGNAL',revision,segments:[{start,end,words:4,tokens:7,signal:45}]}
  }),{revision,start,end});
  await page.click('#tisV10Improve');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'writing');
  const draftVisible=await page.$eval('#tisRevisedPane',el=>el.getClientRects().length>0&&el.getBoundingClientRect().width>=300);
  assert.equal(draftVisible,true,'dual pane must become visible only by user choice');
  assert.equal(await page.$eval('#source',el=>el.value),original);
  const back=await page.$('#tisV10BackFromWriting');
  assert(back,'a visible way back from writing to measured results is required');
  assert.equal(await page.$eval('#tisV10BackFromWriting',el=>el.getClientRects().length>0),true);
  await page.$eval('#tisRevisedText',el=>{el.value='A personal revision, not applied.';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),original,'draft cannot overwrite source on input');
  const folder=process.env.TIS_SCREENSHOT_DIR;
  if(folder){require('node:fs').mkdirSync(folder,{recursive:true});await page.screenshot({path:require('node:path').join(folder,'v10-1-desktop-writing.png'),fullPage:true});}
  await page.click('#tisV10BackFromWriting');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'results');
  assert.equal(await page.$eval('#tisV10ReaderBody',el=>el.textContent),original);
  await page.setViewport({width:390,height:844});
  await page.click('#tisV10Improve');
  assert.equal(await page.evaluate(()=>document.body.dataset.v10Screen),'writing');
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,'mobile writing workspace should not overflow');
  console.log('PASS V10.1 writing: reviewed draft stays isolated and user can return to the result');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});