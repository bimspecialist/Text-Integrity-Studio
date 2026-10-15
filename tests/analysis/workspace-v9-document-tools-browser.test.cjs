'use strict';
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const info=await page.evaluate(()=>{
   const inside=(id,group)=>document.getElementById(group)?.contains(document.getElementById(id));
   return {
    initiallyClosed:!document.getElementById('v5Toolbox').open,
    oneFile:document.querySelectorAll('#file').length===1,
    oneSource:document.querySelectorAll('#source').length===1,
    oneAnalyze:document.querySelectorAll('#scanAI').length===1,
    groups:[inside('writingTools','v9ToolsWriting'),inside('cleanupTools','v9ToolsWriting'),
     inside('v6WordTools','v9ToolsDocuments'),inside('pdfTools','v9ToolsDocuments'),
     inside('wordToolbar','v9ToolsDocuments'),inside('researchTools','v9ToolsResearch'),
     inside('aboutResults','v9ToolsResearch')]
   };
  });
  assert(info.initiallyClosed&&info.oneFile&&info.oneSource&&info.oneAnalyze);
  assert(info.groups.every(Boolean),'Existing tools must be moved, not removed');
  await page.click('#v5Toolbox > summary');
  assert.equal(await page.$eval('#v5Toolbox',e=>e.open),true);
  const original='Notes about the structural design and engineering inspection.';
  await page.evaluate(text=>{
   const input=document.getElementById('file'),d=new DataTransfer();
   d.items.add(new File([text],'engineering-note.txt',{type:'text/plain'}));
   input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  },original);
  await page.waitForFunction(text=>document.getElementById('source').value===text,{timeout:9000},original);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().text),original);
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().sourceKind),'txt');
  await page.evaluate(()=>{
   const input=document.getElementById('file'),d=new DataTransfer();
   d.items.add(new File(['bad'],'unsupported.exe',{type:'application/octet-stream'}));
   input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  assert.equal(await page.$eval('#source',e=>e.value),original,'unsupported file must not overwrite text');
  await page.click('#language');
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  const labels=await page.$$eval('#v5ToolboxItems .v9-tools-group>h3',nodes=>nodes.map(n=>n.textContent));
  assert.equal(labels.length,3);
  assert(labels.every(x=>/[\u0600-\u06ff]/u.test(x)),'three Arabic headings');
  await page.setViewport({width:390,height:844});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8);
  assert.deepEqual(errors,[],'no browser errors');
  assert.deepEqual(remote,[],'no external model calls in document workflow');
  console.log('PASS V9 browser: advanced tool groups, TXT and rejection, RTL/mobile, privacy');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});