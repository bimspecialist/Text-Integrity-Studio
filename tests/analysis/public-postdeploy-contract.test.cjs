'use strict';
/* S5 fail-closed post-Pages release contract: no mock inference, no fake release markers.
 * Pure helpers test the browser observer's metadata. Only a real deployed-origin
 * Chromium run can supply the release evidence for production.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {verifyPublishedApp,assessEngineeringGate,RELEASE_MARKER}=
 require('../../docs/analysis/public-postdeploy-contract.js');

const PUBLIC='https://bimspecialist.github.io/Text-Integrity-Studio/';
const PRIMARY='b9aa251e5bcda7e429fcc936767d921435945b60';
const SECONDARY='54895bd11f34b47a01369d25b2255224717409b8';
function published(extra={}){
 return {
  url:PUBLIC,mode:'production',loaded:true,expectedMarker:RELEASE_MARKER,
  observedMarker:RELEASE_MARKER,modelInferenceObserved:true,
  inferenceSource:'CHROMIUM_REAL_ONNX_DEPLOYED_ORIGIN',
  evidence:{kind:'INCONCLUSIVE',calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
   requestId:'tis-1-1728571296000',revision:1,scanOptions:{deep:true,full:false,context:'general'},
   primary:{model_id:'onnx-community/tmr-ai-text-detector-ONNX',revision:PRIMARY,score:38.2,coverage:95.5},
   secondary:{model_id:'onnx-community/roberta-base-openai-detector-ONNX',revision:SECONDARY,score:62.1,coverage:93.0}},
  consoleErrors:[],failedNetworkHosts:[],...extra
 };
}
function checks(extra={}){
 return {
  quality:'PASS',chromium:'PASS',primaryModel:'PASS',secondaryModel:'PASS',
  docx:'PASS',pdf:'PASS',ocr:'PASS',rtl:'PASS',security:'PASS',
  localGenerator:'HOLD',localGeneratorEnabled:false,
  scientificCalibration:'HOLD',authorshipProbabilityEnabled:false,
  ownerApproved:false,...extra
 };
}
(function releaseMarkerMustBeShippedInRealCandidate(){
 const html=fs.readFileSync(path.join(__dirname,'../../docs/index.html'),'utf8');
 assert.match(RELEASE_MARKER,/^TIS_V8_PATH_A_20261014_S5_[A-Z0-9_]+$/);
 assert(html.includes('name="tis-release-marker" content="'+RELEASE_MARKER+'"'));
 for(const asset of ['app.js','analysis/app-adapter.js',
  'analysis/workspace-v8.js','analysis/draft-diff-preview.js',
  'studio-insights-ui.js','analysis/editor-comparison-core.js',
  'analysis/draft-find-replace-core.js']){
  assert(html.includes('src="'+asset+'?v=20261014-v8-8-rc3"'),
   'release candidate must cache-bust modified JavaScript: '+asset);
 }
 assert(html.includes('href="analysis/workspace-v8.css?v=20261014-v8-8-rc3"'),
  'release candidate must cache-bust redesigned CSS');
 assert.equal(verifyPublishedApp(published()).status,'VERIFIED_DEPLOYED_CANDIDATE');
 assert.equal(verifyPublishedApp(published({observedMarker:null})).status,'BLOCKED');
 assert(verifyPublishedApp(published({observedMarker:'OLD_MAIN_V6'})).reasons.includes('RELEASE_MARKER_MISMATCH'));
})();
(function baselineAndLocalFixtureCannotPassAsPublishedCandidate(){
 for(const mode of ['pr-baseline','local-fixture']){
  const outcome=verifyPublishedApp(published({mode}));
  assert.equal(outcome.status,'NOT_CANDIDATE');
  assert.equal(outcome.candidateVerified,false);
 }
 assert.equal(verifyPublishedApp(published({url:'http://127.0.0.1:1234/'})).status,'BLOCKED');
 assert.equal(verifyPublishedApp(published({url:'https://attacker.example/Text-Integrity-Studio/'})).status,'BLOCKED');
})();
(function realDualModelEvidenceRequiredNoMockOrSignalOnly(){
 for(const change of [
  {inferenceSource:'SYNTHETIC_BROWSER_FIXTURE'},
  {modelInferenceObserved:false},
  {evidence:{...published().evidence,secondary:null}},
  {evidence:{...published().evidence,primary:{...published().evidence.primary,revision:'f'.repeat(40)}}},
  {evidence:{...published().evidence,scanOptions:{deep:false}}},
  {evidence:{...published().evidence,calibration:'VERIFIED_AUTHORSHIP_PERCENT'}}
 ]){
  const result=verifyPublishedApp(published(change));
  assert.equal(result.status,'BLOCKED',JSON.stringify(change));
  assert.equal(result.candidateVerified,false);
 }
})();
(function leakedUserTextOrUnverifiedNetworkFailsClosed(){
 const result=verifyPublishedApp(published({
  failedNetworkHosts:['unapproved-host.example'],consoleErrors:[]
 }));
 assert.equal(result.status,'BLOCKED');
 assert(result.reasons.includes('FAILED_NETWORK_REQUESTS'));
 const withError=verifyPublishedApp(published({consoleErrors:['PAGE_ERROR']})); 
 assert.equal(withError.status,'BLOCKED');
})();
(function blockedModelDownloadMustNotBeReportedSuccessful(){
 const verdict=verifyPublishedApp(published({
  modelInferenceObserved:false,
  evidence:null,
  runtimeFailureCode:'MODEL_UNAVAILABLE'
 }));
 assert.equal(verdict.status,'BLOCKED');
 assert(verdict.reasons.includes('REAL_MODEL_INFERENCE_NOT_OBSERVED'));
})();
(function protectedMainWorkflowCannotMistakePRBaselineForPostDeploy(){
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/deployed-ai-diagnostic.yml'),'utf8');
 const testSource=fs.readFileSync(path.join(__dirname,'../deployed-ai-runtime.test.cjs'),'utf8');
 const live=fs.readFileSync(path.join(__dirname,'../../.github/workflows/live-browser-ai.yml'),'utf8');
 const quality=fs.readFileSync(path.join(__dirname,'../../.github/workflows/quality.yml'),'utf8');
 assert(workflow.includes("TIS_REQUIRE_S5: ${{ github.event_name != 'pull_request' }}"));
 assert(workflow.includes("continue-on-error: ${{ github.event_name == 'pull_request' }}"));
 assert(testSource.includes("await page.click('#aiDeep')"),
  'public candidate must exercise secondary ONNX, not only primary');
 assert(testSource.includes("releaseAudit:productionAudit"));
 assert(live.includes("'docs/analysis/**'"),'Path A changes must rerun genuine models');
 for(const token of ['node tests/ocr-browser.test.js','node tests/pdf-browser.test.js',
  'node tests/word-docx.test.js','node tests/analysis/accessibility-browser.test.cjs',
  'node tests/analysis/public-postdeploy-contract.test.cjs']){
  assert(quality.includes(token),'Missing mandatory release regression: '+token);
 }
})();
(function docxPdfOcrAndSecurityFailuresBlockMerge(){
 for(const field of ['quality','chromium','primaryModel','secondaryModel','docx','pdf','ocr','rtl','security']){
  const outcome=assessEngineeringGate(checks({[field]:'FAIL',ownerApproved:true}));
  assert.equal(outcome.status,'BLOCKED',field);
 }
 assert.equal(assessEngineeringGate(checks({localGeneratorEnabled:true,ownerApproved:true})).status,'BLOCKED');
 assert.equal(assessEngineeringGate(checks({authorshipProbabilityEnabled:true,ownerApproved:true})).status,'BLOCKED');
})();
(function scienceHoldDoesNotFalselyCertifyAuthorshipOrBlockSafeEditorOnly(){
 const pending=assessEngineeringGate(checks());
 assert.equal(pending.status,'APPROVAL_REQUIRED');
 assert.equal(pending.scientificStatus,'HOLD');
 assert.equal(pending.localGeneratorStatus,'HOLD');
 assert.equal(pending.mergeAuthorized,false);
 const approved=assessEngineeringGate(checks({ownerApproved:true}));
 assert.equal(approved.status,'REVIEW_REQUIRED',
  'caller-supplied boolean cannot authenticate a real GitHub merge approval');
 assert.equal(approved.mergeAuthorized,false);
 assert(approved.reasons.includes('OWNER_IDENTITY_NOT_AUTHENTICATED'));
 assert.equal(approved.scientificStatus,'HOLD');
 assert.equal(approved.localGeneratorStatus,'HOLD');
 assert.equal(approved.releasedProbability,false);
 assert.equal(approved.localGeneratorEnabled,false);
})();
console.log('PASS S5: candidate marker, real dual-model source, baseline isolation, privacy and independent release gates');
