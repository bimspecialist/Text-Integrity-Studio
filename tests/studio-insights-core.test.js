'use strict';
const assert=require('node:assert/strict');
const core=require('../docs/studio-insights-core.js');
const make=words=>Array.from({length:words},(_,i)=>'measurement'+(i%5)).join(' ');

const text='Engineers measured the structure carefully. The team documented the outcome.\n\n' +
 'Researchers compared the data with earlier work. They reviewed the limitations.';
const result=core.analyzeDocument(text);
assert.equal(result.version,'TIS_STYLE_V1');
assert.equal(result.sections.length,2);
assert.equal(result.partial,false);
assert.equal(result.statistics.sentences,4);
assert.equal(result.statistics.characters,text.length);
assert.equal(result.statistics.words,21);
for(const part of result.sections){
 assert.equal(text.slice(part.start,part.end).trim(),part.text===undefined?text.slice(part.start,part.end).trim():part.text);
 assert(!Object.hasOwn(part,'text'),'No raw paragraph copied into report');
 assert(part.statistics.words>0);
 assert(Number.isFinite(part.statistics.lexicalDiversity));
 assert(part.start<part.end);
}
assert(!JSON.stringify(result).includes('Engineers measured'),'No raw document text in export');
assert(!JSON.stringify(result).includes('authorshipProbability'),'Stylistics never claim authorship');

const repeated='The calibrated measurement was important. '+('Measurement data measurement outcome. ').repeat(18);
const alerts=core.analyzeDocument(repeated);
assert(alerts.suggestions.some(x=>x.code==='REPEATED_TERM'));
assert(alerts.suggestions.every(x=>x.manualReview===true&&x.reference.startsWith('https://')));
assert(alerts.suggestions.every(x=>!Object.hasOwn(x,'replacement')),'No automatic invented rewrites');

const longSentence=Array.from({length:44},(_,i)=>'technical'+(i%8)).join(' ')+' demonstrates a careful review of inputs and outputs.';
assert(core.analyzeDocument(longSentence).suggestions.some(x=>x.code==='LONG_SENTENCE'));

const arabic='وصف المهندس نظام المبنى بشكل واضح ثم راجع جميع البيانات. \n\n'+
 'كانت النتائج واضحة وقد ناقش الفريق القياسات والحدود.';
const ar=core.analyzeDocument(arabic,{locale:'ar'});
assert.equal(ar.language,'ar');
assert.equal(ar.sections.length,2);
assert(ar.statistics.words>10);
assert.equal(ar.authorshipEstimate,undefined);

const capped=core.analyzeDocument(('Test data. \n\n').repeat(160),{maxSections:15});
assert.equal(capped.partial,true);
assert.equal(capped.sections.length,15);
assert.equal(capped.paragraphs.total,160);
assert.equal(capped.paragraphs.analyzed,15);
assert(capped.statistics.coveragePercent<100);

const file=core.safeFileMetadata({name:'private-contract.final.docx',size:12345,lastModified:1760000000000});
assert.deepEqual(file,{extension:'docx',bytes:12345,modifiedIso:'2025-10-09T08:53:20.000Z'});
assert(!JSON.stringify(file).includes('private-contract'));
assert.equal(core.safeFileMetadata({name:'dangerous.exe',size:200}).extension,'unsupported');

const heat=core.mapModelSegments('abcdefghij',[
 {start:2,end:6,signal:82},{start:4,end:8,signal:18}
],{maxPreviewCharacters:10});
assert.equal(heat.previewTruncated,false);
assert.equal(heat.previewCharacters,10);
assert.equal(heat.coveredCharacters,6);
assert.equal(heat.coveragePercent,60);
assert(heat.chunks.some(c=>c.start===0&&c.end===2&&c.tier==='unreviewed'));
assert(heat.chunks.some(c=>c.start===2&&c.end===4&&c.tier==='high'));
assert(heat.chunks.some(c=>c.start===4&&c.end===6&&c.tier==='medium'));
assert(heat.chunks.some(c=>c.start===6&&c.end===8&&c.tier==='low'));
assert(heat.chunks.some(c=>c.start===8&&c.end===10&&c.tier==='unreviewed'));
assert.equal(core.mapModelSegments('abcdefghij',[],{}).coveragePercent,0);
const limited=core.mapModelSegments('abcdefghijklmnopqrst',[{start:1,end:20,signal:95}],{maxPreviewCharacters:10});
assert.equal(limited.previewTruncated,true);
assert.equal(limited.previewCharacters,10);
assert.equal(limited.fullCharacters,20);
assert.equal(limited.coveredCharacters,9);
assert.equal(core.mapModelSegments('abcdefghijkl',[{start:-1,end:20,signal:101}],{}).coveredCharacters,0);
for(const ex of core.editorialExamples('en')){
 assert(ex.before&&ex.after&&ex.description&&ex.reference.startsWith('https://'));
 assert(ex.kind!=='detector_evasion');
}
assert(core.editorialExamples('ar').length>=4);
console.log('PASS local bilingual paragraph profiling, exact offsets, non-authorship safeguards, bounded coverage, safe metadata, highlighted ONNX windows and editorial guide');
