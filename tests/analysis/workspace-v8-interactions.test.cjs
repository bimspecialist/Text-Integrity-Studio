'use strict';
/* V8.1 interaction regression — real Chromium, no network model downloads.
 * Files and text are synthetic; real DOCX/PDF/OCR flows covered by existing CI.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[],broken=[];
 try{
  const page=await browser.newPage();
  await page.setViewport({width:1360,height:900});
  page.on('pageerror',err=>errors.push(err.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  page.on('response',r=>{if(r.status()>=400)broken.push(r.url()+':'+r.status());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  // Canonical source and revision must reflect programmatic sample/clear
  // as faithfully as the input listener reflects ordinary typing.
  await page.click('#tisV8Example');
  let state=await page.evaluate(()=>({
   text:document.getElementById('source').value,
   snapshot:window.TISAnalysisApp.session.read(),
   detection:window.TISAnalysisApp.controller.getState().status
  }));
  assert(state.text.length>10,'sample must load actual text');
  assert.equal(state.snapshot.text,state.text,'sample must publish a source revision');
  assert(state.snapshot.revision>0,'programmatic source changes are not invisible to controller');
  assert(await page.$('#tisV8DropOverlay'),'file drag-and-drop guidance belongs to the editor');
  assert(await page.$('#tisV8AnalysisStatus'),'detector state must be visible without Advanced Details');

  const imported='Local engineering note with measurements 5 m and 2.5 mm. Local file delivery.';
  await page.$eval('#inputPanel',(panel,text)=>{
   const data=new DataTransfer();
   data.items.add(new File([text],'engineering-note.md',{type:'text/markdown'}));
   const mk=type=>new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:data});
   panel.dispatchEvent(mk('dragenter'));
   panel.dispatchEvent(mk('dragover'));
   panel.dispatchEvent(mk('drop'));
  },imported);
  await page.waitForFunction(text=>document.getElementById('source').value===text,{timeout:12000},imported);
  state=await page.evaluate(()=>({
   text:document.getElementById('source').value,
   snapshot:window.TISAnalysisApp.session.read(),
   fileName:document.getElementById('file').files?.[0]?.name,
   dropMessage:document.getElementById('tisV8FileState')?.textContent
  }));
  assert.equal(state.text,imported);
  assert.equal(state.snapshot.text,imported,'dropped text file must use canonical session');
  assert.equal(state.snapshot.sourceKind,'txt','Markdown should be treated as text');
  assert.equal(state.fileName,'engineering-note.md','drop must route through one file picker');
  assert(/engineering-note\.md/.test(state.dropMessage),'the selected file is acknowledged');
  const revision=state.snapshot.revision;
  await page.$eval('#inputPanel',panel=>{
   const data=new DataTransfer();
   data.items.add(new File(['not allowed'],'suspicious.exe',{type:'application/octet-stream'}));
   panel.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
  });
  const rejected=await page.evaluate(()=>({
   revision:window.TISAnalysisApp.session.read().revision,
   text:document.getElementById('source').value,
   selected:document.getElementById('file').files?.[0]?.name,
   message:document.getElementById('tisV8FileState')?.textContent
  }));
  assert.equal(rejected.revision,revision,'unsupported drop must never replace existing document');
  assert.equal(rejected.text,imported);
  assert.equal(rejected.selected,'engineering-note.md','rejecting a drop preserves previous input');
  assert(rejected.message.length>5,'unsupported extension gets inline explanatory feedback');
  // A short text must run writing checks without downloading the AI model.
  await page.click('#scanAI');
  await page.waitForFunction(()=>['WRITING_ONLY','UNSUPPORTED'].includes(
   window.TISAnalysisApp.controller.getState().status),{timeout:8000});
  let stateLabel=await page.$eval('#tisV8AnalysisStatus',el=>({
   text:el.textContent.trim(),kind:el.dataset.state
  }));
  assert.equal(stateLabel.kind,'WRITING_ONLY');
  assert(/writing|short|words|مؤهل|كتابة/i.test(stateLabel.text),'explain writing-only outcome');
  // First post-analysis edit invalidates evidence and stays visible.
  await page.$eval('#source',el=>{
   el.value+=' A later edit.';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  stateLabel=await page.$eval('#tisV8AnalysisStatus',el=>({
   text:el.textContent.trim(),kind:el.dataset.state
  }));
  assert.equal(stateLabel.kind,'STALE','source edit invalidates scan state');
  assert(/rescan|analyze|الفحص|التحليل/i.test(stateLabel.text),'guide user to intentional rescan');
  // Before / After preview must remain browser-local and never mutate the
  // canonical original until an independently authorized Apply.
  await page.click('#tisTabHumanize');
  const canonical=await page.$eval('#source',el=>el.value);
  const proposed=canonical+' Additional explanation <img src=x onerror=alert(1)>.';
  await page.$eval('#tisRevisedText',(el,value)=>{
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  },proposed);
  assert(await page.$('#tisV8DiffReview'),'explicit local change-review affordance');
  await page.click('#tisV8DiffReview > summary');
  await page.waitForFunction(()=>
   document.getElementById('tisV8DiffRevised')?.textContent.includes('Additional explanation'),
   {timeout:5000});
  const comparison=await page.evaluate(()=>({
   before:document.getElementById('tisV8DiffOriginal').textContent,
   after:document.getElementById('tisV8DiffRevised').textContent,
   source:document.getElementById('source').value,
   injected:!!document.querySelector('#tisV8DiffReview img'),
   note:document.getElementById('tisV8DiffNote').textContent
  }));
  assert.equal(comparison.source,canonical,'opening difference preview preserves source');
  assert(comparison.after.includes('<img src=x'),'user text is shown literally');
  assert.equal(comparison.injected,false,'source snippets may not create DOM markup');
  // The revised TXT is a real local export. Saving must never overwrite the
  // original or disguise the output as a format-preserving DOCX.
  await page.evaluate(()=>{
   window.__tisSavedName=null;window.__tisSavedBlob=null;
   const origCreate=URL.createObjectURL.bind(URL);
   URL.createObjectURL=blob=>{window.__tisSavedBlob=blob;return origCreate(blob);};
   const oldClick=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){
    if(this.download==='Text-Integrity-Studio-Draft.txt'){
     window.__tisSavedName=this.download;return;
    }
    return oldClick.call(this);
   };
  });
  assert(await page.$('#tisV8SaveDraft'),'user can export editable draft without altering original');
  await page.click('#tisV8SaveDraft');
  const exportResult=await page.evaluate(async()=>({
   name:window.__tisSavedName,
   contents:await window.__tisSavedBlob?.text(),
   mime:window.__tisSavedBlob?.type,
   source:document.getElementById('source').value,
   draft:document.getElementById('tisRevisedText').value,
   snapshot:window.TISAnalysisApp.session.read().text
  }));
  assert.equal(exportResult.name,'Text-Integrity-Studio-Draft.txt');
  assert.equal(exportResult.contents,proposed,'the exported UTF-8 draft matches reviewed text');
  assert.equal(exportResult.mime,'text/plain;charset=utf-8');
  assert.equal(exportResult.source,canonical,'export does not overwrite original text');
  assert.equal(exportResult.snapshot,canonical,'export cannot change DocumentSession');
  assert.equal(exportResult.draft,proposed,'download cannot clear unsaved edits');

  assert(comparison.note.length>10,'preview scope should be explicit');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  stateLabel=await page.$eval('#tisV8AnalysisStatus',el=>({text:el.textContent,kind:el.dataset.state}));
  assert.equal(stateLabel.kind,'STALE');
  assert(/[\u0600-\u06ff]/u.test(stateLabel.text),'status localizes to Arabic');
  const arabicDraft='تم قياس الجدار بمقدار 5 mm حسب المخطط [2].';
  await page.$eval('#tisRevisedText',(element,value)=>{
   element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));
  },arabicDraft);
  await page.click('#tisV8SaveDraft');
  const arabicExport=await page.evaluate(async()=>({
   name:window.__tisSavedName,
   body:await window.__tisSavedBlob?.text(),
   source:document.getElementById('source').value,
   snapshot:window.TISAnalysisApp.session.read().text,
   button:document.getElementById('tisV8SaveDraft').textContent
  }));
  assert.equal(arabicExport.name,'Text-Integrity-Studio-Draft.txt');
  assert.equal(arabicExport.body,arabicDraft,'Arabic + engineering units survive UTF-8 TXT export');
  assert.equal(arabicExport.source,canonical);
  assert.equal(arabicExport.snapshot,canonical);
  assert(/[\u0600-\u06ff]/u.test(arabicExport.button),'export label localizes to Arabic');
  await page.setViewport({width:320,height:700});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8);
  assert.deepEqual(remote,[],'only a real opt-in may download external AI assets');
  assert.deepEqual(broken,[],'new UI assets all load');
  assert.deepEqual(errors,[],'no unhandled browser exceptions');
  console.log('PASS V8.1 Chromium: synthetic sample/source revisions, local drag/drop, rejected files, writing-only/stale state, RTL and offline privacy');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
