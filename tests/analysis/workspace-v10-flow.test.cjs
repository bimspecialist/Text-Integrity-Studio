'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const modulePath=path.resolve('docs/analysis/workspace-v10.js');
assert(fs.existsSync(modulePath),'V10.1 approved flow must have a dedicated implementation module');
const api=require(modulePath);
const mapping=[
 ['EMPTY','input'],['READY','input'],['STALE','input'],['CANCELLED','input'],
 ['LOADING','progress'],['ANALYZING','progress'],
 ['WRITING_ONLY','eligibility'],['UNSUPPORTED','eligibility'],
 ['RESEARCH_SIGNAL','results'],['INCONCLUSIVE','results'],['ERROR','error']
];
for(const [status,want] of mapping){
 assert.equal(api.screenForStatus(status),want,'screen for '+status);
}
for(const [stage,percent,want] of [
 ['LOADING',null,false],['DOWNLOADING',null,false],['DOWNLOADING',35,true],
 ['ANALYZING',0,true],['ANALYZING',73,true],['ANALYZING',100,true],
 ['ANALYZING',101,false],['ANALYZING',-1,false],['ANALYZING','75',false]
]){
 const got=api.describeProgress({stage,percent});
 assert.equal(got.determinate,want,'progress must be measured for '+stage+'/'+percent);
 if(want)assert.equal(got.percent,percent);
 else assert.equal(got.percent,null,'no invented percentage');
 assert(!String(got.label).toLowerCase().includes('ai-written'));
}
const source='Start: ☀️ This technical sentence needs review. Continue.\nNext paragraph is untouched.';
const begin=source.indexOf('This'),end=source.indexOf(' Continue.');
const evidence={kind:'RESEARCH_SIGNAL',revision:5,segments:[{start:begin,end,signal:63.25,words:6,tokens:12}]};
const projected=api.segmentParts(source,evidence,5);
assert.equal(projected.map(x=>x.text).join(''),source,'source reconstructed without any loss');
assert.equal(projected.filter(x=>x.highlight).length,1);
assert.equal(projected.find(x=>x.highlight).text,source.slice(begin,end));
assert.equal(projected.find(x=>x.highlight).start,begin);
assert.equal(projected.find(x=>x.highlight).end,end);
assert(projected.filter(x=>!x.highlight).every(x=>x.text.length>0));
assert.deepEqual(api.segmentParts(source,evidence,6),[{start:0,end:source.length,text:source,highlight:false}],
 'stale revision must fail closed');
assert.deepEqual(api.segmentParts(source,{...evidence,kind:'INCONCLUSIVE'},5),[{start:0,end:source.length,text:source,highlight:false}],
 'inconclusive has no AI highlight');
for(const segments of [
 [{start:-1,end:7,signal:50}],
 [{start:0,end:source.length+1,signal:50}],
 [{start:begin,end,signal:35},{start:begin+2,end:source.length,signal:75}],
 [{start:8,end:8,signal:24}],
 [{start:begin,end,signal:NaN}]
]){
 assert.deepEqual(api.segmentParts(source,{...evidence,segments},5),
  [{start:0,end:source.length,text:source,highlight:false}],
  'invalid evidence offsets must not highlight partial source');
}
assert(!api.segmentParts('😀test',{kind:'RESEARCH_SIGNAL',revision:1,segments:[{start:1,end:5,signal:50}]},1).some(x=>x.highlight),
 'UTF-16 surrogate boundary is not a legal highlight edge');
console.log('PASS V10.1 pure contract: statuses, authentic scoped progress and revision-safe source spans');
