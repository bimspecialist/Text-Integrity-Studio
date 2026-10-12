/* Optional browser-only RoBERTa model runner.
 * INVARIANT: no fetch or upload of the user's text. External requests performed
 * by Transformers.js fetch executable runtime assets and pretrained weights.
 * Scores are RESEARCH classifier outputs, NOT validated authorship probabilities.
 *
 * Model: onnx-community/tmr-ai-text-detector-ONNX (MIT)
 * Basis: Oxidane/tmr-ai-text-detector, RAID-trained; label index 1 means AI.
 * Transformers.js pinned to 3.8.1; q8 ONNX model is around 126 MiB.
 * Never show a percentage for Arabic/mixed or fewer than 120 words.
 */
'use strict';

const MODEL_ID='onnx-community/tmr-ai-text-detector-ONNX';
const LIBRARY_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MIN_WORDS=120, MAX_TEXT_CHARS=120000, MAX_CHUNKS=8;
let classifierPromise=null;
let busy=false;

function status(message){
 const node=document.getElementById('engine-status');
 if(node)node.textContent=message;
}
function send(op,requestId,details={}){
 if(!window.parent || window.parent===window)return;
 window.parent.postMessage({channel:'TIS_BROWSER_AI_V1',op,requestId,...details},location.origin);
}
function selectChunks(text){
 const words=text.match(/\S+/gu)||[];
 if(words.length<MIN_WORDS)throw new Error('MIN_WORDS');
 if(text.length>MAX_TEXT_CHARS)throw new Error('TEXT_TOO_LONG');
 const ar=(text.match(/\p{Script=Arabic}/gu)||[]).length;
 const latin=(text.match(/[A-Za-z]/g)||[]).length;
 if(latin<Math.max(80,ar*18))throw new Error('UNSUPPORTED_LANGUAGE');
 const chunks=[];
 for(let i=0;i<words.length;i+=230){
  const chunk=words.slice(i,i+230);
  if(chunk.length>=70)chunks.push(chunk.join(' '));
 }
 if(!chunks.length)throw new Error('MIN_WORDS');
 if(chunks.length<=MAX_CHUNKS)return {chunks,words:words.length};
 const selected=[];
 for(let j=0;j<MAX_CHUNKS;j++){
  const index=Math.round(j*(chunks.length-1)/(MAX_CHUNKS-1));
  selected.push(chunks[index]);
 }
 return {chunks:selected,words:words.length};
}
function aiSignalFromOutput(outputs){
 const item=Array.isArray(outputs)?outputs[0]:outputs;
 if(!item || !Number.isFinite(Number(item.score)))throw new Error('INVALID_MODEL_OUTPUT');
 const label=String(item.label||'').toUpperCase().replace(/\s+/g,'_');
 const positive=new Set(['LABEL_1','AI','AI_GENERATED','AI-GENERATED','FAKE','1']);
 const negative=new Set(['LABEL_0','HUMAN','HUMAN_WRITTEN','HUMAN-WRITTEN','REAL','0']);
 if(!positive.has(label)&&!negative.has(label))throw new Error('UNVERIFIED_MODEL_LABEL');
 const raw=Math.max(0,Math.min(1,Number(item.score)));
 return positive.has(label)?raw:1-raw;
}
async function getClassifier(requestId){
 if(!classifierPromise){
  classifierPromise=(async()=>{
   status('Downloading an English-only AI classifier to your browser...');
   send('PROGRESS',requestId,{stage:'LOADING',percent:null});
   const {pipeline}=await import(LIBRARY_URL);
   const worker=await pipeline('text-classification',MODEL_ID,{
    dtype:'q8',
    progress_callback:p=>{
     if(p?.status==='progress'&&Number.isFinite(p.progress)){
      send('PROGRESS',requestId,{stage:'DOWNLOADING',percent:Math.round(Math.min(100,Math.max(0,p.progress)))});
     }
    }
   });
   if(typeof worker!=='function')throw new Error('MODEL_LOAD_FAILED');
   return worker;
  })().catch(err=>{classifierPromise=null;throw err;});
 }
 return classifierPromise;
}
async function evaluate(text,requestId){
 const eligible=selectChunks(text);
 const classifier=await getClassifier(requestId);
 let values=[];
 for(let i=0;i<eligible.chunks.length;i++){
  send('PROGRESS',requestId,{stage:'ANALYZING',percent:Math.round(i/eligible.chunks.length*100)});
  const response=await classifier(eligible.chunks[i],{truncation:true});
  values.push(aiSignalFromOutput(response));
 }
 const avg=values.reduce((a,b)=>a+b,0)/values.length;
 const spread=Math.sqrt(values.reduce((a,b)=>a+(b-avg)**2,0)/values.length);
 return {
  score:Math.round(avg*1000)/10,
  sampleCount:values.length,
  words:eligible.words,
  dispersion:Math.round(spread*1000)/1000,
  language:'en',confidence:'UNVALIDATED',
  model_id:MODEL_ID,model_kind:'QUANTIZED_ROBERTA_BROWSER',
  calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
  warning:'Experimental model signal only. Not a share of AI-written words and not proof of authorship.'
 };
}
window.addEventListener('message',async event=>{
 if(event.source!==window.parent||event.origin!==location.origin)return;
 const data=event.data;
 if(!data || data.channel!=='TIS_BROWSER_AI_V1' || data.op!=='RUN'
  || typeof data.requestId!=='string' || data.requestId.length>80
  || typeof data.text!=='string')return;
 if(busy){send('ERROR',data.requestId,{code:'BUSY'});return;}
 busy=true;
 try{
  const result=await evaluate(data.text,data.requestId);
  send('RESULT',data.requestId,{result});
 }catch(e){
  // Fail closed and do not expose user content or raw model URLs in errors.
  const supported=new Set([
   'MIN_WORDS','TEXT_TOO_LONG','UNSUPPORTED_LANGUAGE','INVALID_MODEL_OUTPUT',
   'UNVERIFIED_MODEL_LABEL','MODEL_LOAD_FAILED','BUSY'
  ]);
  const code=supported.has(e?.message)?e.message:'MODEL_UNAVAILABLE';
  send('ERROR',data.requestId,{code});
 }finally{busy=false;}
});
status('Browser model engine ready. No text was submitted.');
send('READY','');
