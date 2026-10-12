'use strict';
// Explicit live network validation of the browser's real ONNX model.
const puppeteer=require('puppeteer-core');
const fs=require('node:fs'),path=require('node:path');
const {serve,chrome}=require('./pdf-browser.test.js');
async function main(){
 const server=serve();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  const failures=[],warnings=[];
  page.on('requestfailed',r=>failures.push((r.failure()?.errorText||'Request failed')+' '+r.url().slice(0,160)));
  page.on('pageerror',e=>warnings.push('PAGE_ERROR '+e.message));
  page.on('console',e=>{if(['error','warning'].includes(e.type()))warnings.push(e.type()+': '+e.text().slice(0,250));});
  await page.setViewport({width:1280,height:900});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const english=('The laboratory research assistant collected detailed measurements from each experimental location, '+
   'reviewed the calculations with the instructor, and recorded the underlying observations for independent verification. ').repeat(11);
  await page.$eval('#source',(el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));},english);
  await page.click('#aiRun');
  await page.waitForFunction(()=>{
    const label=document.getElementById('aiMeterScore')?.textContent||'';
    const status=document.getElementById('aiStatus')?.textContent||'';
    return label.includes('%')||/unavailable|unable|unknown|تعذر|تعذّر/.test(status.toLowerCase());
  },{timeout:240000});
  const result=await page.evaluate(()=>({
    score:document.getElementById('aiMeterScore').textContent,
    status:document.getElementById('aiStatus').textContent
  }));
  if(!/^\d+(\.\d+)?%/.test(result.score.trim())){
   throw Error('Real model did not produce a score: '+JSON.stringify({result,failures:failures.slice(-8),warnings:warnings.slice(-12)}));
  }
  const score=parseFloat(result.score);
  if(!Number.isFinite(score)||score<0||score>100)throw Error('Model score invalid');
  const dirname=process.env.TIS_SCREENSHOT_DIR||'/tmp/tis-ui-screenshots';
  fs.mkdirSync(dirname,{recursive:true});
  await page.screenshot({path:path.join(dirname,'real-model-runtime.png'),fullPage:true});
  // Explicit advanced opt-in: download a second independent historical model
  // and verify it really runs instead of simulating a second number.
  await page.click('#aiAdvanced > summary');
  await page.click('#aiDeep');
  await page.click('#aiRun');
  await page.waitForFunction(()=>{
    const details=document.getElementById('aiEvidenceBody')?.textContent||'';
    const button=document.getElementById('aiRun');
    const stage=document.getElementById('aiStatus')?.textContent||'';
    return (details.includes('OpenAI') && !button.disabled) ||
      (/unavailable|unable|unexpected/i.test(stage) && !button.disabled);
  },{timeout:320000});
  const deep=await page.evaluate(()=>({
    meter:document.getElementById('aiMeterScore')?.textContent,
    text:document.getElementById('aiEvidenceBody')?.textContent?.slice(0,2500),
    status:document.getElementById('aiStatus')?.textContent,
    label:document.getElementById('aiShort')?.textContent
  }));
  if(!deep.text?.includes('OpenAI') || !deep.text?.match(/\d+(\.\d+)?%/g)?.length ||
     deep.text?.match(/\d+(\.\d+)?%/g)?.length < 2){
    throw Error('Real optional second model not confirmed: '+
      JSON.stringify({deep,failures:failures.slice(-8),warnings:warnings.slice(-12)}));
  }
  await page.screenshot({path:path.join(dirname,'real-dual-model-runtime.png'),fullPage:true});
  console.log(JSON.stringify({
    result:'PASS',score_type:'EXPERIMENTAL_UNCALIBRATED_MODEL_SIGNALS',
    primaryScore:score,deepResult:deep,modelCount:2,
    modelIds:['onnx-community/tmr-ai-text-detector-ONNX','onnx-community/roberta-base-openai-detector-ONNX'],
    downloadFailures:failures.length,warnings:warnings.slice(-8)
  },null,2));
 }finally{
  await browser.close();
  await new Promise(r=>server.close(r));
 }
}
main().catch(e=>{console.error(e);process.exit(1);});
