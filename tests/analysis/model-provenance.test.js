'use strict';
/* S2 pinned-model and executable dependency provenance contract.
 * Verifying source constants DOES NOT establish runtime SRI, binary hashes,
 * a converted ONNX license, or a security release approval.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verifyModelManifest}=require('../../docs/security/model-provenance.js');
const manifest=require('../../docs/security/DEPENDENCY_AND_MODEL_MANIFEST.json');
const root=path.resolve(__dirname,'../..');
const sources=Object.fromEntries([
 'docs/browser-ai-runtime.js','docs/ai-runtime.html',
 'docs/analysis/local-rewrite-model-manifest.json','docs/index.html',
 'docs/vendor/JSZIP_LICENSE.txt','docs/vendor/pdfjs/LICENSE',
 'docs/fonts/MANROPE-OFL.txt','docs/fonts/IBM-PLEX-ARABIC-OFL.txt',
 'docs/vendor/transformers/LICENSE','docs/vendor/transformers/SHA256SUMS'
].map(p=>[p,fs.readFileSync(path.join(root,p),'utf8')]));
const realHashes=Object.fromEntries(Object.keys(manifest.detector.runtime.assets).map(p=>
 [p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
const check=(data=manifest,files=sources,hashes=realHashes)=>verifyModelManifest(data,files,hashes);

(function currentPinningsRecordedButNotDeclaredApproved(){
 const r=check();
 assert.equal(r.ok,false,'missing executable integrity and license review must block supply-chain release');
 assert.equal(r.modelIdentityPinned,true);
 assert.equal(r.deploymentAllowed,false);
 assert.equal(r.runtimeIntegrityVerified,true,'npm-vendored JS/WASM hashes computed from shipped bytes');
 for(const blocker of ['DETECTOR_MODEL_LICENSE_UNVERIFIED','GENERATOR_CONVERTED_LICENSE_UNVERIFIED'])
  assert(r.violations.includes(blocker),blocker);
 assert.equal(manifest.localGenerator.productionDefault,null);
 assert.equal(manifest.localGenerator.realModelVerified,false);
})();
(function primaryAndSecondaryRevisionsCannotDrift(){
 for(const model of ['primary','secondary']){
  const modified=structuredClone(manifest);
  modified.detector.models[model].revision='f'.repeat(40);
  const out=check(modified);
  assert(out.violations.includes(model.toUpperCase()+'_REVISION_MISMATCH'));
 }
})();
(function swappingRealRuntimeSourceFails(){
 const altered={...sources,'docs/browser-ai-runtime.js':
  sources['docs/browser-ai-runtime.js'].replace('./vendor/transformers/transformers.min.js','./vendor/transformers/evil.js')};
 assert(check(manifest,altered).violations.includes('PINNED_RUNTIME_SOURCE_MISMATCH'));
 const modified=structuredClone(manifest);
 modified.detector.runtime.uri='https://evil.invalid/runtime.js';
 assert(check(modified).violations.includes('PINNED_RUNTIME_SOURCE_MISMATCH'));
})();
(function unregisteredOrNonPinnedModelsAreRejected(){
 const extra=structuredClone(manifest);
 extra.detector.models.third={id:'attacker/new-model',revision:'a'.repeat(40)};
 assert(check(extra).violations.includes('UNKNOWN_MODEL_NOT_REGISTERED'));
 const bad=structuredClone(manifest);
 bad.detector.models.primary.id='attacker/new-model';
 assert(check(bad).violations.includes('PRIMARY_MODEL_ID_MISMATCH'));
})();
(function verifiedClaimsCannotBeFabricated(){
 const bad=structuredClone(manifest);
 bad.detector.models.primary.licenseStatus='VERIFIED';
 assert(check(bad).violations.includes('UNVERIFIED_LICENSE_ATTESTATION'));
 const fake=structuredClone(manifest);
 fake.detector.runtime.integrityStatus='FAKE_VERIFIED';
 assert(check(fake).violations.includes('RUNTIME_VENDORED_ASSET_INTEGRITY_FAILURE'));
 const tampered={...realHashes,'docs/vendor/transformers/transformers.min.js':'f'.repeat(64)};
 assert(check(manifest,sources,tampered).violations.includes('RUNTIME_VENDORED_ASSET_INTEGRITY_FAILURE'));
 const candidate=structuredClone(manifest);
 candidate.localGenerator.convertedLicenseStatus='APPROVED';
 assert(check(candidate).violations.includes('UNVERIFIED_LICENSE_ATTESTATION'));
})();
(function licensesActuallyBundled(){
 assert.match(sources['docs/vendor/JSZIP_LICENSE.txt'],/MIT License/);
 assert.match(sources['docs/vendor/pdfjs/LICENSE'],/Apache License/);
 assert.match(sources['docs/fonts/MANROPE-OFL.txt'],/SIL OPEN FONT LICENSE/);
 assert.match(sources['docs/fonts/IBM-PLEX-ARABIC-OFL.txt'],/SIL OPEN FONT LICENSE/);
 const missing={...sources,'docs/fonts/MANROPE-OFL.txt':''};
 assert(check(manifest,missing).violations.includes('MISSING_BUNDLED_LICENSE_EVIDENCE'));
})();
(function publicNewGeneratorStillDisabled(){
 const bad={...sources,'docs/analysis/local-rewrite-model-manifest.json':
  sources['docs/analysis/local-rewrite-model-manifest.json'].replace('"productionDefault": null','"productionDefault": "qwen"')};
 assert(check(manifest,bad).violations.includes('UNAPPROVED_GENERATOR_ACTIVE'));
})();
console.log('PASS S2: npm SHA-pinned first-party JS/WASM hashes verified against shipped files; model-science and separate licenses stay HOLD');
