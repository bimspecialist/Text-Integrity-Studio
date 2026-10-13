'use strict';
const assert=require('node:assert/strict');
const {createDocumentSession}=require('../../docs/analysis/document-session.js');
// H1 RED — exact-source, reviewable editorial advice, not an AI-authorship estimator.
const {suggest}=require('../../docs/analysis/natural-writing-advisor.js');
const doc=(text,kind='paste')=>createDocumentSession(text,kind).read();
const REQUIRED=['id','revision','category','section','start','end','original',
 'proposedReplacement','reason','reasonBasis','locale','risk','reference'];

(function test_actual_source_and_reversible_before_after(){
 const source='In order to complete the study, we recieved the measurments at the site. teh report includes findings.';
 const snapshot=doc(source);
 const review=suggest(snapshot,{locale:'en'});
 assert.equal(review.revision,snapshot.revision);
 assert.equal(review.isPartial,false);
 assert.equal(typeof review.disclaimer,'string');
 assert.match(review.disclaimer,/editorial|heuristic/i);
 assert(review.suggestions.length>=2,'existing local writing rules should identify useful real problems');
 for(const s of review.suggestions){
  for(const prop of REQUIRED)assert(Object.hasOwn(s,prop),prop);
  assert.equal(s.revision,snapshot.revision);
  assert.equal(s.original,source.slice(s.start,s.end),'span must identify exactly the source');
  assert.equal(s.reasonBasis,'LOCAL_EDITORIAL_HEURISTIC');
  assert(['clarity','rhythm','repetition','specificity','grammar'].includes(s.category));
  assert(['low','manual'].includes(s.risk));
  assert.equal(s.locale,'en');
  assert(Number.isInteger(s.section)&&s.section>=1);
  assert(Object.isFrozen(s));
  if(s.proposedReplacement!==null){
   assert.equal(s.risk,'low','only safe typo/whitespace changes should auto-apply');
   assert.notEqual(s.original,s.proposedReplacement);
  }
 }
 assert(review.suggestions.some(s=>s.proposedReplacement==='the'));
 assert(!JSON.stringify(review).includes('aiProbability'));
 assert(!JSON.stringify(review).includes('authorshipPercent'));
})();

(function test_academic_engineering_protected_claims(){
 const text='In 2024 the ISO 9001 procedure recorded 450 kPa (Smith, 2024) at 09:35. '+ 
  'The requirement [12] states: "teh measured steel remained stable." '+ 
  'The formula F = ma uses 31 and 98 without units. teh final report had no new measurements.';
 const r=suggest(doc(text),{mode:'academic',locale:'en'});
 const protectedTerms=['2024','ISO 9001','450 kPa','[12]','09:35','F = ma','31','98','(Smith, 2024)'];
 for(const s of r.suggestions.filter(x=>x.proposedReplacement!==null)){
  const overlap=(a,b)=>s.start<b&&s.end>a;
  for(const term of protectedTerms){
   const idx=text.indexOf(term);
   assert(!overlap(idx,idx+term.length),'safe edits cannot overlap '+term);
  }
  assert(!s.original.includes('teh measured steel'),'quoted text must not be changed');
 }
 assert(r.suggestions.some(s=>s.original==='teh' && s.start>text.lastIndexOf('98')),
  'independent, unprotected typo should still be correctable');
})();

(function test_dialect_preserved_and_bilingual_reasons(){
 const source='هاذا تعبير محلي قصدت كتابته بهاذه الطريقة، لاكن التقرير الفني يتطلب مراجعة';
 const ar=suggest(doc(source),{locale:'ar',mode:'academic'});
 assert(ar.suggestions.length>=1);
 assert(ar.suggestions.every(s=>s.locale==='ar'));
 assert(ar.suggestions.some(s=>s.original==='هاذا'));
 assert(ar.suggestions.filter(s=>/هاذا|بهاذه|لاكن/.test(s.original)).every(s=>
  s.risk==='manual'&&s.proposedReplacement===null),
  'dialect markers require manual choice, never forced MSA correction');
 assert(ar.suggestions.some(s=>/[ء-ي]/.test(s.reason)));
})();

(function test_guidance_cannot_invent_facts_or_typographical_errors(){
 const long=Array(45).fill('measurement').join(' ')+' shows the values collected from this site.';
 const r=suggest(doc(long),{locale:'en'});
 assert(r.suggestions.some(s=>s.category==='clarity'&&s.proposedReplacement===null),
  'overlong sentences require human editorial restructuring, not automatic random splitting');
 assert(r.suggestions.filter(s=>s.proposedReplacement!==null).every(s=>
  !/\bI personally\b|\bI witnessed\b|\b99%\b|\b2026\b/.test(s.proposedReplacement)));
 for(const s of r.suggestions)assert.equal(s.reasonBasis,'LOCAL_EDITORIAL_HEURISTIC');
})();

(function test_technical_repetition_is_manual_not_synonymized(){
 const repeated=Array(35).fill('Revit').join(' ')+' was the term used in the technical classification.';
 const r=suggest(doc(repeated),{locale:'en'});
 assert(r.suggestions.every(s=>s.original!=='Revit'||s.proposedReplacement===null));
 assert(r.suggestions.filter(s=>s.category==='repetition').every(s=>s.risk==='manual'));
})();

(function test_maximum_capped_and_partial_when_text_not_fully_reviewed(){
 const initial='teh '+Array(30).fill('recieve').join(' ');
 const r=suggest(doc(initial),{locale:'en',limit:3});
 assert(r.suggestions.length<=3);
 const giant='a'.repeat(121000)+'\n\n'+Array(800).fill('teh').join(' ');
 const p=suggest(doc(giant),{locale:'en'});
 assert.equal(p.isPartial,true,'bounded sections must be explicitly identified as partial');
 assert(p.suggestions.every(s=>s.end<=giant.length));
})();

(function test_invalid_snapshot_is_rejected(){
 assert.throws(()=>suggest({text:null,revision:0}),TypeError);
 assert.throws(()=>suggest(doc('yes'),{limit:-1}),RangeError);
})();
console.log('PASS H1: source-grounded bilingual human editing, protected facts, dialect and partial limits');
