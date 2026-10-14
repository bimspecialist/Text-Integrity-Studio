/* Local rewriting Worker bridge. No remote inference, automatic downloads or source logging.
 * A real generation Worker may only be enabled after the separately verified model gate.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISLocalRewriteBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CHANNEL='TIS_LOCAL_REWRITE_V1';
 const STYLES=new Set(['natural','clearer','shorter','longer']);
 function createLocalRewriteBridge({runtimeOrigin,locationOrigin,workerUrl,registry,session,
  workerFactory=url=>new Worker(url,{type:'module'}),onEvent=()=>{},timeouts={}}={}){
  if(!session||typeof session.read!=='function'||typeof session.subscribe!=='function'||
   typeof registry?.validateConsent!=='function'||typeof workerFactory!=='function')
   throw new TypeError('INVALID_BRIDGE_DEPENDENCIES');
  const pageOrigin=new URL(locationOrigin||(typeof location!=='undefined'?location.origin:'http://localhost')).origin;
  const allowed=new URL(runtimeOrigin||pageOrigin).origin;
  let url;
  try{url=new URL(workerUrl,allowed);}
  catch{throw new TypeError('INVALID_WORKER_URL');}
  if(allowed!==pageOrigin||url.origin!==allowed||!url.pathname.endsWith('/analysis/local-rewriter-worker.js')||
   url.username||url.password||url.search||url.hash)throw new TypeError('WORKER_URL_ORIGIN_NOT_ALLOWED');
  let worker=null,instanceId='',seq=0,disposed=false,loaded=null,pending=null;
  let status='NOT_REQUESTED';
  const now=()=>Date.now();
  function announce(value){status=value;onEvent(Object.freeze({status:value}));}
  function finish(result,error){
   if(!pending)return;
   const p=pending;pending=null;clearTimeout(p.timer);
   if(error)p.reject(Error(error));else p.resolve(result);
  }
  function abortPending(reason){
   if(!pending)return;
   const p=pending;pending=null;clearTimeout(p.timer);
   p.resolve(Object.freeze({status:reason}));
  }
  function stop(reason='CANCELLED'){
   abortPending(reason);
   if(worker){worker.terminate();worker=null;}
   loaded=null;instanceId='';
   announce(reason);
  }
  const unsubscribe=session.subscribe(snapshot=>{
   if(pending&&pending.documentRevision!==null&&pending.documentRevision!==snapshot.revision)stop('STALE');
  });
  function attach(){
   if(worker)return;
   worker=workerFactory(url.href);
   instanceId='tis-'+String(++seq)+'-'+now();
   const thisWorker=worker,thisInstance=instanceId;
   worker.onmessage=event=>{
    if(disposed||worker!==thisWorker||!pending)return;
    const m=event?.data;
    if(!m||m.channel!==CHANNEL||m.instanceId!==thisInstance||
     m.jobId!==pending.jobId||m.documentRevision!==pending.documentRevision||
     m.modelId!==pending.modelId||m.revision!==pending.revision)return;
    if(m.kind==='ERROR'){
     finish(null,'WORKER_ERROR');announce('ERROR');return;
    }
    if(pending.kind==='LOAD'&&m.kind==='READY'){
     loaded=Object.freeze({modelId:m.modelId,revision:m.revision});
     finish({status:'MODEL_READY'});announce('MODEL_READY');return;
    }
    if(pending.kind==='GENERATE'&&m.kind==='RESULT'){
     if(session.read().revision!==pending.documentRevision){stop('STALE');return;}
     if(!Array.isArray(m.payload?.chunks)||
      m.payload.chunks.length!==pending.expectedIds.length||
      m.payload.chunks.some((c,i)=>c?.id!==pending.expectedIds[i]||typeof c.text!=='string')){
      finish(null,'INVALID_GENERATION_RESULT');announce('ERROR');return;
     }
     const chunks=m.payload.chunks.map(c=>Object.freeze({id:c.id,text:c.text}));
     finish(Object.freeze({status:'COMPLETED',chunks:Object.freeze(chunks)}));
     announce('MODEL_READY');
    }
   };
   worker.onerror=()=>{finish(null,'WORKER_ERROR');stop('ERROR');};
  }
  function start({kind,jobId,documentRevision,modelId,revision,payload,timeoutMs,expectedIds=[]}){
   if(disposed)throw Error('DISPOSED');
   if(pending)throw Error('BUSY');
   attach();
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{finish(null,'WORKER_TIMEOUT');stop('ERROR');},timeoutMs);
    pending={kind,jobId,documentRevision,modelId,revision,expectedIds,resolve,reject,timer};
    try{worker.postMessage({channel:CHANNEL,instanceId,kind,jobId,documentRevision,
     modelId,revision,payload});}
    catch{finish(null,'WORKER_ERROR');stop('ERROR');}
   });
  }
  async function load({consentToken,modelId,revision}={}){
   if(disposed)throw Error('DISPOSED');
   if(!registry.validateConsent(consentToken,{modelId,revision}))throw Error('CONSENT_OR_MODEL_NOT_VERIFIED');
   if(loaded?.modelId===modelId&&loaded?.revision===revision)return {status:'MODEL_READY'};
   if(worker)stop('CANCELLED');
   announce('LOADING');
   return start({kind:'LOAD',jobId:'load',documentRevision:null,modelId,revision,payload:{},
    timeoutMs:timeouts.loadMs||30000});
  }
  function generate({jobId,documentRevision,chunks,style='natural'}={}){
   if(!loaded)throw Error('MODEL_NOT_READY');
   if(!STYLES.has(style)||typeof jobId!=='string'||!jobId||
    !Number.isSafeInteger(documentRevision)||!Array.isArray(chunks)||!chunks.length||
    chunks.some(c=>typeof c?.id!=='string'||typeof c?.text!=='string'||
     !Number.isSafeInteger(c.start)||!Number.isSafeInteger(c.end)||c.start<0||c.end<c.start))
    throw new TypeError('INVALID_GENERATION_REQUEST');
   if(session.read().revision!==documentRevision)return Promise.resolve({status:'STALE'});
   announce('GENERATING');
   return start({kind:'GENERATE',jobId,documentRevision,modelId:loaded.modelId,
    revision:loaded.revision,payload:{chunks,style},
    expectedIds:chunks.map(c=>c.id),timeoutMs:timeouts.generateMs||180000});
  }
  function cancel(jobId){
   if(!pending||pending.kind!=='GENERATE'||pending.jobId!==jobId)return false;
   stop('CANCELLED');return true;
  }
  function dispose(){if(disposed)return;disposed=true;stop();unsubscribe();}
  return Object.freeze({load,generate,cancel,dispose,getState:()=>Object.freeze({status,modelReady:!!loaded})});
 }
 return Object.freeze({createLocalRewriteBridge});
});
