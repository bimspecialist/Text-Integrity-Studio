/* Text Integrity Studio — audited model selection and session-only consent.
 * The registry does not fetch, generate, cache text or persist permissions.
 * Real inference stays disabled until an independently approved trial manifest.
 */
(function(root,factory){
 'use strict';
 const trial=root?.TISLocalModelTrialValidator||
  (typeof module==='object'&&module.exports?require('./local-model-trial-validator.js'):null);
 const api=factory(trial);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISLocalModelRegistry=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(trial){
 'use strict';
 const TTL=15*60*1000;
 function createLocalModelRegistry({manifest,clock=()=>Date.now(),cryptoObject=
  (typeof globalThis!=='undefined'?globalThis.crypto:null)}={}){
  if(!manifest||typeof clock!=='function')throw new TypeError('A fixed trial manifest and clock are required');
  const pinned=JSON.parse(JSON.stringify(manifest));
  const active=new Map();
  function candidate(){
   if(!trial?.assessManifest(pinned).productionReady)return null;
   return pinned.candidates.find(c=>c.modelId===pinned.productionDefault)||null;
  }
  function select({language,deviceProfile}={}){
   const c=candidate();
   const fail=blockedReason=>Object.freeze({blockedReason});
   if(!c)return fail('MODEL_NOT_VERIFIED');
   if(!deviceProfile||deviceProfile.webgpu!==true)return fail('WEBGPU_UNAVAILABLE');
   if(!Number.isFinite(deviceProfile.memoryGB))return fail('UNKNOWN_MEMORY');
   if(deviceProfile.memoryGB<8)return fail('LOW_MEMORY');
   if(!['ar','en'].includes(language)||
    !c.languageSamples.some(s=>s.locale===language&&s.status==='PASS'&&s.reviewer==='independent'))
    return fail('LANGUAGE_NOT_VERIFIED');
   return Object.freeze({
    modelId:c.modelId,revision:c.immutableRevision,dtype:c.dtype,
    estimatedTransferBytes:c.measuredTotalBytes
   });
  }
  function grantConsent({modelId,revision,manifestRevision,
   confirmed=false,acknowledgedBytes=0,userInitiated=false}={}){
   const deny=reason=>Object.freeze({granted:false,reason});
   const c=candidate();
   if(!c||c.modelId!==modelId||c.immutableRevision!==revision||
    pinned.manifestRevision!==manifestRevision)return deny('MODEL_OR_REVISION_NOT_VERIFIED');
   if(confirmed!==true||userInitiated!==true||
    !Number.isSafeInteger(acknowledgedBytes)||acknowledgedBytes<c.measuredTotalBytes)
    return deny('INFORMED_CONSENT_REQUIRED');
   if(typeof cryptoObject?.getRandomValues!=='function')return deny('SECURE_RANDOM_UNAVAILABLE');
   const bytes=new Uint8Array(24);
   try{cryptoObject.getRandomValues(bytes);}
   catch{return deny('SECURE_RANDOM_UNAVAILABLE');}
   const token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
   active.set(token,{modelId,revision,until:clock()+TTL,manifestRevision});
   return Object.freeze({granted:true,token,expiresAt:clock()+TTL});
  }
  function validateConsent(token,{modelId,revision}={}){
   if(typeof token!=='string'||!active.has(token))return false;
   const record=active.get(token);
   if(!record||clock()>=record.until||record.manifestRevision!==pinned.manifestRevision){
    active.delete(token);return false;
   }
   return record.modelId===modelId&&record.revision===revision&&
    candidate()?.modelId===modelId;
  }
  function revokeConsent(token){active.delete(token);}
  function dispose(){active.clear();}
  return Object.freeze({select,grantConsent,validateConsent,revokeConsent,dispose});
 }
 return Object.freeze({createLocalModelRegistry});
});
