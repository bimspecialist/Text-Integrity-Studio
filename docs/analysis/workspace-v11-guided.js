/* V11 M1 — opt-in guided local writing review.
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
  const tr=()=>labels[doc.documentElement.lang==='ar'?'ar':'en'];
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
   docxNote.textContent=t.docx;
   if(reviewRevision!==null)renderSuggestions();
  }
  function renderSuggestions(){
   const t=tr();
   count.textContent=t.reviewCount(reviewedSuggestions.length);
   cards.replaceChildren();
   if(!reviewedSuggestions.length){
    const empty=make(cards,'li',null,'tis-v11-empty');
    empty.textContent=t.noSuggestions;return;
   }
   for(const suggestion of reviewedSuggestions){
    const li=make(cards,'li',null,'tis-v11-suggestion');
    const top=make(li,'div',null,'tis-v11-suggestion-top');
    make(top,'strong',null,null).textContent=t.categories[categoryFor(suggestion)];
    make(top,'small',null,null).textContent=
     suggestion.risk==='low'&&suggestion.proposedReplacement!==null?t.low:t.manual;
    const why=make(li,'p',null,'tis-v11-reason');
    why.textContent=safeText(suggestion.reason,360)||t.manual;
    const original=make(li,'p',null,'tis-v11-original');
    const originalLabel=make(original,'strong',null,null);
    originalLabel.textContent=t.original+': ';
    original.append(doc.createTextNode(safeText(suggestion.original,160)));
    if(typeof suggestion.proposedReplacement==='string'&&suggestion.proposedReplacement!==suggestion.original){
     const proposed=make(li,'p',null,'tis-v11-proposed');
     make(proposed,'strong',null,null).textContent=t.proposed+': ';
     proposed.append(doc.createTextNode(safeText(suggestion.proposedReplacement,160)));
    }
   }
  }
  function openInput(){
   reviewRevision=null;reviewedSuggestions=[];stage.hidden=true;
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
   reviewRevision=snapshot.revision;
   reviewedSuggestions=app.review.getSuggestions();
   status.textContent=tr().status;
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
   if(reviewRevision!==null&&snapshot.revision!==reviewRevision){
    reviewRevision=null;reviewedSuggestions=[];stage.hidden=true;
    if(doc.body.dataset.v10Screen==='guided-review')doc.body.dataset.v10Screen='input';
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
   researchAction.removeEventListener('click',optionalResearch);
   backFromWriting?.removeEventListener('click',returnFromWriting,true);
   stage.remove();research.remove();inputStatus.remove();doc.body.classList.remove('tis-v11');
  }
  return Object.freeze({dispose,showReview,reviewState:()=>Object.freeze({
   revision:reviewRevision,visible:doc.body.dataset.v10Screen==='guided-review',
   suggestions:reviewedSuggestions.length
  })});
 }
 return Object.freeze({mount,categoryFor});
});
