'use strict';
/* V8.11 last chosen document wins even while a prior parser is busy.
 * Real Chromium, real JSZip Word parsing and PDF.js module imports.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
function pdfBytes(txt){
 const data='BT /F1 16 Tf 72 700 Td ('+txt+') Tj ET';
 const objs=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(data,'latin1')+' >>\nstream\n'+data+'\nendstream'
 ];
 let out='%PDF-1.4\n',offsets=[0];
 for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(out,'latin1'));out+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}
 const xref=Buffer.byteLength(out,'latin1');
 out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))out+=String(off).padStart(10,'0')+' 00000 n \n';
 out+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return [...Buffer.from(out,'latin1')];
}
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],remote=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.evaluate(()=>{
   window.__choose=(name,bytes,type)=>{
    const data=new DataTransfer();
    data.items.add(new File([bytes],name,{type}));
    const input=document.getElementById('file');
    input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
   };
   const orig=File.prototype.arrayBuffer;
   File.prototype.arrayBuffer=function(){
    if(this.name!=='slow-first.docx')return orig.call(this);
    return new Promise((resolve,reject)=>{
     window.__releaseOldWord=()=>orig.call(this).then(resolve,reject);
    });
   };
  });
  const mkWord=async value=>page.evaluate(async val=>{
   const zip=new JSZip();
   zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
   zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+val+'</w:t></w:r></w:p></w:body></w:document>');
   return [...(await zip.generateAsync({type:'uint8array'}))];
  },value);
  const one=await mkWord('OLD WORD DOCUMENT'),two=await mkWord('LATEST WORD DOCUMENT');
  const wordMime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await page.evaluate((bytes,mime)=>window.__choose('slow-first.docx',new Uint8Array(bytes),mime),one,wordMime);
  await page.waitForFunction(()=>typeof window.__releaseOldWord==='function',{timeout:8000});
  await page.evaluate((bytes,mime)=>window.__choose('latest-second.docx',new Uint8Array(bytes),mime),two,wordMime);
  await page.evaluate(()=>window.__releaseOldWord());
  await page.waitForFunction(()=>document.getElementById('source').value.includes('LATEST WORD DOCUMENT'),
   {timeout:9000});
  assert.equal(await page.$eval('#source',n=>n.value.trim()),'LATEST WORD DOCUMENT');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().sourceKind),'docx');

  const pdfPage=await browser.newPage();
  pdfPage.on('pageerror',e=>errors.push(e.message));
  pdfPage.on('requestfailed',r=>errors.push('failed request '+r.url()));
  await pdfPage.setRequestInterception(true);
  let resumeModule,signalImport;
  const blocked=new Promise(resolve=>{signalImport=resolve;});
  pdfPage.on('request',req=>{
   const url=new URL(req.url());
   if(url.hostname!=='127.0.0.1')remote.push(req.url());
   if(url.pathname.endsWith('/vendor/pdfjs/pdf.mjs')){
    resumeModule=()=>req.continue();
    signalImport();return;
   }
   req.continue();
  });
  await pdfPage.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await pdfPage.evaluate(()=>{
   window.__choosePdf=(name,bytes)=>{
    const data=new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)],name,{type:'application/pdf'}));
    const input=document.getElementById('file');
    input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
   };
  });
  await pdfPage.evaluate(b=>window.__choosePdf('first-loading.pdf',b),pdfBytes('OLD PDF'));
  await Promise.race([blocked,new Promise((_,reject)=>setTimeout(()=>reject(Error('PDF module import was not reached')),8000))]);
  await pdfPage.evaluate(b=>window.__choosePdf('latest-selected.pdf',b),pdfBytes('LATEST PDF'));
  resumeModule();
  await pdfPage.waitForFunction(()=>document.getElementById('source').value.includes('LATEST PDF'),
   {timeout:15000});
  assert.equal((await pdfPage.$eval('#source',n=>n.value.trim())),'LATEST PDF');
  assert.equal(await pdfPage.evaluate(()=>window.TISAnalysisApp.session.read().sourceKind),'pdf');
  assert.deepEqual(remote,[],'no document text leaves the local origin');
  assert.deepEqual(errors,[],'no JS or request failures');
  console.log('PASS V8.11 Chromium: latest DOCX and PDF selection wins while previous parser is busy');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
