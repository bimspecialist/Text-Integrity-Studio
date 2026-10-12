'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,makePDF,chrome}=require('./pdf-browser.test.js');

async function run(){
 const server=serve();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tis-simple-'));
 const pdf=path.join(dir,'simple.pdf');fs.writeFileSync(pdf,makePDF('The private file is extracted'));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
   const page=await browser.newPage();const errors=[],remote=[],missing=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',req=>{if(new URL(req.url()).hostname!=='127.0.0.1')remote.push(req.url());});
   page.on('response',response=>{if(response.status()>=400)missing.push(response.url()+' '+response.status());});
   await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
   await page.waitForSelector('#writingTools');
   for(const id of ['writingTools','cleanupTools','pdfTools','researchTools','editorOptions','reportMore']){
     assert.equal(await page.$eval('#'+id,node=>node.open),false,id+' starts collapsed');
   }
   assert.equal(await page.$eval('#file',el=>el.accept.includes('.pdf')&&el.accept.includes('.docx')),true,'One shared upload supports PDF/Word');
   assert.equal(await page.$eval('#quickReview',el=>el.hidden),true,'No false suggestions for empty source');

   await page.$eval('#source',input=>{
     input.value='teh note,which includes results.';
     input.dispatchEvent(new Event('input',{bubbles:true}));
   });
   await page.click('#scan');
   await page.waitForFunction(()=>document.querySelectorAll('#labResults .writing-card').length>0 && !document.getElementById('quickReview').hidden);
   assert.equal(await page.$eval('#reportMore',el=>el.open),true,'Detailed report appears only after explicit check');
   assert((await page.$eval('#quickReport',el=>el.textContent)).includes('suggestions'),'One action checks spelling/clarity');
   await page.click('#quickReview');
   assert.equal(await page.$eval('#writingTools',el=>el.open),true,'Review opens only on demand');
   await page.click('#labPreview');
   const preview=await page.$eval('#labPreviewText',el=>el.value);
   assert(preview.includes('the note, which'),'Original writing engine remains functional');
   await page.click('#quickClean');
   assert.equal(await page.$eval('#cleanupTools',el=>el.open),true,'Cleanup remains available without clutter');
   assert.equal(await page.$eval('#resultbox',el=>el.hidden),false,'Cleanup still previews before applying');

   await page.click('#language');
   assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl','Arabic RTL toggle works');
   assert((await page.$eval('#stepInput',el=>el.textContent)).includes('أضف'),'Main workflow localized');

   await (await page.$('#file')).uploadFile(pdf);
   await page.waitForFunction(()=>document.getElementById('source').value.includes('The private file is extracted'),{timeout:40000});
   assert.equal(await page.$eval('#pdfTools',el=>el.open),true,'PDF/OCR options open when a PDF is selected');
   assert.equal(await page.$eval('#pdfDetails',el=>el.hidden),false,'PDF extraction remains functional');
   await page.setViewport({width:390,height:844});
   const mobile=await page.evaluate(()=>{
     const rect=id=>document.getElementById(id).getBoundingClientRect();
     return {overflow:document.documentElement.scrollWidth-window.innerWidth,
       inputTop:rect('inputPanel').top,reportTop:rect('reportPanel').top,
       writingTop:rect('writingTools').top};
   });
   assert(mobile.overflow<=8,'No horizontal overflow on narrow screens');
   assert(mobile.inputTop<mobile.reportTop&&mobile.reportTop<mobile.writingTop,'Mobile presents input, results, then advanced tools');
   assert.deepEqual(errors,[],'No browser runtime errors');
   assert.deepEqual(remote,[],'No third-party requests for user documents');
   assert.deepEqual(missing,[],'All local scripts and PDF assets load');
   console.log('PASS simple UI default, one-click grammar, cleanup, bilingual, PDF, progressive disclosure and mobile ordering');
 }finally{
   await browser.close();await new Promise(resolve=>server.close(resolve));
   fs.rmSync(dir,{force:true,recursive:true});
 }
}
run().catch(error=>{console.error(error);process.exit(1);});
