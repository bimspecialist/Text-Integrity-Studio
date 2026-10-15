'use strict';
const assert=require('node:assert/strict');
const {createDocumentSession}=require('../../docs/analysis/document-session.js');
const {projectEvidence}=require('../../docs/analysis/evidence-projection.js');

function make(text,segments,{kind='RESEARCH_SIGNAL',signal=70,globalCoverage=100}={}){
 const snapshot=createDocumentSession(text).read();
 const outcome={revision:snapshot.revision,kind,signal:kind==='INCONCLUSIVE'?null:signal,
  documentCoverageWordsPercent:globalCoverage,segments};
 return {snapshot,outcome};
}
(function test_window_overlap_not_double_counted(){
 const {snapshot,outcome}=make('abcdefghij',[{start:0,end:6,signal:20},{start:4,end:10,signal:80}]);
 const p=projectEvidence(snapshot,outcome);
 assert.equal(p.sections.length,1);
 assert.equal(p.sections[0].coveredCharacters,10,'overlap cannot exceed the paragraph length');
 assert.equal(p.sections[0].paragraphCoverageCharactersPercent,100);
 assert.equal(p.sections[0].windowSignal,50,'overlap uses averaging, not double-counted coverage');
 assert.equal(p.documentCoverageWordsPercent,100,'word coverage is not replaced with character coverage');
 assert.equal(p.overallSignal,70);
})();
(function test_utf16_offsets_and_unscanned_spans(){
 const text='a🙂b\r\n\r\nsource heading';
 const emoji=text.indexOf('🙂');
 const {snapshot,outcome}=make(text,[{start:emoji,end:emoji+2,signal:91},{start:text.indexOf('source'),end:text.length,signal:10}],{globalCoverage:43});
 assert.equal(snapshot.text.slice(emoji,emoji+2),'🙂');
 const projected=projectEvidence(snapshot,outcome);
 assert.equal(projected.sections[0].start,0);
 assert.equal(projected.sections[0].end,4,'emoji consumes two JS UTF-16 code units');
 assert.equal(projected.sections[0].coveredCharacters,2);
 assert.equal(projected.sections[0].paragraphCoverageCharactersPercent,50);
 assert.equal(projected.sections[0].windowSignal,null,'half a paragraph must not produce a local score');
 assert.equal(projected.sections[1].windowSignal,10);
 assert.equal(projected.documentCoverageWordsPercent,43);
 assert.equal(projected.hasPartialSampling,true);
 assert.equal(projected.sections[0].uncoveredCharacters,2);
})();
(function test_paragraph_under60_unscored(){
 const {snapshot,outcome}=make('abcdefghij',[{start:0,end:5,signal:99}]);
 const p=projectEvidence(snapshot,outcome);
 assert.equal(p.sections[0].paragraphCoverageCharactersPercent,50);
 assert.equal(p.sections[0].windowSignal,null);
 const enough=projectEvidence(snapshot,{...outcome,segments:[{start:0,end:6,signal:30}]});
 assert.equal(enough.sections[0].paragraphCoverageCharactersPercent,60);
 assert.equal(enough.sections[0].windowSignal,30);
})();
(function test_long_doc_samples_begin_middle_end(){
 const text=Array.from({length:15},(_,i)=>'Paragraph '+(i+1)+' records the actual measured changes.').join('\n\n');
 const {snapshot,outcome}=make(text,[{start:0,end:text.length,signal:65}],{globalCoverage:65});
 const p=projectEvidence(snapshot,outcome,{maxOverviewSections:3});
 assert.deepEqual(p.sections.map(x=>x.id),[1,8,15]);
 assert.equal(p.totalParagraphs,15);
 assert.equal(p.sections.every(s=>s.windowSignal===65),true);
 assert.equal(p.hasPartialSampling,true,'global word coverage retained despite section-window map');
})();
(function test_inconclusive_keeps_raw_windows_without_document_score(){
 const {snapshot,outcome}=make('This section was measured.',[{start:0,end:26,signal:90}],
  {kind:'INCONCLUSIVE',signal:null,globalCoverage:100});
 const p=projectEvidence(snapshot,outcome);
 assert.equal(p.overallSignal,null);
 assert.equal(p.sections[0].windowSignal,90,'a window signal can be shown but is not a probability');
 assert.equal(p.documentCoverageWordsPercent,100);
})();
(function test_invalid_and_stale_evidence_fail_closed(){
 const {snapshot,outcome}=make('A complete paragraph here.',[{start:-1,end:100,signal:Infinity}]);
 const p=projectEvidence(snapshot,outcome);
 assert.equal(p.sections[0].coveredCharacters,0);
 assert.equal(p.sections[0].windowSignal,null);
 assert.equal(p.hasPartialSampling,true);
 assert.throws(()=>projectEvidence(snapshot,{...outcome,revision:snapshot.revision+1}),/stale|revision/i);
})();
console.log('PASS R7 union char-window coverage, exact UTF-16 offsets, impartial long-document overview and null global signal');
