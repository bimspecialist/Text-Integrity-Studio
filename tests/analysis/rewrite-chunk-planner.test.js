'use strict';
const assert=require('node:assert/strict');
// L4 RED: source-accurate token-budget planner, never silent truncation.
const {planRewriteChunks,coverageForChunks,remainingForRetry}=require('../../docs/analysis/rewrite-chunk-planner.js');
const {createDocumentSession}=require('../../docs/analysis/document-session.js');
const tokens=s=>Array.from(s).length;
(function missingTokenizerDenied(){
 assert.throws(()=>planRewriteChunks(createDocumentSession('Hello.').read(),{maxInputTokens:64}),/TOKENIZER/);
})();
(function completeEnglishArabicAndUtf16(){
 const source='Section A. Measured 240 V [12].\n\nالقسم ب: ٣٠٪ في عام ٢٠٢٤.\n\nThird part ✅.';
 const snapshot=createDocumentSession(source).read();
 const plan=planRewriteChunks(snapshot,{countTokens:tokens,maxInputTokens:27,
  reservedPromptTokens:7,reservedOutputTokens:5,overlapTokens:0});
 assert.equal(plan.status,'COMPLETE',JSON.stringify(plan));
 assert(plan.chunks.length>1);
 assert.equal(plan.sourceCoverage.coveredCharacters,source.length);
 assert.equal(plan.sourceCoverage.totalCharacters,source.length);
 assert.deepEqual(plan.uncoveredSpans,[]);
 assert.equal(plan.chunks.map(x=>x.text).join(''),source);
 for(const chunk of plan.chunks){
  assert.equal(chunk.text,source.slice(chunk.start,chunk.end));
  assert(chunk.tokenCount<=15,'prompt and output reserves leave only 15 tokens');
  assert(!(/\uD800-\uDBFF/u.test(source[chunk.end-1]||'')&&/\uDC00-\uDFFF/u.test(source[chunk.end]||'')),
   'split must not break an emoji/surrogate pair');
 }
})();
(function partialWhenTokensCannotFit(){
 const source='Alpha 🧪 Beta';
 const snapshot=createDocumentSession(source).read();
 const p=planRewriteChunks(snapshot,{countTokens:s=>Array.from(s).length,
  maxInputTokens:8,reservedPromptTokens:4,reservedOutputTokens:3,overlapTokens:0});
 assert.equal(p.status,'PARTIAL');
 assert(p.uncoveredSpans.length>0);
 assert(p.sourceCoverage.coveredCharacters<source.length);
 assert(p.uncoveredSpans.every(r=>source.slice(r.start,r.end).length>0));
})();
(function overlapsAreNotDoubleCounted(){
 const source='abcdefghijklmno';
 const covered=coverageForChunks(source,[{start:0,end:8},{start:5,end:12},{start:11,end:15}]);
 assert.equal(covered.coveredCharacters,15);
 assert.deepEqual(covered.uncoveredSpans,[]);
 const gap=coverageForChunks(source,[{start:0,end:3},{start:7,end:10}]);
 assert.equal(gap.coveredCharacters,6);
 assert.deepEqual(gap.uncoveredSpans,[{start:3,end:7},{start:10,end:15}]);
})();
(function retryOnlyIncompleteSegments(){
 const snapshot=createDocumentSession('abcdefghi').read();
 const plan=planRewriteChunks(snapshot,{countTokens:tokens,maxInputTokens:7,
  reservedPromptTokens:2,reservedOutputTokens:2,overlapTokens:0});
 assert.equal(plan.status,'COMPLETE');
 assert(plan.chunks.length>=3);
 const finished=new Set([plan.chunks[0].id]);
 const remaining=remainingForRetry(plan,finished);
 assert.equal(remaining.length,plan.chunks.length-1);
 assert(!remaining.some(c=>finished.has(c.id)));
})();
(function noSilentClippingOrWhitespaceDrop(){
 const s='  first\n\n  second\t\n third  ';
 const p=planRewriteChunks(createDocumentSession(s,'docx').read(),
  {countTokens:tokens,maxInputTokens:14,reservedPromptTokens:2,reservedOutputTokens:2});
 assert.equal(p.chunks.map(c=>c.text).join(''),s);
 assert.equal(p.sourceCoverage.coveredCharacters,s.length);
})();
console.log('PASS L4: exact UTF-16 source coverage, tokenizer-required chunks, honest partial and selective retry');
