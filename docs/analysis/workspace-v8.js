/* V8 product-level interactions. No model inference or remote requests.
 * The canonical AnalysisController remains the only detector authority.
 * All changes to the source dispatch a real input event and honor DOCX locks.
 */
(function(root){
 'use strict';
 function setup(){
  const get=id=>document.getElementById(id);
  const source=get('source'),paste=get('tisV8Paste'),sample=get('tisV8Example'),
   status=get('tisV8ActionStatus'),upload=get('v5UploadTab'),
   file=get('file'),headline=get('v5Headline');
  if(!source||!paste||!sample||!status||!headline)return;
  const inputPanel=get('inputPanel'),overlay=get('tisV8DropOverlay'),
   fileState=get('tisV8FileState'),dropLabel=get('tisV8DropLabel'),
   statePanel=get('tisV8AnalysisStatus'),stateText=get('tisV8StateText'),
   revised=get('tisRevisedText'),diffReview=get('tisV8DiffReview'),
   diffNote=get('tisV8DiffNote'),diffBefore=get('tisV8DiffOriginal'),
   diffAfter=get('tisV8DiffRevised'),draftDownload=get('tisV8SaveDraft'),
   writingStatus=get('tisV8WritingFeedback'),
   suggestButton=get('tisV8ReviewSuggestions');
  const allowedFile=/\.(?:docx|pdf|txt|md|csv|tsv|json|log|yaml|yml|tex|srt|vtt)$/iu;
  const labels={
   en:{
    title:{detection:'Review a document',humanize:'Make writing more natural',
     editor:'Edit with confidence'},
    headline:{detection:'Check your text for AI content',
     humanize:'Refine your writing',editor:'Your writing workspace'},
    sub:{detection:'Paste, type, or upload your text. One action reviews writing and checks supported English text with the on-device AI model.',
     humanize:'Compare the original with your revised draft. Review local suggestions and apply only the changes you choose.',
     editor:'Edit beside your original text. Preserve facts and references, then apply or undo your reviewed changes.'},
    eyebrow:'YOUR WORKSPACE',
    privacy:'Private draft · Optional local AI model download',
    paste:'Paste text',example:'Try example',shortcut:'Ctrl + Enter to analyze',
    pasted:'Text pasted into the original editor.',empty:'The clipboard has no text.',
    blocked:'Clipboard access is unavailable. Click the editor and press Ctrl + V.',
    locked:'Word source is read-only. Use the existing document tools to revise your file.',
    exampleDone:'Example loaded. Choose Analyze Text when ready.',
    upload:'Upload file',source:'Before',
    diffTitle:'Review changed passage',diffBefore:'Original excerpt',
    diffAfter:'Revised excerpt',
    diffIdle:'No draft changes. Make a revision to see the first changed passage.',
    diffChanged:'Compact first differing range; review both complete editors before Apply.',
    diffLong:'Long differences have been shortened here. Review both full texts before Apply.',
    diffUnavailable:'The preview is unavailable; review both editors instead.',
    saveDraft:'Download draft TXT',
    saveHelp:'Plain text copy · original preserved',
    saveDone:'UTF-8 TXT saved locally. Your original text and Word file were not changed.',
    saveEmpty:'Write in the draft editor before saving.',
    saveError:'Local download failed. Use Copy draft instead.',
    writingIdle:'Analyze Text reviews your writing here without a detector download.',
    writingStale:'The text changed. Run Analyze Text to refresh your writing suggestions.',
    writingFound:n=>n+' local writing suggestion'+(n===1?'':'s')+
     ' ready. Nothing has been applied.',
    writingNone:'Local writing review complete. No specific changes found; this does not establish authorship.',
    reviewSuggestions:'View suggestions',
    detectorHint:'Eligible English AI detection downloads external model assets only when you select Analyze Text. Signals are uncalibrated.',
    writingHint:'Analyze Text reviews writing locally in this mode. No detector download or automatic generative rewriting.',
    dropLabel:'Drop Word, PDF or text here',
    selected:name=>'Selected file: '+name,
    invalidFile:'Unsupported file. Choose DOCX, PDF or a text format.',
    multipleFiles:'Choose one document at a time; your previous text is preserved.',
    fileError:'This file could not be opened. Use the Upload file control.',
    states:{
     EMPTY:'Add text or a document. No file is uploaded automatically.',
     READY:'Ready. Analyze Text reviews your writing; eligible English text may download a local research model.',
     STALE:'Text changed. Previous model evidence is invalid. Select Analyze Text again.',
     WRITING_ONLY:'Writing review complete. No supported AI model score is available for this text.',
     UNSUPPORTED:'AI detection is not supported for this language or document. Writing tools remain available.',
     LOADING:'Preparing the optional local research model. Select Analyze Text to cancel.',
     ANALYZING:'Analyzing sampled passages on this device. Select Analyze Text to cancel.',
     INCONCLUSIVE:'INCONCLUSIVE. The evidence does not support a document-wide AI signal.',
     RESEARCH_SIGNAL:'Research model signal ready. This is not a calibrated authorship probability.',
     ERROR:'The research model could not finish. Your original text is preserved.',
     CANCELLED:'Analysis cancelled. Your text is unchanged.'
    }
   },
   ar:{
    title:{detection:'مراجعة المستند',humanize:'تحسين الكتابة الطبيعية',
     editor:'تحرير النص ومراجعته'},
    headline:{detection:'افحص النص وحسّن كتابته',
     humanize:'حسّن صياغة النص',editor:'مساحة تحرير المستند'},
    sub:{detection:'الصق النص أو ارفع ملفًا، ثم افحصه بزر واحد. كشف AI البحثي متاح للنص الإنجليزي المؤهل.',
     humanize:'قارن النص الأصلي بالمسودة. عاين المقترحات المحلية وطبّق فقط ما توافق عليه.',
     editor:'عدّل مسودة بجانب الأصل مع الحفاظ على الأرقام والمراجع وإمكانية التراجع.'},
    eyebrow:'مساحة العمل',
    privacy:'مسودة خاصة · تنزيل النموذج المحلي اختياري',
    paste:'لصق النص',example:'تجربة مثال',shortcut:'Ctrl + Enter للتحليل',
    pasted:'تم لصق النص في المحرر الأصلي.',empty:'الحافظة لا تحتوي على نص.',
    blocked:'تعذّر الوصول للحافظة. اضغط على المحرر واستخدم Ctrl + V.',
    locked:'نص Word للقراءة فقط. استخدم أدوات المستند لتحرير الملف.',
    exampleDone:'تم تحميل المثال. اختر تحليل النص عندما تكون جاهزًا.',
    upload:'رفع ملف',source:'قبل',
    diffTitle:'مراجعة المقطع المتغيّر',diffBefore:'مقتطف النص الأصلي',
    diffAfter:'مقتطف المسودة',
    diffIdle:'لا توجد تعديلات في المسودة. غيّر النص لعرض أول مقطع مختلف.',
    diffChanged:'عرض مختصر لأول نطاق مختلف. راجع النصّين كاملين قبل التطبيق.',
    diffLong:'اختُصرت الفروقات الطويلة هنا. راجع النصّين كاملين قبل التطبيق.',
    diffUnavailable:'المعاينة غير متاحة؛ راجع المحررين مباشرة.',
    saveDraft:'تنزيل المسودة TXT',
    saveHelp:'نسخة نصية فقط · الملف الأصلي محفوظ',
    saveDone:'حُفظت نسخة TXT محليًا. لم يتغيّر النص الأصلي أو ملف Word.',
    saveEmpty:'أضف نصًا إلى المسودة أولًا.',
    saveError:'تعذّر تنزيل الملف محليًا. استخدم زر نسخ المسودة.',
    writingIdle:'يراجع زر تحليل النص الصياغة محليًا دون تنزيل نموذج الكشف.',
    writingStale:'تغيّر النص. اضغط تحليل النص لتحديث المقترحات التحريرية.',
    writingFound:n=>n+' مقترحات تحرير محلية جاهزة للمراجعة. لم يُطبّق أي تعديل.',
    writingNone:'اكتملت مراجعة الكتابة محليًا دون العثور على تعديل محدد. هذا لا يثبت مصدر النص.',
    reviewSuggestions:'عرض المقترحات',
    detectorHint:'يُنزل كشف AI الإنجليزي المؤهل ملفات نماذج خارجية فقط بعد الضغط على تحليل النص. الإشارات غير معايرة.',
    writingHint:'يراجع زر تحليل النص الكتابة محليًا هنا، دون تنزيل نموذج الكشف أو إعادة صياغة توليدية تلقائية.',
    dropLabel:'أفلت ملف Word أو PDF أو نص هنا',
    selected:name=>'الملف المحدد: '+name,
    invalidFile:'صيغة غير مدعومة. اختر DOCX أو PDF أو ملفًا نصيًا.',
    multipleFiles:'اختر مستندًا واحدًا في كل مرة. النص السابق محفوظ.',
    fileError:'تعذّر فتح الملف. استخدم زر رفع ملف.',
    states:{
     EMPTY:'أضف نصًا أو مستندًا. لا يُرفع أي ملف تلقائيًا.',
     READY:'جاهز. يراجع تحليل النص الكتابة، وقد ينزّل نموذجًا بحثيًا محليًا للنص الإنجليزي المؤهل.',
     STALE:'تغيّر النص وأصبحت نتيجة الفحص السابقة غير صالحة. اضغط تحليل النص مجددًا.',
     WRITING_ONLY:'اكتملت مراجعة الكتابة. لا تتوفر إشارة كشف AI مدعومة لهذا النص.',
     UNSUPPORTED:'لغة النص أو نوع الملف غير مدعوم لكشف AI. لا تزال أدوات الكتابة متاحة.',
     LOADING:'يجري تجهيز النموذج البحثي الاختياري محليًا. اضغط تحليل النص للإلغاء.',
     ANALYZING:'يجري فحص المقاطع على جهازك. اضغط تحليل النص للإلغاء.',
     INCONCLUSIVE:'النتيجة غير حاسمة. لا تكفي الأدلة لعرض إشارة موحدة للمستند.',
     RESEARCH_SIGNAL:'ظهرت إشارة النموذج البحثي. ليست احتمالًا معايرًا لمصدر النص.',
     ERROR:'تعذر إكمال الفحص البحثي. النص الأصلي محفوظ.',
     CANCELLED:'أُلغي التحليل. لم يتغير النص.'
    }
   }
  };
  const mode=()=>['humanize','editor'].includes(document.body.dataset.tisMode)?
   document.body.dataset.tisMode:'detection';
  const language=()=>document.documentElement.lang==='ar'?'ar':'en';
  let disposed=false,lastStatus='',lastFileStatus=null,lastFileName='',everScanned=false;
  let diffTimer=null,writingResult=null;
  function renderWritingReview(){
   if(!writingStatus||!suggestButton)return;
   const current=root.TISAnalysisApp?.session?.read();
   const active=writingResult&&current&&writingResult.revision===current.revision;
   const count=active?writingResult.suggestions:0;
   writingStatus.textContent=active?
    count?t().writingFound(count):t().writingNone:
    writingResult?t().writingStale:t().writingIdle;
   suggestButton.textContent=t().reviewSuggestions;
   suggestButton.hidden=!active||count===0;
  }
  function setWritingReviewResult(metadata){
   if(disposed||!metadata||!Number.isSafeInteger(metadata.revision)||
    !Number.isSafeInteger(metadata.suggestions)||metadata.suggestions<0||
    metadata.suggestions>100)return false;
   const current=root.TISAnalysisApp?.session?.read();
   if(!current||metadata.revision!==current.revision)return false;
   writingResult=Object.freeze({revision:metadata.revision,suggestions:metadata.suggestions});
   renderWritingReview();
   return true;
  }
  function jumpToSuggestions(){
   const suggestions=get('humanizeSuggestions');
   if(!suggestions||suggestions.hidden)return;
   suggestions.open=true;
   suggestions.scrollIntoView({block:'start',behavior:'auto'});
  }
  function setAnalysisState(state){
   if(disposed||!statePanel||!stateText)return;
   const raw=state?.status||'EMPTY';
   if(['LOADING','ANALYZING','WRITING_ONLY','UNSUPPORTED','RESEARCH_SIGNAL',
     'INCONCLUSIVE','ERROR','CANCELLED'].includes(raw))everScanned=true;
   const selected=!source.value.trim()?'EMPTY':raw==='STALE'&&!everScanned?'READY':raw;
   statePanel.dataset.state=Object.hasOwn(t().states,selected)?selected:'READY';
   const value=t().states[statePanel.dataset.state];
   if(stateText.textContent!==value)stateText.textContent=value;
  }
  function fileMessage(code,name=''){
   lastFileStatus=code;lastFileName=name;
   if(fileState)fileState.textContent=typeof t()[code]==='function'?
    t()[code](name):t()[code]||'';
  }
  const put=(id,value)=>{const node=get(id);if(node&&node.textContent!==value)node.textContent=value;};
  const t=()=>labels[language()];
  function syncDraftDownload(){
   if(draftDownload)draftDownload.disabled=!revised?.value;
  }
  function downloadDraft(){
   if(disposed||!draftDownload||!revised)return;
   const note=get('tisDraftStatus');
   if(!revised.value){
    if(note)note.textContent=t().saveEmpty;return;
   }
   try{
    const bytes=new Blob([revised.value],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(bytes);
    const link=document.createElement('a');
    link.href=url;link.download='Text-Integrity-Studio-Draft.txt';
    document.body.append(link);
    try{link.click();}
    finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
    if(note)note.textContent=t().saveDone;
   }catch{
    if(note)note.textContent=t().saveError;
   }
  }
  function renderDiff(){
   if(disposed||!diffReview?.open||!diffBefore||!diffAfter||!diffNote||!revised)return;
   const algorithm=root.TISDraftDiffPreview?.firstDifference;
   if(typeof algorithm!=='function'){
    diffNote.textContent=t().diffUnavailable;
    diffBefore.textContent='';diffAfter.textContent='';return;
   }
   let preview;
   try{preview=algorithm(source.value,revised.value,{
    maxChangeChars:160,contextChars:34
   });}
   catch{
    diffNote.textContent=t().diffUnavailable;
    diffBefore.textContent='';diffAfter.textContent='';return;
   }
   diffReview.dataset.diffStatus=preview.status;
   if(preview.status==='UNCHANGED'){
    diffNote.textContent=t().diffIdle;
    diffBefore.textContent='';diffAfter.textContent='';
   }else{
    diffNote.textContent=preview.beforeTruncated||preview.afterTruncated?
     t().diffLong:t().diffChanged;
    // textContent only: never interpret document excerpts as HTML.
    diffBefore.textContent=preview.beforeExcerpt;
    diffAfter.textContent=preview.afterExcerpt;
   }
  }
  function scheduleDiff(){
   if(disposed||!diffReview?.open)return;
   if(diffTimer!==null)clearTimeout(diffTimer);
   diffTimer=setTimeout(()=>{diffTimer=null;renderDiff();},110);
  }
  function render(){
   if(disposed)return;
   const dict=t(),selected=mode();
   put('tisV8ContextTitle',dict.title[selected]);
   put('tisV8Eyebrow',dict.eyebrow);
   put('tisV8PrivacyText',dict.privacy);
   put('v5ClickNote',selected==='detection'?dict.detectorHint:dict.writingHint);
   renderWritingReview();
   put('v5Headline',dict.headline[selected]);
   put('v5Subtitle',dict.sub[selected]);
   // UI keeps one primary Analyze button. Existing localization code owns it.
   put('tisV8Shortcut',dict.shortcut);
   paste.lastChild.textContent=' '+dict.paste;
   sample.lastChild.textContent=' '+dict.example;
   put('tisSourceLabel',dict.source);
   put('tisV8DropLabel',dict.dropLabel);
   put('tisV8DiffTitle',dict.diffTitle);
   put('tisV8DiffOriginalLabel',dict.diffBefore);
   put('tisV8DiffRevisedLabel',dict.diffAfter);
   put('tisV8SaveDraft',dict.saveDraft);
   put('tisV8SaveHelp',dict.saveHelp);
   syncDraftDownload();
   scheduleDiff();
   if(fileState&&lastFileStatus)
    fileState.textContent=typeof dict[lastFileStatus]==='function'?
     dict[lastFileStatus](lastFileName):dict[lastFileStatus]||'';
   setAnalysisState(root.TISAnalysisApp?.controller?.getState());
   put('tisV8ActionStatus',lastStatus?dict[lastStatus]||'':'');
   const nav=document.querySelectorAll('.side-navigation .nav-item');
   for(const item of nav){
    const navId=item.getAttribute('href');
    const current=selected==='detection'?navId==='#studioAiQuick':
     navId==='#inputPanel';
    item.classList.toggle('current',current);
    if(current)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
   }
  }
  function message(code){lastStatus=code;put('tisV8ActionStatus',t()[code]||'');}
  async function pasteFromClipboard(){
   if(disposed)return;
   if(source.readOnly){message('locked');return;}
   try{
    if(!navigator.clipboard||typeof navigator.clipboard.readText!=='function')
     throw new Error('CLIPBOARD_UNAVAILABLE');
    const value=await navigator.clipboard.readText();
    if(disposed)return;
    if(!value){message('empty');return;}
    if(source.readOnly){message('locked');return;}
    const from=Number.isInteger(source.selectionStart)?source.selectionStart:source.value.length;
    const to=Number.isInteger(source.selectionEnd)?source.selectionEnd:from;
    if(source.value.length-(to-from)+value.length>120000){
     message('blocked');source.focus();return;
    }
    source.setRangeText(value,from,to,'end');
    source.dispatchEvent(new Event('input',{bubbles:true}));
    source.focus({preventScroll:true});
    message('pasted');
   }catch{
    if(disposed)return;message('blocked');source.focus({preventScroll:true});
   }
  }
  function useExample(){
   const button=get('sample');if(!button)return;
   if(source.readOnly){message('locked');return;}
   button.click();message('exampleDone');
  }
  function shortcut(event){
   if(event.defaultPrevented||!(event.ctrlKey||event.metaKey)||
    event.key!=='Enter'||event.altKey||event.shiftKey)return;
   const target=event.target;
   if(target!==source&&target!==get('tisRevisedText'))return;
   if(!get('scanAI')?.disabled){event.preventDefault();get('scanAI').click();}
  }
  function fileDrag(event){
   if(!inputPanel||!overlay||!event.dataTransfer?.types?.includes('Files'))return;
   event.preventDefault();
   inputPanel.dataset.tisFileDrag='true';
   overlay.hidden=false;
  }
  function fileLeave(event){
   if(!inputPanel||!overlay)return;
   if(event.relatedTarget&&inputPanel.contains(event.relatedTarget))return;
   delete inputPanel.dataset.tisFileDrag;
   overlay.hidden=true;
  }
  function dropFile(event){
   const files=event.dataTransfer?.files;
   if(!files?.length)return;
   event.preventDefault();
   // Capture before the legacy textarea-only .txt drop handler.
   event.stopPropagation();
   fileLeave({relatedTarget:null});
   if(files.length!==1){fileMessage('multipleFiles');return;}
   const chosen=files[0];
   if(!allowedFile.test(chosen.name)){fileMessage('invalidFile');return;}
   if(!file){fileMessage('fileError');return;}
   try{
    const transfer=new DataTransfer();
    transfer.items.add(chosen);
    file.files=transfer.files;
    file.dispatchEvent(new Event('change',{bubbles:true}));
    fileMessage('selected',chosen.name);
   }catch{fileMessage('fileError');}
  }
  function onFileChange(){
   const chosen=file?.files?.[0];
   if(chosen)fileMessage('selected',chosen.name);
  }
  function keyboardUpload(event){
   if(event.key!=='Enter'&&event.key!==' ')return;
   if(!file)return;event.preventDefault();file.click();
  }
  const observe=new MutationObserver(mutations=>{
   if(mutations.some(m=>m.attributeName==='data-tis-mode'||m.attributeName==='lang'))
    render();
  });
  observe.observe(document.body,{attributes:true,attributeFilter:['data-tis-mode']});
  observe.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  paste.addEventListener('click',pasteFromClipboard);
  sample.addEventListener('click',useExample);
  document.addEventListener('keydown',shortcut);
  upload?.addEventListener('keydown',keyboardUpload);
  inputPanel?.addEventListener('dragenter',fileDrag,true);
  inputPanel?.addEventListener('dragover',fileDrag,true);
  inputPanel?.addEventListener('dragleave',fileLeave,true);
  inputPanel?.addEventListener('drop',dropFile,true);
  file?.addEventListener('change',onFileChange);
  diffReview?.addEventListener('toggle',scheduleDiff);
  source.addEventListener('input',scheduleDiff);
  revised?.addEventListener('input',scheduleDiff);
  source.addEventListener('input',syncDraftDownload);
  source.addEventListener('input',renderWritingReview);
  suggestButton?.addEventListener('click',jumpToSuggestions);
  revised?.addEventListener('input',syncDraftDownload);
  draftDownload?.addEventListener('click',downloadDraft);
  get('language')?.addEventListener('click',()=>queueMicrotask(render));
  for(const tab of document.querySelectorAll('#tisModes [role=tab]')){
   tab.addEventListener('click',()=>queueMicrotask(render));
  }
  // Users can still use the existing Word, PDF, OCR, advanced and export
  // modules; this layer does not replace or re-bind those handlers.
  render();
  root.TISWorkspaceV8=Object.freeze({
   refresh:render,setAnalysisState,setWritingReviewResult,
   dispose:()=>{
    if(disposed)return;disposed=true;observe.disconnect();
    if(diffTimer!==null)clearTimeout(diffTimer);
    diffReview?.removeEventListener('toggle',scheduleDiff);
    source.removeEventListener('input',scheduleDiff);
    revised?.removeEventListener('input',scheduleDiff);
    source.removeEventListener('input',syncDraftDownload);
    source.removeEventListener('input',renderWritingReview);
    suggestButton?.removeEventListener('click',jumpToSuggestions);
    revised?.removeEventListener('input',syncDraftDownload);
    draftDownload?.removeEventListener('click',downloadDraft);
    paste.removeEventListener('click',pasteFromClipboard);
    sample.removeEventListener('click',useExample);
    document.removeEventListener('keydown',shortcut);
    upload?.removeEventListener('keydown',keyboardUpload);
    inputPanel?.removeEventListener('dragenter',fileDrag,true);
    inputPanel?.removeEventListener('dragover',fileDrag,true);
    inputPanel?.removeEventListener('dragleave',fileLeave,true);
    inputPanel?.removeEventListener('drop',dropFile,true);
    file?.removeEventListener('change',onFileChange);
   }
  });
 }
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})(typeof window!=='undefined'?window:this);
