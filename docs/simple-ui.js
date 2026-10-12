/* Text Integrity Studio — Progressive disclosure layer.
 * Preserves original tool IDs, event handlers, file handling and all exports.
 * Must load after the existing document and editor modules.
 */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const copy = {
 en:{
   fileDescription:'or paste text below · processed on your device',
   sourceLabel:'Text to check',
   stepInput:'1 · Add text or file',stepScan:'2 · Check',stepSave:'3 · Review and save',
   editorMore:'Text statistics and undo / redo',
   cleanupSummary:'Clean invisible characters',
   cleanupDescription:'Optional · preview before applying',
   aboutSummary:'Privacy and AI score information',
   reportMoreLabel:'View detailed findings',
   writingSummary:'Improve grammar and clarity',
   writingHint:'Optional · review every proposed edit',
   pdfSummary:'PDF tools and OCR',pdfHint:'For scanned documents',
   wordSummary:'Extra Word upload options',wordHint:'One file picker works for every format',
   wordReportSummary:'Full Word inspection details',
   wordOptionsSummary:'Additional Word settings',
   aiSummary:'Experimental AI research',aiHint:'Optional · requires your own model',
   inputEmpty:'0 words · Add text or choose a file',
   inputCount: n => n+' words · '+(n>0?'Ready to check':'Add text'),
   resultsEmpty:'Your results will appear after you add text.',
   resultsReady: (n,c) => c ? n+' words checked · '+c+' observations found.' : n+' words checked · No issues found in these checks.',
   resultsSuggestion: n=>n+' writing suggestions available for your review.',
   review:'Review writing suggestions',reviewWord:'Review suggested Word edits',
   scannedPdf:'PDF loaded · open OCR tools when necessary.',
   reportText:'No verified AI-origin percentage is available without independently validated model weights.',
   fileSelection:'Selected file: ',fileNo:'Text stays on your device',
 },
 ar:{
   fileDescription:'أو ألصق النص أدناه · يعالج على جهازك',
   sourceLabel:'النص المطلوب فحصه',
   stepInput:'1 · أضف النص أو الملف',stepScan:'2 · افحص',stepSave:'3 · راجع واحفظ',
   editorMore:'إحصاءات النص والتراجع والإعادة',
   cleanupSummary:'تنظيف الأحرف غير المرئية',
   cleanupDescription:'اختياري · عاين قبل التطبيق',
   aboutSummary:'الخصوصية ومعلومات نتيجة AI',
   reportMoreLabel:'عرض الملاحظات التفصيلية',
   writingSummary:'تحسين اللغة والوضوح',
   writingHint:'اختياري · راجع كل تعديل مقترح',
   pdfSummary:'أدوات PDF والتعرف الضوئي OCR',pdfHint:'للمستندات المصورة',
   wordSummary:'خيارات إضافية لملفات Word',wordHint:'زر رفع واحد لجميع الصيغ',
   wordReportSummary:'تفاصيل فحص مستند Word',
   wordOptionsSummary:'المزيد من خيارات Word',
   aiSummary:'بحوث الكشف التجريبية للذكاء الاصطناعي',aiHint:'اختياري · يتطلب نموذجًا منك',
   inputEmpty:'0 كلمات · أضف نصًا أو اختر ملفًا',
   inputCount: n=>n+' كلمة · '+(n>0?'جاهز للفحص':'أضف نصًا'),
   resultsEmpty:'ستظهر النتائج بعد إضافة النص.',
   resultsReady:(n,c)=>c?n+' كلمة تم فحصها · '+c+' ملاحظة.':n+' كلمة تم فحصها · لا ملاحظات ضمن الفحص الحالي.',
   resultsSuggestion:n=>n+' اقتراحًا لغويًا متاحًا للمراجعة.',
   review:'مراجعة اقتراحات التحسين',reviewWord:'مراجعة تعديلات Word المقترحة',
   scannedPdf:'تم فتح ملف PDF · استخدم OCR عند الحاجة.',
   reportText:'لا توجد نسبة AI معتمدة دون نموذج اجتاز التحقق العلمي المستقل.',
 }
};
const language=()=>document.documentElement.lang==='ar'?'ar':'en';
const strings=()=>copy[language()];
function setText(id,value){if($(id))$(id).textContent=value;}
function disclosure(element,id,label,hint,options={}){
 if(!element)return null;
 const parent=element.parentElement;
 const container=document.createElement('details');
 container.className='tool-details tool-disclosure';
 container.id=id;
 if(options.hidden)container.hidden=true;
 const summary=document.createElement('summary');
 const title=document.createElement('span');
 title.id=id+'Label';title.className='disclosure-name';title.textContent=label;
 const detail=document.createElement('small');
 detail.id=id+'Hint';detail.className='disclosure-note';detail.textContent=hint;
 summary.append(title,detail);container.append(summary);
 parent.insertBefore(container,element);
 container.append(element);
 return container;
}
let writingTools, pdfTools, wordReportTools, wordPickTools, researchTools, wordOptions;
function setupWordOptions(){
 const toolbar=$('wordToolbar');
 if(!toolbar)return;
 const optional=document.createElement('details');
 optional.className='tool-details word-more';
 optional.id='wordExtraOptions';
 const summary=document.createElement('summary');
 summary.id='wordExtraLabel';
 summary.textContent=strings().wordOptionsSummary;
 optional.append(summary);
 for(const id of ['stripHidden','wordTrackEdits']){
   const label=$(id)?.closest('label');
   if(label)optional.append(label);
 }
 const wordCopy=$('wordCopy');
 if(wordCopy)optional.append(wordCopy.closest('.row'));
 const warning=$('wordSafe');
 if(warning)optional.append(warning);
 toolbar.append(optional);
 wordOptions=optional;
}
function setFileHint(){
 const uploaded=$('file')?.files?.[0];
 const label=uploaded?.name? strings().fileSelection+uploaded.name:strings().fileNo;
 if($('quickFileHint'))$('quickFileHint').textContent=label;
}
function updateSummary(){
 const len=Number($('words')?.textContent||0);
 const flags=Number($('flags')?.textContent||0);
 const meaningful=$('source')?.value.trim()||'';
 const scanned=Boolean(meaningful);
 setText('quickInputState',scanned?strings().inputCount(len):strings().inputEmpty);
 const labCount=document.querySelectorAll('#labResults .writing-card').length;
 const visibleSuggestions=scanned?labCount:0;
 let message=scanned?strings().resultsReady(len,flags):strings().resultsEmpty;
 if(visibleSuggestions)message+=' '+strings().resultsSuggestion(visibleSuggestions);
 setText('quickReport',message);
 const review=$('quickReview');
 if(review){
   review.hidden=!visibleSuggestions;
   review.textContent=$('source')?.readOnly?strings().reviewWord:strings().review;
 }
 const report=$('wordReport');
 if(report&&wordReportTools)wordReportTools.hidden=report.hidden;
 const pdfLoaded=$('pdfDetails') && !$('pdfDetails').hidden;
 const pdfFile=/\.pdf$/i.test($('file')?.files?.[0]?.name||'');
 if(pdfTools &&(pdfLoaded||pdfFile))pdfTools.open=true;
 setFileHint();
}
function translate(){
 const labels=strings();
 const ids=['fileDescription','sourceLabel','stepInput','stepScan','stepSave',
 'editorMore','cleanupSummary','cleanupDescription','aboutSummary','reportMoreLabel'];
 for(const id of ids)setText(id,labels[id]);
 for(const [box,k] of [[writingTools,'writing'],[pdfTools,'pdf'],[wordPickTools,'word'],[wordReportTools,'wordReport'],[researchTools,'ai']]){
   if(!box)continue;
   const title=$(box.id+'Label'),hint=$(box.id+'Hint');
   if(title)title.textContent=labels[k+'Summary'];
   if(hint)hint.textContent=labels[k+'Hint']||'';
 }
 if(wordOptions)wordOptions.querySelector('summary').textContent=labels.wordOptionsSummary;
 updateSummary();
}
function show(details){
 if(!details)return;
 details.open=true;
 details.scrollIntoView({behavior:'auto',block:'start'});
}
function setup(){
 const main=document.querySelector('.workspace > div:first-child');
 if(!main||!$('source')||!$('scan'))return;
 const writing=$('writingLab'), wordPick=$('wordDrop'),
   pdf=$('pdfPanel'),wordReport=$('wordReport'),research=$('researchSignal');
 writingTools=disclosure(writing,'writingTools',copy.en.writingSummary,copy.en.writingHint);
 wordPickTools=disclosure(wordPick,'wordPickerOptions',copy.en.wordSummary,copy.en.wordHint);
 pdfTools=disclosure(pdf,'pdfTools',copy.en.pdfSummary,copy.en.pdfHint);
 wordReportTools=disclosure(wordReport,'wordReportTools',copy.en.wordReportSummary,'',{hidden:true});
 researchTools=disclosure(research,'researchTools',copy.en.aiSummary,copy.en.aiHint);
 // Preserve module event handlers, but put results first and the least-used tools last.
 const results=document.querySelector('.workspace > div:last-child');
 if(results && $('reportPanel'))results.prepend($('reportPanel'));
 if(writingTools && $('cleanupTools'))main.insertBefore(writingTools,$('cleanupTools'));
 if(wordPickTools)main.append(wordPickTools);
 setupWordOptions();
 // A small textual filename hint avoids requiring a second document picker.
 const hint=document.createElement('span');
 hint.id='quickFileHint';hint.className='small inline-file-status';
 const input=$('file');
 input.closest('label')?.insertAdjacentElement('afterend',hint);

 // One visible Check button also runs the existing grammar/clarity analyzer.
 $('scan').addEventListener('click',()=>{
   if(!$('source').value.trim()){
     $('source').focus();
     updateSummary();
     return;
   }
   $('labAnalyze')?.click();
   $('reportMore').open=true;
   updateSummary();
 });
 $('quickReview').addEventListener('click',()=>show(writingTools));
 $('quickClean').addEventListener('click',()=>{
   show($('cleanupTools'));
   $('preview')?.click();
   if($('resultbox')&&!$('resultbox').hidden)$('resultbox').scrollIntoView({block:'nearest'});
 });
 $('language').addEventListener('click',translate);
 for(const event of ['input','change'])$('source').addEventListener(event,updateSummary);
 for(const id of ['sample','clear','undo','redo','labAnalyze','labApply','labPreview','wordPreview']){
   $(id)?.addEventListener('click',()=>queueMicrotask(updateSummary));
 }
 input.addEventListener('change',()=>{
   const f=input.files?.[0];
   if(f&&/\.pdf$/i.test(f.name)&&pdfTools)pdfTools.open=true;
   queueMicrotask(updateSummary);
 });
 for(const [id,options] of [
   ['words',{childList:true,characterData:true,subtree:true}],
   ['flags',{childList:true,characterData:true,subtree:true}],
   ['labResults',{childList:true,subtree:false}],
   ['wordReport',{attributes:true,attributeFilter:['hidden']}],
   ['pdfDetails',{attributes:true,attributeFilter:['hidden']}],
   ['wordToolbar',{attributes:true,attributeFilter:['hidden']}]
 ]){
   if($(id))new MutationObserver(updateSummary).observe($(id),options);
 }
 translate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
else setup();
})();
