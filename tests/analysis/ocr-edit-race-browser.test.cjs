'use strict';
/* V8.10: real Chromium and PDF.js extraction with deliberately delayed OCR
 * worker result. The worker result is controlled only to test race ordering;
 * genuine Tesseract OCR accuracy remains tested by tests/ocr-browser.test.js.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
function pdfBytes(){
 const data='BT /F1 16 Tf 72 700 Td (A) Tj ET';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(data,'latin1')+' >>\nstream\n'+data+'\nendstream'
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=Buffer.byteLength(pdf,'latin1');
 pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return [...Buffer.from(pdf,'latin1')];
}
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[],egress=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')egress.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.evaluate(bytes=>{
   const picker=document.getElementById('file');
   const data=new DataTransfer();
   data.items.add(new File([new Uint8Array(bytes)],'one-short-page.pdf',{type:'application/pdf'}));
   picker.files=data.files;picker.dispatchEvent(new Event('change',{bubbles:true}));
  },pdfBytes());
  await page.waitForFunction(()=>document.getElementById('source').value.trim()==='A'&&
   document.getElementById('pdfStatus').textContent.includes('pages'),{timeout:20000});
  await page.evaluate(()=>{
   window.__recognizeRelease=null;window.__ocrFinished=false;
   window.Tesseract={createWorker:async()=>({
    recognize:async() => new Promise(resolve=>{
     window.__recognizeRelease=()=>{resolve({data:{text:'STALE RECOGNITION'}});};
    }),
    terminate:async()=>{window.__ocrFinished=true;}
   })};
  });
  await page.$eval('#v5Toolbox',el=>{el.open=true;});
  await page.click('#pdfOcr');
  await page.waitForFunction(()=>typeof window.__recognizeRelease==='function',{timeout:20000});
  const recent='I updated the engineering notes [2] to 5 mm while OCR was running.';
  await page.$eval('#source',(el,txt)=>{
   el.value=txt;el.dispatchEvent(new Event('input',{bubbles:true}));
  },recent);
  const revision=await page.evaluate(()=>window.TISAnalysisApp.session.read().revision);
  await page.evaluate(()=>window.__recognizeRelease());
  await page.waitForFunction(()=>window.__ocrFinished&&
   !document.getElementById('pdfOcr').disabled,{timeout:10000});
  assert.equal(await page.$eval('#source',el=>el.value),recent,
   'late OCR recognition must not overwrite edits made during recognition');
  assert.equal(await page.evaluate(()=>window.TISAnalysisApp.session.read().revision),revision,
   'stale OCR must not advance authoritative document revision');
  assert(await page.$eval('#pdfStatus',n=>n.textContent.length>8),
   'discarding an OCR result should display understandable local status');
  assert.deepEqual(egress,[],'no remote text or OCR requests');
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('PASS V8.10 Chromium: delayed OCR completion preserves latest source and session; real engine is separately verified');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
