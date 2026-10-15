/* Text Integrity Studio — calibrated-evidence-aware experimental runtime.
 * The first model (RAID/TMR) remains the fast default. Explicit deep mode
 * loads a separately trained, older GPT-2 detector for a *disagreement check*.
 * These scores are NEVER independently validated authorship probabilities.
 *
 * Inference runs only after the user clicks, locally in the browser.
 * No code path transmits text to remote classifier APIs.
 */
'use strict';
const core=globalThis.TISEvidenceCore;
if(!core)throw Error('Evidence engine unavailable');

const MODELS={
 primary:{
  id:'onnx-community/tmr-ai-text-detector-ONNX',
  revision:'b9aa251e5bcda7e429fcc936767d921435945b60',
  label:'TMR · RAID-trained English',
  ai:new Set(['AI']),human:new Set(['HUMAN']),
  training:'RAID_2024'
 },
 secondary:{
  id:'onnx-community/roberta-base-openai-detector-ONNX',
  revision:'54895bd11f34b47a01369d25b2255224717409b8',
  label:'OpenAI GPT-2-era cross-check',
  ai:new Set(['FAKE']),human:new Set(['REAL']),
  training:'GPT2_2019_LEGACY'
 }
};
const LIBRARY_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const clients=new Map();
let libraryPromise=null,busy=false,nextRequest=null,cancelled=false;
let parentOrigin=null,frameToken=null;

