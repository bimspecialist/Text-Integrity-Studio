'use strict';
/* S3: no performance improvements may be claimed without like-for-like,
 * real-model, repeatable source-backed measurements.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {comparePerf,validatePerfRecord}=require('../../docs/analysis/performance-budget.js');
const schema=JSON.parse(fs.readFileSync('docs/research/performance-baseline-schema.json','utf8'));
const base=()=>({
 version:'before-S3',commitSha:'a'.repeat(40),
 modelRevisions:{primary:'b9aa251e5bcda7e429fcc936767d921435945b60',secondary:null},
 deviceProfile:{platform:'Linux',viewport:'1440x900',cpuThrottle:1},
 browserVersion:'Chrome/154.0.0.0',networkProfile:'unthrottled',
 documentWordCount:150,documentCharacterCount:1200,
 coldStart:true,downloadBytesIfObserved:108000000,
 medianMs:3000,p95Ms:4800,peakHeapBytesIfAvailable:145000000,
 measurementMethod:'CHROMIUM_REAL_ONNX',sampleMode:'REAL_MODEL',
 runs:20,notes:'Confirmed first-party browser benchmark',
});
(function schemaIsMetadataOnly(){
 assert.equal(schema.additionalProperties,false);
 assert(schema.required.includes('measurementMethod'));
 assert(!schema.properties.documentText);
 assert(!schema.properties.sourceText);
 assert(!schema.properties.rawSamples);
})();
(function unknownBaselineIsNotPass(){
 const x=comparePerf(null,base());
 assert.equal(x.pass,false);
 assert.equal(x.status,'NO_BASELINE');
 assert(x.reasons.includes('NO_BASELINE'));
})();
(function matchingMeasurementsPassOnlyIfActual(){
 const x=comparePerf(base(),{...base(),version:'after-S3',commitSha:'b'.repeat(40),
  medianMs:3100,p95Ms:4850,peakHeapBytesIfAvailable:146000000});
 assert.equal(x.status,'PASS');
 assert.equal(x.pass,true);
 assert(x.comparisons.medianMs.regressionRatio>1);
 assert(x.comparisons.p95Ms.regressionRatio>1);
})();
(function contextMismatchBlocksComparability(){
 const changes=[
  {deviceProfile:{platform:'Windows',viewport:'1440x900',cpuThrottle:1}},
  {browserVersion:'Chrome/153.0.0.0'},
  {networkProfile:'offline-cache'},
  {documentWordCount:2000},
  {documentCharacterCount:1300},
  {coldStart:false},
  {modelRevisions:{primary:'c'.repeat(40),secondary:null}},
  {sampleMode:'NON_REAL_PERFORMANCE'},
  {measurementMethod:'CHROMIUM_LOCAL_STUB'},
 ];
 for(const change of changes){
  const report=comparePerf(base(),{...base(),version:'candidate',...change});
  assert.equal(report.pass,false,JSON.stringify(change));
  assert(report.reasons.includes('NOT_COMPARABLE')||report.reasons.includes('NON_REAL_PERFORMANCE'));
 }
})();
(function twentyOnePercentRegressionIsBlocking(){
 const median=comparePerf(base(),{...base(),medianMs:3631});
 assert.equal(median.pass,false);
 assert(median.reasons.includes('MEDIAN_REGRESSION_OVER_BUDGET'));
 const p95=comparePerf(base(),{...base(),p95Ms:5810});
 assert.equal(p95.pass,false);
 assert(p95.reasons.includes('P95_REGRESSION_OVER_BUDGET'));
 assert.equal(p95.comparisons.medianMs.regressionRatio,1);
 assert(p95.comparisons.p95Ms.regressionRatio>1.20);
})();
(function memoryUnknownCannotTurnIntoFakeReady(){
 const noHeap=comparePerf(base(),{...base(),peakHeapBytesIfAvailable:null});
 assert.equal(noHeap.pass,false);
 assert.equal(noHeap.status,'RESOURCE_UNKNOWN');
 assert(noHeap.reasons.includes('PEAK_HEAP_UNKNOWN'));
 const regression=comparePerf(base(),{...base(),peakHeapBytesIfAvailable:190000000});
 assert.equal(regression.pass,false);
 assert(regression.reasons.includes('PEAK_HEAP_REGRESSION_OVER_BUDGET'));
})();
(function syntheticSamplesCannotProveRealModelSpeed(){
 const simulated=base();
 simulated.sampleMode='NON_REAL_PERFORMANCE';
 simulated.measurementMethod='CHROMIUM_LOCAL_STUB';
 simulated.downloadBytesIfObserved=null;
 simulated.peakHeapBytesIfAvailable=null;
 const check=validatePerfRecord(simulated);
 assert.equal(check.ok,true,'valid descriptive stub measurements may be retained');
 assert.equal(check.realModelObserved,false);
 assert.equal(comparePerf(simulated,simulated).pass,false);
})();
(function invalidEvidenceIsRejected(){
 for(const invalid of [
  {runs:0},{medianMs:-5},{p95Ms:1500},{downloadBytesIfObserved:-1},
  {documentCharacterCount:0},{medianMs:NaN},{notes:'PRIVATE_USER_DOCUMENT_SENTINEL'},
  {rawSamples:['user text']},{sampleMode:'PRODUCTION_VERIFIED'},
  {peakHeapBytesIfAvailable:0},
 ]){
  const report=validatePerfRecord({...base(),...invalid});
  assert.equal(report.ok,false,JSON.stringify(invalid));
 }
})();
console.log('PASS S3: source-backed noncomparable perf, p95/median/memory budgets and research-only fixtures');
