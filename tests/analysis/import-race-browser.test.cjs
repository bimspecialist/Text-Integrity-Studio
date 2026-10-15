'use strict';
/* V8.9 — asynchronous local import safety. Real Chromium with real File APIs.
 * The artificial delay controls ONLY reading time; parsing and editor/session
 * commits are exercised through the application's actual file loaders.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
function pdfBytes(value){
 const commands='BT /F1 16 Tf 72 700 Td ('+value.replace(/[()\\]/g,'\\$&')+') Tj ET';
 const entries=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(commands,'latin1')+' >>\nstream\n'+commands+'\nendstream'
 ];
 let body='%PDF-1.4\n';const offsets=[0];
 for(let k=0;k<entries.length;k++){
  offsets.push(Buffer.byteLength(body,'latin1'));
  body+=(k+1)+' 0 obj\n'+entries[k]+'\nendobj\n';
 }
 const xref=Buffer.byteLength(body,'latin1');
 body+='xref\n0 '+(entries.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))body+=String(offset).padStart(10,'0')+' 00000 n \n';
 body+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return [...Buffer.from(body,'latin1')];
}
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
   if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.evaluate(()=>{
   window.__importPending=new Map();
   const text=File.prototype.text,bytes=File.prototype.arrayBuffer;
   File.prototype.text=function(){
    if(!this.name.startsWith('slow-'))return text.call(this);
    return new Promise((resolve,reject)=>{
     window.__importPending.set(this.name,()=>{
      window.__importPending.delete(this.name);
      text.call(this).then(resolve,reject);
     });
    });
   };
   File.prototype.arrayBuffer=function(){
    if(!this.name.startsWith('slow-'))return bytes.call(this);
    return new Promise((resolve,reject)=>{
     window.__importPending.set(this.name,()=>{
      window.__importPending.delete(this.name);
      bytes.call(this).then(resolve,reject);
     });
    });
   };
   window.__chooseLocal=(name,contents,type='text/plain')=>{
    const data=new DataTransfer();
    data.items.add(new File([contents],name,{type}));
    const input=document.getElementById('file');input.files=data.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
   };
   window.__typeCurrent=text=>{
    const source=document.getElementById('source');
    source.value=text;source.dispatchEvent(new Event('input',{bubbles:true}));
   };
  });
  const userEdit='The user kept the draft with 5 mm and reference [2].';
  await page.evaluate(()=>window.__chooseLocal('slow-older.txt','OLD_FILE_CONTENT'));
  await page.waitForFunction(()=>window.__importPending.has('slow-older.txt'));
  await page.evaluate(text=>window.__typeCurrent(text),userEdit);
  const rev=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.evaluate(()=>window.__importPending.get('slow-older.txt')());
  await new Promise(ok=>setTimeout(ok,150));
  assert.equal(await page.$eval('#source',el=>el.value),userEdit,
   'a slow TXT read must not overwrite newer user typing');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().revision),rev,
   'stale TXT completion must not add a document revision');

  await page.evaluate(()=>window.__chooseLocal('slow-first.txt','FIRST_FILE'));
  await page.waitForFunction(()=>window.__importPending.has('slow-first.txt'));
  await page.evaluate(()=>window.__chooseLocal('fast-second.txt','SECOND_FILE'));
  await page.waitForFunction(()=>document.getElementById('source').value==='SECOND_FILE');
  await page.evaluate(()=>window.__importPending.get('slow-first.txt')());
  await new Promise(ok=>setTimeout(ok,150));
  assert.equal(await page.$eval('#source',el=>el.value),'SECOND_FILE',
   'latest file selection must win even when the previous TXT read finishes last');

  const userAfterPdf='User edited while PDF extraction was reading.';
  await page.evaluate(buffer=>{
   window.__chooseLocal('slow-old.pdf',new Uint8Array(buffer),'application/pdf');
  },pdfBytes('Stale PDF should not replace newer text'));
  await page.waitForFunction(()=>window.__importPending.has('slow-old.pdf'));
  await page.evaluate(text=>window.__typeCurrent(text),userAfterPdf);
  const pdfRevision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.evaluate(()=>window.__importPending.get('slow-old.pdf')());
  await new Promise(ok=>setTimeout(ok,350));
  assert.equal(await page.$eval('#source',el=>el.value),userAfterPdf,
   'late PDF extraction must not overwrite newer user editing');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().revision),pdfRevision,
   'late PDF result must not update the document revision');

  // Genuine minimal Word OpenXML zip, parsed by existing vendored JSZip.
  await page.evaluate(async()=>{
   const zip=new JSZip();
   zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
   zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Old DOCX text that must be discarded</w:t></w:r></w:p></w:body></w:document>');
   const bytes=await zip.generateAsync({type:'uint8array'});
   window.__chooseLocal('slow-old.docx',bytes,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
  await page.waitForFunction(()=>window.__importPending.has('slow-old.docx'));
  const latest='New user typing during the delayed Word read.';
  await page.evaluate(text=>window.__typeCurrent(text),latest);
  const wordRevision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.evaluate(()=>window.__importPending.get('slow-old.docx')());
  await new Promise(ok=>setTimeout(ok,350));
  assert.equal(await page.$eval('#source',el=>el.value),latest,
   'late DOCX inspection must not replace current text with old document');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().revision),wordRevision);
  assert.equal(await page.$eval('#source',el=>el.readOnly),false,
   'discarded DOCX must not lock the newly typed source');
  assert.deepEqual(errors,[],'browser exceptions');
  assert.deepEqual(remote,[],'local imports never send user text to servers');
  console.log('PASS V8.9 Chromium: delayed TXT/Word/PDF loads cannot overwrite a newer document revision, last file selection wins');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
