'use strict';
const assert=require('node:assert/strict');
const {createLocalModelRegistry}=require('../../docs/analysis/local-model-registry.js');
const research=require('../../docs/analysis/local-rewrite-model-manifest.json');
const {fakeVerifiedManifest}=require('./local-verified-fixture.cjs');
let now=1000;
const bytes=new Uint8Array(Array.from({length:16},(_,i)=>i+1));
const cryptoObject={getRandomValues(arr){arr.set(bytes);return arr;}};
const verified=fakeVerifiedManifest();
const candidate=verified.candidates[0];
const profile={memoryGB:16,hardwareConcurrency:8,webgpu:true};
const make=(manifest=verified)=>createLocalModelRegistry({manifest,clock:()=>now,cryptoObject});

(function deny_consent_no_asset_download(){
 let requested=false;
 const beforeFetch=globalThis.fetch;
 globalThis.fetch=()=>{requested=true;throw Error('unsafe model download');};
 try{
  const registry=make(research);
  assert.equal(registry.select({language:'en',deviceProfile:profile}).blockedReason,'MODEL_NOT_VERIFIED');
  assert.equal(registry.grantConsent({modelId:candidate.modelId,revision:candidate.immutableRevision,
   manifestRevision:verified.manifestRevision,confirmed:true,acknowledgedBytes:600000000}).granted,false);
  assert.equal(requested,false);
 }finally{globalThis.fetch=beforeFetch;}
})();
(function verified_device_lang_selection_is_exact(){
 const registry=make();
 const chosen=registry.select({language:'ar',deviceProfile:profile});
 assert.equal(chosen.modelId,candidate.modelId);
 assert.equal(chosen.revision,candidate.immutableRevision);
 assert.equal(chosen.dtype,'q4f16');
 assert.equal(chosen.estimatedTransferBytes,600000000);
 assert.equal(registry.select({language:'fr',deviceProfile:profile}).blockedReason,'LANGUAGE_NOT_VERIFIED');
 assert.equal(registry.select({language:'en',deviceProfile:{...profile,memoryGB:null}}).blockedReason,'UNKNOWN_MEMORY');
})();
(function explicit_informed_ack_is_required(){
 const registry=make();
 const params={modelId:candidate.modelId,revision:candidate.immutableRevision,
  manifestRevision:verified.manifestRevision,confirmed:true,acknowledgedBytes:600000000,userInitiated:true};
 for(const patch of [
  {confirmed:false},
  {userInitiated:false},
  {acknowledgedBytes:569789750},
  {manifestRevision:'older-version'},
  {revision:'main'}
 ]){
  const r=registry.grantConsent({...params,...patch});
  assert.equal(r.granted,false);
 }
 const good=registry.grantConsent(params);
 assert.equal(good.granted,true);
 assert.equal(typeof good.token,'string');
 assert(good.token.length>=32,'opaque token not just a public model id');
 assert(!Object.keys(good).includes('text'));
 assert.equal(registry.validateConsent(good.token,{modelId:candidate.modelId,revision:candidate.immutableRevision}),true);
 assert.equal(registry.validateConsent(good.token,{modelId:'other',revision:candidate.immutableRevision}),false);
 assert.equal(registry.validateConsent(good.token,{modelId:candidate.modelId,revision:'other'}),false);
})();
(function stale_or_expired_consent_rejected(){
 const registry=make();
 const params={modelId:candidate.modelId,revision:candidate.immutableRevision,
  manifestRevision:verified.manifestRevision,confirmed:true,acknowledgedBytes:600000000,userInitiated:true};
 const t=registry.grantConsent(params).token;
 now+=15*60*1000+1;
 assert.equal(registry.validateConsent(t,{modelId:candidate.modelId,revision:candidate.immutableRevision}),false);
 now=1000;
 const t2=registry.grantConsent(params).token;
 registry.revokeConsent(t2);
 assert.equal(registry.validateConsent(t2,{modelId:candidate.modelId,revision:candidate.immutableRevision}),false);
})();
(function no_crypto_no_consent(){
 const reg=createLocalModelRegistry({manifest:verified,clock:()=>1000,cryptoObject:{}});
 assert.equal(reg.grantConsent({modelId:candidate.modelId,revision:candidate.immutableRevision,
  manifestRevision:verified.manifestRevision,confirmed:true,acknowledgedBytes:600000000,userInitiated:true}).granted,false);
})();
console.log('PASS L2: no asset download without verified model + 15-minute in-memory explicit informed consent');
