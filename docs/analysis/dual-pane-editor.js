/* V7 local dual-pane writing workspace.
 * Source remains canonical; draft stays in memory, never in storage or remote APIs.
 * This is MANUAL editing + H1 preview only, not a replacement for unverified
 * local generative inference. No model/Worker request is initiated here.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISDualPaneEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const modes=['detection','humanize','editor'];
 const ids={detection:'tisTabDetection',humanize:'tisTabHumanize',editor:'tisTabEditor'};
 const words={
  en:{
   group:'Workspace modes',detection:'AI Detection',humanize:'Humanize',editor:'Writing Editor',
   original:'Original text',revised:'Revised draft',before:'Before',after:'After',
   draftIntro:'Edit this local draft or preview a writing suggestion. Your original text stays unchanged until you apply.',
   idle:'The revised pane starts with a copy of the source. No rewrite has been generated.',
   untouched:'No draft changes to apply.',changed:'Local draft ready for your review. No text was changed automatically.',
   preview:'Suggestion preview only. Check the wording before applying.',
   stale:'The original text changed. Your draft was kept, but it cannot be applied until you reset it to the new version.',
   protected:'The draft changes a number, citation, measurement or URL. Review and edit the original manually.',
   docx:'DOCX source is read-only for this draft. Copy the draft and use the existing Word tools; the original remains intact.',
   reset:'Reset draft',restoreReset:'Restore discarded draft',copy:'Copy draft',apply:'Apply reviewed draft',undo:'Undo apply',
   restored:'Your discarded draft was restored. The original text is still unchanged.',
   applied:'Reviewed draft applied. Previous AI results are invalid until you choose Analyze Text again.',
   undone:'Previous text restored. Analyze Text again for new research evidence.',
   copied:'Draft copied to the clipboard.',copyError:'Clipboard is unavailable. Select and copy the draft manually.',
   safeMode:'Manual local editing only',generator:'Rewrite locally',generatorNotice:'Local generative rewriting is not yet available: a verified, licensed on-device model and real WebGPU tests are required. No cloud fallback.',
   discarded:'Draft reset from the latest original.',noChange:'Nothing changed.',noHistory:'No draft change to undo.',
   reviewFirst:'Review the changes in the revised draft before applying them.',
   undoPending:'Your draft has unsaved changes. Apply, copy or reset this draft before undoing an earlier applied revision.'
  },
  ar:{
   group:'أوضاع مساحة العمل',detection:'كشف AI',humanize:'تحسين الكتابة',editor:'محرر الكتابة',
   original:'النص الأصلي',revised:'المسودة المحسّنة',before:'قبل',after:'بعد',
   draftIntro:'عدّل المسودة محليًا أو عاين مقترحًا. لن يتغير النص الأصلي حتى تضغط على تطبيق.',
   idle:'بدأت المسودة بنسخة من النص الأصلي. لم تُنشأ إعادة صياغة توليدية.',
   untouched:'لا توجد تعديلات على المسودة.',changed:'المسودة جاهزة لمراجعتك. لم يُعدّل النص الأصلي تلقائيًا.',
   preview:'هذه معاينة للمقترح فقط. راجع الصياغة قبل التطبيق.',
   stale:'تغيّر النص الأصلي. احتفظنا بالمسودة، لكن لا يمكن تطبيقها قبل إعادة ضبطها على الإصدار الجديد.',
   protected:'تغيّر رقم أو مرجع أو وحدة قياس أو رابط. راجع النص وعدّل النسخة الأصلية يدويًا.',
   docx:'ملف Word للقراءة فقط في هذه المسودة. انسخها واستخدم أدوات Word الموجودة؛ يبقى الأصل محفوظًا.',
   reset:'إعادة ضبط',restoreReset:'استعادة المسودة',copy:'نسخ المسودة',apply:'تطبيق المسودة بعد المراجعة',undo:'التراجع',
   restored:'استُعيدت المسودة السابقة دون تعديل النص الأصلي.',
   applied:'طُبّقت المسودة بموافقتك. نتائج الكشف السابقة غير صالحة حتى تضغط تحليل النص مرة أخرى.',
   undone:'استُرجع النص السابق. اضغط تحليل النص لإجراء فحص جديد.',
   copied:'نُسخت المسودة.',copyError:'تعذّر النسخ تلقائيًا. حدّد النص وانسخه يدويًا.',
   safeMode:'تحرير محلي يدوي فقط',generator:'إعادة الصياغة محليًا',
   generatorNotice:'إعادة الصياغة التوليدية المحلية غير متاحة بعد؛ يلزم نموذج مرخّص ومختبَر فعليًا باستخدام WebGPU. لا يوجد بديل سحابي.',
   discarded:'أُعيدت المسودة من النسخة الأصلية الحالية.',noChange:'لم يتغيّر النص.',noHistory:'لا يوجد تعديل يمكن التراجع عنه.',
   reviewFirst:'راجع النسخة المحسّنة قبل تطبيقها.',
   undoPending:'توجد تعديلات غير مطبّقة في المسودة. طبّقها أو انسخها أو أعد ضبط المسودة قبل التراجع عن تعديل سابق.'
  }
 };
 function mount({source,session,controller,root:panel=document,
  locale=()=>document.documentElement.lang,integrity=null}={}){
  if(!source||typeof session?.read!=='function'||typeof session?.replaceText!=='function'||
   typeof session?.subscribe!=='function'||!controller||!panel)
   throw new TypeError('A shared revisioned source and analysis controller are required');
  const el=id=>document.getElementById(id);
  const textarea=el('tisRevisedText'),reset=el('tisDraftReset'),
   apply=el('tisDraftApply'),undo=el('tisDraftUndo'),copy=el('tisDraftCopy'),
   status=el('tisDraftStatus'),generator=el('tisLocalRewrite'),tabs=modes.map(m=>el(ids[m]));
  if(!textarea||!reset||!apply||!undo||!copy||!status||!generator||tabs.some(t=>!t))
   throw Error('L7 dual pane HTML controls are not loaded');
  let disposed=false,mode='detection',base=session.read(),draftFlag='SYNCED',history=[],ownWrite=false,resetBackup=null;
  const t=()=>words[locale()==='ar'?'ar':'en'];
  const put=(id,value)=>{const e=el(id);if(e)e.textContent=value;};
  function notify(message){status.textContent=message;}
  function changed(){return textarea.value!==base.text;}
  function stale(){const current=session.read();
   return current.revision!==base.revision||current.text!==base.text;}
  function checks(){
   if(!changed()||!integrity?.compareRewrite)return {flags:[]};
   return integrity.compareRewrite(base.text,textarea.value,{locale:locale()==='ar'?'ar':'en'});
  }
  function canUndo(){
   const h=history[history.length-1],snapshot=session.read();
   return !!h&&h.afterRevision===snapshot.revision&&h.afterText===snapshot.text;
  }
  function render(){
   const current=session.read(),different=changed(),isStale=stale(),readonly=current.sourceKind==='docx',
    protectedChange=different&&!isStale&&checks().flags?.some(f=>f==='PROTECTED_FACT_CHANGED'||f==='UNVERIFIED_PERSONAL_CLAIM');
   apply.disabled=!different||isStale||readonly||protectedChange;
   const undoPending=canUndo()&&different;
   // Undo applies to a prior committed version; doing it while a newer
   // handwritten draft exists would silently discard that unsaved draft.
   undo.disabled=!canUndo()||different;
   // After explicit Reset, the same control offers a one-step recovery while
   // the canonical source revision remains unchanged. No disk persistence.
   reset.textContent=resetBackup&&!different&&!isStale&&
    resetBackup.revision===current.revision?t().restoreReset:t().reset;
   textarea.dir='auto';
   const label=readonly?'docx':isStale?'stale':protectedChange?'protected':undoPending?'undoPending':different?draftFlag:'untouched';
   const translation=t();
   const messages={
    docx:translation.docx,stale:translation.stale,protected:translation.protected,
    undoPending:translation.undoPending,
    PREVIEW:translation.preview,EDITED:translation.changed,
    SYNCED:translation.idle,untouched:translation.untouched
   };
   notify(messages[label]||translation.changed);
   generator.disabled=true; // No selected production model / no local generation quality gate.
  }
  function resetDraft(message=false){
   base=session.read();textarea.value=base.text;draftFlag='SYNCED';
   render();if(message)notify(t().discarded);
  }
  function onSourceChange(snapshot){
   if(disposed||ownWrite)return;
   resetBackup=null; // A newer source must never revive discarded stale text.
   history=[];
   if(changed()){draftFlag='STALE';render();}
   else resetDraft();
  }
  const unlisten=session.subscribe(onSourceChange);
  function onInput(){
   if(disposed)return;
   resetBackup=null; // New typing supersedes the one-step reset recovery.
   draftFlag=changed()?'EDITED':'SYNCED';render();
  }
  function onResetClick(){
   if(disposed)return;
   const current=session.read();
   // Recovery is allowed only for the exact source revision on which the
   // draft was discarded. Restore goes to the draft pane, never the source.
   if(resetBackup&&!changed()&&!stale()&&
      resetBackup.revision===current.revision){
    const prior=resetBackup;
    resetBackup=null;
    textarea.value=prior.text;
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
    draftFlag=prior.flag;
    render();notify(t().restored);
    return;
   }
   resetBackup=changed()&&!stale()?Object.freeze({
    revision:current.revision,text:textarea.value,flag:draftFlag
   }):null;
   resetDraft(true);
  }
  function setMode(next,{focus=false}={}){
   if(!modes.includes(next))return false;
   mode=next;document.body.dataset.tisMode=mode;
   for(const name of modes){
    const n=el(ids[name]);n.setAttribute('aria-selected',String(mode===name));
    n.tabIndex=mode===name?0:-1;
   }
   panel.setAttribute('aria-labelledby',ids[mode]);
   if(focus)el(ids[mode]).focus();
   render();return true;
  }
  const listeners=[];
  function listen(target,type,handler){target.addEventListener(type,handler);listeners.push([target,type,handler]);}
  function onTabKey(event){
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   // Navigation follows the computed document direction rather than a
   // translation callback that can lag a language-toggle event.
   const rtl=document.documentElement.dir==='rtl';
   // Arrow navigation starts from the focused tab, not a previously
   // selected tab when focus is moved by screen readers or scripts.
   const focused=modes.findIndex(name=>ids[name]===event.currentTarget.id);
   const current=focused<0?modes.indexOf(mode):focused;
   const forward=(event.key==='ArrowRight')!==rtl;
   const next=event.key==='Home'?modes[0]:
    event.key==='End'?modes[modes.length-1]:
    modes[(current+(forward?1:modes.length-1))%modes.length];
   setMode(next,{focus:true});
  }
  function applyDraft(){
   if(disposed)return;
   if(apply.disabled){render();return;}
   const sourceSnapshot=session.read();
   if(stale()||sourceSnapshot.sourceKind==='docx'){render();return;}
   const newText=textarea.value;
   if(!newText||newText===sourceSnapshot.text){render();return;}
   // Revalidate immediately before the revisioned write.
   const check=checks();
   if(check.flags?.some(f=>f==='PROTECTED_FACT_CHANGED'||f==='UNVERIFIED_PERSONAL_CLAIM')){
    render();return;
   }
   ownWrite=true;
   let updated;
   try{updated=session.replaceText(newText,sourceSnapshot.sourceKind);}
   finally{ownWrite=false;}
   if(updated.revision===sourceSnapshot.revision){render();return;}
   resetBackup=null;
   history.push({beforeText:sourceSnapshot.text,beforeKind:sourceSnapshot.sourceKind,
    afterRevision:updated.revision,afterText:updated.text});
   if(history.length>15)history.shift();
   source.value=updated.text;
   source.dispatchEvent(new Event('input',{bubbles:true}));
   resetDraft();notify(t().applied);
  }
  function undoDraft(){
   if(disposed)return;
   if(changed()){
    render();notify(t().undoPending);return;
   }
   const item=history[history.length-1];
   if(!item||!canUndo()){history=[];render();return;}
   resetBackup=null;
   history.pop();ownWrite=true;
   let restored;
   try{restored=session.replaceText(item.beforeText,item.beforeKind);}
   finally{ownWrite=false;}
   const previous=history[history.length-1];
   if(previous&&previous.afterText===restored.text)previous.afterRevision=restored.revision;
   source.value=restored.text;
   source.dispatchEvent(new Event('input',{bubbles:true}));
   resetDraft();notify(t().undone);
  }
  async function copyDraft(){
   try{
    if(typeof navigator.clipboard?.writeText!=='function')throw Error('No clipboard');
    await navigator.clipboard.writeText(textarea.value);
    if(!disposed)notify(t().copied);
   }catch{
    if(disposed)return;
    textarea.focus();textarea.select();notify(t().copyError);
   }
  }
  function previewSuggestion(item){
   const sourceSnapshot=session.read();
   if(!item||sourceSnapshot.revision!==item.revision||stale()||
    typeof item.proposedReplacement!=='string'||item.risk!=='low'||
    !Number.isSafeInteger(item.start)||!Number.isSafeInteger(item.end)||
    item.start<0||item.end>base.text.length||
    base.text.slice(item.start,item.end)!==item.original)return false;
   // Never erase hand-written unsaved edits to show an advisor preview.
   if(changed()&&draftFlag==='EDITED'){notify(t().reviewFirst);return false;}
   resetBackup=null;
   textarea.value=base.text.slice(0,item.start)+item.proposedReplacement+base.text.slice(item.end);
   draftFlag='PREVIEW';
   setMode('humanize');return true;
  }
  function localize(){
   put(ids.detection,t().detection);put(ids.humanize,t().humanize);put(ids.editor,t().editor);
   put('tisRevisedHeading',t().revised);put('tisRevisedLabel',t().after);
   put('tisSourceLabel',t().before);put('tisDraftIntro',t().draftIntro);
   put('tisDraftReset',t().reset);put('tisDraftCopy',t().copy);
   put('tisDraftApply',t().apply);put('tisDraftUndo',t().undo);
   put('tisLocalRewrite',t().generator);put('tisGeneratorNotice',t().generatorNotice);
   put('tisDraftBadge',t().safeMode);
   el('tisModes')?.setAttribute('aria-label',t().group);
   render();
  }
  const onLanguage=()=>queueMicrotask(()=>{if(!disposed)localize();});
  for(const name of modes){
   const n=el(ids[name]);listen(n,'click',()=>setMode(name));listen(n,'keydown',onTabKey);
  }
  listen(textarea,'input',onInput);
  listen(reset,'click',onResetClick);
  listen(apply,'click',applyDraft);listen(undo,'click',undoDraft);
  listen(copy,'click',copyDraft);
  listen(el('language'),'click',onLanguage);
  function dispose(){
   if(disposed)return;disposed=true;unlisten();
   for(const [n,type,fn]of listeners)n.removeEventListener(type,fn);
  }
  resetDraft();localize();setMode('detection');
  return Object.freeze({getState:()=>Object.freeze({mode,status:draftFlag,
    baseRevision:base.revision,currentRevision:session.read().revision,
    dirty:changed(),stale:stale()}),
   setMode,resetDraft,previewSuggestion,dispose});
 }
 return Object.freeze({mount});
});
