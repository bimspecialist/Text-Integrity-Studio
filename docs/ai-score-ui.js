/* Main-workspace controller for an optional local ONNX detector.
 * No frame, CDN executable, or model network request before a user clicks.
 * Existing DOCX, PDF, OCR, and writing actions are unaffected.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let child=null,ready=false,currentRequest='',lastResult=null,counter=0;
const messages={
 en:{
  title:'AI text indicator',badge:'EXPERIMENTAL',unit:'Model signal',
  idle:'No model estimate yet',
  explanation:'A real English classifier can provide a research signal. This is not proof of who wrote a document.',
  run:'Get experimental AI estimate',
  consent:'First run downloads about 126 MB of model weights plus browser inference code from Hugging Face and a CDN. Your text is processed in the browser; third-party code is downloaded only after you click.',
  legal:'English only · At least 120 words · Model output is not the share of AI-written words.',
  noText:'Paste text or open a document before running AI analysis.',
  short:'At least 120 words of English are required for this experimental model.',
  language:'This classifier was trained for English. A number for Arabic or mixed writing would be misleading.',
  loading:'Initializing the browser classifier. First-time download can be large...',
  analyzing:'Analyzing your document in the browser...',
  download:p=>'Downloading model assets: '+p+'%',
  done:'Experimental model signal calculated. It is not independently calibrated and cannot establish authorship.',
  failed:'The browser model is unavailable. Check internet access, memory, or content blockers. No number was guessed.',
  unsupported:'The model returned an unknown label. No score can be shown.',
  expired:'Text changed. Re-run the model to estimate this version.',
  export:'Save model report'
 },
 ar:{
  title:'مؤشر الذكاء الاصطناعي',badge:'تجريبي',unit:'إشارة النموذج',
  idle:'لم يتم حساب نتيجة النموذج',
  explanation:'يمكن لنموذج فعلي تحليل النص الإنجليزي وإعطاء إشارة بحثية، لكنه لا يثبت هوية كاتب المستند.',
  run:'احسب مؤشر AI التجريبي',
  consent:'يُنزّل عند أول تشغيل نموذجًا بحجم يقارب 126 ميجابايت مع كود التشغيل من Hugging Face وCDN. يعمل النموذج داخل المتصفح، ولا يبدأ التنزيل إلا بعد الضغط على الزر.',
  legal:'للإنجليزية فقط · 120 كلمة على الأقل · النتيجة ليست نسبة الكلمات التي كتبها AI.',
  noText:'الصق النص أو افتح ملفًا أولًا قبل تشغيل تحليل AI.',
  short:'يحتاج النموذج التجريبي إلى 120 كلمة إنجليزية على الأقل.',
  language:'هذا النموذج مدرّب للإنجليزية. سيكون عرض رقم للنص العربي أو المختلط مضللًا.',
  loading:'يجري تهيئة النموذج. التنزيل الأول قد يكون كبيرًا...',
  analyzing:'يجري تحليل المستند محليًا...',
  download:p=>'جارٍ تنزيل النموذج: '+p+'%',
  done:'تم حساب إشارة النموذج التجريبية. لم تُعاير بشكل مستقل ولا تصلح للحكم على كاتب المستند.',
  failed:'تعذّر تنزيل النموذج أو تشغيله. تحقّق من الاتصال والذاكرة أو مانع المحتوى. لن نعرض رقمًا مخمّنًا.',
  unsupported:'أعاد النموذج تصنيفًا غير معروف؛ لم نعرض أي رقم.',
  expired:'تغيّر النص بعد التحليل. أعد تشغيل النموذج.',
  export:'حفظ تقرير النموذج'
 }
};
const lang=()=>document.documentElement.lang==='ar'?'ar':'en';
const t=()=>messages[lang()];
function label(id,value){const n=$(id);if(n)n.textContent=value;}
function setStatus(message){label('aiStatus',message);}
function reset(reason){
 lastResult=null;currentRequest='';
 $('aiBar').hidden=true;$('aiBar').value=0;
 $('aiExport').hidden=true;
 if($('aiMeterScore')?.firstChild)$('aiMeterScore').firstChild.textContent='—';
 label('aiShort',t().idle);
 setStatus(reason||'');
 $('aiRun').disabled=false;
}
function translate(){
 for(const [id,key] of [
  ['aiMeterTitle','title'],['aiBadge','badge'],['aiMeterUnit','unit'],
  ['aiMeterExplanation','explanation'],['aiRun','run'],
  ['aiConsent','consent'],['aiLegal','legal'],['aiExport','export']
 ])label(id,t()[key]);
 if(!lastResult)label('aiShort',t().idle);
 else{label('aiShort',lang()==='ar'?'إشارة نموذج AI · تجريبية':'AI model signal · experimental');setStatus(t().done);}
 label('navEditor',lang()==='ar'?'المحرر':'Editor');
 label('navResults',lang()==='ar'?'النتائج':'Results');
 label('navWriting',lang()==='ar'?'تحسين الكتابة':'Writing tools');
 label('navCleanup',lang()==='ar'?'التنظيف':'Cleanup');
 label('heroEyebrow',lang()==='ar'?'مساحة العمل / مراجعة المستند':'WORKSPACE / DOCUMENT REVIEW');
}
function eligible(text){
 const words=(text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu)||[]).length;
 if(!text.trim())return 'NO_TEXT';
 if(words<120)return 'SHORT';
 const ar=(text.match(/\p{Script=Arabic}/gu)||[]).length;
 const latin=(text.match(/[A-Za-z]/g)||[]).length;
 if(latin<Math.max(80,ar*18))return 'LANGUAGE';
 if(text.length>120000)return 'LONG';
 return null;
}
function postRun(){
 if(!ready||!child||!currentRequest)return;
 child.contentWindow.postMessage({
  channel:'TIS_BROWSER_AI_V1',op:'RUN',requestId:currentRequest,text:$('source').value
 },location.origin);
}
function start(){
 const failure=eligible($('source').value);
 if(failure){
  reset(failure==='NO_TEXT'?t().noText:failure==='SHORT'?t().short:
   failure==='LANGUAGE'?t().language:t().failed);
  $('aiMeter').scrollIntoView({block:'nearest'});
  return;
 }
 reset();currentRequest=String(Date.now())+'-'+String(++counter);
 $('aiRun').disabled=true;
 setStatus(t().loading);
 $('aiMeter').scrollIntoView({block:'nearest'});
 if(!child){
  child=document.createElement('iframe');
  child.id='tisOnDeviceModel';
  child.title='Optional browser model runtime';
  child.setAttribute('sandbox','allow-scripts allow-same-origin');
  child.setAttribute('referrerpolicy','no-referrer');
  child.setAttribute('aria-hidden','true');
  child.hidden=true;
  child.src='ai-runtime.html';
  $('aiMeter').append(child);
  return;
 }
 if(ready)postRun();
}
function onResult(data){
 const result=data.result;
 if(!result||result.calibration!=='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE'
  ||result.model_id!=='onnx-community/tmr-ai-text-detector-ONNX'
  ||!Number.isFinite(result.score)||result.score<0||result.score>100){
  fail();return;
 }
 lastResult=result;
 if($('aiMeterScore')?.firstChild)$('aiMeterScore').firstChild.textContent=result.score.toFixed(1)+'%';
 label('aiShort',lang()==='ar'?'إشارة نموذج AI · تجريبية':'AI model signal · experimental');
 $('aiBar').hidden=false;$('aiBar').value=result.score;
 $('aiExport').hidden=false;$('aiRun').disabled=false;
 setStatus(t().done);
}
function fail(code){
 lastResult=null;$('aiRun').disabled=false;
 $('aiBar').hidden=true;$('aiExport').hidden=true;
 setStatus(code==='UNVERIFIED_MODEL_LABEL'?t().unsupported:
  code==='UNSUPPORTED_LANGUAGE'?t().language:
  code==='MIN_WORDS'?t().short:t().failed);
}
function onMessage(event){
 if(!child||event.source!==child.contentWindow||event.origin!==location.origin)return;
 const data=event.data;
 if(!data||data.channel!=='TIS_BROWSER_AI_V1')return;
 if(data.op==='READY'){ready=true;postRun();return;}
 if(!currentRequest||data.requestId!==currentRequest)return;
 if(data.op==='PROGRESS'){
  if(data.stage==='DOWNLOADING'&&Number.isFinite(data.percent)){
   setStatus(t().download(data.percent));
  }else setStatus(data.stage==='ANALYZING'?t().analyzing:t().loading);
 }else if(data.op==='RESULT'){
  onResult(data);currentRequest='';
 }else if(data.op==='ERROR'){
  fail(data.code);currentRequest='';
 }
}
function exportResult(){
 if(!lastResult)return;
 const report={
  software:'Text Integrity Studio',source:'Browser ONNX research signal',
  generatedAt:new Date().toISOString(),...lastResult,
  privacy:'Original document text excluded.',
  usage:'Not evidence sufficient for authorship or misconduct decisions.'
 };
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
 const a=document.createElement('a');
 a.href=url;a.download='ai-model-research-signal.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function initialize(){
 if(!$('aiMeter')||!$('aiRun'))return;
 $('aiRun').addEventListener('click',start);
 $('aiExport').addEventListener('click',exportResult);
 $('source')?.addEventListener('input',()=>{
  if(lastResult||currentRequest)reset(t().expired);
 });
 for(const id of ['clear','sample'])$(id)?.addEventListener('click',()=>reset());
 $('file')?.addEventListener('change',()=>reset());
 $('language')?.addEventListener('click',translate);
 window.addEventListener('message',onMessage);
 translate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
else initialize();
})();
