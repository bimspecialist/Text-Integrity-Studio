/* Isolated local generation Worker entrypoint.
 * The local generative model is intentionally NOT shipped/verified yet.
 * This worker cannot make network requests or produce simulated rewrites.
 * L1/L8 independent license, binary pin, real WebGPU and quality gates
 * must pass before a real loader is introduced here.
 */
'use strict';
const CHANNEL='TIS_LOCAL_REWRITE_V1';
self.onmessage=event=>{
 const m=event?.data;
 if(!m||m.channel!==CHANNEL||m.kind!=='LOAD'||typeof m.instanceId!=='string')return;
 self.postMessage({
  channel:CHANNEL,instanceId:m.instanceId,jobId:m.jobId,
  documentRevision:m.documentRevision,modelId:m.modelId,revision:m.revision,
  kind:'ERROR',payload:{code:'MODEL_NOT_VERIFIED'}
 });
};
