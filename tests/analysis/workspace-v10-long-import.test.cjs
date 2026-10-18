'use strict';
/* V10.1 real long DOCX/PDF import and 320/390/768/1440px Arabic-English layout. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const JSZip=require('../../docs/vendor/jszip.min.js');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const sample='Structural site observations include measured reinforcement spacing, foundation elevations and inspection dates without changing the original design documents. ';
async function writeDocx(folder){
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const paragraphs=Array.from({length:320},(_,i)=>'Section '+(i+1)+'. '+sample.repeat(2));
 zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="'+ns+'"><w:body>'+paragraphs.map(text=>'<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p>').join('')+'<w:sectPr/></w:body></w:document>');
 const file=path.join(folder,'v10-long-engineering.docx');
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
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-v10-preflight-'));
 const file=await writeDocx(temp);
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],outside=[],metrics=[];
 try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:900});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{const host=new URL(r.url()).hostname;if(host!=='127.0.0.1')outside.push(host);});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
  await (await page.$('#file')).uploadFile(file);
  await page.waitForFunction(()=>document.getElementById('source').value.length>45000,{timeout:28000});
  const imported=await page.evaluate(()=>{
   const session=window.TISAnalysisApp.session.read();
   return {words:session.text.split(/\s+/u).length,characters:session.text.length,
    sourceEqualsSession:document.getElementById('source').value===session.text,
    kind:session.sourceKind,modelLoaded:!!document.getElementById('tisOnDeviceModel'),
    screen:document.body.dataset.v10Screen};
  });
  assert(imported.words>5000,'long DOCX must extract at least 5000 words: '+JSON.stringify(imported));
  assert(imported.sourceEqualsSession);assert.equal(imported.kind,'docx');
  assert.equal(imported.modelLoaded,false,'DOCX must not auto-invoke optional ONNX model');
  assert.equal(imported.screen,'input');
  for(const width of [1440,768,390,320]){
   await page.setViewport({width,height:850});
   for(const lang of ['en','ar']){
    if((await page.evaluate(()=>document.documentElement.lang))!==lang)await page.click('#language');
    const layout=await page.evaluate(()=>({
     lang:document.documentElement.lang,dir:document.documentElement.dir,
     overflow:document.documentElement.scrollWidth-innerWidth,
     inputWidth:document.getElementById('inputPanel').getBoundingClientRect().width,
     actionVisible:!!document.getElementById('scanAI').getClientRects().length,
     sourceLength:document.getElementById('source').value.length,
     sessionLength:window.TISAnalysisApp.session.read().text.length
    }));
    metrics.push({width,lang,overflow:layout.overflow});
    assert(layout.overflow<=8,'long Word mobile overflow '+JSON.stringify({width,lang,overflow:layout.overflow}));
    assert(layout.actionVisible,'scan button invisible with imported Word at '+width);
    assert.equal(layout.sourceLength,layout.sessionLength,'source not preserved');
   }
  }
  const pdf=await browser.newPage();pdf.on('pageerror',e=>errors.push(e.message));
  await pdf.setViewport({width:390,height:844});
  await pdf.goto('http://127.0.0.1:'+server.address().port+'/?v10preview=1',{waitUntil:'load'});
  await pdf.evaluate(bytes=>{
   const input=document.getElementById('file'),dt=new DataTransfer();
   dt.items.add(new File([new Uint8Array(bytes)],'synthetic-measurements.pdf',{type:'application/pdf'}));
   input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  },pdfBytes('Engineering measurements were recorded before issuing the construction document.'));
  await pdf.waitForFunction(()=>document.getElementById('source').value.includes('Engineering measurements'),{timeout:20000});
  assert.equal(await pdf.evaluate(()=>window.TISAnalysisApp.session.read().sourceKind),'pdf');
  assert.equal(await pdf.evaluate(()=>document.body.dataset.v10Screen),'input');
  assert.deepEqual(errors,[],'no browser runtime errors');
  assert.deepEqual(outside,[],'file parsing does not contact third-party services');
  console.log('V10 long-document metrics '+JSON.stringify({words:imported.words,characters:imported.characters,layouts:metrics}));
  console.log('PASS V10 real 5k+ word DOCX and PDF import, eight responsive configurations, preserved source and no automatic model requests');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));fs.rmSync(temp,{recursive:true,force:true});}
}
run().catch(e=>{console.error(e);process.exitCode=1;});