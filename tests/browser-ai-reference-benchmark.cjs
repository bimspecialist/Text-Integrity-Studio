'use strict';
/* Research benchmark only: runs the actual TMR ONNX browser model on a bounded,
 * public English HC3 holdout or external 2026 source-documented dataset.
 * All author labels are source claims, not independently verified; no document
 * text is written to prediction artifacts. HC3 labels are public dataset claims,
 * not independently verified provenance. The optional GPT-2-era model was not
 * tested here: different data and pretrained training collisions require review.
 */
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('puppeteer-core');
const {serve,chrome}=require('./pdf-browser.test.js');
const corpus=process.env.TIS_PUBLIC_WEAK_CORPUS;
const output=process.env.TIS_BENCH_RESULTS||'/tmp/tis-hc3-benchmark.jsonl';
if(!corpus||!fs.existsSync(corpus))throw Error('Bounded public baseline JSONL required');
const dataset=fs.readFileSync(corpus,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const includeCalibration=process.env.TIS_BENCH_INCLUDE_CALIBRATION==='1';
function choose(label,split,limit){
 const filtered=dataset.filter(r=>
  r.label===label&&r.split===split&&r.language==='en'&&
  typeof r.text==='string'&&r.text.length<120000&&r.text.trim().split(/\s+/u).length>=120
 );
 filtered.sort((a,b)=>a.id.localeCompare(b.id));
 return filtered.slice(0,limit);
}
const EXTERNAL=process.env.TIS_BENCH_CORPUS_MODE==='external-2026';
const selected=EXTERNAL
 ? [...dataset].filter(r=>r.split==='test'&&r.language==='en').sort((a,b)=>
     a.id.localeCompare(b.id))
 : [
   ...choose('human','test',24),...choose('ai','test',24),
   ...(includeCalibration?[...choose('human','calibration',32),...choose('ai','calibration',32)]:[])
 ];
if(EXTERNAL){
 const counts=new Map();
 for(const r of selected){
  if(!['human','ai'].includes(r.label)||!r.source_group||
     typeof r.text!=='string'||r.text.split(/\s+/).length<120||
     !r.label_provenance)
    throw Error('Invalid external benchmark record or authorship provenance');
  counts.set(r.domain,(counts.get(r.domain)||0)+1);
 }
 if(!counts.has('academic')||!counts.has('encyclopedic'))
  throw Error('Independent evaluation must include both academic and encyclopedic domains');
}
const human=selected.filter(x=>x.label==='human').length;
const machine=selected.filter(x=>x.label==='ai').length;
if(human<12||machine<12)throw Error('Not enough consent/license-audited public weak-label samples for an informative pilot');
async function run(){
 const server=serve();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 const rows=[];
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.waitForSelector('#scanAI',{visible:true});
  await page.evaluate(()=>{
   window.__benchmarkResults=[];
   window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.data?.channel!=='TIS_BROWSER_AI_V1')return;
    if(event.data.op==='RESULT'||event.data.op==='ERROR'){
     window.__benchmarkResults.push(event.data);
    }
   });
  });
  for(let i=0;i<selected.length;i++){
   const sample=selected[i];
   const before=await page.evaluate(()=>window.__benchmarkResults.length);
   await page.$eval('#source',(input,value)=>{
    input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
   },sample.text);
   // Use the canonical visible public Analyze action; legacy #aiRun is hidden.
   await page.click('#scanAI');
   await page.waitForFunction(previous=>window.__benchmarkResults.length>previous,
     {timeout:180000},before);
   const response=await page.evaluate(()=>window.__benchmarkResults.at(-1));
   if(response.op!=='RESULT'||!Number.isFinite(response.result?.primary?.score))
    throw Error('Pretrained TMR inference failed on record '+(i+1)+': '+response.code);
   const result=response.result;
   if(!Number.isFinite(result.primary.coverage)||result.primary.coverage<=0)
    throw Error('Reference text has invalid source coverage');
   if(result.calibration!=='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE' ||
      result.version!=='TIS_CONSENSUS_V2_2026_10' ||
      typeof result.status!=='string' ||
      (result.score!==null&&!Number.isFinite(result.score)))
    throw Error('Unverified or invalid browser display contract in benchmark sample '+(i+1));
   rows.push({
    id:sample.id,label:sample.label,
    score:result.primary.score,
    // Keep displayed diagnostics separate; withheld scores must NOT count as user alerts.
    reported_signal_percent:result.score,
    report_status:result.status,
    group:sample.source_group,
    domain:sample.domain||'general',
    language:'en',split:sample.split,
    benchmark:EXTERNAL?'TEXTSIGHT_2026_EXTERNAL_VENDOR_BENCHMARK':'HC3_PUBLIC_WEAK_LABELS',
    label_provenance:EXTERNAL?sample.label_provenance:'UNVERIFIED_PUBLIC_DATASET_CLAIM',
    model_family:EXTERNAL?(sample.model_family||''):'',
    covered_percent:result.primary.coverage,
    model_revision:result.primary.revision
   });
   console.log('Benchmark sample '+(i+1)+'/'+selected.length+' complete (source text not logged)');
  }
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  console.log('Wrote evidence-only JSONL with '+rows.length+' public weak-labelled records, no raw document text');
 }finally{
  await browser.close();
  await new Promise(r=>server.close(r));
 }
}
run().catch(error=>{console.error(error);process.exit(1);});
