/* Text Integrity Studio — pure, fail-closed V2 research evidence contract.
 * Validation cannot certify AI authorship or accuracy. Never copy source text
 * or untrusted model fields into the returned UI projection.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISEvidenceContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PRIMARY_ID='onnx-community/tmr-ai-text-detector-ONNX';
 const PRIMARY_REV='b9aa251e5bcda7e429fcc936767d921435945b60';
 const SECONDARY_ID='onnx-community/roberta-base-openai-detector-ONNX';
 const SECONDARY_REV='54895bd11f34b47a01369d25b2255224717409b8';
 const VERSION='TIS_CONSENSUS_V2_2026_10';
 const CALIBRATION='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE';
 const SIGNAL=new Set(['SINGLE_UNCALIBRATED_MODEL','AGREEMENT_UNCALIBRATED','SECONDARY_UNAVAILABLE']);
 const WITHHELD=new Set(['MODEL_DISAGREEMENT','HETEROGENEOUS_DOCUMENT','INSUFFICIENT_COVERAGE']);
 const fail=code=>Object.freeze({ok:false,code});
 const percent=v=>Number.isFinite(v)&&v>=0&&v<=100;
 function validateModel(model,expectedId,expectedRev,size){
  if(!model||typeof model!=='object')return {code:'MISSING_MODEL'};
  if(model.model_id!==expectedId||model.revision!==expectedRev)return {code:'UNVERIFIED_MODEL_REVISION'};
  if(!percent(model.score)||!percent(model.coverage)||!percent(model.coverageRawPercent))
   return {code:'INVALID_MODEL_SCORE_OR_COVERAGE'};
  if(!Array.isArray(model.segments)||!model.segments.length||model.segments.length>96)
   return {code:'INVALID_WINDOW_COUNT'};
  let previousEnd=-1;
  const segments=[];
  for(const s of model.segments){
   if(!s||!Number.isInteger(s.start)||!Number.isInteger(s.end)||
    s.start<0||s.end<=s.start||s.end>size||s.start<previousEnd||
    !percent(s.signal)||!Number.isInteger(s.words)||s.words<1||
    !Number.isInteger(s.tokens)||s.tokens<1||s.tokens>448)
    return {code:'INVALID_MODEL_WINDOW'};
   segments.push(Object.freeze({
    start:s.start,end:s.end,words:s.words,tokens:s.tokens,signal:s.signal
   }));
   previousEnd=s.end;
  }
  return {model:Object.freeze({
   model_id:model.model_id,revision:model.revision,
   score:model.score,coverage:model.coverage,
   coverageRawPercent:model.coverageRawPercent,
   segments:Object.freeze(segments)
  })};
 }
 function validateEvidence(raw,snapshot,meta){
  if(!snapshot||typeof snapshot.text!=='string'||!Number.isInteger(snapshot.revision)||
   !meta||typeof meta!=='object'||!Number.isInteger(meta.revision)||
   snapshot.revision!==meta.revision)return fail('STALE_DOCUMENT_REVISION');
  if(typeof meta.requestId!=='string'||!meta.requestId||meta.requestId.length>80)
   return fail('INVALID_REQUEST_ID');
  if(raw?.requestId!==undefined&&raw.requestId!==meta.requestId)
   return fail('STALE_REQUEST_ID');
  if(meta.expectedPrimaryId!==PRIMARY_ID||meta.expectedPrimaryRevision!==PRIMARY_REV)
   return fail('UNVERIFIED_EXPECTED_PRIMARY');
  if(!raw||typeof raw!=='object'||raw.version!==VERSION||
   raw.calibration!==CALIBRATION||
   raw.score_type!=='UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY'||
   raw.processing!=='CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE'||
   raw.valid_for_authorship_decisions!==false)return fail('UNSUPPORTED_EVIDENCE_SCHEMA');
  if(raw.language!=='en')return fail('UNSUPPORTED_MODEL_LANGUAGE');
  const options=meta.scanOptions||{};
  const deep=options.deep===true,full=options.full===true;
  if(raw.deepRequested!==deep||raw.extendedScanRequested!==full)
   return fail('SCAN_OPTIONS_MISMATCH');
  if(!SIGNAL.has(raw.status)&&!WITHHELD.has(raw.status))
   return fail('UNKNOWN_CONSENSUS_STATE');
  if(raw.secondary&&!deep)return fail('UNREQUESTED_SECONDARY_MODEL');
  const p=validateModel(raw.primary,PRIMARY_ID,PRIMARY_REV,snapshot.text.length);
  if(p.code)return fail(p.code);
  let secondary=null;
  if(raw.secondary){
   if(meta.expectedSecondaryId!==SECONDARY_ID||
    meta.expectedSecondaryRevision!==SECONDARY_REV)
    return fail('UNVERIFIED_EXPECTED_SECONDARY');
   const s=validateModel(raw.secondary,SECONDARY_ID,SECONDARY_REV,snapshot.text.length);
   if(s.code)return fail(s.code);
   secondary=s.model;
  }
  if(raw.status==='AGREEMENT_UNCALIBRATED'&&!secondary||
   raw.status==='MODEL_DISAGREEMENT'&&!secondary||
   raw.status==='SINGLE_UNCALIBRATED_MODEL'&&secondary||
   raw.status==='SECONDARY_UNAVAILABLE'&&(!deep||secondary))
   return fail('CONFLICTING_MODEL_CONSENSUS');
  if(deep&&!secondary&&SIGNAL.has(raw.status)&&raw.status!=='SECONDARY_UNAVAILABLE')
   return fail('UNREQUESTED_SINGLE_MODEL_CONCLUSION');
  const scored=SIGNAL.has(raw.status);
  if(scored){
   if(!percent(raw.score)||Math.abs(raw.score-p.model.score)>0.051)
    return fail('INVALID_COMBINED_MODEL_SIGNAL');
   if(p.model.coverageRawPercent<60||(secondary&&secondary.coverageRawPercent<60))
    return fail('INSUFFICIENT_SAMPLED_COVERAGE');
  }else if(raw.score!==null)return fail('CONFLICTING_SCORE_STATUS');
  if(p.model.coverageRawPercent<60&&raw.status!=='INSUFFICIENT_COVERAGE')
   return fail('INSUFFICIENT_SAMPLED_COVERAGE');
  if(secondary&&secondary.coverageRawPercent<60&&raw.status!=='INSUFFICIENT_COVERAGE')
   return fail('INSUFFICIENT_SAMPLED_COVERAGE');
  const scanOptions=Object.freeze({
   deep,full,context:typeof options.context==='string'&&options.context?options.context:'general'
  });
  return Object.freeze({ok:true,outcome:Object.freeze({
   kind:scored?'RESEARCH_SIGNAL':'INCONCLUSIVE',
   signal:scored?raw.score:null,
   reason:scored?null:raw.status,
   calibration:CALIBRATION,
   primary:p.model,
   secondary,
   segments:p.model.segments,
   documentCoverageWordsPercent:p.model.coverageRawPercent,
   scanOptions,
   requestId:meta.requestId,
   revision:snapshot.revision
  })});
 }
 return Object.freeze({validateEvidence,PRIMARY_ID,PRIMARY_REV,SECONDARY_ID,SECONDARY_REV});
});
