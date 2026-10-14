'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const JSZip=require('../docs/vendor/jszip.min.js');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';

async function run(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-v6-document-'));
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const paragraph=i=>('The engineering report documents observed measurements and explains how the project team checked the sampling method. ').repeat(13)+
   'Document section '+i+' contains historical findings and requires manual verification before use.';
 const data=Array.from({length:7},(_,i)=>paragraph(i+1));
 zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="'+W+'"><w:body>'+data.map(s=>'<w:p><w:r><w:t>'+s+'</w:t></w:r></w:p>').join('')+'<w:sectPr/></w:body></w:document>');
 const file=path.join(temp,'eight-paragraph-demo.docx');
 fs.writeFileSync(file,await zip.generateAsync({type:'nodebuffer'}));
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[];
 try{
  const page=await browser.newPage();await page.setViewport({width:1736,height:900});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#scanAI',{visible:true});
  await (await page.$('#file')).uploadFile(file);
  await page.waitForFunction(()=>document.getElementById('wordToolbar')?.hidden===false,{timeout:16000});
  assert.equal(await page.$eval('#source',n=>n.readOnly),true,'DOCX extract must remain immutable to preserve original formatting');
  assert.equal(await page.$eval('#v5Toolbox',n=>n.open),false,'A Word import must not expand More Tools or push results away');
  const workflow=await page.evaluate(()=>{
   const pos=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
   const toolbar=document.getElementById('wordToolbar');
   const report=document.getElementById('wordReport');
   return {action:pos('scanAI'),toolbarInInput:document.getElementById('inputPanel').contains(toolbar),
    reportInResults:document.getElementById('reportPanel').contains(report),
    outsideToolbox:!document.getElementById('v5Toolbox').contains(toolbar),
    note:document.getElementById('v6DocumentNote')?.textContent||'',
    sectionCount:document.getElementById('v5TopCounts')?.textContent||'',
    sideReportTop:pos('reportPanel').top,
    actionVisible:!!document.getElementById('scanAI').getClientRects().length,
    sourceRect:pos('source'),
    sourceHeight:getComputedStyle(document.getElementById('source')).height,
    sourceReadOnly:document.getElementById('source').readOnly,
    docxClass:document.body.className,
    v8Css:[...document.styleSheets].some(x=>x.href?.includes('workspace-v8.css')),
    editorNoteHeight:document.getElementById('v6DocumentNote')?.getBoundingClientRect().height
   };
  });
  assert.equal(workflow.toolbarInInput,false,'Word controls must not appear between editor and Analyze button');
  assert.equal(workflow.reportInResults,false,'Word report must not displace AI result panel');
  assert.equal(workflow.outsideToolbox,false,'Word tools belong in More Tools');
  assert.match(workflow.note,/DOCX|Word/i,'User gets a short, visible document status');
  assert.match(workflow.note,/read.only|read only|immutable|original/i,'Read-only import semantics are explained');
  assert.match(workflow.sectionCount,/[2-9] sections/i,'Imported Word paragraph boundaries must remain distinguishable');
  assert(workflow.actionVisible&&workflow.action.bottom<=900,
   'Analyze Text stays accessible at default desktop height even with a long Word document: '+JSON.stringify(workflow));
  await page.evaluate(()=>{
   const source=document.getElementById('source');
   window.dispatchEvent(new CustomEvent('tis:ai-evidence',{detail:{
    version:'TIS_CONSENSUS_V2_2026_10',
    model_id:'onnx-community/tmr-ai-text-detector-ONNX',
    calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
    sourceLength:source.value.length,
    displayedSignalPercent:null,
    status:'HETEROGENEOUS_DOCUMENT',
    documentCoverage:51,
    segments:[{start:0,end:Math.floor(source.value.length/2),signal:4.7,words:150,tokens:300}]
   }}));
  });
  await page.waitForFunction(()=>document.getElementById('v5ResultHeadline')?.textContent.includes('Inconclusive'),{timeout:5000});
  const ui=await page.evaluate(()=>{
   const ring=document.getElementById('v5SignalRing').getBoundingClientRect();
   const label=document.getElementById('studioAiQuickValue').getBoundingClientRect();
   return {ring:{left:ring.left,right:ring.right,top:ring.top,bottom:ring.bottom},
    label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom},
    score:document.getElementById('studioAiQuickValue').textContent.trim(),
    scanNote:document.getElementById('studioAiQuickNote').textContent.trim(),
    explanation:document.getElementById('v6ConclusionReason')?.textContent||'',
    breakdown:document.getElementById('v5BreakdownRows')?.textContent||''
   };
  });
  assert.equal(ui.score,'—','INCONCLUSIVE should not overflow the 108px ring or become a false number');
  assert(ui.label.left>=ui.ring.left-2&&ui.label.right<=ui.ring.right+2,'Ring score must stay within circle');
  assert.match(ui.explanation,/passage|vary|inconsistent|heterogeneous|تختلف/i,'Why it abstained must be visible to user');
  assert.match(ui.scanNote,/processing completed|whole-document number was withheld/i,
   'Completed inference cannot keep showing an obsolete first-download instruction');
  assert.match(ui.breakdown,/4.7%/,'Real model-window signal can still be shown as local evidence');
  assert.match(ui.breakdown,/coverage|covered|تغطية/i,'The paragraph-level score must be labeled with local model-window coverage');
  const out=process.env.TIS_SCREENSHOT_DIR||temp;
  fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'v6-long-docx-desktop.png'),fullPage:true});
  await page.$eval('#v5Toolbox',n=>n.open=true);
  await page.$eval('#v6WordTools',n=>n.open=true);
  assert.equal(await page.$eval('#wordToolbar',n=>n.hidden),false,'Word tools remain accessible by explicit disclosure');
  assert.equal(await page.$eval('#wordReport',n=>n.hidden),false,'Word structural report remains available');
  await page.click('#language');
  await page.setViewport({width:390,height:844});
  const phone=await page.evaluate(()=>{
   const editor=document.getElementById('inputPanel').getBoundingClientRect();
   const report=document.getElementById('reportPanel').getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth-innerWidth,
    editorBottom:editor.bottom,reportTop:report.top,dir:document.documentElement.dir,
    label:document.getElementById('studioAiQuickValue').textContent.trim()};
  });
  assert.equal(phone.dir,'rtl');
  assert(phone.overflow<=8,'No RTL horizontal overflow');
  assert(phone.editorBottom<=phone.reportTop+6,'Main editor never overlaps results on mobile');
  assert.equal(phone.label,'—','Abstention indicator remains compact in Arabic');
  await page.$eval('#v5Toolbox',n=>{n.open=false;});
  await page.screenshot({path:path.join(out,'v6-docx-mobile-rtl.png'),fullPage:true});
  assert.deepEqual(errors,[],'No uncaught browser errors');
  console.log('PASS DOCX workflow hierarchy, visible single Analyze action, no overflow on inconclusive, scientific reason/coverage, RTL');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));fs.rmSync(temp,{recursive:true,force:true});}
}
run().catch(e=>{console.error(e);process.exitCode=1});
