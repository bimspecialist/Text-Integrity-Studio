/* User-reviewed on-device rewrite draft lifecycle.
 * Pure controller: a verified local Worker must be supplied separately.
 * Never auto-edits, downloads model assets or invokes any remote inference.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISLocalRewriteController=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_HISTORY=15;
 const styles=new Set(['natural','clearer','shorter','longer']);
 function createLocalRewriteController({session,bridge,registry,capability,planner,integrity,
  manifest=null,deviceInfo={},navigatorInfo={}}={}){
  if(typeof session?.read!=='function'||typeof session?.replaceText!=='function'||
   typeof session?.subscribe!=='function'||typeof bridge?.load!=='function'||
   typeof bridge?.generate!=='function'||typeof bridge?.cancel!=='function'||
   typeof registry?.select!=='function'||typeof capability?.assess!=='function'||
   typeof planner?.plan!=='function'||typeof integrity?.compareRewrite!=='function')
   throw new TypeError('INCOMPLETE_REWRITE_CONTROLLER_DEPENDENCIES');
  let status='NOT_REQUESTED',disposed=false,epoch=0,activeJob=null;
  let draft=[],sourceSnapshot=null,plan=null,ownWrite=false,history=[];
  const signal=code=>Object.freeze({status:code});
  function invalidate(reason){
   ++epoch;
   if(activeJob){bridge.cancel(activeJob);activeJob=null;}
   draft=[];sourceSnapshot=null;plan=null;
   status=reason;
  }
  const unsubscribe=session.subscribe(()=>{
   if(ownWrite||disposed)return;
   invalidate('STALE');history=[];
  });
  function ensure(){if(disposed)throw Error('DISPOSED');}
  function getState(){
   return Object.freeze({status,documentRevision:sourceSnapshot?.revision??null,
    chunks:draft.length,coveredCharacters:plan?.sourceCoverage?.coveredCharacters??null,
    totalCharacters:plan?.sourceCoverage?.totalCharacters??null});
  }
  function getDraftChunks(){return Object.freeze(draft.map(c=>Object.freeze({
   id:c.id,start:c.start,end:c.end,original:c.original,proposed:c.proposed,
   approved:c.approved,flags:Object.freeze([...c.flags])
  })));}
  async function requestRewrite({language,style='natural',consentToken,deviceProfile=null,
   tokenBudget={}}={}){
   ensure();
   if(activeJob)throw Error('REWRITE_ALREADY_RUNNING');
   if(!styles.has(style)||!['en','ar'].includes(language))throw new TypeError('INVALID_REWRITE_MODE');
   invalidate('CAPABILITY_CHECK');
   const startEpoch=epoch,source=session.read();
   const eligible=capability.assess({manifest,deviceInfo,navigatorInfo});
   if(eligible?.supported!==true){status='MODEL_UNAVAILABLE';return signal(status);}
   const model=registry.select({language,deviceProfile:deviceProfile||eligible.deviceProfile});
   if(!model||model.blockedReason){status='MODEL_UNAVAILABLE';return signal(status);}
   if(typeof consentToken!=='string'||!consentToken){status='CONSENT_REQUIRED';return signal(status);}
   let proposedPlan;
   try{proposedPlan=planner.plan(source,tokenBudget);}
   catch{status='ERROR';return signal(status);}
   if(!Array.isArray(proposedPlan?.chunks)||!proposedPlan.chunks.length||
    !proposedPlan.sourceCoverage||!Array.isArray(proposedPlan.uncoveredSpans)){
    status='ERROR';return signal(status);
   }
   const total=source.text.length;
   if(proposedPlan.sourceCoverage.totalCharacters!==total||
    !Number.isSafeInteger(proposedPlan.sourceCoverage.coveredCharacters)||
    proposedPlan.sourceCoverage.coveredCharacters>total){
    status='ERROR';return signal(status);
   }
   const selected=proposedPlan.chunks;
   let cursor=0;
   for(const c of selected){
    if(typeof c.id!=='string'||c.start!==cursor||!Number.isSafeInteger(c.end)||
     c.end<cursor||c.end>total||c.text!==source.text.slice(cursor,c.end)){
     status='ERROR';return signal(status);
    }
    cursor=c.end;
   }
   const incomplete=proposedPlan.status!=='COMPLETE'||cursor!==total||
    proposedPlan.uncoveredSpans.length>0||
    proposedPlan.sourceCoverage.coveredCharacters!==total;
   const jobId='rewrite-'+String(startEpoch);
   activeJob=jobId;
   try{
    status='MODEL_READY';
    await bridge.load({consentToken,modelId:model.modelId,revision:model.revision});
    if(epoch!==startEpoch)return signal(status);
    if(session.read().revision!==source.revision){invalidate('STALE');return signal(status);}
    status='GENERATING';
    const output=await bridge.generate({jobId,documentRevision:source.revision,
     chunks:selected,style});
    if(epoch!==startEpoch)return signal(status);
    if(session.read().revision!==source.revision){invalidate('STALE');return signal(status);}
    if(output?.status!=='COMPLETED'){
     status=output?.status==='CANCELLED'?'CANCELLED':'ERROR';return signal(status);
    }
    if(!Array.isArray(output.chunks)||output.chunks.length!==selected.length||
     output.chunks.some((c,i)=>c.id!==selected[i].id||typeof c.text!=='string')){
     status='ERROR';return signal(status);
    }
    draft=selected.map((c,i)=>({
     id:c.id,start:c.start,end:c.end,original:c.text,
     proposed:output.chunks[i].text,approved:false,
     flags:integrity.compareRewrite(c.text,output.chunks[i].text,{locale:language}).flags
    }));
    sourceSnapshot=source;plan=proposedPlan;
    status=incomplete?'PARTIAL':'DRAFT_READY';
    return signal(status);
   }catch{
    if(epoch===startEpoch)status='ERROR';
    return signal(status);
   }finally{
    if(activeJob===jobId)activeJob=null;
   }
  }
  function approveChunk(id){
   ensure();
   if(!sourceSnapshot||session.read().revision!==sourceSnapshot.revision)
    return {approved:false,reason:'STALE_REVISION'};
   const c=draft.find(x=>x.id===id);
   if(!c)return {approved:false,reason:'NOT_FOUND'};
   if(c.flags.includes('PROTECTED_FACT_CHANGED')||c.flags.includes('UNVERIFIED_PERSONAL_CLAIM'))
    return {approved:false,reason:'PROTECTED_CHANGE'};
   c.approved=true;status=plan?.status==='COMPLETE'?'REVIEWING':'PARTIAL';
   return {approved:true};
  }
  function acceptReviewed(){
   ensure();
   const source=session.read();
   if(!sourceSnapshot||source.revision!==sourceSnapshot.revision||
    source.text!==sourceSnapshot.text)return {accepted:false,reason:'STALE_REVISION'};
   if(source.sourceKind==='docx')return {accepted:false,reason:'WORD_READ_ONLY'};
   if(plan.status!=='COMPLETE'||plan.uncoveredSpans.length||
    plan.sourceCoverage.coveredCharacters!==source.text.length)
    return {accepted:false,reason:'PARTIAL_COVERAGE'};
   if(!draft.length||draft.some(c=>!c.approved))return {accepted:false,reason:'REVIEW_REQUIRED'};
   const revised=draft.map(c=>c.proposed).join('');
   if(revised===source.text)return {accepted:false,reason:'NO_CHANGE'};
   ownWrite=true;
   let update;
   try{update=session.replaceText(revised,source.sourceKind);}
   finally{ownWrite=false;}
   history.push({beforeText:source.text,beforeKind:source.sourceKind,
    afterRevision:update.revision,afterText:update.text});
   if(history.length>MAX_HISTORY)history.shift();
   draft=[];sourceSnapshot=null;plan=null;status='ACCEPTED';
   return {accepted:true,snapshot:update};
  }
  function undo(){
   ensure();
   const previous=history[history.length-1];
   if(!previous)return {restored:false,reason:'NO_HISTORY'};
   const now=session.read();
   if(now.revision!==previous.afterRevision||now.text!==previous.afterText){
    history=[];return {restored:false,reason:'STALE_REVISION'};
   }
   history.pop();ownWrite=true;let restored;
   try{restored=session.replaceText(previous.beforeText,previous.beforeKind);}
   finally{ownWrite=false;}
   const prior=history[history.length-1];
   if(prior&&prior.afterText===restored.text)prior.afterRevision=restored.revision;
   draft=[];sourceSnapshot=null;plan=null;status='ACCEPTED';
   return {restored:true,snapshot:restored};
  }
  function cancel(){
   ensure();
   if(!activeJob)return false;
   invalidate('CANCELLED');return true;
  }
  function dispose(){if(disposed)return;invalidate('CANCELLED');disposed=true;
   unsubscribe();history=[];bridge.dispose?.();}
  return Object.freeze({requestRewrite,approveChunk,acceptReviewed,undo,cancel,
   getState,getDraftChunks,dispose});
 }
 return Object.freeze({createLocalRewriteController});
});
