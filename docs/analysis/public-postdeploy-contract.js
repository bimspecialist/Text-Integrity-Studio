/* S5 release-evidence contract, no browser or network side effects.
 * Verifies *metadata observed by* a real Chromium run. This helper itself
 * cannot establish that an operator actually performed that run. It NEVER
 * promotes a research-only detector probability or authorizes Git merge.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISPublicPostdeployContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const RELEASE_MARKER='TIS_V8_PATH_A_20261014_S5_RC2';
 const PAGES='https://bimspecialist.github.io/Text-Integrity-Studio/';
 const PRIMARY_ID='onnx-community/tmr-ai-text-detector-ONNX';
 const PRIMARY_REV='b9aa251e5bcda7e429fcc936767d921435945b60';
 const SECONDARY_ID='onnx-community/roberta-base-openai-detector-ONNX';
 const SECONDARY_REV='54895bd11f34b47a01369d25b2255224717409b8';
 const CALIBRATION='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE';
 const REQUIRED=['quality','chromium','primaryModel','secondaryModel',
  'docx','pdf','ocr','rtl','security'];
 const isPercent=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100;
 function ensureList(items){return Array.isArray(items)?items:null;}
 function verifyPublishedApp(info={}){
  if(!info||typeof info!=='object')throw new TypeError('PUBLIC_BROWSER_EVIDENCE_REQUIRED');
  const reasons=[];
  const mode=info.mode;
  if(mode==='local-fixture'||mode==='pr-baseline')return Object.freeze({
   status:'NOT_CANDIDATE',candidateVerified:false,releaseMarkerMatched:false,
   modelInferenceObserved:false,
   reasons:Object.freeze([mode==='local-fixture'?'LOCAL_FIXTURE_IS_NOT_DEPLOYED_PRODUCTION':
    'PR_TESTED_PUBLIC_BASELINE_NOT_PR_CANDIDATE'])
  });
  if(mode!=='production')reasons.push('UNKNOWN_EVIDENCE_MODE');
  let url;
  try{url=new URL(info.url);}
  catch{reasons.push('INVALID_PUBLIC_ORIGIN');}
  if(url?.href!==PAGES||url?.username||url?.password)
   reasons.push('INVALID_PUBLIC_ORIGIN');
  if(info.loaded!==true)reasons.push('PUBLIC_ORIGIN_UNAVAILABLE');
  if(info.expectedMarker!==RELEASE_MARKER)
   reasons.push('UNPINNED_RELEASE_TARGET');
  const matched=info.expectedMarker===RELEASE_MARKER&&info.observedMarker===RELEASE_MARKER;
  if(!matched)reasons.push('RELEASE_MARKER_MISMATCH');
  if(info.modelInferenceObserved!==true||
   info.inferenceSource!=='CHROMIUM_REAL_ONNX_DEPLOYED_ORIGIN')
   reasons.push('REAL_MODEL_INFERENCE_NOT_OBSERVED');
  const evidence=info.evidence;
  if(!evidence||typeof evidence!=='object'||
   !['RESEARCH_SIGNAL','INCONCLUSIVE'].includes(evidence.kind)||
   evidence.calibration!==CALIBRATION||
   !Number.isSafeInteger(evidence.revision)||evidence.revision<0||
   typeof evidence.requestId!=='string'||!/^tis-\d+-\d+$/.test(evidence.requestId)||
   evidence.scanOptions?.deep!==true||
   evidence.primary?.model_id!==PRIMARY_ID||
   evidence.primary?.revision!==PRIMARY_REV||
   !isPercent(evidence.primary?.score)||
   !isPercent(evidence.primary?.coverage)||
   evidence.secondary?.model_id!==SECONDARY_ID||
   evidence.secondary?.revision!==SECONDARY_REV||
   !isPercent(evidence.secondary?.score)||
   !isPercent(evidence.secondary?.coverage)){
   reasons.push('PINNED_DUAL_MODEL_EVIDENCE_MISSING');
  }
  const consoleErrors=ensureList(info.consoleErrors);
  const failedHosts=ensureList(info.failedNetworkHosts);
  if(!consoleErrors||consoleErrors.length)reasons.push('PUBLIC_BROWSER_CONSOLE_ERRORS');
  if(!failedHosts||failedHosts.length)reasons.push('FAILED_NETWORK_REQUESTS');
  const verified=reasons.length===0;
  return Object.freeze({
   status:verified?'VERIFIED_DEPLOYED_CANDIDATE':'BLOCKED',
   candidateVerified:verified,releaseMarkerMatched:matched,
   modelInferenceObserved:verified&&info.modelInferenceObserved===true,
   reasons:Object.freeze([...new Set(reasons)].sort())
  });
 }
 function assessEngineeringGate(checks={}){
  if(!checks||typeof checks!=='object')
   throw new TypeError('ENGINEERING_RELEASE_CHECKS_REQUIRED');
  const reasons=[];
  for(const key of REQUIRED)if(checks[key]!=='PASS')
   reasons.push(key.toUpperCase()+'_NOT_PASS');
  if(checks.localGeneratorEnabled!==false||
   !['PASS','HOLD'].includes(checks.localGenerator))
   reasons.push('UNVERIFIED_LOCAL_GENERATION_NOT_DISABLED');
  if(checks.authorshipProbabilityEnabled!==false||
   !['PASS','HOLD'].includes(checks.scientificCalibration))
   reasons.push('UNVERIFIED_AUTHORSHIP_PROBABILITY_NOT_DISABLED');
  const blocked=reasons.length>0;
  // A caller-supplied boolean is NOT signed/verified owner authorization.
  // Readiness is informational only; approval and merge remain separate actions.
  if(!blocked)reasons.push(checks.ownerApproved===true?
   'OWNER_IDENTITY_NOT_AUTHENTICATED':'OWNER_APPROVAL_REQUIRED');
  return Object.freeze({
   status:blocked?'BLOCKED':checks.ownerApproved===true?'REVIEW_REQUIRED':'APPROVAL_REQUIRED',
   reasons:Object.freeze([...new Set(reasons)].sort()),
   mergeAuthorized:false,
   scientificStatus:checks.scientificCalibration||'UNKNOWN',
   localGeneratorStatus:checks.localGenerator||'UNKNOWN',
   localGeneratorEnabled:false,
   releasedProbability:false
  });
 }
 return Object.freeze({
  RELEASE_MARKER,PAGES,PRIMARY_REV,SECONDARY_REV,
  verifyPublishedApp,assessEngineeringGate
 });
});
