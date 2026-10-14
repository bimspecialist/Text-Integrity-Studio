'use strict';
/* S3 actual Chrome responsiveness measured on the existing STATIC EDITOR ONLY.
 * This is NOT a WebGPU generative or ONNX detector inference benchmark.
 * Every fixture is synthetic and no document content is logged/persisted.
 */
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('../pdf-browser.test.js');
const {validatePerfRecord,comparePerf}=require('../../docs/analysis/performance-budget.js');

if(process.env.TIS_PERF_REAL_MODEL==='1'){
 console.error('REAL_MODEL_PERFORMANCE_PROTOCOL_NOT_CONFIGURED: refusing to replace a real-model benchmark with synthetic timings');
 process.exit(3);
}
const repoSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.match(repoSha,/^[0-9a-f]{40}$/,'source commit must be an actual SHA');
const MODEL='b9aa251e5bcda7e429fcc936767d921435945b60';
const words=n=>Array(n).fill('check').join(' '); // explicitly synthetic public fixture

const median=values=>{
 const a=[...values].sort((x,y)=>x-y);
 return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;
};
const p95=values=>{
 const a=[...values].sort((x,y)=>x-y);
 return a[Math.ceil(.95*a.length)-1];
};

async function main(){
 const server=serve();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const remote=[],errors=[],records=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.hostname!=='127.0.0.1')remote.push({method:request.method(),origin:url.origin});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const browserVersion=await browser.version();
  const cdp=await page.createCDPSession();
  const scenarios=[
   {name:'desktop-150',width:1440,height:900,wordCount:150,throttle:1},
   {name:'desktop-2000',width:1440,height:900,wordCount:2000,throttle:1},
   {name:'desktop-20000',width:1440,height:900,wordCount:20000,throttle:1},
   {name:'mobile-150',width:390,height:844,wordCount:150,throttle:4},
   {name:'mobile-2000',width:390,height:844,wordCount:2000,throttle:4},
   {name:'near-limit',width:1440,height:900,wordCount:23999,throttle:1},
  ];
  for(const scenario of scenarios){
   const value=words(scenario.wordCount);
   assert(value.length<=120000,'fixture respects 120k-character limit');
   await page.setViewport({width:scenario.width,height:scenario.height});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:scenario.throttle});
   // Never click Analyze; measure input dispatch plus two paint opportunities.
   const samples=[];
   for(let trial=0;trial<3;trial++){
    const elapsed=await page.evaluate(async t=>{
     const source=document.getElementById('source');
     const start=performance.now();
     source.value=t;
     source.dispatchEvent(new Event('input',{bubbles:true}));
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     return performance.now()-start;
    },value);
    assert(Number.isFinite(elapsed)&&elapsed>0);
    samples.push(elapsed);
   }
   assert.equal(await page.$('#tisOnDeviceModel'),null,'editor baseline never loads AI runtime');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   if(scenario.width===390)assert(overflow<=8,'mobile viewport remains usable');
   const result={
    version:'PATH_A_V7_EDITOR_NON_REAL',
    commitSha:repoSha,
    modelRevisions:{primary:MODEL,secondary:null},
    deviceProfile:{platform:process.platform,viewport:scenario.width+'x'+scenario.height,cpuThrottle:scenario.throttle},
    browserVersion,
    networkProfile:'local-http-without-external-fetch',
    documentWordCount:scenario.wordCount,
    documentCharacterCount:value.length,
    coldStart:false,
    downloadBytesIfObserved:null,
    medianMs:median(samples),
    p95Ms:p95(samples),
    peakHeapBytesIfAvailable:null,
    measurementMethod:'CHROMIUM_EDITOR_NO_MODEL',
    sampleMode:'NON_REAL_PERFORMANCE',
    runs:samples.length,
    notes:'Synthetic editor input/paint only. No GPU memory, model download or generation measured.'
   };
   assert.equal(validatePerfRecord(result).ok,true,scenario.name);
   assert.equal(comparePerf(result,result).pass,false,'no synthetic acceptance');
   records.push(result);
  }
  assert.deepEqual(remote,[],'editor-only test should not contact a third-party host');
  assert.deepEqual(errors,[],'no browser exceptions during synthetic workload');
  assert(records.some(x=>x.documentWordCount===20000));
  assert(records.some(x=>x.documentCharacterCount>115000));
  assert(records.some(x=>x.deviceProfile.viewport==='390x844'));
  // Only print aggregate metadata (never even synthetic document text).
  console.log(JSON.stringify({status:'NON_REAL_PERFORMANCE',commitSha:repoSha,
   browserVersion,scenarios:records.map(r=>({
    words:r.documentWordCount,characters:r.documentCharacterCount,
    viewport:r.deviceProfile.viewport,cpuThrottle:r.deviceProfile.cpuThrottle,
    medianMs:r.medianMs,p95Ms:r.p95Ms,peakHeapBytesIfAvailable:null
   })),modelInferenceObserved:false}));
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
