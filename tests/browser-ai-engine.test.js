'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const core=require('../docs/ai-evidence-core.js');
const source=fs.readFileSync('docs/browser-ai-runtime.js','utf8');
const sent=[];
const parent={postMessage(value,origin){sent.push({value,origin});}};
const windowMock={parent,addEventListener(type,fn){if(type==='message')windowMock.dispatch=fn;}};
const sandbox={
 window:windowMock,globalThis:null,
 TISEvidenceCore:core,location:{origin:'http://localhost:3000',href:'http://localhost:3000/ai-runtime.html'},
 document:{getElementById:()=>({textContent:''})},console
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source+'\nwindow.__testApi={aiSignalFromOutput,evaluate,MODELS};',sandbox,{filename:'browser-ai-runtime.js'});
const {aiSignalFromOutput,MODELS}=windowMock.__testApi;
assert.strictEqual(MODELS.primary.revision.length,40);
assert.strictEqual(MODELS.secondary.revision.length,40);
assert.equal(aiSignalFromOutput([{label:'ai',score:.72}]),.72);
assert(Math.abs(aiSignalFromOutput([{label:'human',score:.72}])-.28)<1e-9);
assert.equal(aiSignalFromOutput([{label:'Fake',score:.8}],'secondary'),.8);
assert(Math.abs(aiSignalFromOutput([{label:'Real',score:.8}],'secondary')-.2)<1e-9);
assert.throws(()=>aiSignalFromOutput([{label:'LABEL_1',score:.8}]),/UNVERIFIED_MODEL_LABEL/);
assert.throws(()=>aiSignalFromOutput([{label:'ChatGPT',score:.8}],'secondary'),/UNVERIFIED_MODEL_LABEL/);
assert.throws(()=>aiSignalFromOutput([{label:'ai',score:NaN}]),/INVALID_MODEL_OUTPUT/);
assert.equal(sent[0].value.op,'READY');
const tokenizer={encode:text=>Array(Math.ceil(text.length/5)+2).fill(2)};
const fakePrimary=Object.assign(async ()=>[{label:'ai',score:.83}],{tokenizer});
const fakeSecondary=Object.assign(async ()=>[{label:'Real',score:.86}],{tokenizer});
// Override external model loading only in synthetic tests; no model-based accuracy claims.
vm.runInNewContext('getClassifier=async(which)=>which==="primary"?window.testPrimary:window.testSecondary;',sandbox);
windowMock.testPrimary=fakePrimary;
windowMock.testSecondary=fakeSecondary;
(async()=>{
 const long=('A site engineer collected primary field observations and recorded the calculations for later verification. ').repeat(26);
 const primary=await windowMock.__testApi.evaluate(long,'sample-1',{deep:false,context:'general'});
 assert.equal(primary.status,'SINGLE_UNCALIBRATED_MODEL');
 assert.equal(primary.score,83);
 assert.equal(primary.secondary,null);
 assert.equal(primary.primary.segments.length>0,true);
 const compare=await windowMock.__testApi.evaluate(long,'sample-2',{deep:true,context:'academic'});
 assert.equal(compare.status,'MODEL_DISAGREEMENT');
 assert.equal(compare.score,null);
 assert.equal(compare.primary.score,83);
 assert(Math.abs(compare.secondary.score-14)<.01);
 assert(compare.flags.includes('FORMAL_OR_NON_NATIVE_FALSE_POSITIVE_RISK'));
 assert(compare.flags.includes('MODELS_DISAGREE'));
 assert.equal(compare.calibration,'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE');
 assert(!sent.some(item=>item.value?.text),'No source document returned in model result');
 console.log('PASS strict model AI label mapping, pinned versions, tokenizer-aware windows, genuine model disagreement and no fake aggregate');
})().catch(err=>{console.error(err);process.exit(1);});
