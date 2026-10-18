/* V11 M1–M2 — guided local writing review with reversible, reviewed edits.
 * Presentation adapter only. DocumentSession and existing advisory engines remain
 * authoritative. No automatic model downloads, remote inference or text mutation.
 * Enabled exclusively with ?v11preview=1 on the development branch.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 root.TISWorkspaceV11=api;
 const setup=()=>{
  if(new URL(root.location.href).searchParams.get('v11preview')!=='1')return;
  const view=api.mount({doc:root.document,win:root,app:root.TISAnalysisApp});
  root.TISWorkspaceV11=Object.freeze({...api,...view});
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const labels=Object.freeze({
  en:Object.freeze({
   heading:'Review your writing',intro:'Paste text or upload a document to get clear, local writing suggestions.',
   button:'Review text',help:'Writing review runs entirely in this browser. No AI model is started or downloaded by this button.',
   research:'Optional AI research (English only)',
   researchHelp:'Experimental English-only classifier: at least 120 eligible words. Selecting the action can download model files. Signals are not calibrated probabilities of authorship.',
   researchButton:'Start optional AI research',
   empty:'Add text or upload a document to start your writing review.',
   reviewTitle:'Your writing review',reviewCount:n=>n===1?'1 writing observation':n+' writing observations',
   reviewLimit:'Suggestions are local, rule-based writing guidance. They are not AI-origin findings, a grammar guarantee, or proof of authorship.',
   noSuggestions:'No suggestions from the available local rules. This does not mean the document is error-free.',
   manual:'Review before changing',low:'Possible small correction',original:'Current wording',proposed:'Suggested wording',
   edit:'Edit original',improve:'Open writing editor',export:'Download writing report (JSON)',
   saved:'Writing report saved locally.',notReady:'The writing report is not ready. Try reviewing the text again.',
   docx:'Imported Word text is read-only for automatic changes. Keep the original file safe and review suggestions manually.',
   status:'Writing review complete. Your original text is unchanged.',
   previewAction:'Preview',closePreview:'Close preview',applyAction:'Apply correction',dismissAction:'Dismiss',
   undoAction:'Undo last correction',previewTitle:'Exact before/after review',before:'Before',after:'After',
   manualPreview:'This observation needs your own wording. No automatic replacement is available.',
   readOnlyPreview:'Imported Word text is read-only here. Review the suggestion in the Word editor instead.',
   previewFirst:'Preview the exact correction before applying it.',
   applied:'Reviewed correction applied. You can undo it.',undone:'The previous correction was restored.',
   dismissed:'Suggestion dismissed for this document revision. No text was changed.',
   stale:'The document changed. Review the current version before using older suggestions.',
   blocked:'Protected facts or an unverified personal claim could change. Nothing was applied.',
   applyError:'This correction could not be safely applied.',
   undoError:'Undo is no longer available after other changes.',
   categories:Object.freeze({clarity:'Clarity',grammar:'Grammar',repetition:'Repetition',rhythm:'Sentence rhythm',
    style:'Style',spelling:'Spelling',other:'Writing tip'})
  }),
  ar:Object.freeze({
   heading:'راجع كتابتك',intro:'الصق النص أو ارفع مستندًا للحصول على ملاحظات واضحة ومحلية لتحسين الكتابة.',
   button:'مراجعة النص',help:'تتم مراجعة الكتابة داخل متصفحك دون تشغيل أو تنزيل نموذج كشف AI تلقائيًا.',
   research:'كشف AI بحثي اختياري (للإنجليزية فقط)',
   researchHelp:'مصنف تجريبي للنصوص الإنجليزية المؤهلة من 120 كلمة فأكثر. قد يؤدي اختيار الفحص إلى تنزيل ملفات نموذج. الإشارات ليست احتمالات معايرة لتحديد المؤلف.',
   researchButton:'بدء الفحص البحثي الاختياري',
   empty:'أضف نصًا أو ارفع مستندًا لبدء مراجعة الكتابة.',
   reviewTitle:'مراجعة كتابتك',reviewCount:n=>n===1?'ملاحظة كتابية واحدة':n+' ملاحظات كتابية',
   reviewLimit:'هذه إرشادات كتابة محلية تعتمد على قواعد، وليست نتائج لكشف AI أو ضمانًا لخلو النص من الأخطاء أو إثباتًا لمصدره.',
   noSuggestions:'لم تُظهر القواعد المحلية المتاحة مقترحات. لا يعني ذلك أن النص خالٍ من الأخطاء.',
   manual:'يحتاج إلى مراجعة بشرية',low:'تصحيح بسيط مقترح',original:'النص الحالي',proposed:'الصياغة المقترحة',
   edit:'تعديل النص الأصلي',improve:'فتح محرر الكتابة',export:'تنزيل تقرير الكتابة (JSON)',
   saved:'حُفظ تقرير الكتابة على جهازك.',notReady:'التقرير غير جاهز. أعد مراجعة النص أولًا.',
   docx:'النص المستورد من Word للقراءة فقط عند التعديل التلقائي. احتفظ بالملف الأصلي وراجع الاقتراحات يدويًا.',
   status:'اكتملت مراجعة الكتابة. النص الأصلي لم يتغير.',
   previewAction:'معاينة',closePreview:'إغلاق المعاينة',applyAction:'تطبيق التصحيح',dismissAction:'تجاهل',
   undoAction:'التراجع عن آخر تصحيح',previewTitle:'مراجعة النص قبل التعديل وبعده',
   before:'قبل',after:'بعد',
   manualPreview:'تتطلب هذه الملاحظة صياغة منك. لا يوجد تصحيح آلي موثوق لتطبيقه.',
   readOnlyPreview:'النص المستورد من Word للقراءة فقط هنا. راجع الملاحظة داخل محرر Word.',
   previewFirst:'راجع معاينة التصحيح المحدد قبل تطبيقه.',
   applied:'طُبّق التصحيح بعد مراجعتك. يمكنك التراجع عنه.',
   undone:'استُعيد النص السابق قبل التصحيح.',
   dismissed:'تم تجاهل المقترح لهذه النسخة دون تغيير النص.',
   stale:'تغير المستند. راجع النسخة الحالية قبل تطبيق أي مقترح قديم.',
   blocked:'قد يؤدي التعديل إلى تغيير رقم أو مرجع أو ادعاء شخصي غير موثق. لم يُطبّق شيء.',
   applyError:'تعذّر تطبيق التصحيح بأمان.',
   undoError:'لم يعد التراجع متاحًا بعد تغييرات أخرى.',
   categories:Object.freeze({clarity:'الوضوح',grammar:'القواعد',repetition:'التكرار',rhythm:'إيقاع الجمل',
    style:'الأسلوب',spelling:'الإملاء',other:'ملاحظة كتابية'})
  })
 });
 const safeText=(value,max=180)=>typeof value==='string'?value.slice(0,max):'';
 function categoryFor(item){
  const category=typeof item?.category==='string'?item.category:'other';
  return Object.prototype.hasOwnProperty.call(labels.en.categories,category)?category:'other';
 }
 function mount({doc,win,app}={}){
  if(!doc||!win||!app?.reviewWritingOnly||!app?.session?.read||
     !app?.review?.getSuggestions||!app?.controller?.getState||
     !doc.getElementById('tisV10Flow')||!doc.getElementById('scanAI')){
   throw new TypeError('V11_REQUIRES_EXISTING_LOCAL_REVIEW_AND_V10_PREVIEW');
  }
  const byId=id=>doc.getElementById(id);
  const action=byId('scanAI'),source=byId('source');
  const flow=byId('tisV10Flow'),inputPanel=byId('inputPanel'),note=byId('v5ClickNote');
  const make=(parent,tag,id,className)=>{
   const n=doc.createElement(tag);if(id)n.id=id;if(className)n.className=className;
   parent.append(n);return n;
  };
  const stage=make(flow,'section','tisV11GuidedReview','tis-v10-stage tis-v11-stage');
  stage.hidden=true;
  const heading=make(stage,'h2','tisV11Heading','tis-v10-title');heading.tabIndex=-1;
  const count=make(stage,'p','tisV11Count','tis-v11-count');
  const disclaimer=make(stage,'p','tisV11Disclaimer','tis-v11-disclaimer');
  const docxNote=make(stage,'p','tisV11DocxNote','tis-v11-disclaimer');docxNote.hidden=true;
  const cards=make(stage,'ol','tisV11SuggestionList','tis-v11-suggestions');
  const actions=make(stage,'div',null,'tis-v11-actions');
  const edit=make(actions,'button','tisV11Edit','tis-v10-secondary');edit.type='button';
  const improve=make(actions,'button','tisV11Improve','tis-v10-primary');improve.type='button';
  const exportButton=make(actions,'button','tisV11Export','tis-v10-secondary');exportButton.type='button';
  const undoButton=make(actions,'button','tisV11Undo','tis-v10-secondary');undoButton.type='button';undoButton.disabled=true;
  const status=make(stage,'p','tisV11Status','tis-v11-status');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const research=make(inputPanel,'details','tisV11Research','tis-v11-research');
  const researchTitle=make(research,'summary','tisV11ResearchTitle',null);
  const researchHelp=make(research,'p','tisV11ResearchHelp',null);
  const researchAction=make(research,'button','tisV11ResearchRun','tis-v10-secondary');
  researchAction.type='button';researchAction.setAttribute('aria-describedby','tisV11ResearchHelp');
  inputPanel.insertBefore(research,note.nextSibling);
  const inputStatus=make(inputPanel,'p','tisV11InputStatus','tis-v11-status');
  inputStatus.setAttribute('role','status');inputStatus.setAttribute('aria-live','polite');
  inputPanel.insertBefore(inputStatus,research);
  let reviewRevision=null,reviewedSuggestions=[],disposed=false;
  let ownRevisionChange=false,ownUndoCount=0,openPreviewId=null,lastNotice='status';
  const tr=()=>labels[doc.documentElement.lang==='ar'?'ar':'en'];
  const notice=key=>{lastNotice=key;status.textContent=tr()[key]||tr().applyError;};
  const live=item=>{
   if(!item||reviewRevision===null)return false;
   const snapshot=app.session.read();
   return snapshot.revision===reviewRevision&&item.revision===snapshot.revision&&
    Number.isSafeInteger(item.start)&&Number.isSafeInteger(item.end)&&
    item.start>=0&&item.end<=snapshot.text.length&&item.start<item.end&&
    snapshot.text.slice(item.start,item.end)===item.original;
  };
  function copy(){
   if(disposed)return;
   const t=tr();
   byId('v5Headline').textContent=t.heading;
   byId('v5Subtitle').textContent=t.intro;
   note.textContent=t.help;
   const buttonTitle=action.querySelector('.v5-action-title');
   if(buttonTitle)buttonTitle.textContent=t.button;
   const subtitle=action.querySelector('.v5-action-sub');
   if(subtitle)subtitle.textContent='';
   action.setAttribute('aria-label',t.button);
   action.setAttribute('aria-describedby','v5ClickNote tisV11InputStatus');
   researchTitle.textContent=t.research;
   researchHelp.textContent=t.researchHelp;
   researchAction.textContent=t.researchButton;
   heading.textContent=t.reviewTitle;
   disclaimer.textContent=t.reviewLimit;
   edit.textContent=t.edit;improve.textContent=t.improve;exportButton.textContent=t.export;
   undoButton.textContent=t.undoAction;undoButton.disabled=ownUndoCount===0;
   docxNote.textContent=t.docx;
   if(reviewRevision!==null){renderSuggestions();status.textContent=t[lastNotice]||t.status;}
  }
  function renderSuggestions(){
   const t=tr(),readonly=app.session.read().sourceKind==='docx';
   count.textContent=t.reviewCount(reviewedSuggestions.length);
   undoButton.disabled=ownUndoCount===0;
   cards.replaceChildren();
   if(!reviewedSuggestions.length){
    make(cards,'li',null,'tis-v11-empty').textContent=t.noSuggestions;
    return;
   }
   reviewedSuggestions.forEach((item,index)=>{
    const li=make(cards,'li',null,'tis-v11-suggestion');
    li.dataset.reviewIndex=String(index);li.dataset.suggestionId=item.id;
    const top=make(li,'div',null,'tis-v11-suggestion-top');
    make(top,'strong',null,null).textContent=t.categories[categoryFor(item)];
    make(top,'small',null,null).textContent=
     item.risk==='low'&&item.proposedReplacement!==null?t.low:t.manual;
    make(li,'p',null,'tis-v11-reason').textContent=safeText(item.reason,360)||t.manual;
    const original=make(li,'p',null,'tis-v11-original');
    make(original,'strong',null,null).textContent=t.original+': ';
    original.append(doc.createTextNode(safeText(item.original,160)));
    if(typeof item.proposedReplacement==='string'&&item.proposedReplacement!==item.original){
     const proposed=make(li,'p',null,'tis-v11-proposed');
     make(proposed,'strong',null,null).textContent=t.proposed+': ';
     proposed.append(doc.createTextNode(safeText(item.proposedReplacement,160)));
    }
    const detail=make(li,'div','tisV11Preview'+index,'tis-v11-preview');
    detail.setAttribute('role','region');
    detail.setAttribute('aria-label',t.previewTitle+' — '+t.categories[categoryFor(item)]);
    detail.hidden=openPreviewId!==item.id;
    make(detail,'strong',null,null).textContent=t.before;
    const before=make(detail,'blockquote',null,'tis-v11-excerpt');
    before.textContent=item.original;before.dir='auto';
    const canApply=item.risk==='low'&&typeof item.proposedReplacement==='string';
    if(canApply){
     make(detail,'strong',null,null).textContent=t.after;
     const after=make(detail,'blockquote',null,'tis-v11-excerpt tis-v11-after');
     after.textContent=item.proposedReplacement;after.dir='auto';
    }else{
     make(detail,'p',null,'tis-v11-preview-note').textContent=readonly?t.readOnlyPreview:t.manualPreview;
    }
    if(readonly&&canApply)make(detail,'p',null,'tis-v11-preview-note').textContent=t.readOnlyPreview;
    const controls=make(li,'div',null,'tis-v11-suggestion-actions');
    const preview=make(controls,'button',null,'tis-v11-preview-toggle');
    preview.type='button';preview.textContent=detail.hidden?t.previewAction:t.closePreview;
    preview.setAttribute('aria-controls',detail.id);
    preview.setAttribute('aria-expanded',String(!detail.hidden));
    preview.setAttribute('aria-label',t.previewAction+' — '+t.categories[categoryFor(item)]+' '+(index+1));
    preview.addEventListener('click',()=>{
     if(!live(item)||!app.review.preview(item.id)){notice('stale');return;}
     openPreviewId=openPreviewId===item.id?null:item.id;
     renderSuggestions();
     cards.querySelector('[data-review-index="'+index+'"] .tis-v11-preview-toggle')?.focus();
    });
    const apply=make(controls,'button',null,'tis-v11-apply');
    apply.type='button';apply.textContent=t.applyAction;
    apply.disabled=!canApply||readonly||openPreviewId!==item.id;
    apply.setAttribute('aria-describedby',detail.id);
    apply.title=readonly?t.readOnlyPreview:!canApply?t.manualPreview:
     openPreviewId!==item.id?t.previewFirst:'';
    apply.addEventListener('click',()=>applySuggestion(item));
    const dismiss=make(controls,'button',null,'tis-v11-dismiss');
    dismiss.type='button';dismiss.textContent=t.dismissAction;
    dismiss.addEventListener('click',()=>dismissSuggestion(item));
   });
  }
  function refreshAfterOwnedChange(snapshot){
   // An approved change emits a session revision and invalidates model
   // evidence. Restore the guided result after the canonical editor is synced.
   source.value=snapshot.text;
   source.dispatchEvent(new win.Event('input',{bubbles:true}));
   reviewRevision=snapshot.revision;openPreviewId=null;
   reviewedSuggestions=app.review.getSuggestions();
   showReview();
  }
  function applySuggestion(item){
   if(!live(item)){notice('stale');return false;}
   if(openPreviewId!==item.id){notice('previewFirst');return false;}
   const preview=app.review.preview(item.id),before=app.session.read();
   if(!preview||preview.revision!==before.revision){notice('stale');return false;}
   if(before.sourceKind==='docx'){notice('readOnlyPreview');return false;}
   if(preview.risk!=='low'||typeof preview.after!=='string'){notice('applyError');return false;}
   // Repeat conservative protected-fact screening at the last moment.
   const integrity=win.TISRewriteIntegrityCheck;
   if(typeof integrity?.compareRewrite!=='function'){notice('applyError');return false;}
   const candidate=before.text.slice(0,item.start)+preview.after+before.text.slice(item.end);
   const flags=integrity.compareRewrite(before.text,candidate,{
    locale:/\p{Script=Arabic}/u.test(before.text)?'ar':'en'
   }).flags;
   if(flags.includes('PROTECTED_FACT_CHANGED')||flags.includes('UNVERIFIED_PERSONAL_CLAIM')){
    notice('blocked');return false;
   }
   ownRevisionChange=true;
   let result;
   try{result=app.review.apply(item.id);}finally{ownRevisionChange=false;}
   if(!result?.applied){notice(result?.reason==='STALE_REVISION'?'stale':'applyError');return false;}
   ownUndoCount++;
   refreshAfterOwnedChange(result.snapshot);
   notice('applied');undoButton.focus();return true;
  }
  function dismissSuggestion(item){
   if(!live(item)){notice('stale');return false;}
   app.review.dismiss(item.id);
   reviewedSuggestions=app.review.getSuggestions();openPreviewId=null;
   renderSuggestions();notice('dismissed');
   (cards.querySelector('.tis-v11-preview-toggle')||edit).focus();
   return true;
  }
  function undoSuggestion(){
   if(ownUndoCount<1){notice('undoError');return false;}
   ownRevisionChange=true;
   let result;
   try{result=app.review.undo();}finally{ownRevisionChange=false;}
   if(!result?.restored){ownUndoCount=0;undoButton.disabled=true;notice('undoError');return false;}
   ownUndoCount--;
   refreshAfterOwnedChange(result.snapshot);
   notice('undone');
   if(ownUndoCount)undoButton.focus();else heading.focus();
   return true;
  }
  function openInput(){
   reviewRevision=null;reviewedSuggestions=[];openPreviewId=null;stage.hidden=true;
   doc.body.dataset.v10Screen='input';
   byId('tisTabDetection')?.click();
   copy();
   source.focus();
  }
  function showReview(){
   if(reviewRevision===null||app.session.read().revision!==reviewRevision){openInput();return false;}
   stage.hidden=false;
   doc.body.dataset.v10Screen='guided-review';
   renderSuggestions();
   docxNote.hidden=app.session.read().sourceKind!=='docx';
   inputStatus.textContent='';
   heading.focus();
   return true;
  }
  function startReview(event){
   // Capture the button before V8/V9 target listeners that would start AI
   // inference. Do not disable unrelated actions or mutate the source.
   event.preventDefault();event.stopImmediatePropagation();
   const state=app.controller.getState();
   if(['LOADING','ANALYZING'].includes(state.status))return;
   if(!source.value.trim()){
    inputStatus.textContent=tr().empty;source.focus();return;
   }
   inputStatus.textContent='';
   if(app.reviewWritingOnly()!==true){
    inputStatus.textContent=tr().notReady;return;
   }
   const snapshot=app.session.read();
   reviewRevision=snapshot.revision;openPreviewId=null;
   reviewedSuggestions=app.review.getSuggestions();
   notice('status');
   showReview();
  }
  function enterWriting(){
   if(reviewRevision===null||reviewRevision!==app.session.read().revision){openInput();return;}
   byId('tisTabHumanize')?.click();
   stage.hidden=true;
   doc.body.dataset.v10Screen='writing';
   byId('tisRevisedText')?.focus();
  }
  function returnFromWriting(event){
   if(doc.body.dataset.v10Screen!=='writing'||reviewRevision===null)return;
   event.preventDefault();event.stopImmediatePropagation();
   if(reviewRevision===app.session.read().revision)showReview();
   else openInput();
  }
  function optionalResearch(){
   if(!source.value.trim()){
    inputStatus.textContent=tr().empty;source.focus();return;
   }
   reviewRevision=null;reviewedSuggestions=[];stage.hidden=true;
   inputStatus.textContent='';
   app.toggle();
  }
  function exportReview(){
   const target=byId('studioExportReview'),downstream=byId('studioExportStatus');
   if(!target||!downstream){status.textContent=tr().notReady;return;}
   downstream.textContent='';
   target.click();
   status.textContent=downstream.textContent.trim()||tr().notReady;
  }
  const onRevision=snapshot=>{
   if(ownRevisionChange)return;
   ownUndoCount=0;undoButton.disabled=true;openPreviewId=null;
   if(reviewRevision!==null&&snapshot.revision!==reviewRevision){
    reviewRevision=null;reviewedSuggestions=[];stage.hidden=true;
    if(doc.body.dataset.v10Screen==='guided-review'){
     doc.body.dataset.v10Screen='input';source.focus();
    }
   }
  };
  const unsubscribe=app.session.subscribe(onRevision);
  const observer=new win.MutationObserver(()=>win.queueMicrotask(copy));
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  const backFromWriting=byId('tisV10BackFromWriting');
  action.addEventListener('click',startReview,true);
  edit.addEventListener('click',openInput);
  improve.addEventListener('click',enterWriting);
  exportButton.addEventListener('click',exportReview);
  undoButton.addEventListener('click',undoSuggestion);
  researchAction.addEventListener('click',optionalResearch);
  backFromWriting?.addEventListener('click',returnFromWriting,true);
  doc.body.classList.add('tis-v11');
  copy();
  function dispose(){
   if(disposed)return;disposed=true;
   observer.disconnect();unsubscribe();
   action.removeEventListener('click',startReview,true);
   edit.removeEventListener('click',openInput);
   improve.removeEventListener('click',enterWriting);
   exportButton.removeEventListener('click',exportReview);
   undoButton.removeEventListener('click',undoSuggestion);
   researchAction.removeEventListener('click',optionalResearch);
   backFromWriting?.removeEventListener('click',returnFromWriting,true);
   stage.remove();research.remove();inputStatus.remove();doc.body.classList.remove('tis-v11');
  }
  return Object.freeze({dispose,showReview,reviewState:()=>Object.freeze({
   revision:reviewRevision,visible:doc.body.dataset.v10Screen==='guided-review',
   suggestions:reviewedSuggestions.length,undoAvailable:ownUndoCount>0,
   previewOpen:openPreviewId!==null
  })});
 }
 return Object.freeze({mount,categoryFor});
});
