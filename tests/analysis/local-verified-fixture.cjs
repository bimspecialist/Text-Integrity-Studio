'use strict';
// Tests only: fictional verification evidence to exercise positive gating.
// MUST NOT be imported into production or committed to a real model manifest.
const raw=require('../../docs/analysis/local-rewrite-model-manifest.json');
const SHA='f'.repeat(64);
function fakeVerifiedManifest(){
 const manifest=structuredClone(raw);
 const model=manifest.candidates[0];
 model.status='VERIFIED';
 model.convertedLicenseEvidence={license:'apache-2.0',
  url:'https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX'};
 model.measuredTotalBytes=600000000;
 model.webgpuStatus='PASSED';
 model.realInferenceObserved=true;
 model.startupMs=1000;model.warmGenerationMs=150;
 model.memoryObservedOrUnknown=2000000000;
 model.languageSamples=[
  {locale:'en',status:'PASS',reviewer:'independent',trialArtifactSha256:SHA},
  {locale:'ar',status:'PASS',reviewer:'independent',trialArtifactSha256:SHA}
 ];
 model.trialEvidence={ownerApproved:true,observedOnDevice:true,networkAuditSha256:SHA,runtimeBuildSha256:SHA};
 manifest.productionDefault=model.modelId;
 return manifest;
}
module.exports={fakeVerifiedManifest};
