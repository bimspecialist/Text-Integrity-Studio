'use strict';
const assert=require('node:assert/strict');
const {createDocumentSession}=require('../../docs/analysis/document-session.js');
// RED R4: validate genuine V2 evidence against the exact immutable source snapshot.
const {validateEvidence}=require('../../docs/analysis/evidence-contract.js');
const PRIMARY='onnx-community/tmr-ai-text-detector-ONNX';
const PRIMARY_REV='b9aa251e5bcda7e429fcc936767d921435945b60';
const SECONDARY='onnx-community/roberta-base-openai-detector-ONNX';
const SECONDARY_REV='54895bd11f34b47a01369d25b2255224717409b8';
const snapshot=createDocumentSession(Array(135).fill('measured').join(' ')).read();
function makePrimary(){
 return {
  model_id:PRIMARY,revision:PRIMARY_REV,score:64.2,coverage:100,coverageRawPercent:100,
  words:135,wordsAnalyzed:135,consistency:'CONSISTENT_PASSAGES',dispersion:0.02,
  segments:[{start:0,end:snapshot.text.length,words:135,tokens:250,signal:64.2}]
 };
}
function makeRaw(){
 const primary=makePrimary();
 return {
  version:'TIS_CONSENSUS_V2_2026_10',
  score_type:'UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY',
  processing:'CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE',
  status:'SINGLE_UNCALIBRATED_MODEL',score:64.2,
  calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
  valid_for_authorship_decisions:false,
  primary,secondary:null,models:[primary],flags:[],
  deepRequested:false,extendedScanRequested:false,
  words:135,language:'en'
 };
}
function makeMeta(){
 return {requestId:'scan-1',revision:snapshot.revision,
  expectedPrimaryId:PRIMARY,expectedPrimaryRevision:PRIMARY_REV,
  scanOptions:{deep:false,full:false,context:'general'}};
}
function expectRejected(raw,meta=makeMeta(),document=snapshot){
 const res=validateEvidence(raw,document,meta);
 assert.equal(res.ok,false,'must fail closed: '+JSON.stringify(res));
 assert.equal(typeof res.code,'string');
 assert(res.code.length>0);
 return res.code;
}

(function test_valid_primary_and_optional_legacy(){
 const valid=validateEvidence(makeRaw(),snapshot,makeMeta());
 assert.equal(valid.ok,true);
 assert.equal(valid.outcome.kind,'RESEARCH_SIGNAL');
 assert.equal(valid.outcome.signal,64.2);
 assert.equal(valid.outcome.reason,null);
 assert.equal(valid.outcome.documentCoverageWordsPercent,100);
 assert.equal(valid.outcome.revision,snapshot.revision);
 assert.equal(valid.outcome.requestId,'scan-1');
 assert.equal(valid.outcome.calibration,'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE');
 assert.equal(valid.outcome.segments.length,1);
 assert.equal(valid.outcome.segments[0].end,snapshot.text.length);
 assert.equal(JSON.stringify(valid).includes(snapshot.text),false,'Never echo user source text');
 const both=makeRaw();
 both.secondary={...makePrimary(),model_id:SECONDARY,revision:SECONDARY_REV,score:76};
 both.models=[both.primary,both.secondary];
 both.status='AGREEMENT_UNCALIBRATED';both.deepRequested=true;
 const m={...makeMeta(),expectedSecondaryId:SECONDARY,expectedSecondaryRevision:SECONDARY_REV,
  scanOptions:{deep:true,full:false,context:'academic'}};
 const res=validateEvidence(both,snapshot,m);
 assert.equal(res.ok,true);
 assert.equal(res.outcome.primary.revision,PRIMARY_REV);
 assert.equal(res.outcome.secondary.revision,SECONDARY_REV);
 assert.deepEqual(res.outcome.scanOptions,m.scanOptions);
})();

(function test_invalid_evidence_fail_closed(){
 for(const score of [-1,101,NaN,Infinity,null,'64.2']){
  const raw=makeRaw();raw.score=score;
  expectRejected(raw);
 }
 for(const score of [NaN,-1,101]){
  const raw=makeRaw();raw.primary.score=score;
  expectRejected(raw);
 }
 const raw=makeRaw();raw.primary.segments[0].signal=Infinity;expectRejected(raw);
})();

(function test_bad_segment_offset(){
 const negative=makeRaw();negative.primary.segments[0].start=-1;expectRejected(negative);
 const over=makeRaw();over.primary.segments[0].end=snapshot.text.length+1;expectRejected(over);
 const zero=makeRaw();zero.primary.segments[0].end=0;expectRejected(zero);
 const overlap=makeRaw();
 overlap.primary.segments.push({start:1,end:50,words:5,tokens:15,signal:71});
 expectRejected(overlap);
})();

(function test_unknown_model_revision(){
 const unknown=makeRaw();unknown.primary.revision='not-the-pinned-model';expectRejected(unknown);
 const missing=makeRaw();delete missing.primary.revision;expectRejected(missing);
 const other=makeRaw();other.primary.model_id='untrusted-detector';expectRejected(other);
})();

(function test_conflicting_score_status_and_coverage(){
 const conflicting=makeRaw();conflicting.status='MODEL_DISAGREEMENT';expectRejected(conflicting);
 const nonfinite=makeRaw();nonfinite.score=null;expectRejected(nonfinite);
 const below=makeRaw();below.primary.coverageRawPercent=59.9;below.primary.coverage=59.9;
 expectRejected(below);
 const disagreement=makeRaw();disagreement.status='MODEL_DISAGREEMENT';disagreement.score=null;
 const abstained=validateEvidence(disagreement,snapshot,makeMeta());
 assert.equal(abstained.ok,true);
 assert.equal(abstained.outcome.kind,'INCONCLUSIVE');
 assert.equal(abstained.outcome.signal,null);
 assert.equal(abstained.outcome.reason,'MODEL_DISAGREEMENT');
 const notCovered=makeRaw();notCovered.status='INSUFFICIENT_COVERAGE';notCovered.score=null;
 notCovered.primary.coverage=59.9;notCovered.primary.coverageRawPercent=59.9;
 assert.equal(validateEvidence(notCovered,snapshot,makeMeta()).outcome.kind,'INCONCLUSIVE');
})();

(function test_revision_request_and_context_mismatch(){
 expectRejected(makeRaw(),{...makeMeta(),revision:snapshot.revision+1});
 const late=makeRaw();late.requestId='older-scan';expectRejected(late);
 const wrongOpt=makeRaw();wrongOpt.extendedScanRequested=true;expectRejected(wrongOpt);
 const deep=makeRaw();deep.deepRequested=true;expectRejected(deep);
 const forged=makeRaw();forged.valid_for_authorship_decisions=true;expectRejected(forged);
 const wrongVer=makeRaw();wrongVer.version='future-schema';expectRejected(wrongVer);
 const wrongCal=makeRaw();wrongCal.calibration='CERTIFIED_99_PERCENT';expectRejected(wrongCal);
})();

console.log('PASS R4 strict model revision and source span validation, no-score abstention and no private text export');
