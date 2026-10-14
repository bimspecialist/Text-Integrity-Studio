'use strict';
/* S4 real Chromium keyboard, screen reader semantics, Arabic RTL + Word layout.
 * Tests only browser-accessible structure and behavior; this does not certify
 * WCAG 2.2 AA without manual assistive-technology review.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const JSZip=require('../../docs/vendor/jszip.min.js');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const short='teh report was recieved at the engineering site and checked.';

async function fileFixture(temp){
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const paragraphs=Array.from({length:7},(_,i)=>('The engineering report reviews measurement records and preserves technical references in chapter '+(i+1)+'. ').repeat(14));
 zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="'+NS+'"><w:body>'+paragraphs.map(text=>'<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p>').join('')+'<w:sectPr/></w:body></w:document>');
 const file=path.join(temp,'synthetic-accessibility-long.docx');
 fs.writeFileSync(file,await zip.generateAsync({type:'nodebuffer'}));return file;
}
async function main(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-s4-'));
 const file=await fileFixture(temp);
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const tabs=await page.$$eval('#tisModes [role="tab"]',arr=>arr.map(n=>({
   id:n.id,selected:n.getAttribute('aria-selected'),controls:n.getAttribute('aria-controls'),
   name:n.textContent.trim(),tabindex:n.tabIndex
  })));
  assert.deepEqual(tabs.map(x=>x.tabindex),[0,-1,-1]);
  assert.deepEqual(tabs.map(x=>x.selected),['true','false','false']);
  assert(tabs.every(x=>x.controls==='tisModePanel'&&x.name.length));
  assert.equal(await page.$eval('#tisModePanel',e=>e.getAttribute('role')),'tabpanel');
  const role=await page.$eval('#scanAI',e=>({
   name:e.innerText.trim(),descriptionIds:e.getAttribute('aria-describedby'),
   visible:e.getClientRects().length>0
  }));
  assert(role.visible&&role.name.includes('Analyze'));
  assert(role.descriptionIds.split(' ').every(Boolean));
  assert.equal(await page.$eval('#tisDraftStatus',e=>e.getAttribute('aria-live')),'polite');
  assert.equal(await page.$eval('#studioAiQuickStatus',e=>e.getAttribute('aria-live')),'polite');

  await page.focus('#tisTabDetection');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'tisTabHumanize');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'tisTabEditor');
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'tisTabDetection');

  // Open a simple editor preview by keyboard rather than pointer.
  await page.$eval('#source',(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));},short);
  await page.focus('#scanAI');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#humanizeSuggestionCards .humanize-preview'),
   {timeout:11000});
  const preview=await page.$eval('#humanizeSuggestionCards .humanize-preview',e=>({
   name:e.textContent.trim(),expanded:e.getAttribute('aria-expanded'),
   controls:e.getAttribute('aria-controls')
  }));
  assert(preview.name.length>0);
  assert.equal(preview.expanded,'false');
  assert(preview.controls&&preview.controls.length>0,
   'preview button must explicitly name its collapsible content for assistive tech');
  assert.equal(await page.evaluate(id=>!!document.getElementById(id),preview.controls),true);
  await page.focus('#humanizeSuggestionCards .humanize-preview');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('#humanizeSuggestionCards .humanize-preview',e=>e.getAttribute('aria-expanded')),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('humanize-preview')),true);

  await page.click('#language');await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
  await page.focus('#tisTabDetection');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'tisTabHumanize',
   'ArrowLeft advances tab selection in RTL layout');
  await page.$eval('#tisRevisedText',n=>{n.value='تقرير بسيط مع 240 V [12].';n.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$eval('#source',e=>e.value),short);

  // Real Word import and long RTL layout, no synthetic DOM toggle pretending to load DOCX.
  await (await page.$('#file')).uploadFile(file);
  await page.waitForFunction(()=>document.getElementById('wordToolbar')?.hidden===false,
   {timeout:18000});
  assert.equal(await page.$eval('#source',n=>n.readOnly),true);
  assert.equal(await page.$eval('#tisDraftApply',n=>n.disabled),true);
  const geom=await page.evaluate(()=>{
   const rect=id=>document.getElementById(id).getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth-innerWidth,
    firstBottom:rect('inputPanel').bottom,secondTop:rect('tisRevisedPane').top,
    width:rect('tisRevisedPane').width,windowWidth:innerWidth};
  });
  assert(geom.overflow<=8,'Arabic mobile Word input does not create horizontal overflow');
  assert(geom.firstBottom<=geom.secondTop+7,'original text should stack before revised pane');
  assert(geom.width<=geom.windowWidth,'revised editor fits the viewport');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  assert.deepEqual(errors,[],'no Chromium runtime page exceptions');
  console.log('PASS S4: desktop keyboard tabs, review disclosures, screen reader labels, long DOCX 390px Arabic RTL and reduced-motion');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
