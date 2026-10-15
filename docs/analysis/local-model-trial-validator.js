/* Text Integrity Studio — research-only provenance and feasibility gate.
 * Passing structural validation is NOT independent proof of ONNX licensing,
 * bilingual generation quality, measured transfer or product approval.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISLocalModelTrialValidator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const immutable=v=>typeof v==='string'&&/^[a-f0-9]{40}$/u.test(v);
 const artifact=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
 const trustedModel=v=>typeof v==='string'&&/^onnx-community\/[A-Za-z0-9._-]+$/u.test(v);
 function trialBasics(candidate){
  if(!candidate||!trustedModel(candidate.modelId)||!immutable(candidate.immutableRevision)||
   !candidate.modelFile||!/^onnx\/[\w.-]+\.onnx$/u.test(candidate.modelFile)||
   !artifact(candidate.modelFileSha256)||
   !Number.isSafeInteger(candidate.claimedFileBytes)||candidate.claimedFileBytes<=0)
   return false;
  return true;
 }
 function canPromote(candidate){
  if(!trialBasics(candidate)||candidate.status!=='VERIFIED'||
   candidate.upstreamLicense!=='apache-2.0'||!candidate.convertedLicenseEvidence||
   candidate.convertedLicenseEvidence.license!=='apache-2.0'||
   !/^https:\/\/huggingface\.co\//u.test(candidate.convertedLicenseEvidence.url||'')||
   candidate.realInferenceObserved!==true||candidate.webgpuStatus!=='PASSED'||
   !Number.isSafeInteger(candidate.measuredTotalBytes)||
   candidate.measuredTotalBytes<candidate.claimedFileBytes||
   !Number.isFinite(candidate.startupMs)||candidate.startupMs<=0||
   !Number.isFinite(candidate.warmGenerationMs)||candidate.warmGenerationMs<=0||
   !Number.isFinite(candidate.memoryObservedOrUnknown)||candidate.memoryObservedOrUnknown<=0||
   !Array.isArray(candidate.languageSamples))return false;
  const languages=['en','ar'];
  if(!languages.every(locale=>candidate.languageSamples.some(s=>
   s.locale===locale&&s.status==='PASS'&&s.reviewer==='independent'&&
   typeof s.trialArtifactSha256==='string'&&artifact(s.trialArtifactSha256))))return false;
  const evidence=candidate.trialEvidence;
  return Boolean(evidence?.ownerApproved===true&&evidence?.observedOnDevice===true&&
   artifact(evidence.networkAuditSha256)&&artifact(evidence.runtimeBuildSha256));
 }
 function assessManifest(manifest){
  const issues=[];
  if(!manifest||manifest.schemaVersion!=='TIS_LOCAL_REWRITER_TRIAL_V1'||
   !Array.isArray(manifest.candidates)||!manifest.candidates.length)
   return Object.freeze({productionReady:false,issues:Object.freeze(['INVALID_TRIAL_MANIFEST'])});
  const known=new Set();
  for(const candidate of manifest.candidates){
   if(!trialBasics(candidate))issues.push('IMMUTABLE_PIN_OR_ARTIFACT_MISSING');
   if(!trustedModel(candidate?.modelId)||known.has(candidate.modelId))
    issues.push('UNKNOWN_OR_DUPLICATE_MODEL_ID');
   known.add(candidate.modelId);
   if(candidate.status==='VERIFIED'&&!canPromote(candidate))
    issues.push('UNVERIFIED_TRIAL_EVIDENCE');
  }
  const current=manifest.candidates.find(x=>x.modelId===manifest.productionDefault);
  if(manifest.productionDefault!==null&&(!current||!canPromote(current)))
   issues.push('UNVERIFIED_PRODUCTION_DEFAULT');
  const approved=Boolean(manifest.productionDefault&&current&&canPromote(current));
  return Object.freeze({productionReady:approved&&issues.length===0,issues:Object.freeze(issues)});
 }
 return Object.freeze({assessManifest,canPromote});
});
