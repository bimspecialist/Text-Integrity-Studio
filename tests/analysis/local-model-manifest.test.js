'use strict';
const assert=require('node:assert/strict');
const manifest=require('../../docs/analysis/local-rewrite-model-manifest.json');
const {assessManifest,canPromote}=require('../../docs/analysis/local-model-trial-validator.js');
const sha='558750086ed49d78cb701ed6fa85af33fd16453f';
const clean=()=>structuredClone(manifest);

(function no_prod_model_without_real_evidence(){
 assert.equal(manifest.schemaVersion,'TIS_LOCAL_REWRITER_TRIAL_V1');
 assert.equal(manifest.productionDefault,null,'do not deploy an unverified 570MB generator');
 assert(manifest.candidates.some(x=>x.modelId==='onnx-community/Qwen3-0.6B-ONNX'));
 const c=manifest.candidates.find(x=>x.modelId==='onnx-community/Qwen3-0.6B-ONNX');
 assert.equal(c.immutableRevision,sha);
 assert.equal(c.modelFile,'onnx/model_q4f16.onnx');
 assert.equal(c.dtype,'q4f16');
 assert.equal(c.claimedFileBytes,569789750);
 assert.equal(c.measuredTotalBytes,null,'reported file size is NOT measured total browser download');
 assert.equal(c.status,'RESEARCH_ONLY');
 assert.equal(c.realInferenceObserved,false);
 assert.equal(canPromote(c),false,'none of the untested candidates may reach production');
 assert.equal(assessManifest(manifest).productionReady,false);
})();
(function invalid_conversion_license_blocks_selection(){
 const c=clean().candidates[0];
 c.status='VERIFIED';
 c.realInferenceObserved=true;c.webgpuStatus='PASSED';
 c.startupMs=100;c.warmGenerationMs=20;c.measuredTotalBytes=600000000;
 c.languageSamples=[{locale:'en',status:'PASS',reviewer:'independent'},
                    {locale:'ar',status:'PASS',reviewer:'independent'}];
 assert.equal(canPromote(c),false,'upstream Apache 2 alone does not prove ONNX conversion license');
})();
(function mutable_main_revision_rejected(){
 const c=clean().candidates[0];
 c.immutableRevision='main';
 assert.equal(canPromote(c),false);
 assert(assessManifest({...clean(),candidates:[c]}).issues.some(s=>s.includes('IMMUTABLE')));
})();
(function no_real_inference_cannot_pass(){
 const c=clean().candidates[0];
 c.status='VERIFIED';
 c.convertedLicenseEvidence={license:'apache-2.0',url:'https://huggingface.co/license-not-confirmed'};
 c.measuredTotalBytes=600000000;
 c.webgpuStatus='PASSED';
 c.startupMs=100;c.warmGenerationMs=30;
 assert.equal(canPromote(c),false);
})();
(function measured_size_and_language_quality_not_guessed(){
 const c=clean().candidates[0];
 c.status='VERIFIED';c.realInferenceObserved=true;c.webgpuStatus='PASSED';
 c.convertedLicenseEvidence={license:'apache-2.0',url:'https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX'};
 c.measuredTotalBytes=null;
 c.startupMs=100;c.warmGenerationMs=30;
 c.languageSamples=[{locale:'en',status:'PASS',reviewer:'independent'}];
 assert.equal(canPromote(c),false,'no measured transfer or Arabic-reviewed sample');
})();
(function no_unapproved_production_default(){
 const d=clean();
 d.productionDefault='onnx-community/Qwen3-0.6B-ONNX';
 assert.equal(assessManifest(d).productionReady,false);
 assert(assessManifest(d).issues.some(x=>x.includes('UNVERIFIED_PRODUCTION_DEFAULT')));
})();
console.log('PASS L1: research-only pinned ONNX provenance, independent license/measurement and EN/AR real-generation gates');
