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
  if(!['v11preview','v12preview'].some(flag=>new URL(root.location.href).searchParams.get(flag)==='1'))return;
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
   button:'Review text',help:'Private writing review in this browser. AI research is optional.',
   combinedButton:'Review text + check AI signal',
   combinedHelp:'You chose an experimental English AI model scan. It may download about 126 MB of model files. A raw signal is not an AI-written percentage.',
   optTitle:'Also check AI signal (experimental)',
   optHint:'Off by default · English only · at least 120 eligible words · downloads model files only after you start.',
   optReady:'English text eligible for optional model research.',
   optShort:'The optional English model needs at least 120 eligible words. Writing review is still available.',
   optUnsupported:'Research model supports English only. Writing review is available in Arabic and other languages.',
   optedUnsupported:'Writing review complete. This document is not eligible for the experimental English AI model, so no AI percentage is shown.',
   signalTitle:'Measured AI-model signal',signalLabel:'Raw model signal',signalScope:'Measured word coverage',
   signalWarning:'Experimental, uncalibrated signal — NOT the percentage written by AI. False alerts have been observed in independent data tests.',
   withheld:'No reliable document-wide signal can be shown from the available model evidence.',
   researchResultsReview:'Return to writing suggestions',researchFromReview:'Check AI signal (experimental)',
   researchFromReviewNote:'English only · 120+ eligible words · optional model download · not proof of who wrote the text.',
   refineHeading:'Refine your writing',refineIntro:'Compare the original with your editable draft. You decide which changes to apply.',
   originalHeading:'Original text',originalHint:'Editing the original invalidates earlier review and model results.',
   refinedHeading:'Your draft',
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
   button:'مراجعة النص',help:'مراجعة الكتابة تتم داخل متصفحك، وفحص AI البحثي اختياري.',
   combinedButton:'مراجعة النص وفحص إشارة AI',
   combinedHelp:'اخترت فحص النموذج الإنجليزي التجريبي. قد ينزّل ملفات بحجم يقارب 126MB. إشارة النموذج ليست نسبة النص المكتوب بالذكاء الاصطناعي.',
   optTitle:'إضافة فحص إشارة AI (تجريبي)',
   optHint:'معطّل افتراضيًا · للإنجليزية فقط · 120 كلمة مؤهلة على الأقل · تُحمّل ملفات النموذج عند بدء الفحص فقط.',
   optReady:'النص الإنجليزي مؤهل لفحص النموذج البحثي الاختياري.',
   optShort:'يتطلب النموذج الإنجليزي 120 كلمة مؤهلة على الأقل. لا تزال مراجعة الكتابة متاحة.',
   optUnsupported:'النموذج البحثي يدعم الإنجليزية فقط. يمكنك مراجعة الكتابة بالعربية واللغات الأخرى.',
   optedUnsupported:'اكتملت مراجعة الكتابة، لكن النص غير مؤهل للنموذج الإنجليزي التجريبي؛ لذا لن نعرض نسبة AI.',
   signalTitle:'إشارة نموذج AI المقاسة',signalLabel:'إشارة النموذج الخام',signalScope:'تغطية الكلمات المقاسة',
   signalWarning:'إشارة تجريبية غير معايرة، وليست نسبة النص المكتوب بالذكاء الاصطناعي. سُجلت إنذارات خاطئة في اختبارات بيانات مستقلة.',
   withheld:'لا تسمح الأدلة الحالية بعرض إشارة موثوقة للمستند بالكامل.',
   researchResultsReview:'العودة إلى ملاحظات الكتابة',researchFromReview:'فحص إشارة AI (تجريبي)',
   researchFromReviewNote:'للإنجليزية فقط · 120 كلمة مؤهلة فأكثر · تنزيل نموذج اختياري · ليس دليلًا على مؤلف النص.',
   refineHeading:'حسّن كتابتك',refineIntro:'قارن النص الأصلي بالمسودة القابلة للتحرير. أنت من يقرر ما يُطبّق.',
   originalHeading:'النص الأصلي',originalHint:'تعديل الأصل يُلغي صلاحية نتائج المراجعة والكشف السابقة.',
   refinedHeading:'مسودتك',
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
 // Only a contract-validated, same-revision research signal is displayable.
 // This does not convert a raw classifier signal into authorship probability.
 function researchDisplay(state,revision){
  const genuine=state?.status==='RESEARCH_SIGNAL'&&
   state.evidence?.kind==='RESEARCH_SIGNAL'&&
   state.revision===revision&&Number.isFinite(state.signal)&&
   state.signal>=0&&state.signal<=100&&state.evidence.signal===state.signal;
  if(!genuine)return Object.freeze({measured:false,signal:null,coverage:null});
  const coverage=state.evidence.documentCoverageWordsPercent;
  return Object.freeze({measured:true,signal:Number(state.signal.toFixed(1)),
   coverage:Number.isFinite(coverage)&&coverage>=0&&coverage<=100?
    Number(coverage.toFixed(1)):null});
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
  // The primary Review Text action stays local unless the visitor actively
  // selects the experimental classifier. One intentional click can then
  // run the same existing AnalysisController, never a second inference path.
  const scanChoice=make(inputPanel,'div','tisV11ScanChoice','tis-v11-scan-choice');
  const scanLabel=make(scanChoice,'label',null,'tis-v11-scan-label');
  const includeAI=make(scanLabel,'input','tisV11IncludeAI',null);
  includeAI.type='checkbox';includeAI.checked=false;
  const labelCopy=make(scanLabel,'span',null,'tis-v11-scan-label-copy');
  const choiceTitle=make(labelCopy,'strong','tisV11ScanTitle',null);
  const choiceHint=make(labelCopy,'small','tisV11ScanHint',null);
  const choiceStatus=make(scanChoice,'p','tisV11ScanEligibility','tis-v11-eligibility');
  choiceStatus.setAttribute('role','status');choiceStatus.setAttribute('aria-live','polite');
  const buttonRow=inputPanel.querySelector('.main-actions');
  if(!buttonRow)throw Error('V11_REQUIRES_MAIN_REVIEW_ACTION');
  inputPanel.insertBefore(scanChoice,buttonRow);
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
  const qaFromResults=make(actions,'a','tisV11QaResults','tis-v11-qa-link');
  qaFromResults.href='quality/v11-manual-acceptance.html';qaFromResults.rel='noopener';
  const undoButton=make(actions,'button','tisV11Undo','tis-v10-secondary');undoButton.type='button';undoButton.disabled=true;
  const researchFromReview=make(stage,'div','tisV11ResearchFromReview','tis-v11-research-from-review');
  const researchFromReviewButton=make(researchFromReview,'button','tisV11ResearchFromReviewButton','tis-v10-secondary');
  researchFromReviewButton.type='button';
  const researchFromReviewNote=make(researchFromReview,'p','tisV11ResearchFromReviewNote','tis-v11-disclaimer');
  // Research V10 results hide the writing workspace; give validated model
  // evidence its own legible result panel, without creating any new scores.
  const modelResults=byId('tisV10Results');
  const modelSummary=byId('tisV10ResultSummary');
  if(!modelResults||!modelSummary)throw Error('V11_REQUIRES_CANONICAL_RESEARCH_RESULTS');
  const signalCard=make(modelResults,'section','tisV11SignalCard','tis-v11-signal-card');
  signalCard.hidden=true;
  modelResults.insertBefore(signalCard,modelSummary);
  const signalTitle=make(signalCard,'h3','tisV11SignalTitle',null);
  const signalNumbers=make(signalCard,'div',null,'tis-v11-signal-numbers');
  const signalFigure=make(signalNumbers,'strong','tisV11SignalValue','tis-v11-signal-value');
  signalFigure.textContent='—';
  const signalCoverage=make(signalNumbers,'p','tisV11SignalCoverage',null);
  const signalWarning=make(signalCard,'p','tisV11SignalWarning',null);
  const modelWritingButton=make(signalCard,'button','tisV11BackToWriting','tis-v10-secondary');
  modelWritingButton.type='button';
  // Refine writing keeps the canonical dual-editor and all existing guards.
  const main=doc.querySelector('.shell>main');
  const backFromWriting=byId('tisV10BackFromWriting');
  const writingIntro=make(main,'header','tisV11WritingIntro','tis-v11-writing-intro');
  main.insertBefore(writingIntro,backFromWriting);
  const writingTitle=make(writingIntro,'h1','tisV11WritingTitle',null);
  const writingSubtitle=make(writingIntro,'p','tisV11WritingSubtitle',null);
  const originalTop=make(inputPanel,'div','tisV11OriginalTop','tis-v11-original-top');
  inputPanel.insertBefore(originalTop,inputPanel.querySelector('.tis-v8-source-heading'));
  const originalTitle=make(originalTop,'h2','tisV11OriginalTitle',null);
  const originalNote=make(originalTop,'p','tisV11OriginalNote',null);
  const status=make(stage,'p','tisV11Status','tis-v11-status');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const research=make(inputPanel,'details','tisV11Research','tis-v11-research');
  const qaFromInput=make(inputPanel,'a','tisV11QaInput','tis-v11-qa-link');
  qaFromInput.href='quality/v11-manual-acceptance.html';qaFromInput.rel='noopener';
  const researchTitle=make(research,'summary','tisV11ResearchTitle',null);
  const researchHelp=make(research,'p','tisV11ResearchHelp',null);
  const researchAction=make(research,'button','tisV11ResearchRun','tis-v10-secondary');
  researchAction.type='button';researchAction.setAttribute('aria-describedby','tisV11ResearchHelp');
  inputPanel.insertBefore(research,note.nextSibling);
  research.after(qaFromInput);
  const inputStatus=make(inputPanel,'p','tisV11InputStatus','tis-v11-status');
  inputStatus.setAttribute('role','status');inputStatus.setAttribute('aria-live','polite');
  inputPanel.insertBefore(inputStatus,research);
  let reviewRevision=null,reviewedSuggestions=[],disposed=false;
  let ownRevisionChange=false,ownUndoCount=0,openPreviewId=null,lastNotice='status';
  const tr=()=>labels[doc.documentElement.lang==='ar'?'ar':'en'];
  function eligibility(){
   const decide=win.TISEligibilityPolicy?.assess;
   return typeof decide==='function'?decide(source.value,app.session.read().sourceKind):null;
  }
  function renderScanChoice(){
   const t=tr(),allowed=eligibility();
   choiceStatus.textContent=!includeAI.checked?'':allowed?.eligible?t.optReady:
    allowed?.reason==='TOO_SHORT'?t.optShort:
    allowed?.languageClass==='en'&&allowed?.reason==='MIN_WORDS'?t.optShort:
    allowed?.languageClass==='en'&&allowed?.words<120?t.optShort:t.optUnsupported;
   const desired=includeAI.checked?t.combinedButton:t.button;
   const title=action.querySelector('.v5-action-title');
   // V9 still localizes the shared button for its own mode. Do not edit that
   // protected release; correct only changed V11 labels without feedback loops.
   if(title&&title.textContent!==desired)title.textContent=desired;
   if(action.getAttribute('aria-label')!==desired)action.setAttribute('aria-label',desired);
   const help=includeAI.checked?t.combinedHelp:t.help;
   if(note.textContent!==help)note.textContent=help;
  }
  function presentModelEvidence(){
   const state=app.controller.getState(),snapshot=app.session.read(),t=tr();
   if(doc.body.dataset.v10Screen!=='results'){signalCard.hidden=true;return;}
   const measured=researchDisplay(state,snapshot.revision);
   signalCard.hidden=false;
   signalFigure.textContent=measured.measured?measured.signal.toFixed(1)+'%':'—';
   signalCoverage.textContent=measured.measured?
    t.signalLabel+' · '+t.signalScope+': '+
    (measured.coverage===null?'—':measured.coverage.toFixed(1)+'%'):
    t.withheld;
   signalWarning.textContent=t.signalWarning;
  }
  function openLocalReview(){
   if(app.reviewWritingOnly()!==true)return false;
   const snapshot=app.session.read();
   reviewRevision=snapshot.revision;openPreviewId=null;
   reviewedSuggestions=app.review.getSuggestions();
   notice('status');return showReview();
  }
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
   action.setAttribute('aria-describedby','v5ClickNote tisV11ScanHint tisV11InputStatus');
   choiceTitle.textContent=t.optTitle;choiceHint.textContent=t.optHint;
   signalTitle.textContent=t.signalTitle;modelWritingButton.textContent=t.researchResultsReview;
   researchFromReviewButton.textContent=t.researchFromReview;
   researchFromReviewNote.textContent=t.researchFromReviewNote;
   writingTitle.textContent=t.refineHeading;writingSubtitle.textContent=t.refineIntro;
   originalTitle.textContent=t.originalHeading;originalNote.textContent=t.originalHint;
   if(doc.body.dataset.v10Screen==='writing')byId('tisRevisedHeading').textContent=t.refinedHeading;
   renderScanChoice();
   presentModelEvidence();
   researchTitle.textContent=t.research;
   researchHelp.textContent=t.researchHelp;
   researchAction.textContent=t.researchButton;
   heading.textContent=t.reviewTitle;
   disclaimer.textContent=t.reviewLimit;
   edit.textContent=t.edit;improve.textContent=t.improve;exportButton.textContent=t.export;
   qaFromInput.textContent=qaFromResults.textContent=
    doc.documentElement.lang==='ar'?'فتح لوحة اختبارات V11':'Open V11 testing desk';
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
    preview.setAttribute('aria-label',(detail.hidden?t.previewAction:t.closePreview)+' — '+t.categories[categoryFor(item)]+' '+(index+1));
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
   if(includeAI.checked){
    const allowed=eligibility();
    if(allowed?.eligible){
     inputStatus.textContent='';
     stage.hidden=true;
     if(app.analyze()!==true)inputStatus.textContent=tr().notReady;
     return;
    }
    // Ineligible AR/short text still gets the promised local writing review.
    if(openLocalReview())notice('optedUnsupported');
    else inputStatus.textContent=tr().notReady;
    return;
   }
   if(app.reviewWritingOnly()!==true){
    inputStatus.textContent=tr().notReady;return;
   }
   // The shared legacy '#scan' also displays a generic "Analysis updated"
   // toast. V11 provides an accurate local-writing live status instead.
   // Suppress only that transient toast; do not change V9/V10 events.
   const legacyToast=byId('toast');
   if(legacyToast)legacyToast.style.display='none';
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
   const allowed=eligibility();
   if(!allowed?.eligible){
    if(openLocalReview())notice('optedUnsupported');
    else inputStatus.textContent=tr().notReady;
    return;
   }
   reviewRevision=null;reviewedSuggestions=[];stage.hidden=true;
   inputStatus.textContent='';
   app.analyze();
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
  const buttonCopyObserver=new win.MutationObserver(()=>{
   // Restore the selected AI disclosure if the legacy V9 view relabels the
   // common action following a language or research lifecycle event.
   if(!disposed)win.queueMicrotask(renderScanChoice);
  });
  buttonCopyObserver.observe(action,{
   attributes:true,attributeFilter:['aria-label'],
   childList:true,characterData:true,subtree:true
  });
  const viewObserver=new win.MutationObserver(()=>{
   if(doc.body.dataset.v10Screen==='writing')byId('tisRevisedHeading').textContent=tr().refinedHeading;
   presentModelEvidence();
  });
  viewObserver.observe(doc.body,{attributes:true,attributeFilter:['data-v10-screen']});
  action.addEventListener('click',startReview,true);
  edit.addEventListener('click',openInput);
  improve.addEventListener('click',enterWriting);
  exportButton.addEventListener('click',exportReview);
  undoButton.addEventListener('click',undoSuggestion);
  researchAction.addEventListener('click',optionalResearch);
  researchFromReviewButton.addEventListener('click',optionalResearch);
  modelWritingButton.addEventListener('click',openLocalReview);
  includeAI.addEventListener('change',renderScanChoice);
  source.addEventListener('input',renderScanChoice);
  backFromWriting?.addEventListener('click',returnFromWriting,true);
  doc.body.classList.add('tis-v11');
  copy();
  function dispose(){
   if(disposed)return;disposed=true;
   observer.disconnect();buttonCopyObserver.disconnect();viewObserver.disconnect();unsubscribe();
   action.removeEventListener('click',startReview,true);
   edit.removeEventListener('click',openInput);
   improve.removeEventListener('click',enterWriting);
   exportButton.removeEventListener('click',exportReview);
   undoButton.removeEventListener('click',undoSuggestion);
   researchAction.removeEventListener('click',optionalResearch);
   researchFromReviewButton.removeEventListener('click',optionalResearch);
   modelWritingButton.removeEventListener('click',openLocalReview);
   includeAI.removeEventListener('change',renderScanChoice);
   source.removeEventListener('input',renderScanChoice);
   backFromWriting?.removeEventListener('click',returnFromWriting,true);
   stage.remove();research.remove();qaFromInput.remove();inputStatus.remove();
   scanChoice.remove();signalCard.remove();writingIntro.remove();originalTop.remove();
   doc.body.classList.remove('tis-v11');
  }
  return Object.freeze({dispose,showReview,reviewState:()=>Object.freeze({
   revision:reviewRevision,visible:doc.body.dataset.v10Screen==='guided-review',
   suggestions:reviewedSuggestions.length,undoAvailable:ownUndoCount>0,
   previewOpen:openPreviewId!==null
  })});
 }
 return Object.freeze({mount,categoryFor,researchDisplay});
});
