/* V8.7 — deterministic bilingual editor comparison measurements.
 * No document copies are persisted, transmitted, or passed to AI models.
 * Word counts match the existing whitespace-delimited editor statistic.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISEditorComparisonCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function countWords(text){
  if(typeof text!=='string')throw new TypeError('TEXT_STRING_REQUIRED');
  const trimmed=text.trim();
  return trimmed?trimmed.split(/\s+/u).length:0;
 }
 function compareWords(original,draft){
  const before=countWords(original),after=countWords(draft);
  return Object.freeze({before,after,delta:after-before});
 }
 // Normalizes scroll to a viewport-independent reading position. Offsets
 // are pixel measurements, never character indices or content changes.
 function proportionalScroll(fromTop,fromScrollHeight,fromClientHeight,
  toScrollHeight,toClientHeight){
  const dims=[fromTop,fromScrollHeight,fromClientHeight,
   toScrollHeight,toClientHeight];
  if(dims.some(x=>!Number.isFinite(x)||x<0))
   throw new RangeError('INVALID_SCROLL_GEOMETRY');
  const fromRange=Math.max(0,fromScrollHeight-fromClientHeight);
  const toRange=Math.max(0,toScrollHeight-toClientHeight);
  if(!fromRange||!toRange)return 0;
  return Math.round(Math.min(1,Math.max(0,fromTop/fromRange))*toRange);
 }
 return Object.freeze({countWords,compareWords,proportionalScroll});
});
