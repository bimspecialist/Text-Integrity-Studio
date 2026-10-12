'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');
function imageOnlyPDF(jpeg,width=1100,height=320){
 const image=Buffer.concat([
  Buffer.from('<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n','latin1'),
  jpeg,Buffer.from('\nendstream','latin1')
 ]);
 const content='q 500 0 0 145 56 530 cm /Im1 Do Q';
 const objs=[
  Buffer.from('<< /Type /Catalog /Pages 2 0 R >>','latin1'),
  Buffer.from('<< /Type /Pages /Count 1 /Kids [3 0 R] >>','latin1'),
  Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>','latin1'),
  image,
  Buffer.from('<< /Length '+Buffer.byteLength(content,'latin1')+' >>\nstream\n'+content+'\nendstream','latin1')
 ];
 const parts=[Buffer.from('%PDF-1.4\n','latin1')],offsets=[0];
 let position=parts[0].length;
 for(let i=0;i<objs.length;i++){
  const obj=Buffer.concat([Buffer.from((i+1)+' 0 obj\n','latin1'),objs[i],Buffer.from('\nendobj\n','latin1')]);
  offsets.push(position);parts.push(obj);position+=obj.length;
 }
 let trailer='xref\n0 6\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))trailer+=String(off).padStart(10,'0')+' 00000 n \n';
 trailer+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+position+'\n%%EOF\n';
 parts.push(Buffer.from(trailer,'latin1'));
 return Buffer.concat(parts);
}
async function run(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-ocr-'));
 const source=path.join(temp,'scanned-page.pdf');
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
   const page=await browser.newPage();
   const jpeg64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1100;c.height=320;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='bold 88px Arial, sans-serif';x.fillText('HELLO 123',100,206);return c.toDataURL('image/jpeg',.97).split(',')[1];});
   fs.writeFileSync(source,imageOnlyPDF(Buffer.from(jpeg64,'base64')));
   const errors=[],remote=[],missing=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
   page.on('response',r=>{if(r.status()>=400)missing.push(r.url()+' '+r.status());});
   await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
   await (await page.$('#file')).uploadFile(source);
   await page.waitForFunction(()=>!document.getElementById('pdfDetails').hidden,{timeout:20000});
   await page.waitForFunction(()=>document.getElementById('pdfStatus').textContent.includes('pages without readable text')||document.getElementById('pdfStatus').textContent.includes('Some pages'),{timeout:30000});
   await page.select('#pdfLanguage','eng');
   await page.click('#pdfOcr');
   await page.waitForFunction(()=>document.getElementById('pdfOcr').disabled===false&&/OCR finished|OCR done|اكتمل OCR/i.test(document.getElementById('pdfStatus').textContent),{timeout:110000});
   const recognized=await page.$eval('#source',el=>el.value.trim());
   console.log('OCR result snippet:',JSON.stringify(recognized.slice(0,130)));
   assert(/HELLO|123/i.test(recognized),'Actual OCR recognizes text from scanned image-only PDF');
   assert.deepEqual(remote,[],'Document and OCR data stay on the same local origin');
   assert.deepEqual(missing,[],'OCR worker, WASM and language data all load');
   assert.deepEqual(errors,[],'No uncaught OCR page errors');
   console.log('PASS offline scanned-PDF OCR with locally hosted English language and WASM engine');
 }finally{
   await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});
 }
}
run().catch(err=>{console.error(err);process.exit(1);});
