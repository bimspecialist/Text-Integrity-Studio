/* Text Integrity Studio — one shared policy for English research-model eligibility.
 * The existing detector evidence core determines eligibility, never the UI.
 * Arabic and mixed text still receive local editorial review, not AI scores.
 */
(function(root,factory){
 'use strict';
 const core=root&&root.TISEvidenceCore ||
  (typeof module==='object'&&module.exports?require('../ai-evidence-core.js'):null);
 const api=factory(core);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISEligibilityPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(core){
 'use strict';
 if(!core||typeof core.eligibility!=='function'||typeof core.wordsWithOffsets!=='function')
  throw Error('Detector eligibility core unavailable');
 const SOURCE_KINDS=new Set(['paste','txt','docx','pdf','ocr']);
 function languageClassOf(text){
  const arabic=(text.match(/\p{Script=Arabic}/gu)||[]).length;
  const latin=(text.match(/[A-Za-z]/g)||[]).length;
  const other=(text.match(/\p{L}/gu)||[]).length-arabic-latin;
  if(arabic&&latin)return 'mixed';
  if(arabic)return 'ar';
  if(latin&&other)return 'mixed';
  if(latin)return 'en';
  if(other)return 'other';
  return 'unknown';
 }
 function assess(text,sourceKind='paste'){
  if(typeof text!=='string')throw new TypeError('Document text must be a string');
  const words=core.wordsWithOffsets(text).length;
  const languageClass=languageClassOf(text);
  const basic={words,characters:text.length,languageClass,policyVersion:'TIS_ELIGIBILITY_V2'};
  if(!SOURCE_KINDS.has(sourceKind))
   return Object.freeze({...basic,eligible:false,reason:'UNSUPPORTED_FORMAT'});
  if(!text.trim())return Object.freeze({...basic,eligible:false,reason:'NO_TEXT'});
  const decision=core.eligibility(text);
  return Object.freeze({...basic,eligible:decision.eligible,reason:decision.eligible?'NONE':decision.reason});
 }
 return Object.freeze({assess,languageClassOf});
});
