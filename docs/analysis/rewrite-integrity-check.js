/* Local rewrite protected-fact screening.
 * Conservative text-level checks are not semantic equivalence proofs.
 * All changed drafts require user review before application.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISRewriteIntegrityCheck=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PATTERNS=[
  ['url',/https?:\/\/[^\s<>"']+/gu],
  ['citation',/\[(?:[\d\u0660-\u0669]+(?:\s*[,;\-]\s*[\d\u0660-\u0669]+)*)\]/gu],
  ['measurement',/[+\-]?[\d\u0660-\u0669]+(?:[.,٫][\d\u0660-\u0669]+)?\s*(?:kPa|MPa|kN|kV|mA|mm|cm|km|kg|Hz|W|V|m²|m³|%|٪)/giu],
  ['numeric',/[+\-]?[\d\u0660-\u0669]+(?:[.,٫][\d\u0660-\u0669]+)?(?:%|٪)?/gu]
 ];
 function extractProtectedFacts(source){
  if(typeof source!=='string')throw new TypeError('SOURCE_MUST_BE_TEXT');
  const found=[];
  for(const [kind,regex] of PATTERNS){
   for(const match of source.matchAll(regex)){
    const value=match[0].replace(/[.,;:]+$/u,'');
    if(!value)continue;
    found.push(Object.freeze({kind,value,start:match.index,end:match.index+value.length}));
   }
  }
  return Object.freeze(found);
 }
 function compareRewrite(original,proposed,{locale='en'}={}){
  if(typeof original!=='string'||typeof proposed!=='string')
   throw new TypeError('TEXT_REQUIRED');
  const old=extractProtectedFacts(original),next=extractProtectedFacts(proposed);
  const changes=[];
  for(const kind of PATTERNS.map(x=>x[0])){
   const before=old.filter(x=>x.kind===kind).map(x=>x.value).sort();
   const after=next.filter(x=>x.kind===kind).map(x=>x.value).sort();
   if(JSON.stringify(before)!==JSON.stringify(after))
    changes.push(Object.freeze({kind,before:Object.freeze(before),after:Object.freeze(after)}));
  }
  const flags=[];
  if(changes.length)flags.push('PROTECTED_FACT_CHANGED');
  const personal=locale==='ar'?/(?:أنا شخصيا|قمت بنفسي|من تجربتي الشخصية)/u:
   /\b(?:I personally|I tested|we conducted|in my experience|I witnessed)\b/iu;
  if(personal.test(proposed)&&!personal.test(original))flags.push('UNVERIFIED_PERSONAL_CLAIM');
  if(proposed!==original)flags.push('MANUAL_REVIEW_REQUIRED');
  return Object.freeze({
   safeToApply:flags.length===0,
   flags:Object.freeze(flags),
   protectedChanges:Object.freeze(changes)
  });
 }
 return Object.freeze({compareRewrite,extractProtectedFacts});
});
