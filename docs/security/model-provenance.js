/* S2 browser-model supply-chain source verifier (Node-compatible UMD).
 * This module NEVER fetches remote packages or claims that a declared SHA was
 * hashed locally. Unknown licenses/runtime binaries keep deployment HOLD.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISModelProvenance=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EXACT={
  primary:{
   id:'onnx-community/tmr-ai-text-detector-ONNX',
   revision:'b9aa251e5bcda7e429fcc936767d921435945b60'
  },
  secondary:{
   id:'onnx-community/roberta-base-openai-detector-ONNX',
   revision:'54895bd11f34b47a01369d25b2255224717409b8'
  }
 };
 const RUNTIME_URI='./vendor/transformers/transformers.min.js';
 const ARCHIVE_SHA='207714c36765b87accfd9b7b0672c3505805af97140990e0d9f8ac6e3cd5471e';
 const VERIFIED_ASSETS={
   "docs/vendor/transformers/transformers.min.js": "aa5002b70e789798da263f5f99c62bd3e8fcd0c119258a493c40c180648365fa",
   "docs/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs": "08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9",
   "docs/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm": "c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39",
   "docs/vendor/transformers/LICENSE": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"
 };
 const LICENSE_PATHS=[
  ['docs/vendor/JSZIP_LICENSE.txt','MIT License'],
  ['docs/vendor/pdfjs/LICENSE','Apache License'],
  ['docs/fonts/MANROPE-OFL.txt','SIL OPEN FONT LICENSE'],
  ['docs/fonts/IBM-PLEX-ARABIC-OFL.txt','SIL OPEN FONT LICENSE']
 ];
 const CANDIDATE='onnx-community/Qwen3-0.6B-ONNX';
 const CANDIDATE_REV='558750086ed49d78cb701ed6fa85af33fd16453f';
 function verifyModelManifest(manifest,sourceFiles={},binaryHashes={}){
  const violations=new Set();
  const add=code=>violations.add(code);
  if(!manifest||typeof manifest!=='object'||!sourceFiles||
   typeof sourceFiles!=='object')throw new TypeError('SOURCE_AND_MANIFEST_REQUIRED');
  const detector=manifest.detector||{},runtime=detector.runtime||{},models=detector.models||{};
  const code=sourceFiles['docs/browser-ai-runtime.js']||'';
  const match=(name)=>{
   const re=new RegExp(name+String.raw`:\s*\{\s*id:'([^']+)',\s*revision:'([^']+)'`);
   const m=code.match(re);
   return m?{id:m[1],revision:m[2]}:null;
  };
  let modelIdentityPinned=true;
  for(const key of ['primary','secondary']){
   const canonical=EXACT[key],registered=models[key],observed=match(key);
   if(registered?.id!==canonical.id){add(key.toUpperCase()+'_MODEL_ID_MISMATCH');modelIdentityPinned=false;}
   if(registered?.revision!==canonical.revision){add(key.toUpperCase()+'_REVISION_MISMATCH');modelIdentityPinned=false;}
   if(!observed||observed.id!==canonical.id||observed.revision!==canonical.revision){
    add(key.toUpperCase()+'_RUNTIME_IDENTITY_MISMATCH');modelIdentityPinned=false;
   }
   if(registered?.licenseStatus!=='UNVERIFIED_RESEARCH_ONLY')
    add('UNVERIFIED_LICENSE_ATTESTATION');
   if(registered?.binaryIntegrityStatus!=='MODEL_REVISION_PIN_ONLY_NO_LOCAL_HASH_CHECK')
    add('UNVERIFIED_MODEL_HASH_ATTESTATION');
  }
  if(Object.keys(models).sort().join(',')!=='primary,secondary'){
   add('UNKNOWN_MODEL_NOT_REGISTERED');modelIdentityPinned=false;
  }
  if(runtime.uri!==RUNTIME_URI||runtime.packageVersion!=='3.8.1'||
   !code.includes("const LIBRARY_URL='"+RUNTIME_URI+"'"))
   add('PINNED_RUNTIME_SOURCE_MISMATCH');
  const checksumList=sourceFiles['docs/vendor/transformers/SHA256SUMS']||'';
  const assetEntries=Object.entries(VERIFIED_ASSETS);
  const runtimeIntegrityVerified=runtime.integrityStatus==='VENDORED_HASHES_VERIFIED'&&
   runtime.archiveSha256===ARCHIVE_SHA&&assetEntries.every(([path,hash])=>
    runtime.assets?.[path]===hash&&binaryHashes?.[path]===hash&&
    checksumList.includes(hash+'  '+path.split('/').at(-1)));
  if(!runtimeIntegrityVerified)add('RUNTIME_VENDORED_ASSET_INTEGRITY_FAILURE');
  if(runtime.licenseStatus!=='NPM_PUBLISHED_APACHE_2_0_LICENSE'||
    !sourceFiles['docs/vendor/transformers/LICENSE']?.includes('Apache License'))
   add('UNVERIFIED_LICENSE_ATTESTATION');
  // Model cards' license claims and repository revisions are not proof of each
  // remote ONNX binary's integrity: retain the separate experimental-model HOLD.
  add('DETECTOR_MODEL_LICENSE_UNVERIFIED');
  const runtimeHTML=sourceFiles['docs/ai-runtime.html']||'';
  if(runtimeHTML.includes('https://cdn.jsdelivr.net')||
   !runtimeHTML.includes("script-src 'self'")||
   !runtimeHTML.includes("default-src 'none'"))
   add('MODEL_IFRAME_CSP_CHANGED');
  const map=new Map(LICENSE_PATHS);
  if(!Array.isArray(manifest.bundledLicenses)||
    manifest.bundledLicenses.length!==LICENSE_PATHS.length)
   add('MISSING_BUNDLED_LICENSE_EVIDENCE');
  for(const [path,token]of LICENSE_PATHS){
   const listed=manifest.bundledLicenses?.find(x=>x.path===path);
   if(!listed||listed.expectedEvidence!==token||
    typeof sourceFiles[path]!=='string'||!sourceFiles[path].includes(token))
    add('MISSING_BUNDLED_LICENSE_EVIDENCE');
  }
  const gen=manifest.localGenerator||{},raw=sourceFiles['docs/analysis/local-rewrite-model-manifest.json'];
  let research=null;
  try{research=JSON.parse(raw);}
  catch{add('LOCAL_GENERATOR_MANIFEST_UNREADABLE');}
  if(gen.productionDefault!==null||research?.productionDefault!==null||
   gen.realModelVerified!==false) add('UNAPPROVED_GENERATOR_ACTIVE');
  if(gen.candidateId!==CANDIDATE||gen.candidateRevision!==CANDIDATE_REV||
   research?.candidates?.[0]?.modelId!==CANDIDATE||
   research?.candidates?.[0]?.immutableRevision!==CANDIDATE_REV)
   add('LOCAL_GENERATOR_CANDIDATE_PIN_MISMATCH');
  if(gen.convertedLicenseStatus!=='UNVERIFIED')add('UNVERIFIED_LICENSE_ATTESTATION');
  add('GENERATOR_CONVERTED_LICENSE_UNVERIFIED');
  if(gen.binaryHashStatus!=='DECLARED_RESEARCH_METADATA_NOT_DOWNLOADED')
   add('UNVERIFIED_MODEL_HASH_ATTESTATION');
  if(!Array.isArray(manifest.notes)||manifest.scientificDeploymentAllowed!==false)
   add('UNSUPPORTED_SECURITY_RELEASE_STATE');
  return Object.freeze({
   ok:violations.size===0,
   modelIdentityPinned,
   runtimeIntegrityVerified,
   deploymentAllowed:false,
   violations:Object.freeze([...violations].sort())
  });
 }
 return Object.freeze({verifyModelManifest});
});
