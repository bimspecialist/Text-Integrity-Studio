'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage(),errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const first=await page.evaluate(()=>({
   visible:(()=>{const e=document.getElementById('humanizeSuggestions');return !!e&&!e.hidden;})(),
   primary:[...document.querySelectorAll('button.primary')].filter(b=>b.id==='scanAI'&&
    b.getBoundingClientRect().height>0).length
  }));
  assert.equal(first.primary,1,'Analyze Text stays one prominent primary action');
  assert.equal(first.visible,false,'Humanize stays hidden until explicit Analyze');
  const text='teh report was recieved at the engineering site and reviewed for accuracy.';
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},text);
  await page.click('#scanAI');
  await page.waitForFunction(()=>document.querySelectorAll('#humanizeSuggestionCards .humanize-card').length>0,
   {timeout:7000});
  assert.equal(await page.$eval('#humanizeSuggestions',e=>e.hidden),false);
  assert.equal(await page.$eval('#humanizeSuggestions',e=>e.open),true);
  assert.match(await page.$eval('#humanizeSuggestions > summary',e=>e.textContent),/Make writing more natural/);
  const info=await page.$eval('#humanizeSuggestionCards .humanize-card',e=>({
   before:e.querySelector('.humanize-before')?.textContent,
   after:e.querySelector('.humanize-after')?.textContent,
   id:e.dataset.suggestionId
  }));
  assert(['teh','recieved'].includes(info.before),'before must come from actual text');
  assert(['the','received'].includes(info.after),'after must come from deterministic suggestion');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'short English triggers no model downloads');
  const prior=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.click('#humanizeSuggestionCards .humanize-preview');
  assert.equal(await page.$eval('#humanizeSuggestionCards .humanize-card .humanize-preview-detail',e=>e.hidden),false);
  assert.equal(await page.$eval('#source',e=>e.value),text,'preview is not an edit');
  await page.click('#humanizeSuggestionCards .humanize-apply');
  assert.equal(await page.$eval('#source',e=>e.value.startsWith('the report')),true);
  assert((await page.evaluate(()=>window.TISAnalysisApp.session.read().revision))>prior);
  assert.equal(await page.$eval('#studioAiQuickValue',e=>e.textContent.trim()),'—','old AI signal is invalidated');
  assert.equal(await page.$('#tisOnDeviceModel'),null,'Apply never rescans the model');
  await page.click('#humanizeUndo');
  assert.equal(await page.$eval('#source',e=>e.value),text,'Undo restores before text');
  assert.equal(await page.$('#tisOnDeviceModel'),null);

  // Unsupported Arabic still receives optional editorial guidance; dialect is manual.
  await page.click('#language');
  const arabic='هاذا تعبير محلي قصدت كتابته بهاذه الطريقة، لاكن التقرير يحتاج مراجعة.';
  await page.$eval('#source',(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},arabic);
  await page.click('#scanAI');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  await page.waitForFunction(()=>document.querySelector('#humanizeSuggestionCards .humanize-card'),{timeout:7000});
  assert.match(await page.$eval('#humanizeSuggestions > summary',e=>e.textContent),/اجعل الكتابة أكثر طبيعية/);
  assert.equal(await page.$eval('#source',e=>e.value),arabic);
  assert.equal(await page.$('#tisOnDeviceModel'),null,'Arabic never goes to the English detector');
  const arabicButtons=await page.$$eval('#humanizeSuggestionCards .humanize-apply',els=>
   els.map(e=>e.disabled));
  assert(arabicButtons.every(Boolean),'dialect requires manual review rather than forced conversion');

  // Imported Word text is read-only for direct Humanize Apply.
  await page.evaluate((v)=>{
   document.getElementById('source').value=v;
   window.TISAnalysisApp.session.replaceText(v,'docx');
   document.getElementById('source').dispatchEvent(new Event('input',{bubbles:true}));
  },text);
  await page.click('#scanAI');
  await page.waitForFunction(()=>document.querySelector('#humanizeSuggestionCards .humanize-card'),{timeout:7000});
  assert.equal(await page.$eval('#source',e=>e.value),text);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().sourceKind),'docx');
  const readOnly=await page.$$eval('#humanizeSuggestionCards .humanize-apply',e=>e.every(b=>b.disabled));
  assert.equal(readOnly,true,'DOCX must use the separate approved Word review workflow');

  await page.setViewport({width:390,height:844});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8,'RTL mobile layout must fit');
  assert.deepEqual(errors,[],'No errors from local editorial UI');
  assert.deepEqual(remote,[],'No user content requests to other origins');
  console.log('PASS H3 one analyze, English/Arabic review, protected DOCX, before/after, preview/apply/undo and RTL');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
