'use strict';
const assert=require('node:assert/strict');
const core=require('../../docs/ai-evidence-core.js');
// RED (R3): one rule should back eligibility warnings in the parent page and iframe.
const {assess}=require('../../docs/analysis/eligibility-policy.js');
const english=Array(120).fill('measured').join(' ');
const short=Array(119).fill('measured').join(' ');
const arabic=Array(120).fill('المبنى').join(' ');
const mixed=english+' '+Array(12).fill('النتائج').join(' ');

(function test_policy_decision_parity(){
 for(const sample of [english,short,arabic,mixed,english+' '.repeat(120001),'123 '.repeat(120)]){
  const coreDecision=core.eligibility(sample);
  const policyDecision=assess(sample);
  assert.equal(policyDecision.eligible,coreDecision.eligible,'accept/reject parity against runtime');
  assert.equal(policyDecision.reason,coreDecision.reason||'NONE','no policy split between model and UI');
  assert.equal(policyDecision.words,coreDecision.words);
  assert.equal(policyDecision.characters,sample.length);
 }
})();

(function test_empty_input_and_word_counts(){
 const missing=assess('');
 assert.equal(missing.eligible,false);
 assert.equal(missing.reason,'NO_TEXT','empty editor requires a meaningful warning');
 assert.equal(missing.words,0);
 assert.equal(missing.languageClass,'unknown');
 assert.equal(missing.policyVersion,'TIS_ELIGIBILITY_V2');
 assert.equal(assess(' \n\t ').reason,'NO_TEXT');
 assert.equal(assess(short).reason,'MIN_WORDS');
 assert.equal(assess(english).eligible,true);
 assert.equal(assess(english).reason,'NONE');
 assert.equal(assess(english).languageClass,'en');
})();

(function test_arabic_mixed_and_unsupported(){
 assert.equal(assess(arabic).reason,'UNSUPPORTED_LANGUAGE');
 assert.equal(assess(arabic).languageClass,'ar');
 assert.equal(assess(mixed).reason,'UNSUPPORTED_LANGUAGE');
 assert.equal(assess(mixed).languageClass,'mixed');
 // Preserve the actual V6 core precedence, not duplicated, contradictory UI limits.
 assert.equal(assess('نص عربي قصير').reason,core.eligibility('نص عربي قصير').reason);
 assert.equal(assess('A', 'unsupported').reason,'UNSUPPORTED_FORMAT');
 assert.equal(assess(english,'docx').eligible,true);
 assert.equal(assess(english,'pdf').eligible,true);
 assert.equal(assess(english,'ocr').eligible,true);
 assert.equal(assess(english,'txt').eligible,true);
 assert.throws(()=>assess(null),TypeError);
})();

console.log('PASS single detector eligibility policy mirrors runtime and preserves local writing support');
