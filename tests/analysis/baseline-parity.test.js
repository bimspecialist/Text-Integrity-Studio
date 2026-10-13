'use strict';
// Characterization ONLY: freeze observed V6 detector policy before any refactor.
// These are not performance or model-accuracy claims. Do not adjust thresholds here.
const assert=require('node:assert/strict');
const core=require('../../docs/ai-evidence-core.js');
const englishWord='measured';
const eligibleEnglish=Array(120).fill(englishWord).join(' ');
const shortEnglish=Array(119).fill(englishWord).join(' ');
const formalArabic=Array(121).fill('القياسات').join(' ');
const mixedAcademic=eligibleEnglish+' '+Array(12).fill('النتائج').join(' ');

function policy_is_unchanged(){
 assert.equal(core.MIN_WORDS,120);
 assert.equal(core.MAX_TEXT_CHARS,120000);
 assert.equal(core.MAX_TOKENS,448);
 assert.equal(core.MAX_WINDOWS,12);
 assert.equal(core.MAX_WINDOWS_EXTENDED,96);
 assert.equal(core.MIN_DOCUMENT_COVERAGE_PERCENT,60);
 assert.equal(core.eligibility(eligibleEnglish).eligible,true);
 assert.equal(core.eligibility(shortEnglish).reason,'MIN_WORDS');
 assert.equal(core.eligibility(formalArabic).reason,'UNSUPPORTED_LANGUAGE');
 assert.equal(core.eligibility(mixedAcademic).reason,'UNSUPPORTED_LANGUAGE');
 assert.equal(core.eligibility(eligibleEnglish+' '.repeat(120001)).reason,'TEXT_TOO_LONG');
 assert.equal(core.wordsWithOffsets('a 🙂 b')[1].start,2);
 assert.equal(core.wordsWithOffsets('a 🙂 b')[1].end,4,'source offsets are UTF-16 code units');
}

const actualTokenizer={encode(text){return Array.from({length:Math.ceil(text.length/5)+2},()=>1);}};
function sampler_and_coverage_are_unchanged(){
 const text=Array(450).fill(
  'Every engineer measured the constructed building and reviewed the project schedule at the active site. '
 ).join('');
 const normal=core.partitionWindows(text,actualTokenizer);
 const extended=core.partitionWindows(text,actualTokenizer,{maxSamples:96});
 assert(normal.windowCount>12,'fixture must actually exercise sampling');
 assert.equal(normal.windows.length,12);
 assert.equal(extended.windows.length,Math.min(96,extended.windowCount));
 assert(normal.coverage>0&&normal.coverage<1);
 assert(extended.coverage>=normal.coverage);
 assert(extended.windows.every(w=>w.tokens<=448),'no model-window token overflow');
 assert(normal.windows.every(w=>text.slice(w.start,w.end)===w.text));
 assert.equal(normal.windows.at(0).start,0);
 assert.equal(normal.windows.at(-1).end,text.trimEnd().length);
 assert.equal(normal.sampledCount,normal.windows.length);
 assert.equal(normal.method,'REAL_TOKENIZER_NO_SILENT_TRUNCATION_STRATIFIED_SAMPLE');
 assert.deepEqual(core.sampleIndices(10,3),[0,5,9]);

 const giant='a'.repeat(3000)+' '+eligibleEnglish;
 const large=core.partitionWindows(giant,actualTokenizer,{maxSamples:12});
 assert(large.oversizeCount>=1,'unsupported long single words must be reported');
 assert(large.supportedCoverage<1);
 assert(large.windows.every(w=>w.tokens<=448));
}

function abstention_is_unchanged(){
 const primary={model_id:'primary',score:70,coverage:75,consistency:'CONSISTENT_PASSAGES',dispersion:0.1,segments:[]};
 const valid=core.consensus({...primary,coverage:60});
 assert.equal(valid.status,'SINGLE_UNCALIBRATED_MODEL');
 assert.equal(valid.score,70);
 assert.equal(valid.valid_for_authorship_decisions,false);
 assert.equal(valid.calibration,'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE');

 const insufficient=core.consensus({...primary,coverage:59.9});
 assert.equal(insufficient.status,'INSUFFICIENT_COVERAGE');
 assert.equal(insufficient.score,null);
 assert(insufficient.flags.includes('LOW_DOCUMENT_COVERAGE'));

 const disparate=core.consensus(primary,{...primary,model_id:'historical',score:40});
 assert.equal(disparate.status,'MODEL_DISAGREEMENT');
 assert.equal(disparate.score,null);
 const close=core.consensus(primary,{...primary,model_id:'historical',score:80});
 assert.equal(close.status,'AGREEMENT_UNCALIBRATED');
 assert.equal(close.score,70,'historical model cannot be averaged into primary');
 const academic=core.consensus(primary,null,{context:'academic'});
 assert(academic.flags.includes('FORMAL_OR_NON_NATIVE_FALSE_POSITIVE_RISK'));
 const mixed=core.consensus({...primary,consistency:'MIXED_PASSAGES'});
 assert.equal(mixed.status,'HETEROGENEOUS_DOCUMENT');
 assert.equal(mixed.score,null);
 const justRounded=core.consensus({...primary,coverage:60,coverageRawPercent:59.96});
 assert.equal(justRounded.status,'INSUFFICIENT_COVERAGE',
  'actual sampled coverage, not rounded display coverage, determines abstention');
}

policy_is_unchanged();
sampler_and_coverage_are_unchanged();
abstention_is_unchanged();
console.log('PASS frozen V6: policy, English/Arabic gate, tokenizer windows, exact coverage and no-score abstention');
