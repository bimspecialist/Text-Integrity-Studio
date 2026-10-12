'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,makePDF,chrome}=require('./pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tis-ocr-'));
 const source=path.join(temp,'scanned-page.pdf');
 fs.writeFileSync(source,makePDF('')); // Blank page exercises the entire offline image-to-text pipeline.
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
   const page=await browser.newPage();
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
   assert.deepEqual(remote,[],'Document and OCR data stay on the same local origin');
   assert.deepEqual(missing,[],'OCR worker, WASM and language data all load');
   assert.deepEqual(errors,[],'No uncaught OCR page errors');
   console.log('PASS offline scanned-PDF OCR with locally hosted English language and WASM engine');
 }finally{
   await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});
 }
}
run().catch(err=>{console.error(err);process.exit(1);});
