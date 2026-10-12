'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');

async function run(){
 const chrome = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
 if(!chrome)throw Error('Headless Chrome required for Next.js UI test');
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/',{waitUntil:'load',timeout:45000});
  await page.waitForSelector('#additionalOptions');
  assert((await page.$eval('h1',n=>n.textContent)).includes('Check your document'));
  assert.equal(await page.$eval('#additionalOptions',n=>n.open),false,'Optional settings hidden by default');
  assert(await page.$('.file-picker input[type=file]'),'Document picker visible');
  assert(await page.$('a[href="https://bimspecialist.github.io/Text-Integrity-Studio/"]'),'Preserved public Word/PDF/writing toolkit link');
  await page.click('#additionalOptions > summary');
  assert.equal(await page.$eval('#additionalOptions',n=>n.open),true,'Experts can access all analysis options');
  await page.click('button[type=button].secondary');
  assert((await page.$eval('h1',n=>n.textContent)).includes('افحص'));
  assert.equal(await page.$eval('main',n=>n.dir),'rtl','Arabic uses RTL');
  await page.setViewport({width:390,height:844});
  const width=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert(width<=8,'Responsive view has no horizontal overflow: '+width);
  assert.deepEqual(errors,[],'No uncaught Next.js UI errors');
  console.log('PASS Next.js simple UI, progressive advanced settings, main toolkit link, Arabic RTL, mobile layout');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exit(1);});
