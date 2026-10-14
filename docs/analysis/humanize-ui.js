/* Text Integrity Studio — optional post-scan, on-device writing review.
 * Uses textContent for source excerpts. Apply is never automatic and always
 * invalidates prior detector evidence through DocumentSession revisions.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISHumanizeUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const copy={
  en:{
   title:'Make writing more natural',local:'Local editorial guidance · not AI authorship evidence',
   noChanges:'No specific editorial changes identified. This does not establish human authorship.',
   start:'Choose Analyze Text to review writing suggestions.',
   edited:'The text changed. Previous evidence was cleared; use Analyze Text when ready.',
   preview:'Preview',apply:'Apply',undo:'Undo change',before:'Before',after:'After',
   manual:'Human review needed; supply real details without inventing facts.',
   docx:'Word document: review in the existing Word editing tools. Original file preserved.',
   stale:'The document changed. Analyze the current text before applying suggestions.',
   undone:'Previous edit restored. Model results remain cleared until the next analysis.',
   extra:'More optional suggestions',reference:'Writing guidance',
   notAllowed:'Only a reviewed low-risk suggestion may be applied.',failure:'The edit could not be applied.',
   applied:'Reviewed change applied. You can undo it.',section:'Section',
   compare:'Change in uncalibrated research signal',points:'points',
   unavailable:'Research-signal comparison unavailable',notAuthorship:'This does not establish who wrote the text.'
  },
  ar:{
   title:'اجعل الكتابة أكثر طبيعية',local:'مقترحات تحرير محلية، وليست دليلًا على مصدر كتابة النص',
   noChanges:'لا توجد تعديلات تحريرية محددة. هذا لا يثبت أن النص مكتوب بواسطة إنسان.',
   start:'اضغط على تحليل النص لمراجعة مقترحات الكتابة.',
   edited:'تغيّر النص وأُلغيت النتائج السابقة. يمكنك إعادة التحليل عندما تصبح جاهزًا.',
   preview:'معاينة',apply:'تطبيق',undo:'التراجع عن التعديل',before:'قبل',after:'بعد',
   manual:'تحتاج الصياغة إلى مراجعتك. أضف معلومات حقيقية دون اختراع حقائق.',
   docx:'ملف Word للقراءة فقط. راجع التعديلات عبر أدوات Word الحالية. يبقى الملف الأصلي محفوظًا.',
   stale:'تغيّر النص. أعد تحليل النسخة الحالية قبل تطبيق المقترح.',
   undone:'تم استرجاع التعديل. ستظل نتائج الكشف السابقة ملغاة حتى الفحص التالي.',
   extra:'مقترحات إضافية',reference:'مرجع إرشادي للكتابة',
   notAllowed:'يمكن فقط تطبيق التعديلات الآمنة بعد المراجعة.',failure:'تعذّر تطبيق التعديل.',
   applied:'تم تطبيق التعديل بعد موافقتك. يمكنك التراجع عنه.',section:'فقرة',
   compare:'التغير في إشارة النموذج البحثية غير المعايرة',points:'نقطة',
   unavailable:'لا تتوفر مقارنة موثوقة بين نتيجتي النموذج',notAuthorship:'لا يثبت هذا من كتب النص.'
  }
 };
 const text=(node,value)=>{if(node)node.textContent=String(value??'');return node;};
 const element=(name,cls,value)=>{
  const node=document.createElement(name);
  if(cls)node.className=cls;
  if(value!==undefined)text(node,value);
  return node;
 };
 function mount({root,session,review,controller,locale,onApplied,onUndoApplied,onPreviewSuggestion}={}){
  if(!root||!session||typeof session.read!=='function'||
   !review||typeof review.getSuggestions!=='function'||
   !controller||typeof controller.getState!=='function')
   throw new TypeError('Humanize UI needs the shared session, review and analysis controller');
  const cards=root.querySelector('#humanizeSuggestionCards'),
   status=root.querySelector('#humanizeReviewStatus'),
   undo=root.querySelector('#humanizeUndo'),
   subtitle=root.querySelector('#humanizeSubtitle'),
   expand=root.querySelector('#humanizeMore'),
   moreCards=root.querySelector('#humanizeMoreCards'),
   comparison=root.querySelector('#humanizeComparison');
  if(!cards||!status||!undo||!subtitle||!expand||!moreCards||!comparison)throw Error('Missing Humanize markup');
  let disposed=false,analyzedRevision=null,allowUndo=false,lastComparison=null,disclosureSerial=0;
  function showComparison(result){
   lastComparison=result||null;
   if(!result){comparison.hidden=true;text(comparison,'');return;}
   const d=tr();
   const message=result.comparable===true&&Number.isFinite(result.differencePoints)?
    d.compare+': '+(result.differencePoints>0?'+':'')+result.differencePoints.toFixed(1)+' '+d.points+'. '+d.notAuthorship:
    d.unavailable+'. '+d.notAuthorship;
   text(comparison,message);comparison.hidden=false;
  }
  const tr=()=>copy[(locale?locale():document.documentElement.lang)==='ar'?'ar':'en'];
  function note(value){text(status,value);}
  function card(item){
   const d=tr(),n=element('article','humanize-card');
   n.dataset.suggestionId=item.id;
   const label=element('strong','humanize-kind',d.section+' '+item.section+' · '+item.category);
   const reason=element('p','humanize-reason',item.reason);
   const before=element('p','humanize-before',item.original);
   const after=element('p','humanize-after',item.proposedReplacement??d.manual);
   const previewBlock=element('div','humanize-preview-detail');
   // A unique explicit relationship lets keyboard/screen-reader users know
   // which Before/After excerpt the Preview button expands.
   previewBlock.id='tis-humanize-preview-'+(++disclosureSerial);
   previewBlock.setAttribute('role','region');
   previewBlock.setAttribute('aria-label',d.preview+' · '+d.section+' '+item.section);
   previewBlock.hidden=true;
   previewBlock.append(
    element('strong','',d.before),element('blockquote','humanize-quote',item.original),
    element('strong','',d.after),element('blockquote','humanize-quote',item.proposedReplacement??d.manual)
   );
   const buttons=element('div','humanize-actions');
   const preview=element('button','humanize-preview',d.preview);
   preview.type='button';
   preview.setAttribute('aria-label',d.preview+' · '+d.section+' '+item.section);
   preview.setAttribute('aria-controls',previewBlock.id);
   preview.setAttribute('aria-expanded','false');
   preview.addEventListener('click',()=>{
    const current=review.preview(item.id);
    if(!current){note(d.stale);return;}
    previewBlock.hidden=!previewBlock.hidden;
    preview.setAttribute('aria-expanded',String(!previewBlock.hidden));
    if(!previewBlock.hidden&&typeof onPreviewSuggestion==='function')onPreviewSuggestion(item);
   });
   const apply=element('button','humanize-apply',d.apply);
   apply.type='button';
   const readonly=session.read().sourceKind==='docx';
   apply.disabled=readonly||item.risk!=='low'||item.proposedReplacement===null;
   apply.setAttribute('aria-label',d.apply+' · '+d.section+' '+item.section);
   apply.addEventListener('click',()=>{
    const verified=controller.getState();
    const before=verified.status==='RESEARCH_SIGNAL'?verified.evidence:null;
    const result=review.apply(item.id);
    if(!result.applied){
     note(result.reason==='WORD_READ_ONLY'?d.docx:
      result.reason==='STALE_REVISION'?d.stale:result.reason==='MANUAL_ONLY'?d.notAllowed:d.failure);
     return;
    }
    allowUndo=true;
    if(typeof onApplied==='function')onApplied(before);
    const input=document.getElementById('source');
    if(input){
     input.value=result.snapshot.text;
     input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    undo.disabled=false;
    note(d.applied);
   });
   buttons.append(preview,apply);
   if(item.reference){
    try{
     const uri=new URL(item.reference);
     if(uri.protocol==='https:'&&
      ['www.plainlanguage.gov','plainlanguage.gov','owl.purdue.edu'].includes(uri.hostname)){
      const link=element('a','humanize-reference',d.reference);
      link.href=uri.href;link.target='_blank';link.rel='noopener noreferrer';
      buttons.append(link);
     }
    }catch{}
   }
   if(readonly){
    n.append(element('small','humanize-readonly',d.docx));
   }
   n.append(label,reason,before,after,buttons,previewBlock);
   return n;
  }
  function renderSuggestions(){
   cards.replaceChildren();moreCards.replaceChildren();
   const items=review.getSuggestions();
   for(const item of items.slice(0,3))cards.append(card(item));
   for(const item of items.slice(3))moreCards.append(card(item));
   expand.hidden=items.length<=3;
   undo.disabled=!allowUndo;
   if(!items.length)cards.append(element('p','humanize-empty',tr().noChanges));
  }
  function refresh(){
   if(disposed)return;
   if(!session.read().text.trim()){
    root.hidden=true;analyzedRevision=null;return;
   }
   review.refresh();
   analyzedRevision=session.read().revision;
   root.hidden=false;root.open=true;
   text(root.querySelector('summary'),tr().title);
   text(subtitle,tr().local);
   text(expand.querySelector('summary'),tr().extra);
   text(undo,tr().undo);
   note(session.read().sourceKind==='docx'?tr().docx:tr().local);
   renderSuggestions();
  }
  const unsubscribe=session.subscribe(snapshot=>{
   if(disposed||analyzedRevision===null||snapshot.revision===analyzedRevision)return;
   analyzedRevision=null;
   showComparison(null);
   cards.replaceChildren();moreCards.replaceChildren();expand.hidden=true;
   undo.disabled=!allowUndo;
   note(tr().edited);
  });
  const onUndo=()=>{
   if(!allowUndo)return;
   const restored=review.undo();
   if(!restored.restored){allowUndo=false;undo.disabled=true;note(tr().stale);return;}
   if(typeof onUndoApplied==='function')onUndoApplied();
   const input=document.getElementById('source');
   if(input){
    input.value=restored.snapshot.text;
    input.dispatchEvent(new Event('input',{bubbles:true}));
   }
   // Existing undo stack is kept in memory by the review; the explicit
   // next click will harmlessly report NO_HISTORY when exhausted.
   note(tr().undone);
   undo.disabled=false;
  };
  const onLang=()=>queueMicrotask(()=>{
   if(disposed)return;
   text(root.querySelector('summary'),tr().title);
   text(subtitle,tr().local);text(undo,tr().undo);
   text(expand.querySelector('summary'),tr().extra);
   if(root.hidden)return;
   if(analyzedRevision===session.read().revision)renderSuggestions();
   if(lastComparison)showComparison(lastComparison);
  });
  undo.addEventListener('click',onUndo);
  const languageButton=document.getElementById('language');
  languageButton?.addEventListener('click',onLang);
  root.hidden=true;
  function dispose(){
   if(disposed)return;
   disposed=true;unsubscribe();
   undo.removeEventListener('click',onUndo);
   languageButton?.removeEventListener('click',onLang);
  }
  return Object.freeze({refresh,showComparison,clearComparison:()=>showComparison(null),dispose});
 }
 return Object.freeze({mount});
});
