'use strict';
// Fast, non-disruptive browser preflight. Not a real generator benchmark:
// without independently licensed weights, device consent and actual bilingual
// inference, the only acceptable result is HOLD / RESEARCH_ONLY.
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const manifest=require('../../docs/analysis/local-rewrite-model-manifest.json');
async function main(){
 const server=serve();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
  const page=await browser.newPage(),remote=[];
  page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')remote.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const device=await page.evaluate(()=>({
   webgpuPresent:typeof navigator.gpu!=='undefined',
   secureContext:window.isSecureContext,
   generatorEnabled:typeof window.TISLocalRewriteGenerator!=='undefined',
   modelIframePresent:!!document.querySelector('#tisOnDeviceModel')
  }));
  assert.equal(typeof device.webgpuPresent,'boolean');
  assert.equal(device.generatorEnabled,false);
  assert.equal(device.modelIframePresent,false);
  assert.equal(manifest.productionDefault,null,'unverified local generator cannot be silently enabled');
  assert(manifest.candidates.every(c=>c.status==='RESEARCH_ONLY'));
  assert.deepEqual(remote,[],'first load does not download models or send document content');
  console.log('PASS L1 research HOLD; preflight only, WebGPU present='+device.webgpuPresent+
    '. No real generation was performed; license/quality/device gates remain.');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
