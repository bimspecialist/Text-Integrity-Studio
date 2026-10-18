/* Text Integrity Studio V10.1 — opt-in centered workspace.
 * Presentation only. DocumentSession/AnalysisController remain the authorities.
 * Enable on this development branch with ?v10preview=1, never by default.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 root.TISWorkspaceV10=api;
 const setup=()=>{
  if(new URL(root.location.href).searchParams.get('v10preview')!=='1')return;
  const view=api.mount({documentObject:root.document,app:root.TISAnalysisApp});
  root.TISWorkspaceV10=Object.freeze({...api,...view});
  view.setAnalysisState(root.TISAnalysisApp?.controller?.getState()||{status:'EMPTY'});
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const screens=Object.freeze({
  EMPTY:'input',READY:'input',STALE:'input',CANCELLED:'input',
  LOADING:'progress',ANALYZING:'progress',
  WRITING_ONLY:'eligibility',UNSUPPORTED:'eligibility',
  RESEARCH_SIGNAL:'results',INCONCLUSIVE:'results',ERROR:'error'
 });
 const words={
  en:{
   heading:'Check your text with clarity',subheading:'Paste text or upload a Word, PDF, or text document. Review measured passages after scanning.',
   source:'Text to review',scan:'Analyze text',statusEmpty:'Type or paste text first.',
   privacy:'Writing checks run in your browser; optional research model files are downloaded after you start an eligible scan.',
   progress:'Checking your document',loading:'Preparing the on-device research model',download:'Downloading the current model file',analyzing:'Analyzing eligible model windows',
   unknown:'In progress — the total is not available',cancel:'Cancel scan',
   unsupported:'This text is not eligible for experimental English-only AI detection.',short:'The English research detector requires at least 120 eligible English words.',
   missing:'Add text or import a document to continue.',eligibility:'Writing review remains available locally, without an AI authorship claim.',
   back:'Back to text',writing:'Improve writing',
   error:'Analysis could not finish. Your original text has not changed.',retry:'Edit text and try again',
   results:'Your document review',coverage:'Measured word coverage',signal:'Experimental research signal — not AI-authorship probability',
   inconclusive:'The detector cannot draw a document-wide conclusion from this evidence.',
   none:'No eligible highlighted windows are available. Unhighlighted text is not a human-authorship determination.',
   details:'Passage explanation',detailsDefault:'Select a highlighted passage to inspect its measured range.',
   detailsExplain:'This span was evaluated as one research-model window. The signal does not prove who wrote these words.',
   close:'Close passage details',edit:'Edit original text',preserve:'Original text preserved',improve:'Improve writing',
   modalTitle:'Measured passage',cancelled:'The scan was cancelled; your text is unchanged.'
  },
  ar:{
   heading:'افحص نصك بوضوح وثقة',subheading:'الصق نصًا أو ارفع ملف Word أو PDF أو TXT، ثم راجع المقاطع المقاسة داخل النص نفسه.',
   source:'النص المراد فحصه',scan:'فحص النص',statusEmpty:'اكتب نصًا أو الصقه أولًا.',
   privacy:'تعمل مراجعة الكتابة داخل متصفحك، وتُنزل ملفات النموذج البحثي الاختياري عند بدء فحص مؤهل فقط.',
   progress:'جارٍ فحص المستند',loading:'تجهيز نموذج البحث المحلي',download:'تنزيل ملف النموذج الحالي',analyzing:'تحليل نوافذ النص المؤهلة',
   unknown:'العملية جارية — لا يتوفر إجمالي قابل للقياس',cancel:'إلغاء الفحص',
   unsupported:'هذا النص غير مؤهل للكشف التجريبي المدعوم للإنجليزية فقط.',short:'يتطلب نموذج الكشف البحثي 120 كلمة إنجليزية مؤهلة على الأقل.',
   missing:'أضف نصًا أو ارفع مستندًا للمتابعة.',eligibility:'يمكنك مراجعة الكتابة محليًا دون إصدار حكم على هوية الكاتب.',
   back:'العودة إلى النص',writing:'تحسين الكتابة',
   error:'تعذّر إكمال التحليل. بقي النص الأصلي دون تغيير.',retry:'عدّل النص وأعد المحاولة',
   results:'نتيجة مراجعة النص',coverage:'تغطية الكلمات المقاسة',signal:'إشارة بحثية تجريبية وليست احتمالًا لمعرفة مؤلف النص',
   inconclusive:'الأدلة الحالية لا تكفي لإصدار نتيجة على مستوى المستند.',
   none:'لا توجد نوافذ موثوقة لتمييزها. النص غير المميز ليس حكمًا بأنه من كتابة إنسان.',
   details:'تفاصيل المقطع',detailsDefault:'اختر مقطعًا مميزًا لرؤية حدود قياسه وتفسيره.',
   detailsExplain:'تم تقييم هذا النطاق بوصفه نافذة واحدة من النموذج البحثي، ولا تثبت الإشارة من كتب هذه الكلمات.',
   close:'إغلاق تفاصيل المقطع',edit:'تعديل النص الأصلي',preserve:'حُفظ النص الأصلي',improve:'تحسين الكتابة',
   modalTitle:'المقطع المقاس',cancelled:'أُلغي الفحص ولم يتغير النص الأصلي.'
  }
 };
 function screenForStatus(status){return screens[status]||'error';}
 function describeProgress({stage,percent}={}){
  const allowed=stage==='ANALYZING'||stage==='DOWNLOADING';
  const valid=allowed&&typeof percent==='number'&&Number.isFinite(percent)&&percent>=0&&percent<=100;
  return Object.freeze({
   determinate:valid,percent:valid?percent:null,
   label:stage==='ANALYZING'?'analyzed model windows':stage==='DOWNLOADING'?'current model file':'preparing model'
  });
 }
 function surrogateBoundary(text,index){
  if(index<=0||index>=text.length)return false;
  const before=text.charCodeAt(index-1),after=text.charCodeAt(index);
  return before>=0xD800&&before<=0xDBFF&&after>=0xDC00&&after<=0xDFFF;
 }
 function segmentParts(text,evidence,revision){
  if(typeof text!=='string')throw new TypeError('Expected source text');
  const plain=Object.freeze([{start:0,end:text.length,text,highlight:false}]);
  if(evidence?.kind!=='RESEARCH_SIGNAL'||!Number.isSafeInteger(revision)||
   evidence.revision!==revision||!Array.isArray(evidence.segments)||
   evidence.segments.length===0||evidence.segments.length>96)return plain;
  const chunks=[],segments=evidence.segments;
  let cursor=0;
  for(const s of segments){
   if(!s||!Number.isSafeInteger(s.start)||!Number.isSafeInteger(s.end)||
    s.start<cursor||s.end<=s.start||s.end>text.length||
    !Number.isFinite(s.signal)||s.signal<0||s.signal>100||
    surrogateBoundary(text,s.start)||surrogateBoundary(text,s.end))return plain;
   if(s.start>cursor)chunks.push({start:cursor,end:s.start,text:text.slice(cursor,s.start),highlight:false});
   chunks.push({start:s.start,end:s.end,text:text.slice(s.start,s.end),highlight:true});
   cursor=s.end;
  }
  if(cursor<text.length)chunks.push({start:cursor,end:text.length,text:text.slice(cursor),highlight:false});
  return Object.freeze(chunks.map(x=>Object.freeze(x)));
 }
 function mount({documentObject,app}={}){
  const doc=documentObject,win=doc?.defaultView,source=doc?.getElementById?.('source');
  const action=doc?.getElementById?.('scanAI'),main=doc?.querySelector?.('.shell>main');
  const workspace=doc?.querySelector?.('.workspace');
  if(!doc||!win||!source||!action||!main||!workspace||!app?.controller||!app?.session)
   throw new TypeError('V10_1_MISSING_CANONICAL_APP_DEPENDENCIES');
  const make=(tag,id,cls,content)=>{
   const n=doc.createElement(tag);
   if(id)n.id=id;if(cls)n.className=cls;if(content!==undefined)n.textContent=content;
   return n;
  };
  const attach=(parent,tag,id,cls,content)=>{const n=make(tag,id,cls,content);parent.append(n);return n;};
  const flow=attach(main,'section','tisV10Flow','tis-v10-flow');
  main.insertBefore(flow,workspace);
  const progress=attach(flow,'section','tisV10Progress','tis-v10-stage');
  progress.hidden=true;
  const progressHeading=attach(progress,'h2','tisV10ProgressHeading','tis-v10-title');
  const progressStatus=attach(progress,'p','tisV10ProgressStatus','tis-v10-status');
  progressStatus.setAttribute('role','status');progressStatus.setAttribute('aria-live','polite');
  const meter=attach(progress,'progress','tisV10Meter','tis-v10-meter');
  meter.max=100;meter.removeAttribute('value');
  const progressValue=attach(progress,'p','tisV10ProgressValue','tis-v10-meta');
  const cancel=attach(progress,'button','tisV10Cancel','tis-v10-secondary');
  cancel.type='button';

  const eligibility=attach(flow,'section','tisV10Eligibility','tis-v10-stage');
  eligibility.hidden=true;
  const eligibilityHeading=attach(eligibility,'h2','tisV10EligibilityHeading','tis-v10-title');
  const eligibilityStatus=attach(eligibility,'p','tisV10EligibilityStatus','tis-v10-meta');
  const back=attach(eligibility,'button','tisV10BackToInput','tis-v10-secondary');
  back.type='button';
  const review=attach(eligibility,'button','tisV10ReviewInstead','tis-v10-primary');
  review.type='button';

  const error=attach(flow,'section','tisV10Error','tis-v10-stage');error.hidden=true;
  const errorHeading=attach(error,'h2','tisV10ErrorHeading','tis-v10-title');
  const errorBack=attach(error,'button','tisV10ErrorBack','tis-v10-primary');errorBack.type='button';

  const results=attach(flow,'section','tisV10Results','tis-v10-stage');results.hidden=true;
  const resultsTop=attach(results,'div',null,'tis-v10-results-top');
  const resultsHeading=attach(resultsTop,'h2','tisV10ResultHeading','tis-v10-title');
  const edit=attach(resultsTop,'button','tisV10Edit','tis-v10-secondary');edit.type='button';
  const resultSummary=attach(results,'p','tisV10ResultSummary','tis-v10-meta');
  const resultGrid=attach(results,'div',null,'tis-v10-reader-grid');
  const textBody=attach(resultGrid,'article','tisV10ReaderBody','tis-v10-reader');
  textBody.setAttribute('aria-label','Measured passage review of original text');
  textBody.dir='auto';
  const inspector=attach(resultGrid,'aside','tisV10Inspector','tis-v10-inspector');
  const inspectorHeading=attach(inspector,'h3','tisV10InspectorTitle',null);
  const inspectorText=attach(inspector,'p','tisV10InspectorText',null);
  const inspectorNotice=attach(inspector,'p','tisV10InspectorNotice','tis-v10-meta');
  const improve=attach(results,'button','tisV10Improve','tis-v10-primary');improve.type='button';
  const dialog=attach(doc.body,'dialog','tisV10InspectorDialog','tis-v10-dialog');
  const dialogTitle=attach(dialog,'h3','tisV10DialogTitle',null);
  const dialogText=attach(dialog,'p','tisV10DialogText',null);
  const dialogNote=attach(dialog,'p','tisV10DialogNote','tis-v10-meta');
  const closeDialog=attach(dialog,'button','tisV10CloseDialog','tis-v10-secondary');
  closeDialog.type='button';
  let last={status:'EMPTY'},lastProgress=null,selected=null,disposed=false,previousScreen='input';
  const locale=()=>doc.documentElement.lang==='ar'?'ar':'en';
  const t=()=>words[locale()];
  function show(screen){
   if(disposed)return;
   doc.body.dataset.v10Screen=screen;
   for(const n of [progress,eligibility,error,results])n.hidden=
    !(screen==='progress'&&n===progress||screen==='eligibility'&&n===eligibility||
      screen==='error'&&n===error||screen==='results'&&n===results);
  }
  function resetToSource(){
   doc.getElementById('tisTabDetection')?.click();
   lastProgress=null;show('input');
   source.focus();
  }
  function switchToWriting(){
   doc.getElementById('tisTabHumanize')?.click();
   show('writing');
   doc.getElementById('tisRevisedText')?.focus();
  }
  function renderLocale(){
   const strings=t();
   const set=(id,value)=>{const el=doc.getElementById(id);if(el)el.textContent=value;};
   set('v5Headline',strings.heading);set('v5Subtitle',strings.subheading);
   set('sourceLabel',strings.source);
   const title=action.querySelector('.v5-action-title');if(title)title.textContent=strings.scan;
   const sub=action.querySelector('.v5-action-sub');if(sub)sub.textContent='';
   set('v5ClickNote',strings.privacy);
   set('tisV10ProgressHeading',strings.progress);
   set('tisV10EligibilityHeading',strings.unsupported);
   set('tisV10ErrorHeading',strings.error);
   set('tisV10ResultHeading',strings.results);
   set('tisV10InspectorTitle',strings.details);
   set('tisV10InspectorNotice',strings.detailsExplain);
   set('tisV10DialogTitle',strings.modalTitle);
   set('tisV10DialogNote',strings.detailsExplain);
   set('tisV10CloseDialog',strings.close);
   set('tisV10Cancel',strings.cancel);set('tisV10BackToInput',strings.back);
   set('tisV10ReviewInstead',strings.writing);set('tisV10ErrorBack',strings.retry);
   set('tisV10Edit',strings.edit);set('tisV10Improve',strings.improve);
   if(!selected){inspectorText.textContent=strings.detailsDefault;dialogText.textContent=strings.detailsDefault;}
   else {inspectorText.textContent=selected.text;dialogText.textContent=selected.text;}
   renderProgress();
   renderEligibility();
   if(['RESEARCH_SIGNAL','INCONCLUSIVE'].includes(last.status))renderResult();
  }
  function renderProgress(){
   const info=describeProgress(lastProgress||{stage:last.stage,percent:null});
   const strings=t();
   const stage=lastProgress?.stage||last.stage;
   progressStatus.textContent=stage==='ANALYZING'?strings.analyzing:
    stage==='DOWNLOADING'?strings.download:strings.loading;
   meter.setAttribute('aria-label',progressStatus.textContent);
   if(info.determinate){
    meter.value=info.percent;
    meter.setAttribute('aria-valuenow',String(info.percent));
    progressValue.textContent=info.percent+'% — '+progressStatus.textContent;
   }else{
    meter.removeAttribute('value');meter.removeAttribute('aria-valuenow');
    progressValue.textContent=strings.unknown;
   }
  }
  function renderEligibility(){
   const strings=t();
   const kind=last.eligibleReason;
   const decision=win.TISEligibilityPolicy?.assess(source.value,app.session.read().sourceKind);
   const language=decision?.languageClass;
   eligibilityHeading.textContent=language==='en'&&decision?.words<120?strings.short:strings.unsupported;
   eligibilityStatus.textContent=decision?.reason==='NO_TEXT'?strings.missing:strings.eligibility;
  }
  function showPassage(part,button){
   selected=part;
   inspectorText.textContent=part.text;
   dialogText.textContent=part.text;
   if(win.matchMedia('(max-width:770px)').matches&&typeof dialog.showModal==='function'){
    dialog.showModal();
    closeDialog.focus();
    dialog.addEventListener('close',()=>button?.focus(),{once:true});
   }else inspectorHeading.focus?.();
  }
  function renderResult(){
   const snapshot=app.session.read();
   const sameRevision=snapshot.revision===last.revision;
   const verified=sameRevision?last.evidence:null;
   const parts=segmentParts(snapshot.text,verified,snapshot.revision);
   textBody.replaceChildren();
   selected=null;
   inspectorText.textContent=t().detailsDefault;
   for(const part of parts){
    if(!part.highlight){textBody.append(doc.createTextNode(part.text));continue;}
    const hit=make('button',null,'tis-v10-highlight');
    hit.type='button';hit.textContent=part.text;
    hit.setAttribute('aria-label',t().details+': '+part.text.slice(0,110));
    hit.dataset.start=String(part.start);hit.dataset.end=String(part.end);
    hit.addEventListener('click',()=>showPassage(part,hit));
    textBody.append(hit);
   }
   const coverage=verified?.kind==='RESEARCH_SIGNAL'?
    verified.documentCoverageWordsPercent:null;
   const coverageText=typeof coverage==='number'&&Number.isFinite(coverage)?
    t().coverage+': '+coverage+'%. ':'';
   resultSummary.textContent=last.status==='INCONCLUSIVE'?t().inconclusive:
    t().signal+'. '+coverageText;
   if(!parts.some(x=>x.highlight))resultSummary.textContent+=' '+t().none;
  }
  function setAnalysisState(state){
   if(disposed)return false;
   const prior=last.requestId;
   last=state&&typeof state.status==='string'?state:{status:'EMPTY'};
   if(prior!==last.requestId||!['LOADING','ANALYZING'].includes(last.status))
    lastProgress=null;
   if(doc.body.dataset.v10Screen==='writing'&&last.status!=='ERROR'&&last.status!=='STALE')return true;
   const screen=screenForStatus(last.status);
   show(screen);
   if(screen==='progress')renderProgress();
   if(screen==='eligibility')renderEligibility();
   if(screen==='results')renderResult();
   if(screen==='input'&&last.status==='CANCELLED'){
    const n=doc.getElementById('tisV8ActionStatus');
    if(n)n.textContent=t().cancelled;
   }
   return true;
  }
  function setProgress(event){
   if(disposed||!event||!['LOADING','ANALYZING'].includes(last.status)||
    last.requestId!==event.requestId)return false;
   lastProgress={stage:event.stage,percent:event.percent};
   if(doc.body.dataset.v10Screen==='progress')renderProgress();
   return true;
  }
  const langObserver=new win.MutationObserver(()=>win.queueMicrotask(renderLocale));
  langObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  const clickBack=()=>resetToSource();
  back.addEventListener('click',clickBack);
  edit.addEventListener('click',clickBack);
  errorBack.addEventListener('click',clickBack);
  review.addEventListener('click',switchToWriting);
  improve.addEventListener('click',switchToWriting);
  cancel.addEventListener('click',()=>app.cancel());
  closeDialog.addEventListener('click',()=>dialog.close());
  const sourceInput=()=>{if(doc.body.dataset.v10Screen==='results')show('input');};
  source.addEventListener('input',sourceInput);
  const restoreOnTab=()=>{if(doc.body.dataset.v10Screen==='writing')show('writing');};
  doc.getElementById('tisTabHumanize')?.addEventListener('click',restoreOnTab);
  doc.body.classList.add('tis-v10');
  doc.body.dataset.v10Screen='input';
  renderLocale();
  function dispose(){
   if(disposed)return;
   disposed=true;langObserver.disconnect();
   source.removeEventListener('input',sourceInput);
   if(dialog.open)dialog.close();
   dialog.remove();
   flow.remove();
   doc.body.classList.remove('tis-v10');
  }
  return Object.freeze({setAnalysisState,setProgress,dispose});
 }
 return Object.freeze({screenForStatus,describeProgress,segmentParts,mount});
});