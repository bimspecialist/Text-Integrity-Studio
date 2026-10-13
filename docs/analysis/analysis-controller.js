/* Text Integrity Studio — one revision-safe analysis lifecycle.
 * Detector transport, UI and immutable source are separate responsibilities.
 * Controller state never contains private document text or generated excerpts.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISAnalysisController=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const INIT_TIMEOUT=30000,INACTIVITY_TIMEOUT=180000,ABSOLUTE_TIMEOUT=540000;
 function createAnalysisController({
  session,policy,bridge,validator,onState=()=>{},onWritingReview=()=>{},
  clock={now:()=>Date.now(),setTimeout:(fn,ms)=>setTimeout(fn,ms),
   clearTimeout:id=>clearTimeout(id)}
 }={}){
  if(!session||typeof session.read!=='function'||typeof session.subscribe!=='function'||
   !policy||typeof policy.assess!=='function'||
   !bridge||typeof bridge.run!=='function'||typeof bridge.cancel!=='function'||
   typeof bridge.subscribe!=='function'||
   !validator||typeof validator.validateEvidence!=='function'||
   typeof onState!=='function'||typeof onWritingReview!=='function'||
   typeof clock.now!=='function'||typeof clock.setTimeout!=='function'||
   typeof clock.clearTimeout!=='function')
   throw new TypeError('Incomplete analysis controller dependencies');
  let counter=0,active=null,disposed=false;
  let readinessTimer=null,inactivityTimer=null,absoluteTimer=null;
  const initial=session.read();
  let state=Object.freeze({
   status:initial.text.trim()?'READY':'EMPTY',
   requestId:null,revision:initial.revision,signal:null,
   eligibleReason:null,stage:null,errorCode:null,evidence:null
  });
  function publish(next){
   state=Object.freeze({...next});
   onState(state);
  }
  function change(patch){
   publish({...state,...patch});
  }
  function clearTimers(){
   for(const id of [readinessTimer,inactivityTimer,absoluteTimer]){
    if(id!==null)clock.clearTimeout(id);
   }
   readinessTimer=null;inactivityTimer=null;absoluteTimer=null;
  }
  function terminalError(code,shouldCancel=false){
   if(!active||disposed)return;
   const id=active.id;
   clearTimers();
   active=null;
   change({status:'ERROR',requestId:id,signal:null,evidence:null,
    stage:null,errorCode:code||'MODEL_UNAVAILABLE'});
   if(shouldCancel)bridge.cancel(id);
  }
  function armInactivity(id){
   if(inactivityTimer!==null)clock.clearTimeout(inactivityTimer);
   inactivityTimer=clock.setTimeout(()=>{
    if(active&&active.id===id)terminalError('MODEL_TIMEOUT',true);
   },INACTIVITY_TIMEOUT);
  }
  function onBridgeEvent(event){
   if(disposed||!active||!event||event.requestId!==active.id)return;
   if(session.read().revision!==active.snapshot.revision)return;
   const id=active.id;
   if(event.op==='READY'){
    if(readinessTimer!==null)clock.clearTimeout(readinessTimer);
    readinessTimer=null;
    armInactivity(id);
   }else if(event.op==='PROGRESS'){
    const stage=typeof event.payload?.stage==='string'?event.payload.stage:'LOADING';
    armInactivity(id);
    change({status:stage==='ANALYZING'?'ANALYZING':'LOADING',stage});
   }else if(event.op==='RESULT'){
    const running=active;
    clearTimers();
    active=null;
    let validated;
    try{
     validated=validator.validateEvidence(event.payload?.result,running.snapshot,{
      requestId:running.id,revision:running.snapshot.revision,
      expectedPrimaryId:validator.PRIMARY_ID,
      expectedPrimaryRevision:validator.PRIMARY_REV,
      ...(running.options.deep?{
       expectedSecondaryId:validator.SECONDARY_ID,
       expectedSecondaryRevision:validator.SECONDARY_REV
      }:{}),
      scanOptions:running.options
     });
    }catch{
     terminalBadEvidence(id,'THREW');
     return;
    }
    if(!validated?.ok){
     terminalBadEvidence(id,validated?.code||'REJECTED');
     return;
    }
    const outcome=validated.outcome;
    change({status:outcome.kind,requestId:id,signal:outcome.signal,
     evidence:outcome,stage:null,errorCode:null,eligibleReason:null});
   }else if(event.op==='ERROR'){
    terminalError(typeof event.payload?.code==='string'?event.payload.code:'MODEL_UNAVAILABLE');
   }else if(event.op==='CANCELLED'){
    // An external bridge cancellation is authoritative, but an old
    // post-cancel response cannot revive a newer document analysis.
    clearTimers();active=null;
    change({status:'CANCELLED',signal:null,evidence:null,stage:null,errorCode:null});
   }
  }
  function terminalBadEvidence(id,reason){
   change({status:'ERROR',requestId:id,signal:null,evidence:null,stage:null,
    errorCode:'INVALID_EVIDENCE_'+reason});
  }
  const unsubscribeBridge=bridge.subscribe(onBridgeEvent);
  const unsubscribeSession=session.subscribe(snapshot=>{
   if(disposed)return;
   const stale=active;
   clearTimers();active=null;
   if(stale)bridge.cancel(stale.id);
   change({status:'STALE',requestId:null,revision:snapshot.revision,
    signal:null,evidence:null,stage:null,errorCode:null,eligibleReason:null});
  });
  function analyze({deep=false,full=false,context='general'}={}){
   if(disposed||active)return false;
   const snapshot=session.read();
   const decision=policy.assess(snapshot.text,snapshot.sourceKind);
   if(snapshot.text.trim()){
    try{onWritingReview(snapshot);}
    catch{
     // Editorial suggestions are optional; an error must not manufacture
     // a model score or leak the local document into diagnostics.
    }
   }
   if(!decision.eligible){
    change({status:decision.reason==='NO_TEXT'?'EMPTY':
     ['UNSUPPORTED_LANGUAGE','UNSUPPORTED_FORMAT'].includes(decision.reason)?
     'UNSUPPORTED':'WRITING_ONLY',
     requestId:null,revision:snapshot.revision,signal:null,evidence:null,
     eligibleReason:decision.reason,stage:null,errorCode:null});
    return false;
   }
   const id='tis-'+String(++counter)+'-'+String(clock.now());
   const options={deep:deep===true,full:full===true,context:String(context||'general')};
   active={id,snapshot,options};
   change({status:'LOADING',requestId:id,revision:snapshot.revision,
    signal:null,evidence:null,stage:'LOADING',errorCode:null,eligibleReason:null});
   readinessTimer=clock.setTimeout(()=>{
    if(active&&active.id===id)terminalError('RUNTIME_INIT_TIMEOUT',true);
   },INIT_TIMEOUT);
   absoluteTimer=clock.setTimeout(()=>{
    if(active&&active.id===id)terminalError('MODEL_TIMEOUT',true);
   },ABSOLUTE_TIMEOUT);
   let started=false;
   try{started=bridge.run(snapshot,options,id)===true;}
   catch{started=false;}
   if(!started){
    terminalError('MODEL_TRANSPORT_BUSY',true);
    return false;
   }
   return true;
  }
  function cancel(){
   if(disposed||!active)return false;
   const id=active.id;
   clearTimers();active=null;
   change({status:'CANCELLED',requestId:id,signal:null,evidence:null,
    stage:null,errorCode:null});
   bridge.cancel(id);
   return true;
  }
  function dispose(){
   if(disposed)return;
   const id=active?.id||null;
   disposed=true;active=null;
   clearTimers();
   if(id)bridge.cancel(id);
   unsubscribeSession();
   unsubscribeBridge();
   if(typeof bridge.dispose==='function')bridge.dispose();
  }
  publish(state);
  return Object.freeze({analyze,cancel,getState:()=>state,dispose});
 }
 return Object.freeze({createAnalysisController});
});
