/* Text Integrity Studio — evidence processing core, no network and no UI.
 * Contract V2: token-aware windows, honest model agreement, measured input
 * coverage and segment consistency. Never claims an authorship probability.
 */
(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 if(root)root.TISEvidenceCore=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MIN_WORDS=120,MAX_TEXT_CHARS=120000,MAX_TOKENS=448,MAX_WINDOWS=12,MAX_WINDOWS_EXTENDED=96;
// A whole-document number is withheld when less than 60% was actually sampled.
// This is a transparent *sampling coverage guard*, not a validated AI threshold.
const MIN_DOCUMENT_COVERAGE_PERCENT=60;
function round(value,decimals=1){const k=10**decimals;return Math.round(value*k)/k;}
function wordsWithOffsets(text){
 if(typeof text!=='string')throw TypeError('Expected document text.');
 const words=[];
 for(const m of text.matchAll(/\S+/gu)) words.push({start:m.index,end:m.index+m[0].length});
 return words;
}
function validateLanguage(text){
 const ar=(text.match(/\p{Script=Arabic}/gu)||[]).length;
 const latin=(text.match(/[A-Za-z]/g)||[]).length;
 const nonlatin=(text.match(/\p{L}/gu)||[]).length-latin-ar;
 // 5%+ Arabic and major non-Latin scripts are unsupported in English detectors.
 if(latin<80 || ar>Math.max(3,latin*.02) || nonlatin>Math.max(10,latin*.10))return false;
 return true;
}
function eligibility(text){
 const words=wordsWithOffsets(text);
 if(text.length>MAX_TEXT_CHARS)return {eligible:false,reason:'TEXT_TOO_LONG',words:words.length};
 if(words.length<MIN_WORDS)return {eligible:false,reason:'MIN_WORDS',words:words.length};
 if(!validateLanguage(text))return {eligible:false,reason:'UNSUPPORTED_LANGUAGE',words:words.length};
 return {eligible:true,words:words.length,language:'en'};
}
function sampleIndices(total,count){
 if(!Number.isInteger(total)||total<0)throw RangeError('Invalid windows');
 if(total<=count)return Array.from({length:total},(_x,i)=>i);
 if(count<=1)return [Math.floor((total-1)/2)];
 const out=[];
 for(let i=0;i<count;i++)out.push(Math.round(i*(total-1)/(count-1)));
 return out;
}
function tokenLength(tokenizer,text){
 if(!tokenizer||typeof tokenizer.encode!=='function')throw TypeError('Real model tokenizer is required');
 const tokens=tokenizer.encode(text,{add_special_tokens:true});
 if(!Array.isArray(tokens)&&!ArrayBuffer.isView(tokens))throw TypeError('Tokenizer returned no token IDs');
 if(!Number.isInteger(tokens.length)||tokens.length<=0)throw TypeError('Invalid token count');
 return tokens.length;
}
function partitionWindows(text,tokenizer,opts={}){
 const maxTokens=Math.min(MAX_TOKENS,Math.max(128,Number(opts.maxTokens)||MAX_TOKENS));
 const maxSamples=Math.min(MAX_WINDOWS_EXTENDED,Math.max(1,Math.floor(Number(opts.maxSamples)||MAX_WINDOWS)));
 const spans=wordsWithOffsets(text);
 const all=[],oversize=[];
 let cursor=0;
 while(cursor<spans.length){
  // Start conservatively to avoid repeatedly trying to encode full 512+ tokens.
  let end=Math.min(spans.length,cursor+185);
  const size=(right)=>tokenLength(tokenizer,text.slice(spans[cursor].start,spans[right-1].end));
  let count=size(end);
  while(count>maxTokens&&end>cursor+1){
   const excess=end-cursor;
   const next=Math.max(cursor+1,cursor+Math.max(1,Math.floor(excess*.78)));
   if(next===end)throw Error('Window split made no progress');
   end=next;
   count=size(end);
  }
  if(count>maxTokens){
   oversize.push({start:spans[cursor].start,end:spans[cursor].end});
   cursor++;
   continue;
  }
  // Fill spare tokens while preserving a strict 448-token model cap.
  while(end<spans.length && end-cursor<225 && count<maxTokens-24){
   const step=Math.min(20,225-(end-cursor),spans.length-end);
   const candidate=end+step;
   const candidateCount=size(candidate);
   if(candidateCount>maxTokens){
    if(step<=1)break;
    const binaryEnd=(()=>{let lo=end,hi=candidate;while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(size(mid)<=maxTokens)lo=mid;else hi=mid;}return lo;})();
    if(binaryEnd>end){end=binaryEnd;count=size(end);}
    break;
   }
   end=candidate;count=candidateCount;
  }
  const start=spans[cursor].start,finish=spans[end-1].end;
  all.push({start,end:finish,words:end-cursor,tokens:count});
  cursor=end;
 }
 const indices=sampleIndices(all.length,maxSamples);
 const windows=indices.map((i)=>({...all[i],text:text.slice(all[i].start,all[i].end)}));
 const sampledWords=windows.reduce((sum,c)=>sum+c.words,0);
 const completeWords=all.reduce((sum,c)=>sum+c.words,0);
 return {
  windows,totalWords:spans.length,windowCount:all.length,
  sampledCount:windows.length,coverage:spans.length?sampledWords/spans.length:0,
  supportedCoverage:spans.length?completeWords/spans.length:0,
  oversizeCount:oversize.length,
  maxTokens,method:indices.length===all.length?
   'REAL_TOKENIZER_FULL_DOCUMENT_NO_TRUNCATION':
   'REAL_TOKENIZER_NO_SILENT_TRUNCATION_STRATIFIED_SAMPLE'
 };
}
function summarizeWindows(windows,values,options={}){
 if(windows.length!==values.length||!windows.length)throw Error('Missing or mismatched model window outputs');
 if(values.some(v=>!Number.isFinite(v)||v<0||v>1))throw TypeError('Non-finite/invalid model score');
 const total=windows.reduce((sum,w)=>sum+w.words,0);
 const weighted=values.reduce((sum,v,i)=>sum+v*windows[i].words,0)/total;
 const spread=Math.sqrt(values.reduce((sum,v,i)=>sum+windows[i].words*(v-weighted)**2,0)/total);
 const range=[Math.min(...values),Math.max(...values)];
 const mixed=values.length>1&&range[0]<.25&&range[1]>.75;
 const windowReports=windows.map((w,i)=>({
  start:w.start,end:w.end,words:w.words,tokens:w.tokens,
  signal:round(values[i]*100,1),
  tier:values[i]>=.8?'HIGHER_MODEL_SIGNAL':values[i]<=.2?'LOWER_MODEL_SIGNAL':'UNCERTAIN_MODEL_SIGNAL'
 }));
 return {
  model_id:options.modelId||'',score:round(weighted*100,1),
  consistency:mixed?'MIXED_PASSAGES':spread>.22?'VARIABLE_PASSAGES':'CONSISTENT_PASSAGES',
  dispersion:round(spread,3),
  range_percent:[round(range[0]*100,1),round(range[1]*100,1)],
  wordsAnalyzed:total,sampleCount:windows.length,
  coverage:round((options.coverage??1)*100,1),
  segments:windowReports
 };
}
function consensus(primary,secondary=null,options={}){
 if(!primary||!Number.isFinite(primary.score))throw new TypeError('Primary model output required');
 const flags=[];
 if(primary.coverage<MIN_DOCUMENT_COVERAGE_PERCENT)flags.push('LOW_DOCUMENT_COVERAGE');
 if(primary.consistency==='MIXED_PASSAGES')flags.push('CONFLICTING_PASSAGES');
 if(primary.dispersion>.25)flags.push('HIGH_SEGMENT_VARIANCE');
 const context=options.context||'general';
 if(['academic','second_language','formal'].includes(context))flags.push('FORMAL_OR_NON_NATIVE_FALSE_POSITIVE_RISK');
 let score=primary.score,status='SINGLE_UNCALIBRATED_MODEL',agreement=null;
 if(secondary){
  if(!Number.isFinite(secondary.score))throw new TypeError('Secondary model missing valid output');
  const difference=Math.abs(primary.score-secondary.score);
  agreement=round(difference,1);
  if(difference>25){
   score=null;
   status='MODEL_DISAGREEMENT';
   flags.push('MODELS_DISAGREE');
  }else{
   status='AGREEMENT_UNCALIBRATED';
   // Do NOT average independently uncalibrated models from different
   // generator eras: their scores do not share a justified probability scale.
   // Keep the primary as an explicitly uncalibrated signal and display
   // the secondary separately for disagreement evidence.
   score=round(primary.score,1);
  }
  if(secondary.coverage<MIN_DOCUMENT_COVERAGE_PERCENT)flags.push('SECONDARY_LOW_COVERAGE');
  if(secondary.consistency==='MIXED_PASSAGES')flags.push('SECONDARY_MIXED_PASSAGES');
 }
 if(primary.coverage<MIN_DOCUMENT_COVERAGE_PERCENT||
    (secondary&&secondary.coverage<MIN_DOCUMENT_COVERAGE_PERCENT)){
  // No overall percentage when most of the document went unobserved.
  score=null;status='INSUFFICIENT_COVERAGE';
 }else if(primary.consistency==='MIXED_PASSAGES'||
          primary.dispersion>.25||
          (secondary&&(secondary.consistency==='MIXED_PASSAGES'||secondary.dispersion>.25))){
  // Averages erase genuine disagreement between passages. Show the underlying
  // window scores, but do not misrepresent a mixed document with one number.
  score=null;status='HETEROGENEOUS_DOCUMENT';
  flags.push('DOCUMENT_WIDE_SCORE_NOT_REPRESENTATIVE');
 }
 return {
  status,score,agreementDifferencePoints:agreement,
  calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
  flags,models:[primary,...(secondary?[secondary]:[])],
  valid_for_authorship_decisions:false,
  note:'Scores are uncalibrated classifier signals, not the percentage of AI-written words.'
 };
}
return {MIN_WORDS,MAX_TEXT_CHARS,MAX_TOKENS,MAX_WINDOWS,MAX_WINDOWS_EXTENDED,
 MIN_DOCUMENT_COVERAGE_PERCENT,wordsWithOffsets,
 eligibility,validateLanguage,partitionWindows,summarizeWindows,consensus,sampleIndices};
});
