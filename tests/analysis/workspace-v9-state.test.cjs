'use strict';
/* V9 state copy is a pure interpretation of the existing controller status. */
const assert=require('node:assert/strict');
const {describeStatus}=require('../../docs/analysis/workspace-v9.js');
for(const locale of ['en','ar']) {
 for(const kind of ['EMPTY','READY','LOADING','ANALYZING','WRITING_ONLY','UNSUPPORTED','RESEARCH_SIGNAL','INCONCLUSIVE','STALE','ERROR','CANCELLED']) {
  const result=describeStatus(kind,locale);
  assert.equal(typeof result,'string');
  assert(result.length>8,kind+' must have a meaningful message');
  assert(!/\b(?:100% human|AI-written percentage|نسبة الكتابة بالذكاء الاصطناعي 100)\b/i.test(result));
 }
}
assert.match(describeStatus('INCONCLUSIVE','en'),/not|insufficient|conclusive/i);
assert.match(describeStatus('WRITING_ONLY','ar'),/[\u0600-\u06ff]/u);
assert.match(describeStatus('RESEARCH_SIGNAL','en'),/experimental|uncalibrated/i);
assert.match(describeStatus('ERROR','en'),/try|error|failed/i);
console.log('PASS V9 state copy: bilingual, no fabricated authorship score, all 11 states');
