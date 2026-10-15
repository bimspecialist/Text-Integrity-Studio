'use strict';
const assert=require('node:assert/strict');
// RED (R2): this production module must not exist until the required behavior is frozen.
const {createDocumentSession}=require('../../docs/analysis/document-session.js');

(function test_same_length_utf16_edit(){
 const session=createDocumentSession('Panel A and B','paste');
 const old=session.read();
 const next=session.replaceText('Panel C and B');
 assert.equal(next.text.length,old.text.length);
 assert.equal(next.revision,old.revision+1,'same-length text change must invalidate old AI results');
 assert.equal(old.text,'Panel A and B','previous snapshot is immutable');
 assert.notStrictEqual(next,old);
 assert.equal(session.read(),next);
})();

(function test_import_during_inference(){
 const session=createDocumentSession('This is the previous analyzed text.');
 const revisionAnalyzing=session.read().revision;
 const imported=session.replaceText('The new DOCX document contains source paragraphs.','docx');
 assert.equal(imported.sourceKind,'docx');
 assert.notEqual(revisionAnalyzing,imported.revision,'old inference revision must become stale');
 assert.equal(session.read().revision,imported.revision);
})();

(function test_utf16_offsets_and_unscanned_spans(){
 const text='  First line  \r\n\r\n  🙂 Second sentence  \r\n\r\n  Last item  ';
 const session=createDocumentSession(text,'txt');
 const s=session.read();
 assert.equal(s.text,text,'source must not be normalized or reordered');
 assert.deepEqual(s.paragraphs.map(({start,end})=>s.text.slice(start,end)),[
  'First line','🙂 Second sentence','Last item'
 ]);
 const emojiPos=text.indexOf('🙂');
 assert.equal(s.paragraphs[1].start,emojiPos);
 assert.equal(text.slice(s.paragraphs[1].start,s.paragraphs[1].start+2),'🙂');
 assert.equal(s.paragraphs[2].end,text.lastIndexOf('item')+4);
})();

(function test_read_snapshot_frozen(){
 const session=createDocumentSession('One.\n\nTwo.');
 const first=session.read();
 assert.equal(first.revision,0);
 assert(Object.isFrozen(first));
 assert(Object.isFrozen(first.paragraphs));
 assert(Object.isFrozen(first.paragraphs[0]));
 assert.throws(()=>{first.paragraphs[0].start=900;},TypeError);
 assert.throws(()=>{first.text='corrupted';},TypeError);
 const second=session.replaceText('Changed.\n\nTwo.');
 assert.equal(first.text,'One.\n\nTwo.');
 assert.notEqual(first,second);
 assert.equal(first.paragraphs[0].start,0);
})();

(function test_source_kind_change_increments_revision(){
 const session=createDocumentSession('Source text','paste');
 const initial=session.read().revision;
 const imported=session.replaceText('Source text','pdf');
 assert.equal(imported.sourceKind,'pdf');
 assert.equal(imported.revision,initial+1);
 const same=session.replaceText('Source text','pdf');
 assert.strictEqual(same,imported,'repeat import of identical source and kind does not invalidate');
 assert.equal(session.read().revision,imported.revision);
 for(const sourceKind of ['ocr','docx','txt','paste']){
  assert.equal(session.replaceText('Source text',sourceKind).sourceKind,sourceKind);
 }
 assert.throws(()=>session.replaceText('text','unknown'),/source|kind|format/i);
 assert.throws(()=>createDocumentSession(null),TypeError);
})();

(function test_subscriptions_and_disposal(){
 const session=createDocumentSession();
 assert.equal(session.read().text,'');
 assert.deepEqual(session.read().paragraphs,[]);
 const seen=[];
 const unsubscribe=session.subscribe(s=>{seen.push({revision:s.revision,text:s.text,kind:s.sourceKind});});
 session.replaceText('Hello');
 session.replaceText('Hello');
 session.replaceText('Hello','docx');
 assert.deepEqual(seen.map(s=>s.revision),[1,2]);
 assert.deepEqual(seen.map(s=>s.kind),['paste','docx']);
 unsubscribe();
 session.replaceText('Goodbye');
 assert.equal(seen.length,2);
 assert.throws(()=>session.subscribe(null),TypeError);
})();

console.log('PASS revision-safe immutable DocumentSession, source offsets, Unicode, read-only snapshots and notifications');
