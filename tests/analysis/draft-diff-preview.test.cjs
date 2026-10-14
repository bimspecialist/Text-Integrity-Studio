'use strict';
/* Diff preview: first differing range + bounded surrounding context.
 * This is NOT a linguistic edit score or a full multi-hunk diff.
 */
const assert=require('node:assert/strict');
const {firstDifference}=require('../../docs/analysis/draft-diff-preview.js');
(function rejectsUnsafeCalls(){
 for(const input of [undefined,null,12,{},[]]){
  assert.throws(()=>firstDifference(input,'some text'),TypeError);
  assert.throws(()=>firstDifference('some text',input),TypeError);
 }
 assert.throws(()=>firstDifference('a','b',{maxChangeChars:-1}),RangeError);
})();
(function preservesUnchangedSource(){
 const before='Original 5 mm, [2], Revit 2027, URL https://example.org';
 const data=firstDifference(before,before);
 assert.equal(data.status,'UNCHANGED');
 assert.equal(data.beforeExcerpt,'');
 assert.equal(data.afterExcerpt,'');
 assert.equal(before,'Original 5 mm, [2], Revit 2027, URL https://example.org');
})();
(function reportsOnlyAccurateChangedRange(){
 const before='The wall measures 5 mm and is in scope [4].';
 const after='The wall measures 5 mm and remains in scope [4].';
 const data=firstDifference(before,after,{contextChars:40});
 assert.equal(data.status,'CHANGED');
 assert.equal(data.beforeTruncated,false);
 assert.equal(data.afterTruncated,false);
 assert.notEqual(data.beforeExcerpt,data.afterExcerpt);
 assert(data.afterExcerpt.includes('remains'));
 assert(data.beforeExcerpt.includes('is'));
 assert.equal(data.beforeExcerpt.length<100,true);
})();
(function avoidsSplittingEmojiAndSupportsArabic(){
 const data=firstDifference('مرحبا 😀 في الرسم [2]','مرحبا ✅ في الرسم [2]',{contextChars:8});
 assert.equal(data.status,'CHANGED');
 assert(data.beforeExcerpt.includes('😀'));
 assert(data.afterExcerpt.includes('✅'));
 assert(!data.beforeExcerpt.includes('\uFFFD'));
 assert(!data.afterExcerpt.includes('\uFFFD'));
})();
(function capsLargeContentNoUnboundedOutput(){
 const before='A'.repeat(120000),after='A'.repeat(100)+'B'.repeat(119800);
 const x=firstDifference(before,after,{maxChangeChars:72,contextChars:12});
 assert.equal(x.status,'CHANGED');
 assert(x.beforeExcerpt.length<=120&&x.afterExcerpt.length<=120);
 assert.equal(x.beforeTruncated,true);
 assert.equal(x.afterTruncated,true);
 assert.equal(x.originalLength,120000);
 assert.equal(x.draftLength,119900);
})();
console.log('PASS V8.2: bounded, source-preserving Unicode-aware difference previews on academic and Arabic fixtures');