function status(message){
 const element=document.getElementById('engine-status');
 if(element)element.textContent=message;
}
function send(op,requestId,details={}){
 if(window.parent!==window&&parentOrigin&&frameToken){
  window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',token:frameToken,op,requestId,...details},parentOrigin);
 }
}
function aiSignalFromOutput(outputs,modelKey='primary'){
 const item=Array.isArray(outputs)?outputs[0]:outputs;
 if(!item||!Number.isFinite(item.score)||item.score<0||item.score>1)
  throw Error('INVALID_MODEL_OUTPUT');
 const kind=MODELS[modelKey];
 if(!kind)throw Error('UNVERIFIED_MODEL_LABEL');
 const label=String(item.label||'').toUpperCase().trim();
 if(kind.ai.has(label))return item.score;
 if(kind.human.has(label))return 1-item.score;
 throw Error('UNVERIFIED_MODEL_LABEL');
}
async function getClassifier(which,requestId){
 if(clients.has(which))return clients.get(which);
 const metadata=MODELS[which];
 if(!metadata)throw Error('UNKNOWN_MODEL');
 const promise=(async()=>{
  if(!libraryPromise)libraryPromise=import(LIBRARY_URL).catch(e=>{libraryPromise=null;throw e;});
  const {pipeline}=await libraryPromise;
  send('PROGRESS',requestId,{stage:'LOADING',model:which});
  const pipe=await pipeline('text-classification',metadata.id,{
    dtype:'q8',
    revision:metadata.revision,
    progress_callback:p=>{
     if(p?.status==='progress'&&Number.isFinite(p.progress)){
      send('PROGRESS',requestId,{
       stage:'DOWNLOADING',model:which,
       percent:Math.round(Math.max(0,Math.min(100,p.progress)))
      });
     }
    }
  });
  if(typeof pipe!=='function'||typeof pipe.tokenizer?.encode!=='function')
   throw Error('MODEL_LOAD_FAILED');
  // Verify checkpoint's classifier label contract before observing any user's text.
  const labels=pipe.model?.config?.id2label||{};
  const list=Object.values(labels).map(v=>String(v).toUpperCase());
  if(list.length!==2||!list.some(v=>metadata.ai.has(v))||
     !list.some(v=>metadata.human.has(v))){
   throw Error('UNVERIFIED_MODEL_LABEL');
  }
  return pipe;
 })().catch(e=>{clients.delete(which);throw e;});
 clients.set(which,promise);
 return promise;
}
function ensureActive(){if(cancelled)throw Error('CANCELLED');}
async function runModel(which,text,requestId,context,fullScan=false){
 ensureActive();
 const pipe=await getClassifier(which,requestId);
 const selection=core.partitionWindows(text,pipe.tokenizer,{
  maxTokens:448,
  maxSamples:fullScan?core.MAX_WINDOWS_EXTENDED:core.MAX_WINDOWS
 });
 if(!selection.windows.length)throw Error('INSUFFICIENT_COVERAGE');
 const results=[];
 for(let i=0;i<selection.windows.length;i++){
  ensureActive();
  send('PROGRESS',requestId,{
   stage:'ANALYZING',model:which,
   percent:Math.round(i/selection.windows.length*100)
  });
  const response=await pipe(selection.windows[i].text,{truncation:false});
  const ai=aiSignalFromOutput(response,which);
  results.push(ai);
 }
 ensureActive();
 const summary=core.summarizeWindows(selection.windows,results,{
  modelId:MODELS[which].id,coverage:selection.coverage
 });
 return {
  ...summary,model_label:MODELS[which].label,
  revision:MODELS[which].revision,training:MODELS[which].training,
  words:selection.totalWords,
  supportedCoverage:Math.round(selection.supportedCoverage*1000)/10,
  totalWindows:selection.windowCount,
  skippedOversizeWords:selection.oversizeCount,
  sampling:selection.method,
  context,fullScan
 };
}
async function evaluate(text,requestId,opts={}){
 const eligibility=core.eligibility(text);
 if(!eligibility.eligible)throw Error(eligibility.reason);
 const primary=await runModel('primary',text,requestId,opts.context,opts.full===true);
 let secondary=null,secondaryError=null;
 if(opts.deep===true){
  try{secondary=await runModel('secondary',text,requestId,opts.context,opts.full===true);}
  catch(e){
   if(e?.message==='CANCELLED')throw e;
   secondaryError='SECONDARY_MODEL_UNAVAILABLE';
  }
 }
 const summary=core.consensus(primary,secondary,{context:opts.context});
 if(opts.deep===true&&!secondary){
  if(summary.score!==null)summary.status='SECONDARY_UNAVAILABLE';
  summary.flags.push('SECONDARY_MODEL_UNAVAILABLE');
 }
 return {
  ...summary,primary,secondary,secondaryError,
  deepRequested:opts.deep===true,extendedScanRequested:opts.full===true,
  score_type:'UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY',
  words:eligibility.words,language:'en',
  version:'TIS_CONSENSUS_V2_2026_10',
  processing:'CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE',
  warning:'This percentage is an uncalibrated model diagnostic, not the portion written by AI. Model agreement does not prove accuracy.'
 };
}
async function perform(data){
 busy=true;cancelled=false;
 try{
  const result=await evaluate(data.text,data.requestId,{
   deep:data.deep===true,full:data.full===true,context:data.context||'general'
  });
  ensureActive();send('RESULT',data.requestId,{result});
 }catch(e){
  const supported=new Set([
   'MIN_WORDS','TEXT_TOO_LONG','UNSUPPORTED_LANGUAGE','INVALID_MODEL_OUTPUT',
   'UNVERIFIED_MODEL_LABEL','MODEL_LOAD_FAILED','INSUFFICIENT_COVERAGE',
   'CANCELLED','BUSY'
  ]);
  send('ERROR',data.requestId,{code:supported.has(e?.message)?e.message:'MODEL_UNAVAILABLE'});
 }finally{
  busy=false;cancelled=false;
  if(nextRequest){
   const pending=nextRequest;nextRequest=null;
   perform(pending);
  }
 }
}
window.addEventListener('message',event=>{
 if(event.source!==window.parent)return;
 const data=event.data;
 if(!data||data.channel!=='TIS_BROWSER_AI_V1')return;
 if(data.op==='INIT'){
  if(parentOrigin||!/^https?:\/\//u.test(event.origin)||
   typeof data.token!=='string'||!/^[a-f0-9]{32}$/u.test(data.token))return;
  parentOrigin=event.origin;frameToken=data.token;
  status('Optional models ready for user-initiated analysis.');
  send('READY','');
  return;
 }
 if(event.origin!==parentOrigin||data.token!==frameToken)return;
 if(data.op==='CANCEL'){
  cancelled=true;
  return;
 }
 if(data.op!=='RUN'||typeof data.requestId!=='string'||data.requestId.length>80
  ||typeof data.text!=='string')return;
 if(busy){
  cancelled=true;
  nextRequest=data;
 }else perform(data);
});
status('Waiting for the secure document-host handshake. No document uploaded.');
