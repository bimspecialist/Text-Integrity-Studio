'use strict';
const assert=require('node:assert/strict');
const {compareSignals}=require('../../docs/analysis/scan-comparison.js');
const PRIMARY='onnx-community/tmr-ai-text-detector-ONNX',REV='b9aa251e5bcda7e429fcc936767d921435945b60';
const SECONDARY='onnx-community/roberta-base-openai-detector-ONNX',SREV='54895bd11f34b47a01369d25b2255224717409b8';
function summary(score=70,{coverage=95,deep=false,context='academic',full=false}={}){
 return {
  kind:'RESEARCH_SIGNAL',signal:score,calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
  documentCoverageWordsPercent:coverage,
  primary:{model_id:PRIMARY,revision:REV},
  secondary:deep?{model_id:SECONDARY,revision:SREV}:null,
  scanOptions:{deep,full,context}
 };
}
(function comparable_same_checkpoint_and_coverage(){
 const a=summary(70),b=summary(64.2,{coverage:92});
 const comparison=compareSignals(a,b);
 assert.equal(comparison.comparable,true);
 assert.equal(comparison.reason,'NONE');
 assert.equal(comparison.differencePoints,-5.8);
 assert(!Object.hasOwn(comparison,'text'));
 assert(!Object.hasOwn(comparison,'authorshipProbability'));
 assert(Object.isFrozen(comparison));
})();
(function rejects_uncalibrated_inconclusive_as_score(){
 for(const invalid of [null,undefined,
  {...summary(null),kind:'INCONCLUSIVE'},
  {...summary(75),calibration:'CALIBRATED_AUTHORSHIP'},
  {...summary(NaN)},
  {...summary(40),signal:101}]){
  const c=compareSignals(summary(80),invalid);
  assert.equal(c.comparable,false);
  assert.equal(c.reason,'NO_VALID_SCORE');
  assert.equal(c.differencePoints,null);
 }
})();
(function rejects_different_checkpoint_or_model(){
 const before=summary(45,{deep:true});
 for(const modified of [
  {...summary(44,{deep:true}),primary:{model_id:PRIMARY,revision:'unknown'}},
  {...summary(44,{deep:true}),primary:{model_id:'made-up-model',revision:REV}},
  {...summary(44,{deep:true}),secondary:{model_id:SECONDARY,revision:'other'}},
  {...summary(44,{deep:true}),secondary:null}
 ]){
  assert.equal(compareSignals(before,modified).reason,'DIFFERENT_MODEL');
 }
})();
(function rejects_deep_full_modes_and_context_changes(){
 assert.equal(compareSignals(summary(51),summary(50,{deep:true})).reason,'DIFFERENT_OPTIONS');
 assert.equal(compareSignals(summary(51),summary(50,{full:true})).reason,'DIFFERENT_OPTIONS');
 assert.equal(compareSignals(summary(51),summary(50,{context:'second_language'})).reason,'DIFFERENT_CONTEXT');
})();
(function rejects_different_or_unmeasured_word_coverage(){
 assert.equal(compareSignals(summary(60,{coverage:95}),summary(55,{coverage:88})).reason,'DIFFERENT_COVERAGE');
 assert.equal(compareSignals(summary(60,{coverage:59}),summary(55,{coverage:62})).reason,'DIFFERENT_COVERAGE');
 assert.equal(compareSignals(summary(60,{coverage:95}),summary(55,{coverage:NaN})).reason,'DIFFERENT_COVERAGE');
 assert.equal(compareSignals(summary(60,{coverage:95}),summary(55,{coverage:100})).comparable,true);
})();
(function deep_mode_consistency_without_authorship_claim(){
 const result=compareSignals(summary(61,{deep:true}),summary(69,{deep:true}));
 assert.deepEqual(result,{comparable:true,reason:'NONE',differencePoints:8});
})();
console.log('PASS H4: same pinned model/options/coverage, no fabricated authorship percentage or incomparable delta');
