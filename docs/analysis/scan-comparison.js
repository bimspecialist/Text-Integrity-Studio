/* Text Integrity Studio — metadata-only comparison of two verified ONNX
 * research signals. These numbers are not a measure of human authorship.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISScanComparison=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const primaryId='onnx-community/tmr-ai-text-detector-ONNX';
 const primaryRev='b9aa251e5bcda7e429fcc936767d921435945b60';
 const secondaryId='onnx-community/roberta-base-openai-detector-ONNX';
 const secondaryRev='54895bd11f34b47a01369d25b2255224717409b8';
 const calibration='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE';
 const fail=reason=>Object.freeze({comparable:false,reason,differencePoints:null});
 const percent=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
 function validEvidence(s){
  return s&&s.kind==='RESEARCH_SIGNAL'&&percent(s.signal)&&s.calibration===calibration&&
   s.primary?.model_id===primaryId&&s.primary?.revision===primaryRev&&
   s.scanOptions&&typeof s.scanOptions.deep==='boolean'&&
   typeof s.scanOptions.full==='boolean'&&typeof s.scanOptions.context==='string'&&
   (s.scanOptions.deep?s.secondary?.model_id===secondaryId&&s.secondary?.revision===secondaryRev:
    s.secondary==null);
 }
 function compareSignals(before,after){
  // Invalid or unsupported outcomes are always withheld before any math.
  if(!before||!after||before.kind!=='RESEARCH_SIGNAL'||after.kind!=='RESEARCH_SIGNAL'||
   !percent(before.signal)||!percent(after.signal)||
   before.calibration!==calibration||after.calibration!==calibration)
   return fail('NO_VALID_SCORE');
  const a=before.scanOptions,b=after.scanOptions;
  if(!a||!b||a.deep!==b.deep||a.full!==b.full)return fail('DIFFERENT_OPTIONS');
  if(a.context!==b.context)return fail('DIFFERENT_CONTEXT');
  if(!validEvidence(before)||!validEvidence(after)||
   before.primary.model_id!==after.primary.model_id||
   before.primary.revision!==after.primary.revision||
   Boolean(before.secondary)!==Boolean(after.secondary)||
   before.secondary&&(
    before.secondary.model_id!==after.secondary?.model_id||
    before.secondary.revision!==after.secondary?.revision))
   return fail('DIFFERENT_MODEL');
  const c=before.documentCoverageWordsPercent,d=after.documentCoverageWordsPercent;
  if(!percent(c)||!percent(d)||c<60||d<60||Math.abs(c-d)>5)
   return fail('DIFFERENT_COVERAGE');
  return Object.freeze({
   comparable:true,reason:'NONE',
   differencePoints:Math.round((after.signal-before.signal)*10)/10
  });
 }
 return Object.freeze({compareSignals});
});
