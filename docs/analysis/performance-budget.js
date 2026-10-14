/* S3 reproducible evidence guard. Only matching, measured, real ONNX runs
 * may establish performance parity; a missing baseline cannot be guessed.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISPerformanceBudget=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FIELDS=[
  'version','commitSha','modelRevisions','deviceProfile','browserVersion',
  'networkProfile','documentWordCount','documentCharacterCount','coldStart',
  'downloadBytesIfObserved','medianMs','p95Ms','peakHeapBytesIfAvailable',
  'measurementMethod','sampleMode','runs','notes'
 ];
 const sha=/^[a-f0-9]{40}$/;
 const validInt=x=>Number.isSafeInteger(x);
 const positive=x=>Number.isFinite(x)&&x>0;
 const scalar=x=>typeof x==='string'&&x.length>0&&x.length<=140;
 function validatePerfRecord(record){
  const problems=[];
  const reject=c=>problems.push(c);
  if(!record||typeof record!=='object'||Array.isArray(record)){
   return Object.freeze({ok:false,realModelObserved:false,violations:['INVALID_RECORD']});
  }
  if(Object.keys(record).some(k=>!FIELDS.includes(k))||FIELDS.some(k=>!(k in record)))
   reject('INCOMPLETE_OR_PRIVATE_EVIDENCE');
  if(!scalar(record.version)||!sha.test(record.commitSha||''))reject('UNPINNED_BUILD');
  if(!record.modelRevisions||!sha.test(record.modelRevisions.primary||'')||
   !(record.modelRevisions.secondary===null||sha.test(record.modelRevisions.secondary||''))||
   Object.keys(record.modelRevisions).sort().join(',')!=='primary,secondary')reject('UNPINNED_MODELS');
  const dev=record.deviceProfile;
  if(!dev||!scalar(dev.platform)||!scalar(dev.viewport)||!positive(dev.cpuThrottle)||
   Object.keys(dev).sort().join(',')!=='cpuThrottle,platform,viewport')
   reject('UNVERIFIED_DEVICE_PROFILE');
  if(!scalar(record.browserVersion)||!scalar(record.networkProfile)||
   typeof record.coldStart!=='boolean')reject('MISSING_ENVIRONMENT');
  if(!validInt(record.documentWordCount)||record.documentWordCount<1||
   !validInt(record.documentCharacterCount)||record.documentCharacterCount<1||
   record.documentCharacterCount>120000)reject('INVALID_WORKLOAD_SIZE');
  if(!positive(record.medianMs)||!positive(record.p95Ms)||
   record.p95Ms<record.medianMs)reject('INVALID_LATENCY_DISTRIBUTION');
  if(!validInt(record.runs)||record.runs<1)reject('INVALID_REPETITIONS');
  if(record.downloadBytesIfObserved!==null&&
   (!validInt(record.downloadBytesIfObserved)||record.downloadBytesIfObserved<0))
   reject('INVALID_DOWNLOAD_BYTES');
  if(record.peakHeapBytesIfAvailable!==null&&
   (!validInt(record.peakHeapBytesIfAvailable)||record.peakHeapBytesIfAvailable<1))
   reject('INVALID_PEAK_HEAP');
  if(!['CHROMIUM_REAL_ONNX','CHROMIUM_LOCAL_STUB','CHROMIUM_EDITOR_NO_MODEL'].includes(record.measurementMethod)||
   !['REAL_MODEL','NON_REAL_PERFORMANCE'].includes(record.sampleMode))
   reject('INVALID_MEASUREMENT_CLASSIFICATION');
  if(typeof record.notes!=='string'||record.notes.length>300||
   /PRIVATE_USER_DOCUMENT|CONFIDENTIAL_|SOURCE_TEXT|PRIVATE_STUDENT_|RAW_SAMPLES/i.test(record.notes))
   reject('UNSAFE_FREEFORM_RESEARCH_NOTE');
  return Object.freeze({
   ok:problems.length===0,
   realModelObserved:record.sampleMode==='REAL_MODEL'&&record.measurementMethod==='CHROMIUM_REAL_ONNX'&&problems.length===0,
   violations:Object.freeze([...new Set(problems)])
  });
 }
 function comparePerf(baseline,candidate,{maxRegressionRatio=1.20}={}){
  const result=(status,reasons,comparisons={})=>Object.freeze({
   status,pass:status==='PASS',
   reasons:Object.freeze([...new Set(reasons)]),
   comparisons:Object.freeze(comparisons)
  });
  if(!baseline)return result('NO_BASELINE',['NO_BASELINE']);
  if(!candidate)return result('NO_CANDIDATE',['NO_CANDIDATE']);
  if(!Number.isFinite(maxRegressionRatio)||maxRegressionRatio<1)
   throw new RangeError('INVALID_PERFORMANCE_BUDGET');
  const b=validatePerfRecord(baseline),c=validatePerfRecord(candidate);
  if(!b.ok||!c.ok)return result('INVALID_EVIDENCE',[...b.violations,...c.violations]);
  if(!b.realModelObserved||!c.realModelObserved)
   return result('NON_REAL_PERFORMANCE',['NON_REAL_PERFORMANCE']);
  const comparableFields=[
   'modelRevisions','deviceProfile','browserVersion','networkProfile',
   'documentWordCount','documentCharacterCount','coldStart','measurementMethod'
  ];
  if(comparableFields.some(f=>JSON.stringify(baseline[f])!==JSON.stringify(candidate[f])))
   return result('NOT_COMPARABLE',['NOT_COMPARABLE']);
  const compared={};
  const reasons=[];
  for(const [field,error] of [
   ['medianMs','MEDIAN_REGRESSION_OVER_BUDGET'],
   ['p95Ms','P95_REGRESSION_OVER_BUDGET']
  ]){
   const ratio=candidate[field]/baseline[field];
   compared[field]=Object.freeze({baseline:baseline[field],candidate:candidate[field],regressionRatio:ratio});
   if(ratio>maxRegressionRatio)reasons.push(error);
  }
  if(baseline.peakHeapBytesIfAvailable===null||candidate.peakHeapBytesIfAvailable===null)
   reasons.push('PEAK_HEAP_UNKNOWN');
  else{
   const ratio=candidate.peakHeapBytesIfAvailable/baseline.peakHeapBytesIfAvailable;
   compared.peakHeapBytes=Object.freeze({
    baseline:baseline.peakHeapBytesIfAvailable,
    candidate:candidate.peakHeapBytesIfAvailable,regressionRatio:ratio
   });
   if(ratio>maxRegressionRatio)reasons.push('PEAK_HEAP_REGRESSION_OVER_BUDGET');
  }
  const status=reasons.some(x=>x.endsWith('_REGRESSION_OVER_BUDGET'))?'REGRESSION':
   reasons.includes('PEAK_HEAP_UNKNOWN')?'RESOURCE_UNKNOWN':'PASS';
  return result(status,reasons,compared);
 }
 return Object.freeze({comparePerf,validatePerfRecord});
});
