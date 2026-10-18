'use strict';
/* V11 M1: genuine DOCX and PDF import -> local review, no AI model traffic. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const JSZip=require('../../docs/vendor/jszip.min.js');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function docxFile(dir){
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const paragraphs=['In order to complete the study, we recieved the measurments at the site. teh report includes findings.',
  'The measured concrete strength was 25 MPa [12]. The document is a review example, not a building specification.'];
 zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs.map(x=>'<w:p><w:r><w:t>'+x+'</w:t></w:r></w:p>').join('')+'<w:sectPr/></w:body></w:document>');
 const file=path.join(dir,'writing-review-fixture.docx');
 fs.writeFileSync(file,await zip.generateAsync({type:'nodebuffer'}));return file;
}
function pdfBytes(text){
 const stream='BT /F1 12 Tf 45 720 Td ('+text+') Tj ET';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(stream,'latin1')+' >>\nstream\n'+stream+'\nendstream'
 ];
 let output='%PDF-1.4\n',positions=[0];
 for(let i=0;i<objects.length;i++){positions.push(Buffer.byteLength(output,'latin1'));output+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=Buffer.byteLength(output,'latin1');
 output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of positions.slice(1))output+=String(offset).padStart(10,'0')+' 00000 n \n';
 output+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return [...Buffer.from(output,'latin1')];
}
async function run(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-v11-files-'));
 const file=await docxFile(temp);
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const unexpected=[],errors=[];
 try{
  for(const kind of ['docx','pdf']){
   const page=await browser.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{const url=new URL(r.url());if(url.hostname!=='127.0.0.1'||url.pathname.includes('ai-runtime.html'))unexpected.push(url.href);});
   try{
    await page.setViewport({width:kind==='docx'?1440:390,height:900});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?v11preview=1',{waitUntil:'load'});
    if(kind==='docx')await (await page.$('#file')).uploadFile(file);
    else await page.evaluate(bytes=>{
      const input=document.getElementById('file'),dt=new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)],'review-fixture.pdf',{type:'application/pdf'}));
      input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    },pdfBytes('In order to complete the study, teh report was recieved at the site.'));
    await page.waitForFunction(()=>document.getElementById('source').value.includes('teh report'),{timeout:25000});
    const before=await page.evaluate(()=>window.TISAnalysisApp.session.read());
    assert.equal(before.sourceKind,kind);
    assert.equal(await page.$eval('#source',e=>e.value),before.text);
    await page.click('#scanAI');
    const review=await page.evaluate(()=>({
     state:document.body.dataset.v10Screen,
     source:window.TISAnalysisApp.session.read().text,
     revision:window.TISWorkspaceV11.reviewState().revision,
     notes:window.TISWorkspaceV11.reviewState().suggestions,
     docxNoteVisible:!document.getElementById('tisV11DocxNote').hidden,
     modelBusy:['LOADING','ANALYZING'].includes(window.TISAnalysisApp.controller.getState().status)
    }));
    assert.equal(review.state,'guided-review');
    assert.equal(review.source,before.text,'Imported file review must not mutate source');
    assert.equal(review.revision,before.revision);
    assert(review.notes>=1,'Imported '+kind+' should produce at least one local suggestion');
    assert.equal(review.docxNoteVisible,kind==='docx');
    assert.equal(review.modelBusy,false);
    assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8);
    console.log('PASS V11 M1 '+kind.toUpperCase()+' local review preserves imported document and never runs a model');
   }finally{await page.close();}
  }
  assert.deepEqual(unexpected,[],'No foreign or AI-model network requests on guided document review');
  assert.deepEqual(errors,[],'No Chromium JS errors');
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
  fs.rmSync(temp,{recursive:true,force:true});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
