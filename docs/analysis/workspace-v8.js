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
    upload:'Upload file',source:'Before'
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
    upload:'رفع ملف',source:'قبل'
   }
  };
  const mode=()=>['humanize','editor'].includes(document.body.dataset.tisMode)?
   document.body.dataset.tisMode:'detection';
  const language=()=>document.documentElement.lang==='ar'?'ar':'en';
  let disposed=false,lastStatus='';
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
  get('language')?.addEventListener('click',()=>queueMicrotask(render));
  for(const tab of document.querySelectorAll('#tisModes [role=tab]')){
   tab.addEventListener('click',()=>queueMicrotask(render));
  }
  // Users can still use the existing Word, PDF, OCR, advanced and export
  // modules; this layer does not replace or re-bind those handlers.
  render();
  root.TISWorkspaceV8=Object.freeze({
   refresh:render,
   dispose:()=>{
    if(disposed)return;disposed=true;observe.disconnect();
    paste.removeEventListener('click',pasteFromClipboard);
    sample.removeEventListener('click',useExample);
    document.removeEventListener('keydown',shortcut);
    upload?.removeEventListener('keydown',keyboardUpload);
   }
  });
 }
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})(typeof window!=='undefined'?window:this);
