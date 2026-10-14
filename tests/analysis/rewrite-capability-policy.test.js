'use strict';
const assert=require('node:assert/strict');
const {assess}=require('../../docs/analysis/rewrite-capability-policy.js');
const raw=require('../../docs/analysis/local-rewrite-model-manifest.json');
const {fakeVerifiedManifest}=require('./local-verified-fixture.cjs');
const ready=()=>({
 navigatorInfo:{secureContext:true,webgpuSupported:true},
 deviceInfo:{memoryGB:16,hardwareConcurrency:8},
 manifest:fakeVerifiedManifest()
});
(function available_device_with_fake_verified_trial(){
 const output=assess(ready());
 assert.equal(output.supported,true);
 assert.equal(output.reason,'NONE');
 assert.equal(output.deviceProfile.memoryGB,16);
 assert(Object.isFrozen(output));
})();
(function gpu_off_blocks(){
 const input=ready();input.navigatorInfo.webgpuSupported=false;
 assert.equal(assess(input).reason,'WEBGPU_UNAVAILABLE');
 assert.equal(assess(input).supported,false);
})();
(function insecure_origin_blocks(){
 const input=ready();input.navigatorInfo.secureContext=false;
 assert.equal(assess(input).reason,'INSECURE_CONTEXT');
})();
(function unknown_or_insufficient_memory_blocks(){
 for(const v of [null,undefined,NaN,0,4]){
  const input=ready();input.deviceInfo.memoryGB=v;
  const r=assess(input);
  assert.equal(r.supported,false);
  assert(['UNKNOWN_MEMORY','LOW_MEMORY'].includes(r.reason));
 }
})();
(function unverified_real_manifest_cannot_start(){
 const input=ready();input.manifest=raw;
 const output=assess(input);
 assert.equal(output.supported,false);
 assert.equal(output.reason,'MODEL_NOT_VERIFIED');
 assert(!JSON.stringify(output).includes('Qwen3-0.6B-ONNX/resolve/main'));
})();
(function does_not_access_user_text_or_network(){
 let called=false;
 const original=globalThis.fetch;
 globalThis.fetch=()=>{called=true;throw Error('must not fetch');};
 try{assess(ready());assert.equal(called,false);}
 finally{globalThis.fetch=original;}
})();
console.log('PASS L2 device capability: WebGPU, secure origin, measured RAM, no false promotion or model fetch');
