'use strict';
const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
async function run(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage();await page.setViewport({width:390,height:844});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.click('#tisTabHumanize');
  const info=await page.evaluate(()=>{
   const panel=document.getElementById('tisModePanel');
   return {display:getComputedStyle(panel).display,role:panel.getAttribute('role'),
    label:panel.getAttribute('aria-labelledby'),
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.equal(info.display,'flex','the role=tabpanel wrapper must not be display:contents');
  assert.equal(info.role,'tabpanel');assert.equal(info.label,'tisTabHumanize');
  assert(info.overflow<=8,'390px reflow must not overflow');
  const cdp=await page.target().createCDPSession();
  const root=await cdp.send('DOM.getDocument');
  const hit=await cdp.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#tisModePanel'});
  const desc=await cdp.send('DOM.describeNode',{nodeId:hit.nodeId});
  const ax=await cdp.send('Accessibility.getFullAXTree');
  const node=ax.nodes.find(n=>n.backendDOMNodeId===desc.node.backendNodeId);
  assert(node&&!node.ignored,'tabpanel must be represented and exposed in Chromium AX tree');
  assert.equal(node.role?.value,'tabPanel');
  await page.setViewport({width:1150,height:900});
  assert.match(await page.$eval('#tisV8Shortcut',el=>el.textContent),/review writing/i);
  await page.click('#language');
  assert.match(await page.$eval('#tisV8Shortcut',el=>el.textContent),/مراجعة الكتابة/u);
  await page.click('#tisTabDetection');
  assert.match(await page.$eval('#tisV8Shortcut',el=>el.textContent),/للتحليل/u);
  await page.setViewport({width:320,height:700});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=8);
  console.log('PASS V9 Chromium AX: mobile tabpanel, EN/AR shortcut and 320px reflow');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});