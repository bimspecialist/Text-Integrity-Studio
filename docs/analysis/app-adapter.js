/* Text Integrity Studio — one browser AnalysisController attached to one editor.
 * Keeps legacy visual presenters and file tooling while removing their
 * authority to start, cancel or accept unverified detector inference.
 */
(function(root){
 'use strict';
 function attach({source,scanButton,fileInput,resultsRoot}={}){
  const el=id=>document.getElementById(id);
  if(!source||!scanButton||!resultsRoot||
   !root.TISDocumentSession||!root.TISEligibilityPolicy||
   !root.TISEvidenceContract||!root.TISInferenceBridge||
   !root.TISAnalysisController||!root.TISAiPresenter)
   throw new Error('Path A analysis dependencies not loaded');
  const presenter=root.TISAiPresenter;
  const session=root.TISDocumentSession.createDocumentSession(source.value);
  let pendingSourceKind=null,rawResult=null,lastProgress=null,presentedId=null,disposed=false;
  let humanizeView=null,pendingBeforeEdit=null;
  const dict=()=>{
   const ar=document.documentElement.lang==='ar';
   return {expired:ar?'تغيّر النص. أعد الفحص للنسخة الحالية.':'The text changed. Analyze this version again.'};
  };
  function inferKind(file){
   const name=(file?.name||'').toLowerCase();
   if(name.endsWith('.docx'))return 'docx';
   if(name.endsWith('.pdf'))return 'pdf';
   if(/\.(txt|md|csv|json)$/u.test(name))return 'txt';
   return 'paste';
  }
  function syncSource(kind){
   if(disposed)return;
   const current=session.read();
   if(source.value!==current.text||kind&&kind!==current.sourceKind){
    session.replaceText(source.value,kind||current.sourceKind);
   }
  }
  const sameOriginAvailable=/^https?:\/\//u.test(location.origin);
  // The editor and Word tools also run from file:// previews. Never crash
  // those offline pages or try to create a model iframe at opaque origins.
  const bridge=sameOriginAvailable?
   root.TISInferenceBridge.createInferenceBridge({
    documentObject:document,origin:location.origin,
    container:resultsRoot,src:'ai-runtime.html',
    onEvent:event=>{
     // A result cannot be accepted when the actual textarea has changed.
     syncSource();
     if(event.op==='RESULT')rawResult={id:event.requestId,raw:event.payload?.result};
     if(event.op==='PROGRESS')lastProgress=event.payload;
    }
   }):
   Object.freeze({run:()=>false,cancel:()=>false,subscribe:()=>()=>{},dispose:()=>{}});

  function showState(state){
   if(disposed)return;
   if(state.status==='EMPTY'||state.status==='READY'){
    presentedId=null;rawResult=null;lastProgress=null;
    presenter.clear();return;
   }
   if(state.status==='STALE'){
    presentedId=null;rawResult=null;lastProgress=null;
    presenter.clear(dict().expired);return;
   }
   if(state.status==='WRITING_ONLY'||state.status==='UNSUPPORTED'){
    presentedId=null;rawResult=null;
    presenter.presentUnsupported(state.eligibleReason);
    if(pendingBeforeEdit){
     humanizeView?.showComparison({comparable:false,reason:'NO_VALID_SCORE',differencePoints:null});
     pendingBeforeEdit=null;
    }
    return;
   }
   if(state.status==='LOADING'||state.status==='ANALYZING'){
    if(presentedId!==state.requestId){
     presentedId=state.requestId;rawResult=null;lastProgress=null;
     presenter.presentLoading();
    }else{
     presenter.presentProgress({
      stage:lastProgress?.stage||state.stage||'LOADING',
      percent:Number.isFinite(lastProgress?.percent)?Math.max(0,Math.min(100,lastProgress.percent)):null,
      model:lastProgress?.model||null
     });
    }
    return;
   }
   if(state.status==='RESEARCH_SIGNAL'||state.status==='INCONCLUSIVE'){
    const match=rawResult&&rawResult.id===state.requestId?rawResult.raw:null;
    if(match&&state.revision===session.read().revision){
     presenter.presentVerified(match,session.read().text);
    }else presenter.presentError('UNVERIFIED_MODEL_LABEL');
    if(pendingBeforeEdit){
     humanizeView?.showComparison(root.TISScanComparison?.compareSignals(
      pendingBeforeEdit,state.evidence
     )||{comparable:false,reason:'NO_VALID_SCORE',differencePoints:null});
     pendingBeforeEdit=null;
    }
    rawResult=null;lastProgress=null;presentedId=null;return;
   }
   if(state.status==='ERROR'){
    rawResult=null;lastProgress=null;presentedId=null;
    presenter.presentError(state.errorCode||'MODEL_UNAVAILABLE');
    if(pendingBeforeEdit){
     humanizeView?.showComparison({comparable:false,reason:'NO_VALID_SCORE',differencePoints:null});
     pendingBeforeEdit=null;
    }
    return;
   }
   if(state.status==='CANCELLED'){
    rawResult=null;lastProgress=null;presentedId=null;
    presenter.presentCancelled();
   }
  }
  const controller=root.TISAnalysisController.createAnalysisController({
   session,policy:root.TISEligibilityPolicy,bridge,
   validator:root.TISEvidenceContract,onState:showState,
   onWritingReview:()=>{
    el('scan')?.click();
    humanizeView?.refresh();
   }
  });
  const review=root.TISEditorialReview?.createEditorialReview({
   session,advisor:root.TISNaturalWritingAdvisor
  })||null;
  const humanizeRoot=el('humanizeSuggestions');
  if(review&&humanizeRoot&&root.TISHumanizeUI?.mount){
   humanizeView=root.TISHumanizeUI.mount({
    root:humanizeRoot,session,review,controller,
    locale:()=>document.documentElement.lang,
    onApplied:validated=>{
     // Only source-independent evidence from a genuinely completed scan
     // may be compared after a later, separately initiated Analyze Text.
     pendingBeforeEdit=validated?.kind==='RESEARCH_SIGNAL'?validated:null;
    },
    onUndoApplied:()=>{pendingBeforeEdit=null;}
   });
  }
  function analyze(){
   syncSource();
   return controller.analyze({
    deep:el('aiDeep')?.checked===true,
    full:el('aiFullScan')?.checked===true,
    context:el('aiContext')?.value||'general'
   });
  }
  function toggle(){
   const s=controller.getState();
   if(['LOADING','ANALYZING'].includes(s.status))return controller.cancel();
   return analyze();
  }
  function onInput(event){
   const kind=event.isTrusted?'paste':pendingSourceKind||session.read().sourceKind;
   syncSource(kind);
   pendingSourceKind=null;
  }
  function onFile(){
   pendingSourceKind=inferKind(fileInput?.files?.[0]);
   // Invalidate old evidence *on selection*, before asynchronous PDF/Word parsing.
   syncSource(pendingSourceKind);
  }
  source.addEventListener('input',onInput);
  fileInput?.addEventListener('change',onFile);
  const onUnload=()=>dispose();
  root.addEventListener('pagehide',onUnload,{once:true});
  function dispose(){
   if(disposed)return;
   disposed=true;
   source.removeEventListener('input',onInput);
   fileInput?.removeEventListener('change',onFile);
   root.removeEventListener('pagehide',onUnload);
   humanizeView?.dispose();
   controller.dispose();
  }
  return Object.freeze({controller,session,review,analyze,toggle,cancel:()=>controller.cancel(),dispose});
 }
 function setup(){
  if(!document.getElementById('source'))return;
  root.TISAnalysisApp=attach({
   source:document.getElementById('source'),
   scanButton:document.getElementById('scanAI'),
   fileInput:document.getElementById('file'),
   resultsRoot:document.getElementById('aiMeter')
  });
 }
 root.TISAnalysisAppFactory=Object.freeze({attach});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})(typeof globalThis!=='undefined'?globalThis:this);
