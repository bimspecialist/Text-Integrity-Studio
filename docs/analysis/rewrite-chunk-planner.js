/* Source-loss-proof chunk planning for on-device rewriting.
 * Token counts MUST be provided by the actual selected tokenizer at runtime.
 * No heuristic word counts, silent clipping, or model downloads.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISRewriteChunkPlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function coverageForChunks(source,chunks){
  if(typeof source!=='string'||!Array.isArray(chunks))throw new TypeError('INVALID_COVERAGE_INPUT');
  const spans=chunks.map(c=>({start:c.start,end:c.end})).sort((a,b)=>a.start-b.start||a.end-b.end);
  let cursor=0,covered=0;
  const missing=[];
  for(const r of spans){
   if(!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.end)||
    r.start<0||r.end>source.length||r.end<r.start)throw new TypeError('INVALID_SOURCE_SPAN');
   if(r.start>cursor)missing.push({start:cursor,end:r.start});
   const next=Math.max(cursor,r.end);
   covered+=next-Math.max(cursor,r.start);
   cursor=next;
  }
  if(cursor<source.length)missing.push({start:cursor,end:source.length});
  return Object.freeze({coveredCharacters:covered,totalCharacters:source.length,
   uncoveredSpans:Object.freeze(missing.map(x=>Object.freeze(x)))});
 }
 function planRewriteChunks(snapshot,{countTokens,maxInputTokens,reservedPromptTokens=0,
  reservedOutputTokens=0,overlapTokens=0}={}){
  if(!snapshot||typeof snapshot.text!=='string'||!Number.isSafeInteger(snapshot.revision))
   throw new TypeError('INVALID_SOURCE_SNAPSHOT');
  if(typeof countTokens!=='function')throw new TypeError('REAL_TOKENIZER_REQUIRED');
  for(const n of [maxInputTokens,reservedPromptTokens,reservedOutputTokens,overlapTokens])
   if(!Number.isSafeInteger(n)||n<0)throw new TypeError('INVALID_TOKEN_BUDGET');
  const budget=maxInputTokens-reservedPromptTokens-reservedOutputTokens-overlapTokens;
  if(budget<1)throw new RangeError('NO_CONTENT_TOKEN_BUDGET');
  const source=snapshot.text, chunks=[];
  let from=0;
  // Every UTF-16 source code unit belongs to exactly one emitted chunk.
  // The unused overlap allowance is explicitly deducted rather than
  // silently repeating output or overestimating unique source coverage.
  while(from<source.length){
   let end=from,lastCount=0;
   while(end<source.length){
    const point=source.codePointAt(end);
    const next=end+(point>0xffff?2:1);
    const count=countTokens(source.slice(from,next));
    if(!Number.isSafeInteger(count)||count<0)throw new TypeError('INVALID_TOKENIZER_COUNT');
    if(count>budget)break;
    end=next;lastCount=count;
   }
   if(end===from)break; // Unrepresentable codepoint => explicit PARTIAL.
   chunks.push(Object.freeze({id:'chunk-'+chunks.length,start:from,end,text:source.slice(from,end),
    tokenCount:lastCount,documentRevision:snapshot.revision}));
   from=end;
  }
  const coverage=coverageForChunks(source,chunks);
  return Object.freeze({
   status:coverage.uncoveredSpans.length?'PARTIAL':'COMPLETE',
   documentRevision:snapshot.revision,
   chunks:Object.freeze(chunks),
   sourceCoverage:Object.freeze({coveredCharacters:coverage.coveredCharacters,
    totalCharacters:coverage.totalCharacters}),
   uncoveredSpans:coverage.uncoveredSpans
  });
 }
 function remainingForRetry(plan,finishedIds){
  if(!plan||!Array.isArray(plan.chunks)||!(finishedIds instanceof Set))
   throw new TypeError('INVALID_RETRY_STATE');
  return Object.freeze(plan.chunks.filter(c=>!finishedIds.has(c.id)));
 }
 return Object.freeze({planRewriteChunks,coverageForChunks,remainingForRetry});
});
