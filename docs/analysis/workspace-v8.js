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
   statePanel=get('tisV8AnalysisStatus'),stateText=get('tisV8StateText');
  const allowedFile=/\\.(?:docx|pdf|txt|md|csv|tsv|json|log|yaml|yml|tex|srt|vtt)$/iu;
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
  function render(){
   if(disposed)return;
   const dict=t(),selected=mode();
   put('tisV8ContextTitle',dict.title[selected]);
   put('tisV8Eyebrow',dict.eyebrow);
   put('tisV8Privacy',dict.privacy);
   put('v5Headline',dict.headline[selected]);
   put('v5Subtitle',dict.sub[selected]);
   // UI keeps one primary Analyze button. Existing localization code owns it.
   put('tisV8Shortcut',dict.shortcut);
   paste.lastChild.textContent=' '+dict.paste;
   sample.lastChild.textContent=' '+dict.example;
   put('tisSourceLabel',dict.source);
   put('tisV8DropLabel',dict.dropLabel);
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
  get('language')?.addEventListener('click',()=>queueMicrotask(render));
  for(const tab of document.querySelectorAll('#tisModes [role=tab]')){
   tab.addEventListener('click',()=>queueMicrotask(render));
  }
  // Users can still use the existing Word, PDF, OCR, advanced and export
  // modules; this layer does not replace or re-bind those handlers.
  render();
  root.TISWorkspaceV8=Object.freeze({
   refresh:render,setAnalysisState,
   dispose:()=>{
    if(disposed)return;disposed=true;observe.disconnect();
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
