'use strict';
const assert=require('node:assert/strict');
const {createDocumentSession}=require('../../docs/analysis/document-session.js');
const advisor=require('../../docs/analysis/natural-writing-advisor.js');
// H2 RED — user must opt in to each source-aligned editorial change.
const {createEditorialReview}=require('../../docs/analysis/editorial-review.js');
function fixture(text='teh engineering record was recieved at the site.',kind='paste'){
 const session=createDocumentSession(text,kind);
 const review=createEditorialReview({session,advisor});
 return {session,review};
}
function findFix(review,original){
 return review.getSuggestions().find(x=>x.original===original&&x.proposedReplacement!==null);
}
(function test_preview_never_changes_document_and_apply_is_optin(){
 const {session,review}=fixture();
 const fix=findFix(review,'teh');
 assert(fix,'known safe typo should have reviewable source span');
 const snapshot=session.read();
 const suggested=review.preview(fix.id);
 assert.equal(suggested.before,'teh');
 assert.equal(suggested.after,'the');
 assert.equal(suggested.revision,snapshot.revision);
 assert.equal(suggested.risk,'low');
 assert.equal(session.read(),snapshot,'preview must not apply automatically');
 const seen=[];session.subscribe(s=>seen.push(s.revision));
 const applied=review.apply(fix.id);
 assert.equal(applied.applied,true);
 assert(applied.snapshot.revision>snapshot.revision);
 assert.match(session.read().text,/^the engineering/);
 assert.deepEqual(seen,[1],'applied edit invalidates old model evidence through session revision');
 assert.equal(review.apply(fix.id).applied,false,'old edit cannot be repeated blindly');
 const undo=review.undo();
 assert.equal(undo.restored,true);
 assert.equal(session.read().text,snapshot.text);
 assert.deepEqual(seen,[1,2]);
})();

(function test_same_length_revision_changed_stops_stale_apply(){
 const {session,review}=fixture('teh results were measured at the site.');
 const fix=findFix(review,'teh');
 assert(fix);
 const initial=session.read();
 const preview=review.preview(fix.id);
 session.replaceText('teh results were measured at the room.');
 assert.equal(session.read().text.length,initial.text.length,'equal-length text change');
 assert.equal(session.read().text.slice(fix.start,fix.end),preview.before,'original excerpt still exists');
 const attempt=review.apply(fix.id);
 assert.equal(attempt.applied,false);
 assert.match(attempt.reason,/STALE|REVISION/i,'must guard document version, not excerpt equality alone');
 assert.equal(session.read().text,'teh results were measured at the room.');
})();

(function test_docx_requires_word_bridge_and_never_writes_original_bytes(){
 const original=Object.freeze({name:'original.docx',bytes:new Uint8Array([80,75,3,4,0,0])});
 const bytesBefore=Array.from(original.bytes);
 const {session,review}=fixture('teh BIM document reviewed all five plans.','docx');
 const fix=findFix(review,'teh');
 assert(fix);
 const before=review.preview(fix.id);
 assert.equal(before.after,'the');
 const attempt=review.apply(fix.id);
 assert.deepEqual(attempt,{applied:false,reason:'WORD_READ_ONLY'});
 assert.equal(session.read().sourceKind,'docx');
 assert.equal(session.read().text,'teh BIM document reviewed all five plans.');
 assert.deepEqual(Array.from(original.bytes),bytesBefore,'original DOCX file bytes unchanged');
 assert.equal(review.undo().restored,false);
})();

(function test_manual_only_dialect_protection(){
 const {session,review}=fixture('هاذا تعبير محلي مكتوب بعناية، لاكن التقرير يحتاج مراجعة.');
 const manual=review.getSuggestions().find(x=>x.original==='هاذا');
 assert(manual);
 assert.equal(manual.proposedReplacement,null);
 assert.equal(review.preview(manual.id).after,null);
 assert.deepEqual(review.apply(manual.id),{applied:false,reason:'MANUAL_ONLY'});
 assert.match(session.read().text,/هاذا/);
})();
(function test_protected_academic_claims_never_auto_modified(){
 const source='In 2024, ISO 9001 recorded 450 kPa [12]. teh data needs a citation.';
 const {session,review}=fixture(source);
 for(const item of review.getSuggestions().filter(s=>s.proposedReplacement!==null)){
  assert(!/2024|9001|450|kPa|\[12\]/.test(item.original));
 }
 const correction=findFix(review,'teh');
 assert(correction);
 review.apply(correction.id);
 assert.match(session.read().text,/2024, ISO 9001 recorded 450 kPa \[12\]/);
})();

(function test_undo_only_owned_edit_and_rejects_external_edits(){
 const {session,review}=fixture();
 const fix=findFix(review,'teh');
 review.apply(fix.id);
 session.replaceText('A completely different source was opened.','paste');
 const stale=review.undo();
 assert.equal(stale.restored,false);
 assert.match(stale.reason,/STALE|REVISION/i);
 assert.equal(session.read().text,'A completely different source was opened.');
})();
(function test_sequential_apply_and_two_undos(){
 const {session,review}=fixture('teh report was recieved.');
 const original=session.read().text;
 const a=findFix(review,'teh');review.apply(a.id);
 review.refresh();
 const b=findFix(review,'recieved');assert(b);
 assert.equal(review.apply(b.id).applied,true);
 assert.equal(session.read().text,'the report was received.');
 assert.equal(review.undo().restored,true);
 assert.equal(session.read().text,'the report was recieved.');
 assert.equal(review.undo().restored,true);
 assert.equal(session.read().text,original);
 assert.equal(review.undo().restored,false);
})();

(function test_dismiss_only_in_memory_not_document(){
 const {session,review}=fixture();
 const fix=findFix(review,'teh');assert(fix);
 review.dismiss(fix.id);
 assert.equal(review.getSuggestions().some(x=>x.id===fix.id),false);
 assert.equal(session.read().text,'teh engineering record was recieved at the site.');
 review.refresh();
 assert.equal(review.getSuggestions().some(x=>x.id===fix.id),false);
 const newReview=createEditorialReview({session,advisor});
 assert(newReview.getSuggestions().some(x=>x.original==='teh'));
})();
(function test_bad_inputs_rejected_without_mutation(){
 const {session,review}=fixture();
 const s=session.read();
 assert.deepEqual(review.apply('does-not-exist'),{applied:false,reason:'NOT_FOUND'});
 assert.equal(review.preview('does-not-exist'),null);
 assert.equal(s,session.read());
 assert.throws(()=>createEditorialReview({session:null,advisor}),TypeError);
})();
console.log('PASS H2: reviewed safe edits, source version, original DOCX, optional Arabic and multi-level Undo');
