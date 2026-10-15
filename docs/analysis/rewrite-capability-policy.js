/* Text Integrity Studio — local generative inference admission policy.
 * No permissions request, network, model prefetch, document text or telemetry.
 */
(function(root,factory){
 'use strict';
 const trial=root?.TISLocalModelTrialValidator||
  (typeof module==='object'&&module.exports?require('./local-model-trial-validator.js'):null);
 const api=factory(trial);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISRewriteCapabilityPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(trial){
 'use strict';
 function assess({navigatorInfo={},deviceInfo={},manifest=null}={}){
  const memoryGB=Number.isFinite(deviceInfo.memoryGB)&&deviceInfo.memoryGB>0?deviceInfo.memoryGB:null;
  const cpu=Number.isInteger(deviceInfo.hardwareConcurrency)&&deviceInfo.hardwareConcurrency>0?
   deviceInfo.hardwareConcurrency:null;
  const webgpu=navigatorInfo.webgpuSupported===true;
  const deviceProfile=Object.freeze({memoryGB,hardwareConcurrency:cpu,webgpu});
  const result=(supported,reason)=>Object.freeze({supported,reason,deviceProfile});
  if(navigatorInfo.secureContext!==true)return result(false,'INSECURE_CONTEXT');
  if(!webgpu)return result(false,'WEBGPU_UNAVAILABLE');
  if(memoryGB===null)return result(false,'UNKNOWN_MEMORY');
  if(memoryGB<8)return result(false,'LOW_MEMORY');
  if(!manifest||manifest.userTextRemoteInferenceAllowed!==false||
   typeof trial?.assessManifest!=='function'||!trial.assessManifest(manifest).productionReady)
   return result(false,'MODEL_NOT_VERIFIED');
  return result(true,'NONE');
 }
 return Object.freeze({assess});
});
