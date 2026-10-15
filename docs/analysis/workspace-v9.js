/* V9 presentation-only observer. Canonical state remains in AnalysisController. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root||!root.document)return;
 root.TISWorkspaceV9=api;
 const setup=()=>{
  const doc=root.document;
  if(!doc.getElementById('tisV9Summary'))return;
  const view=api.mount({documentObject:doc,source:doc.getElementById('source'),
   scanButton:doc.getElementById('scanAI'),resultRoot:doc.getElementById('reportPanel')});
  root.TISWorkspaceV9=Object.freeze({...api,...view});
  view.setAnalysisState(root.TISAnalysisApp?.controller?.getState()||{status:'EMPTY'});
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const messages={
  en:{
   EMPTY:'Paste text or upload a document to begin. Nothing is uploaded automatically.',
   READY:'Text ready. Select Analyze Text to review your writing and optional research evidence.',
   LOADING:'Loading the optional research model on your device. You can cancel.',
   ANALYZING:'Analyzing eligible passages on your device. You can cancel.',
   WRITING_ONLY:'Writing review is available. No supported AI model signal for this text.',
   UNSUPPORTED:'Experimental AI detection is unavailable for this language or document. Writing review still works.',
   RESEARCH_SIGNAL:'Experimental model signal is ready. It is not a calibrated authorship probability.',
   INCONCLUSIVE:'Inconclusive: available evidence cannot support a document-wide AI signal.',
   STALE:'Your text has changed. Analyze the updated version to refresh results.',
   ERROR:'The optional model could not finish. Try again; your original text is unchanged.',
   CANCELLED:'Analysis cancelled. Your original text is unchanged.'
  },
  ar:{
   EMPTY:'الصق النص أو ارفع مستندًا للبدء. لا يتم رفع النص تلقائيًا.',
   READY:'النص جاهز. اختر تحليل النص لمراجعة الكتابة والنتائج البحثية الاختيارية.',
   LOADING:'جارٍ تجهيز النموذج البحثي الاختياري على جهازك. يمكنك الإلغاء.',
   ANALYZING:'جارٍ تحليل المقاطع المؤهلة على جهازك. يمكنك الإلغاء.',
   WRITING_ONLY:'يمكن مراجعة الكتابة محليًا. لا تتوفر إشارة كشف AI مدعومة لهذا النص.',
   UNSUPPORTED:'كشف AI التجريبي لا يدعم هذه اللغة أو المستند. أدوات الكتابة متاحة.',
   RESEARCH_SIGNAL:'ظهرت إشارة النموذج التجريبية، لكنها ليست احتمالًا معتمدًا لمعرفة مؤلف النص.',
   INCONCLUSIVE:'نتيجة غير حاسمة: الأدلة الحالية لا تدعم إشارة على مستوى المستند.',
   STALE:'تغيّر النص. اختر التحليل مجددًا لتحديث النتائج.',
   ERROR:'تعذّر إكمال تشغيل النموذج الاختياري. حاول مجددًا؛ بقي النص الأصلي كما هو.',
   CANCELLED:'أُلغي التحليل. لم يتغير النص الأصلي.'
  }
 };
 function describeStatus(kind,locale='en'){
  const dict=messages[locale==='ar'?'ar':'en'];
  return dict[kind]||dict.ERROR;
 }
 function mount({documentObject,source,scanButton,resultRoot}={}){
  const doc=documentObject;
  const node=doc?.getElementById?.('tisV9Summary');
  if(!node||!source||!scanButton||!resultRoot||typeof doc?.defaultView?.MutationObserver!=='function')
   throw new TypeError('V9_PRESENTATION_DEPENDENCIES_MISSING');
  let disposed=false,last={status:'EMPTY'},review=null;
  const mode=()=>['humanize','editor'].includes(doc.body.dataset.tisMode)?doc.body.dataset.tisMode:'detection';
  const language=()=>doc.documentElement.lang==='ar'?'ar':'en';
  function render(){
   if(disposed)return;
   const selected=mode(),state=messages.en[last?.status]?last.status:'ERROR';
   const local=language()==='ar';
   let content=describeStatus(state,language());
   if(selected==='humanize')content=local?'راجع المقترحات المحلية ثم طبّق التغييرات التي تختارها. لا يوجد توليد تلقائي.':'Review local suggestions and apply only changes you choose. No automatic generative rewrite.';
   if(selected==='editor')content=local?'عدّل المسودة بجانب النص الأصلي، ثم راجعها قبل التطبيق.':'Edit the draft beside your original, then review it before applying.';
   if(selected==='humanize'&&review&&review.suggestions>0)
    content=local?review.suggestions+' مقترحات كتابة محلية للمراجعة.':review.suggestions+' local writing suggestions available for review.';
   node.textContent=content;
   node.dataset.state=selected==='detection'?state:'WRITING_ONLY';
   doc.body.dataset.tisV9State=state;
   doc.body.dataset.tisV9Mode=selected;
  }
  function setAnalysisState(state){
   if(disposed)return false;
   last={status:typeof state?.status==='string'?state.status:'EMPTY'};
   if(last.status==='STALE'||last.status==='EMPTY')review=null;
   render();return true;
  }
  function setWritingReviewResult(metadata){
   if(disposed||!Number.isSafeInteger(metadata?.revision)||!Number.isSafeInteger(metadata?.suggestions)||metadata.suggestions<0)return false;
   const current=doc.defaultView.TISAnalysisApp?.session?.read();
   if(!current||current.revision!==metadata.revision)return false;
   review={revision:metadata.revision,suggestions:metadata.suggestions};render();return true;
  }
  const observer=new doc.defaultView.MutationObserver(()=>render());
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
  observer.observe(doc.body,{attributes:true,attributeFilter:['data-tis-mode']});
  render();
  function dispose(){if(disposed)return;disposed=true;observer.disconnect();}
  return Object.freeze({setAnalysisState,setWritingReviewResult,dispose});
 }
 return Object.freeze({describeStatus,mount});
});