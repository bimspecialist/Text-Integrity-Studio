/* V12 user-review prototype. UI only: reuses the authoritative V11 reviewer,
 * V10 measured windows and the R6 single AnalysisController. Opt-in URL only.
 * No new classifier, fabricated AI probability or automatic remote inference.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 root.TISWorkspaceV12=api;
 const setup=()=>{
  if(new URL(root.location.href).searchParams.get('v12preview')!=='1')return;
  const view=api.mount({doc:root.document,win:root,app:root.TISAnalysisApp});
  root.TISWorkspaceV12=Object.freeze({...api,...view});
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const text={
  en:{
   eyebrow:'Text Integrity Studio · Private writing workspace',
   heading:'Check your text. Refine your writing.',
   summary:'One place to examine supported AI-model signals and improve your draft. Your original stays in your browser.',
   scan:'Check AI signal',write:'Refine my writing',
   first:'Experimental English classifier · 120+ eligible words · first use may download about 126 MB.',
   caution:'An uncalibrated model signal is not the percentage written by AI and cannot establish authorship.',
   empty:'Paste text or upload a document to begin.',
   shorter:n=>'Add '+n+' more eligible English words for the research model. Writing review works now.',
   unsupported:'AI-model research currently supports English text only. You can still refine your writing.',
   eligible:'English text is eligible for the optional on-device research scan.',
   ready:'Ready to review locally. No model will load until you select Check AI signal.',
   tips:'View writing suggestions',tabs:'After your scan',back:'Back to AI scan',
   tipsHint:'Review real source-linked suggestions; preview before applying any correction.',
   resultNote:'Highlights mark model-evaluated windows, not confirmed AI-written sentences.',
   helper:'Original text preserved · No automatic rewrite · EN model only',
   processing:'Model analysis is running. The progress display reflects real runtime events.',
   cancelled:'Model analysis cancelled. Your text was kept.',
   draft:'Refine your writing',draftHint:'Original and editable draft stay together, with reviewed suggestions alongside.',
   sampleLabel:'Your document',resultTitle:'Model research summary'
  },
  ar:{
   eyebrow:'Text Integrity Studio · مساحة كتابة خاصة',
   heading:'افحص نصك، ثم حسّن كتابتك.',
   summary:'مكان واحد لعرض إشارات فحص AI المتاحة ومراجعة المسودة، مع بقاء نصك الأصلي داخل المتصفح.',
   scan:'فحص إشارة AI',write:'تحسين الكتابة',
   first:'نموذج بحثي تجريبي للإنجليزية فقط · 120 كلمة مؤهلة فأكثر · قد يتطلب الاستخدام الأول تنزيل نحو 126MB.',
   caution:'إشارة النموذج غير معايرة، وليست نسبة ما كتبه AI ولا دليلًا على مؤلف النص.',
   empty:'الصق نصًا أو ارفع مستندًا للبدء.',
   shorter:n=>'يلزم '+n+' كلمة إنجليزية مؤهلة إضافية لتشغيل النموذج. يمكنك تحسين الكتابة الآن.',
   unsupported:'فحص النموذج البحثي متاح للإنجليزية فقط، ويمكنك تحسين الكتابة العربية.',
   eligible:'النص الإنجليزي مؤهل للفحص البحثي المحلي الاختياري.',
   ready:'يمكنك تحسين النص محليًا. لا يبدأ النموذج حتى تختار فحص إشارة AI.',
   tips:'عرض اقتراحات الكتابة',tabs:'بعد الفحص',back:'العودة إلى نتيجة AI',
   tipsHint:'راجع الملاحظات المرتبطة بالنص الأصلي، واعرض المعاينة قبل أي تصحيح.',
   resultNote:'المقاطع المميزة هي نوافذ قياس للنموذج، وليست جملًا ثبت أن AI كتبها.',
   helper:'النص الأصلي محفوظ · لا إعادة كتابة تلقائية · النموذج للإنجليزية فقط',
   processing:'يعمل النموذج الآن. التقدم المعروض يعتمد على أحداث التشغيل الحقيقية.',
   cancelled:'أُلغي الفحص وبقي نصك كما هو.',
   draft:'حسّن كتابتك',draftHint:'الأصل والمسودة القابلة للتحرير والاقتراحات المعتمدة على النص في مساحة واحدة.',
   sampleLabel:'مستندك',resultTitle:'ملخص النموذج البحثي'
  }
 };
 const localLang=doc=>doc.documentElement.lang==='ar'?'ar':'en';
 function eligibilityMessage(policy,d){
  if(!d||d.reason==='NO_TEXT')return 'empty';
  if(d.eligible)return 'eligible';
  if(d.words<120&&d.languageClass==='en')return 'short';
  return 'unsupported';
 }
 function mount({doc,win,app}={}){
  const id=x=>doc.getElementById(x);
  const main=doc.querySelector('.shell>main'),workspace=doc.querySelector('.workspace');
  const flow=id('tisV10Flow'),stage=id('tisV11GuidedReview'),results=id('tisV10Results');
  const src=id('source'),legacyAction=id('scanAI'),toggle=id('tisV11IncludeAI');
  const back=id('tisV10BackFromWriting');
  if(!main||!workspace||!flow||!stage||!results||!src||!legacyAction||!toggle||
    !app?.controller?.getState||!app?.session?.read||!id('tisV11BackToWriting'))
    throw new TypeError('V12_REQUIRES_CANONICAL_V11_ANALYSIS_AND_EDITOR');
  const build=(parent,tag,elementId,cls)=>{
   const node=doc.createElement(tag);
   if(elementId)node.id=elementId;if(cls)node.className=cls;
   parent.append(node);return node;
  };
  const hero=build(main,'header','tisV12Hero','tis-v12-hero');
  main.insertBefore(hero,flow);
  const eyebrow=build(hero,'p','tisV12Eyebrow','tis-v12-eyebrow');
  const title=build(hero,'h1','tisV12Headline',null);
  const intro=build(hero,'p','tisV12Intro','tis-v12-intro');
  const inputPanel=id('inputPanel');
  const composer=build(inputPanel,'div','tisV12Actions','tis-v12-actions');
  const scan=build(composer,'button','tisV12Scan','tis-v12-primary');
  scan.type='button';scan.setAttribute('aria-describedby','tisV12ScanHint tisV12Eligibility tisV12Caution');
  const write=build(composer,'button','tisV12Write','tis-v12-secondary');
  write.type='button';write.setAttribute('aria-describedby','tisV12Eligibility');
  const scanHint=build(inputPanel,'p','tisV12ScanHint','tis-v12-fineprint');
  const caution=build(inputPanel,'p','tisV12Caution','tis-v12-caution');
  const readiness=build(inputPanel,'p','tisV12Eligibility','tis-v12-eligibility');
  readiness.setAttribute('role','status');readiness.setAttribute('aria-live','polite');
  const anchor=inputPanel.querySelector('.main-actions');
  if(!anchor)throw new TypeError('V12_MAIN_ACTION_MISSING');
  inputPanel.insertBefore(composer,anchor);
  inputPanel.insertBefore(scanHint,anchor);
  inputPanel.insertBefore(caution,anchor);
  inputPanel.insertBefore(readiness,anchor);
  const resultNav=build(results,'div','tisV12ResultNav','tis-v12-result-nav');
  results.insertBefore(resultNav,results.firstChild);
  const resultCaption=build(resultNav,'span','tisV12ResultCaption','tis-v12-pill');
  const tipAction=build(resultNav,'button','tisV12Tips','tis-v12-secondary');
  tipAction.type='button';
  const resultNote=build(results,'p','tisV12ResultNote','tis-v12-result-note');
  resultNote.setAttribute('role','note');
  const reviewNav=build(stage,'div','tisV12ReviewNav','tis-v12-review-nav');
  stage.insertBefore(reviewNav,stage.firstChild);
  const reviewCaption=build(reviewNav,'span','tisV12ReviewCaption','tis-v12-pill');
  const backToModel=build(reviewNav,'button','tisV12BackToModel','tis-v12-secondary');
  backToModel.type='button';
  const reviewNote=build(stage,'p','tisV12ReviewNote','tis-v12-review-note');
  stage.insertBefore(reviewNote,stage.children[2]||null);
  const editLayout=build(main,'div','tisV12EditLayout','tis-v12-editor-layout');
  main.insertBefore(editLayout,workspace);
  const tipsDock=build(editLayout,'aside','tisV12TipsDock','tis-v12-tips-dock');
  tipsDock.setAttribute('aria-label','Writing suggestions');
  const localStatus=build(hero,'p','tisV12Status','tis-v12-status');
  localStatus.setAttribute('role','status');localStatus.setAttribute('aria-live','polite');
  let disposed=false,renderQueued=false,ranResearch=false;
  let pendingReviewedEditRevision=null;
  let sourceParent=workspace.parentNode,stageParent=stage.parentNode;
  function t(){return text[localLang(doc)];}
  function eligibility(){
   try{return win.TISEligibilityPolicy?.assess(src.value,app.session.read().sourceKind)||null;}
   catch{return null;}
  }
  function notify(message){localStatus.textContent=message||'';}
  function updateInput(){
   if(disposed)return;
   const d=eligibility(),which=eligibilityMessage(win.TISEligibilityPolicy,d),w=t();
   readiness.textContent=which==='eligible'?w.eligible:which==='short'?
    w.shorter(Math.max(0,120-(d?.words||0))):
    which==='unsupported'?w.unsupported:w.empty;
   // The primary button remains a real, explicit model action; nothing
   // silently substitutes an unrelated editorial "AI percentage".
   scan.disabled=which!=='eligible';
   write.disabled=!src.value.trim();
  }
  function localize(){
   const w=t();
   eyebrow.textContent=w.eyebrow;title.textContent=w.heading;intro.textContent=w.summary;
   scan.textContent=w.scan;write.textContent=w.write;
   scanHint.textContent=w.first;caution.textContent=w.caution;
   resultCaption.textContent=w.resultTitle;
   tipAction.textContent=w.tips;
   resultNote.textContent=w.resultNote;
   reviewCaption.textContent=w.tips;backToModel.textContent=w.back;
   reviewNote.textContent=w.tipsHint;
   tipsDock.setAttribute('aria-label',w.tips);
   updateInput();
  }
  function scrollToTop(node){
   node?.scrollIntoView?.({behavior:'auto',block:'start'});
  }
  function research(){
   if(disposed)return;
   const d=eligibility();
   if(!d?.eligible){updateInput();src.focus();return;}
   notify(t().processing);
   ranResearch=true;
   // An explicit click is the only consent to download or run the optional
   // English model. Reuse V11 -> R6 exactly; no new model code.
   toggle.checked=true;toggle.dispatchEvent(new win.Event('change',{bubbles:true}));
   legacyAction.click();
   const status=app.controller.getState().status;
   if(!['LOADING','ANALYZING'].includes(status))notify(t().unsupported);
   else scrollToTop(flow);
  }
  function writing(){
   if(disposed)return;
   if(!src.value.trim()){updateInput();src.focus();return;}
   toggle.checked=false;toggle.dispatchEvent(new win.Event('change',{bubbles:true}));
   legacyAction.click();
   scrollToTop(stage);
  }
  function openTipsFromResult(){
   id('tisV11BackToWriting')?.click();
   scrollToTop(stage);
  }
  // V11 intentionally returns to a separate suggestions screen after Apply
  // or Undo. In V12 those exact same controls live inside Refine, so restore
  // the integrated editor ONLY when its verified source revision changes.
  // This does not rerun the detector or bypass V11 integrity checks.
  function retainEditorAfterReviewedChange(event){
   if(disposed||doc.body.dataset.v10Screen!=='writing')return;
   const target=event.target?.closest?.('.tis-v11-apply, #tisV11Undo');
   if(!target)return;
   pendingReviewedEditRevision=app.session.read().revision;
  }
  function backToAI(){
   const state=app.controller.getState(),revision=app.session.read().revision;
   if(['RESEARCH_SIGNAL','INCONCLUSIVE'].includes(state.status)&&state.revision===revision){
    win.TISWorkspaceV10?.setAnalysisState(state);
    scrollToTop(results);
   }
  }
  function syncDock(){
   if(disposed)return;
   const mode=doc.body.dataset.v10Screen;
   // The V10/V11 controller can pass through STALE/input and guided-review
   // during one reviewed edit. Re-enter only after its final visible state is
   // known, not inside a racing click-handler microtask.
   if(pendingReviewedEditRevision!==null&&mode!=='writing'){
    const committed=app.session.read().revision!==pendingReviewedEditRevision;
    pendingReviewedEditRevision=null;
    if(committed&&mode==='guided-review'){
     id('tisV11Improve')?.click();
     return;
    }
   }
   if(mode==='writing'){
    if(workspace.parentNode!==editLayout)editLayout.insertBefore(workspace,tipsDock);
    if(stage.parentNode!==tipsDock)tipsDock.append(stage);
    stage.hidden=false;
    // Existing reversible suggestions, exact previews and protected-fact
    // guards remain attached to their original DOM elements.
   }else{
    if(workspace.parentNode!==sourceParent)main.insertBefore(workspace,editLayout.nextSibling);
    if(stage.parentNode!==stageParent)stageParent.append(stage);
    // V11 is the authority for stage visibility on non-writing screens.
   }
   doc.body.dataset.v12Screen=mode;
   if(mode==='results')notify('');
   if(mode==='guided-review')notify('');
  }
  function syncNext(){
   if(renderQueued||disposed)return;renderQueued=true;
   win.queueMicrotask(()=>{renderQueued=false;syncDock();});
  }
  const modeObserver=new win.MutationObserver(syncNext);
  modeObserver.observe(doc.body,{attributes:true,attributeFilter:['data-v10-screen']});
  const localeObserver=new win.MutationObserver(localize);
  localeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  const onInput=()=>{notify('');updateInput();};
  const onProgress=e=>{
   if(!ranResearch)return;
   const stage=e.detail?.stage;
   if(stage==='CANCELLED')notify(t().cancelled);
   if(stage==='ERROR')notify('');
  };
  scan.addEventListener('click',research);
  write.addEventListener('click',writing);
  tipAction.addEventListener('click',openTipsFromResult);
  tipsDock.addEventListener('click',retainEditorAfterReviewedChange,true);
  backToModel.addEventListener('click',backToAI);
  src.addEventListener('input',onInput);
  win.addEventListener('tis:ai-progress',onProgress);
  doc.body.classList.add('tis-v12');
  localize();syncDock();
  function dispose(){
   if(disposed)return;disposed=true;
   modeObserver.disconnect();localeObserver.disconnect();
   scan.removeEventListener('click',research);
   write.removeEventListener('click',writing);
   tipAction.removeEventListener('click',openTipsFromResult);
   tipsDock.removeEventListener('click',retainEditorAfterReviewedChange,true);
   backToModel.removeEventListener('click',backToAI);
   src.removeEventListener('input',onInput);
   win.removeEventListener('tis:ai-progress',onProgress);
   if(workspace.parentNode!==sourceParent)main.insertBefore(workspace,editLayout.nextSibling);
   if(stage.parentNode!==stageParent)stageParent.append(stage);
   for(const node of [hero,composer,scanHint,caution,readiness,
    resultNav,resultNote,reviewNav,reviewNote,editLayout])node.remove();
   doc.body.classList.remove('tis-v12');delete doc.body.dataset.v12Screen;
  }
  return Object.freeze({dispose,eligibility,screen:()=>doc.body.dataset.v10Screen});
 }
 return Object.freeze({mount,eligibilityMessage});
});
