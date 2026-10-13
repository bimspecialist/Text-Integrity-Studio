'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const puppeteer=require('puppeteer-core');
const root=path.resolve('docs');
const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(p=>fs.existsSync(p));
if(!chrome)throw Error('Chrome must be available in CI');
function makePDF(text='PDF private extraction works'){
 const instructions='BT /F1 16 Tf 72 700 Td ('+text.replace(/[()\\]/g,c=>'\\'+c)+') Tj ET';
 const entries=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(instructions,'latin1')+' >>\nstream\n'+instructions+'\nendstream'
 ];
 let pdf='%PDF-1.4\n'; const offsets=[0];
 for(let i=0;i<entries.length;i++){
   offsets.push(Buffer.byteLength(pdf,'latin1'));
   pdf+=(i+1)+' 0 obj\n'+entries[i]+'\nendobj\n';
 }
 const xref=Buffer.byteLength(pdf,'latin1');
 pdf+='xref\n0 '+(entries.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(pdf,'latin1');
}
function serve(){
 return http.createServer((req,res)=>{
   const uri=decodeURIComponent((req.url||'/').split('?')[0]);
   const name=uri==='/'?'index.html':uri.replace(/^\/+/,'');
   const filename=path.resolve(root,name);
   if(!filename.startsWith(root+path.sep)&&filename!==path.join(root,'index.html')){res.writeHead(403);res.end();return;}
   try{
     const body=fs.readFileSync(filename);
     let type='application/octet-stream';
     if(name.endsWith('.html'))type='text/html';
     else if(name.endsWith('.js')||name.endsWith('.mjs'))type='text/javascript';
     else if(name.endsWith('.css'))type='text/css';
     else if(name.endsWith('.wasm'))type='application/wasm';
     else if(name.endsWith('.gz'))type='application/gzip';
     else if(name.endsWith('.pdf'))type='application/pdf';
     res.writeHead(200,{'Content-Type':type});res.end(body);
   }catch(e){res.writeHead(404);res.end('File missing '+name);}
 });
}
async function run(){
 const server=serve();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-pdf-'));
 const pdfPath=path.join(temp,'normal.pdf');
 fs.writeFileSync(pdfPath,makePDF());
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
   const page=await browser.newPage();const errors=[],outside=[],missing=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')outside.push(r.url());});
   page.on('response',r=>{if(r.status()>=400)missing.push(r.url()+' '+r.status());});
   await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
   assert(await page.$('#pdfPick'),'PDF panel is present');
   await (await page.$('#file')).uploadFile(pdfPath);
   await page.waitForFunction(()=>document.getElementById('source').value.includes('PDF private extraction works'),{timeout:40000});
   assert.equal(await page.$eval('#pdfDetails',el=>el.hidden),false);
   assert.equal(await page.$eval('#source',el=>el.readOnly),false,'PDF extraction can be edited as plain text');
   await page.$eval('#v5Toolbox',el=>{el.open=true;});
   await page.click('#writingTools > summary');
   await page.click('#labAnalyze');
   const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:temp});
   await page.click('#pdfExport');
   const extracted=path.join(temp,'pdf-extracted-text.txt');
   let ok=false;
   for(let i=0;i<32;i++){if(fs.existsSync(extracted)){ok=true;break;}await new Promise(r=>setTimeout(r,180));}
   assert(ok,'Extracted PDF text downloads');
   assert(fs.readFileSync(extracted,'utf8').includes('PDF private extraction works'));
   await page.click('#language');
   assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl','Arabic layout works');
   await page.setViewport({width:390,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+8),'Mobile PDF UI fits');
   assert.deepEqual(outside,[],'No external network requests made while processing PDF');
   assert.deepEqual(missing,[],'All self-hosted PDF modules and CMaps available');
   assert.deepEqual(errors,[],'No client-side browser error');
   console.log('PASS PDF.js local import, PDF text extraction, TXT export, mobile/RTL and privacy.');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exit(1);});
module.exports={serve,makePDF,chrome,root};
