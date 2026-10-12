'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('docs/browser-ai-runtime.js','utf8');

const sends=[];
const windowMock={
 parent:{postMessage(value,origin){sends.push({value,origin});}},
 addEventListener(_event,callback){windowMock.onMessage=callback;}
};
const sandbox={
 window:windowMock,
 document:{getElementById:()=>({textContent:''})},
 location:{origin:'https://bimspecialist.github.io'},
 console
};
vm.runInNewContext(source+'\nwindow.__testApi={selectChunks,aiSignalFromOutput};',sandbox,{filename:'browser-ai-runtime.js'});
const {selectChunks,aiSignalFromOutput}=windowMock.__testApi;
const english=('This verified example describes a field investigation, original measurements, and detailed engineering calculations. ').repeat(25);
const arabic=('هذه كتابة عربية تشرح التجربة الهندسية ونتائج قياس الموقع بالتفصيل وبأسلوب واضح ومختلف. ').repeat(25);
const selected=selectChunks(english);
assert(selected.words>=120);
assert(selected.chunks.length>=1 && selected.chunks.length<=8);
assert(selected.chunks.every(s=>typeof s==='string'&&s.length>20));
assert.throws(()=>selectChunks('short'),/MIN_WORDS/);
assert.throws(()=>selectChunks(arabic),/UNSUPPORTED_LANGUAGE/);
assert.equal(aiSignalFromOutput([{label:'LABEL_1',score:0.72}]),0.72);
assert(Math.abs(aiSignalFromOutput([{label:'LABEL_0',score:0.72}])-0.28)<1e-9);
assert.equal(aiSignalFromOutput([{label:'AI',score:0.9}]),0.9);
assert.throws(()=>aiSignalFromOutput([{label:'NEUTRAL',score:0.9}]),/UNVERIFIED_MODEL_LABEL/);
assert.throws(()=>aiSignalFromOutput([{label:'AI',score:NaN}]),/INVALID_MODEL_OUTPUT/);
assert.equal(sends[0].value.op,'READY');
assert(!sends.some(s=>'text' in s.value),'Runtime never sends source text back to the parent');
console.log('PASS browser model chunk sampling, multilingual abstention, label mapping and no fabricated scores');
