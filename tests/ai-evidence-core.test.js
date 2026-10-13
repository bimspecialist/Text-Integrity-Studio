'use strict';
const assert=require('node:assert/strict');
const core=require('../docs/ai-evidence-core.js');
const english=('We inspected the constructed slab and recorded measurements to compare the design assumptions. ').repeat(30);
const arabic=('قمنا بفحص المبنى وتوثيق الملاحظات الميدانية للتأكد من نتائج الدراسة الفنية. ').repeat(30);
assert.equal(core.eligibility(english).eligible,true);
assert.equal(core.eligibility(arabic).reason,'UNSUPPORTED_LANGUAGE');
assert.equal(core.eligibility('just a sentence').reason,'MIN_WORDS');
assert.equal(core.eligibility(english + (' وهذه فقرة عربية تتضمن شرحًا موسعًا ونتائج ميدانية ومقارنات علمية. ').repeat(12)).reason,'UNSUPPORTED_LANGUAGE');
const fakeTokenizer={encode(text){return Array(Math.round(text.length/6)+2).fill(1);}};
const r=core.partitionWindows(english,fakeTokenizer,{maxTokens:448,maxSamples:12});
assert(r.windowCount>=1);assert(r.coverage>0);
for(const w of r.windows){
 assert(w.tokens<=448,'Real tokenizer maximum length never exceeded');
 assert.equal(w.words,core.wordsWithOffsets(w.text).length);
 assert(english.slice(w.start,w.end)===w.text,'Absolute spans map to the original');
}
const lots=('The electrical engineer inspected the survey and recorded the drainage measurements at the site. ').repeat(1000);
const sampled=core.partitionWindows(lots,fakeTokenizer,{maxTokens:448,maxSamples:9});
assert(sampled.windowCount>9&&sampled.windows.length===9);
assert(sampled.coverage<1 && sampled.coverage>0);
assert(sampled.windows[0].start===0 && sampled.windows.at(-1).end===lots.trimEnd().length);
const extended=core.partitionWindows(lots,fakeTokenizer,{maxTokens:448,maxSamples:core.MAX_WINDOWS_EXTENDED});
assert(extended.windows.length>sampled.windows.length,'Extended scan actually inspects more independent model-token windows');
assert(extended.coverage>sampled.coverage,'Extended mode must materially increase text coverage');
assert(extended.coverage>=.60,'Extended scan covers most of this representative long test document');
assert(extended.windows.every(w=>w.tokens<=448),'Full scan still honors the real tokenizer budget');
assert.equal(extended.method,'REAL_TOKENIZER_FULL_DOCUMENT_NO_TRUNCATION');
assert.equal(core.MIN_DOCUMENT_COVERAGE_PERCENT,60);

const scores=Array(sampled.windows.length).fill(.7);
const p=core.summarizeWindows(sampled.windows,scores,{modelId:'t1',coverage:sampled.coverage});
assert.equal(p.score,70);
assert.equal(p.segments.length,9);
const concordant=core.consensus({...p,coverage:70},{...p,model_id:'t2',score:80,coverage:70});
assert.equal(concordant.status,'AGREEMENT_UNCALIBRATED');assert.equal(concordant.score,70);
assert.equal(concordant.models[1].score,80,'Second model remains independently visible');
assert(concordant.flags.length===0);
const dissent=core.consensus({...p,coverage:70},{...p,model_id:'t2',score:15,coverage:70});
assert.equal(dissent.status,'MODEL_DISAGREEMENT');
assert.equal(dissent.score,null);
assert(dissent.flags.includes('MODELS_DISAGREE'));
const underserved=core.consensus({...p,coverage:24});
assert.equal(underserved.score,null);
assert.equal(underserved.status,'INSUFFICIENT_COVERAGE');
const borderline=core.consensus({...p,coverage:59.9});
assert.equal(borderline.score,null,'A document-wide score is suppressed when 40% of the file was not inspected');
const sufficient=core.consensus({...p,coverage:60});
assert.equal(sufficient.score,70,'Representative coverage alone permits only an explicitly uncalibrated diagnostic');
const formal=core.consensus({...p,coverage:85},null,{context:'second_language'});
assert(formal.flags.includes('FORMAL_OR_NON_NATIVE_FALSE_POSITIVE_RISK'));
const variance=core.summarizeWindows([{start:0,end:70,words:5,tokens:30},{start:71,end:150,words:5,tokens:30}],[.1,.94],{modelId:'t1',coverage:1});
assert.equal(variance.consistency,'MIXED_PASSAGES');
assert(variance.segments[0].tier==='LOWER_MODEL_SIGNAL');
assert(variance.segments[1].tier==='HIGHER_MODEL_SIGNAL');
const mixedReport=core.consensus({...variance,coverage:100});
assert.equal(mixedReport.status,'HETEROGENEOUS_DOCUMENT');
assert.equal(mixedReport.score,null);
assert(mixedReport.flags.includes('DOCUMENT_WIDE_SCORE_NOT_REPRESENTATIVE'));
const variable=core.consensus({...p,coverage:100,dispersion:.31,consistency:'VARIABLE_PASSAGES'});
assert.equal(variable.status,'HETEROGENEOUS_DOCUMENT');
assert.equal(variable.score,null);
const doubleMixed=core.consensus({...p,coverage:100},{
  ...variance,model_id:'other',coverage:100,score:72
});
assert.equal(doubleMixed.status,'HETEROGENEOUS_DOCUMENT');
assert.equal(doubleMixed.score,null);
// Unrounded evidence must govern abstention, not display rounding.
const roundedUp=core.summarizeWindows([{start:0,end:30,words:10,tokens:40}],[.7],{coverage:.5996});
assert.equal(roundedUp.coverage,60);
assert(roundedUp.coverageRawPercent<60);
assert.equal(core.consensus(roundedUp).status,'INSUFFICIENT_COVERAGE');
const fineVariance=core.summarizeWindows([{start:0,end:30,words:5,tokens:40},{start:31,end:60,words:5,tokens:40}],[.2,.7004],{coverage:1});
assert.equal(fineVariance.dispersion,.25);
assert(fineVariance.dispersionRaw>.25);
assert.equal(core.consensus(fineVariance).status,'HETEROGENEOUS_DOCUMENT');
const roundedSecondary=core.consensus({...p,coverage:100},{...roundedUp,model_id:'other',score:70});
assert.equal(roundedSecondary.status,'INSUFFICIENT_COVERAGE');
const massive='a'.repeat(3000)+' '+english;
const long=core.partitionWindows(massive,{encode(text){return Array(Math.ceil(text.length/2)+2).fill(1);}},{
 maxTokens:448,maxSamples:8
});
assert(long.oversizeCount>=1,'Oversize single token cannot be silently truncated');
assert(long.supportedCoverage<1);
for(const w of long.windows)assert(w.tokens<=448);
assert.deepEqual(core.sampleIndices(10,3),[0,5,9]);
console.log('PASS token-aware coverage, document offsets, safe abstention, independent model disagreement, segment variance and Arabic caution');
