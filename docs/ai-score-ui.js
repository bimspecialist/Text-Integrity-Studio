/* TIS advanced evidence UI — honest statistics, clear uncertainty, easy workflow.
 * The regular editor/Word/PDF/OCR/cleanup features continue unchanged.
 * No client-secret or remote text upload; optional model downloads need consent.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const VERSION='TIS_CONSENSUS_V2_2026_10';
const PRIMARY='onnx-community/tmr-ai-text-detector-ONNX';
let child=null,ready=false,currentRequest='',lastResult=null,counter=0;
let inputSnapshot='',running=false;
const languages={
 en:{
  title:'AI text evidence',badge:'EXPERIMENTAL',unit:'Model signal',
  idle:'No analysis yet',
  explanation:'Multiple text windows and an optional second detector show model evidence and disagreement, not certain authorship.',
  run:'Analyze AI model signals',
  consent:'First use downloads an English RoBERTa model (~126 MB) to your browser. Deep cross-check optionally downloads a second ~126 MB historical GPT-2 detector. Remote code/model downloads require internet; the app does not submit your document to a remote inference API.',
  legal:'Uncalibrated classifier diagnostics · not a percentage of AI-authored words · English only, 120+ words. False positives remain possible.',
  advanced:'Deep analysis options',
  deep:'Compare with a second detector (more data and memory)',
  deepHelp:'Optional model checks disagreement. It was trained on GPT-2 (2019), so it does not guarantee modern detection accuracy.',
  fullScan:'Check more of long documents (slower)',
  fullScanHelp:'Inspect up to 96 actual model-token windows rather than 12. This improves document coverage, not demonstrated classifier accuracy. It uses more CPU and memory.',
  hetero:'Document has contradictory passages — no useful single percentage',
  cancel:'Cancel analysis',cancelled:'Analysis cancelled. No score was saved.',
  overflow:'Only the first 16 analyzed passages are shown here; the downloadable evidence report contains all measured passages.',

  contextLabel:'Writing context',
  pilotTitle:'Observed false-alert risk:',
  pilotText:'In one small HC3 public benchmark, 13 of 24 human-labeled texts scored at least 80% with the main model. Labels were not independently verified. Do not treat high scores as authorship proof.',
  pilotLink:'View test',
  evidenceTitle:'View model comparison and analyzed passages',
  noText:'Paste text or open a document before running analysis.',
  short:'120 or more words of English text are required for this analysis.',
  language:'English-only models cannot reliably estimate Arabic or mixed-language writing.',
  loading:'Preparing on-device detectors. Large model downloads may take a while...',
  analyzing:'Analyzing actual model-token windows. No text is being sent to a detector server.',
  download:(p,model)=>'Downloading '+model+' model assets: '+p+'%',
  done:'Model diagnostics calculated. They are not independently calibrated for this website.',
  failed:'The model could not run. Check network access, browser memory or content blockers. No fabricated result is shown.',
  unsupported:'Unexpected model output or class labels; results withheld.',
  expired:'The text changed. Analyze again to evaluate this version.',
  export:'Download model evidence',
  uncertain:'Models disagree — no defensible combined percentage',
  lowCoverage:'Too little of the document could be analyzed — no combined percentage',
  partial:'Only the main model completed. No two-model agreement was assessed.',
  measured:'Primary model signal (research-only, not authorship probability)',
  models:'Model comparison',
  coverage:'Document sampled',
  tokens:'Maximum tokens per window',
  segments:'Text passages',
  reportWindow:'Analyzed passage',
  flags:'Limitations & uncertainty',
  noFlags:'No additional processing warnings (model accuracy remains unverified).',
  labelPrimary:'TMR (2025 / RAID)',
  labelSecondary:'OpenAI (2019 / GPT-2)',
  scoreLabel:'Uncalibrated AI-class signal',
  contextWarning:'Scores can be biased by academic, polished or second-language writing.',
  notHuman:'A lower model signal never proves human authorship.',
  indicatorFallback:'Model analysis unavailable',
  statusAgreement:'Both models produced broadly similar signals. This is not proof that either is correct.',
  statusSampled:'Only a sample of this document was processed; see coverage below.',
  modelReason:'The two detectors were trained on different generators and eras. Their numbers are not directly comparable to commercial detectors.',
  noTextInReport:'Source text excluded from saved report.',
  flagMap:{
   LOW_DOCUMENT_COVERAGE:'A limited fraction of the document was processed.',
   CONFLICTING_PASSAGES:'Some passages give opposite model signals.',
   HIGH_SEGMENT_VARIANCE:'Substantial variation between document sections.',
   FORMAL_OR_NON_NATIVE_FALSE_POSITIVE_RISK:'Formal or second-language writing can be falsely flagged.',
   MODELS_DISAGREE:'Models differ by more than 25 percentage points.',
   SECONDARY_LOW_COVERAGE:'The cross-check covered too little of the text.',
   SECONDARY_MIXED_PASSAGES:'Cross-check signals vary sharply across passages.',
   SECONDARY_MODEL_UNAVAILABLE:'The second model could not be loaded or run.',
   DOCUMENT_WIDE_SCORE_NOT_REPRESENTATIVE:'A single document-wide score would conceal contradictory passage evidence.'
  }
 },
 ar:{
  title:'أدلة الكشف عن AI',badge:'تجريبي',unit:'إشارة النموذج',
  idle:'لم يبدأ التحليل بعد',
  explanation:'تحليل عدة مقاطع من النص، مع نموذج ثانٍ اختياري لإظهار اختلاف النتائج، وليس لإثبات هوية الكاتب.',
  run:'تحليل مؤشرات الذكاء الاصطناعي',
  consent:'يُنزَّل أولًا نموذج RoBERTa إنجليزي (~126 ميجابايت) إلى المتصفح. المقارنة العميقة تنزّل نموذج GPT-2 تاريخيًا إضافيًا (~126 ميجابايت). لا يرسل التطبيق المستند عمدًا إلى خدمة كشف بعيدة، لكنه يحتاج اتصالًا لتنزيل الأكواد والأوزان.',
  legal:'مؤشرات نماذج غير معايرة · ليست نسبة الكلمات المكتوبة بالذكاء الاصطناعي · إنجليزي فقط، 120 كلمة فأكثر. قد تحدث نتائج إيجابية خاطئة.',
  advanced:'خيارات الفحص المتقدم',
  deep:'قارن مع نموذج ثانٍ (يستهلك تنزيلًا وذاكرة أكبر)',
  deepHelp:'نموذج إضافي مدرَّب على GPT-2 عام 2019. لا يضمن كشف النصوص المولَّدة بالنماذج الحديثة.',
  fullScan:'افحص أجزاءً أكثر من المستندات الطويلة (أبطأ)',
  fullScanHelp:'يفحص حتى 96 مقطعًا ضمن حد الرموز الفعلي بدل 12. يزيد مقدار النص المُفحَص، ولا يعني زيادة مثبتة في دقة النموذج. يستهلك موارد إضافية.',
  hetero:'مقاطع المستند متعارضة — لا تصلح نسبة إجمالية واحدة',
  cancel:'إلغاء التحليل',cancelled:'أُلغِي التحليل ولم تُحفظ نتيجة.',
  overflow:'عُرضت أول 16 مقطعًا فقط؛ يمكن تنزيل التقرير للاطلاع على كل المقاطع المفحوصة.',

  contextLabel:'نوع الكتابة',
  pilotTitle:'خطر الخطأ في التنبيه:',
  pilotText:'في اختبار محدود على مجموعة HC3 العامة، حصل 13 من أصل 24 نصًا مصنفًا بشريًا على إشارة 80% أو أكثر من النموذج الأساسي. تسميات المصدر لم تُراجع بشكل مستقل. لا تستخدم النتيجة لإثبات هوية الكاتب.',
  pilotLink:'عرض الاختبار',
  evidenceTitle:'مقارنة النماذج والمقاطع التي تم فحصها',
  noText:'الصق النص أو افتح مستندًا أولًا.',
  short:'يتطلب التحليل 120 كلمة إنجليزية على الأقل.',
  language:'لا يمكن لنموذج إنجليزي إصدار درجة موثوقة للنص العربي أو المختلط.',
  loading:'تجهيز نماذج الجهاز. قد يكون تنزيل الملفات كبيرًا...',
  analyzing:'يُفحص النص بمقاطع ضمن حد الرموز الحقيقي للنموذج، دون إرسال النص إلى خادم كشف.',
  download:(p,model)=>'تنزيل ملفات نموذج '+model+': '+p+'%',
  done:'اكتمل حساب مؤشرات النماذج، لكنها لم تُعاير بشكل مستقل لهذا الموقع.',
  failed:'تعذر تشغيل النموذج. تحقق من الشبكة والذاكرة ومانع المحتوى. لن نعرض رقمًا افتراضيًا.',
  unsupported:'خرج تصنيف غير متوقع من النموذج، ولذلك حُجبت النتيجة.',
  expired:'تغيّر النص بعد الفحص؛ شغّل التحليل مجددًا.',
  export:'تنزيل تقرير أدلة النماذج',
  uncertain:'النموذجان مختلفان — لا توجد نسبة موحدة يمكن الدفاع عنها',
  lowCoverage:'لم تدخل كمية كافية من المستند في الفحص — لا توجد نسبة موحدة',
  partial:'عمل النموذج الرئيسي فقط؛ لم يُتحقق من اتفاق النموذجين.',
  measured:'إشارة النموذج الأساسي (بحثية وليست احتمال إثبات الكتابة)',
  models:'مقارنة النموذجين',
  coverage:'نسبة النص المُعايَن',
  tokens:'الحد الأعلى للرموز في المقطع',
  segments:'المقاطع المفحوصة',
  reportWindow:'مقطع مفحوص',
  flags:'القيود وعدم اليقين',
  noFlags:'لم تُرصد ملاحظات معالجة إضافية، لكن الدقة لم تُتحقق بصورة مستقلة.',
  labelPrimary:'TMR ‏(2025 / RAID)',
  labelSecondary:'OpenAI ‏(2019 / GPT-2)',
  scoreLabel:'إشارة تصنيف AI غير معايرة',
  contextWarning:'قد تُصنف الكتابة الأكاديمية أو المنقحة أو الإنجليزية كلغة ثانية خطأ.',
  notHuman:'انخفاض إشارة النموذج لا يثبت أن النص كتبه إنسان.',
  indicatorFallback:'نتيجة النموذج غير متاحة',
  statusAgreement:'أعطى النموذجان إشارات متقاربة، ولا يثبت ذلك صحة أيّ منهما.',
  statusSampled:'تم فحص عيّنة فقط من المستند، راجع نسبة التغطية.',
  modelReason:'تدرب النموذجان على بيانات وعصور مختلفة، لذا لا تقارن أرقامهـما مباشرة بمواقع تجارية.',
  noTextInReport:'لم يُدرج محتوى المستند في التقرير.',
  flagMap:{
   LOW_DOCUMENT_COVERAGE:'تم فحص جزء محدود من المستند.',
   CONFLICTING_PASSAGES:'تختلف إشارات النموذج بقوة بين مقاطع المستند.',
   HIGH_SEGMENT_VARIANCE:'تباين مرتفع بين المقاطع.',
   FORMAL_OR_NON_NATIVE_FALSE_POSITIVE_RISK:'احتمال نتائج خاطئة في الكتابة الرسمية أو الإنجليزية كلغة ثانية.',
   MODELS_DISAGREE:'يختلف النموذجان بأكثر من 25 نقطة مئوية.',
   SECONDARY_LOW_COVERAGE:'تغطية غير كافية للنموذج الثاني.',
   SECONDARY_MIXED_PASSAGES:'اختلاف كبير في نتائج مقاطع النموذج الثاني.',
   SECONDARY_MODEL_UNAVAILABLE:'تعذّر تشغيل النموذج الثاني.',
   DOCUMENT_WIDE_SCORE_NOT_REPRESENTATIVE:'النسبة الإجمالية تخفي اختلافًا جوهريًا بين المقاطع.'
  }
 }
};
const lang=()=>document.documentElement.lang==='ar'?'ar':'en';
const t=()=>languages[lang()];
function set(id,value){if($(id))$(id).textContent=value;}
function status(value){set('aiStatus',value);}
function cancel(){
 if(currentRequest&&child?.contentWindow)
  child.contentWindow.postMessage({channel:'TIS_BROWSER_AI_V1',op:'CANCEL',requestId:currentRequest},location.origin);
}
function reset(reason=''){
 cancel();lastResult=null;currentRequest='';inputSnapshot='';running=false;
 $('aiRun').disabled=false;set('aiRun',t().run);
 $('aiBar').value=0;$('aiBar').hidden=true;
 $('aiExport').hidden=true;$('aiEvidence').hidden=true;$('aiEvidenceBody').replaceChildren();
 const indicator=$('aiMeterScore');if(indicator?.firstChild)indicator.firstChild.textContent='—';
 set('aiShort',t().idle);status(reason);
}
function translate(){
 const fields={
  aiMeterTitle:'title',aiBadge:'badge',aiMeterUnit:'unit',
  aiMeterExplanation:'explanation',aiRun:'run',aiConsent:'consent',
  aiLegal:'legal',aiExport:'export',aiAdvancedSummary:'advanced',
  aiDeepLabel:'deep',aiDeepHelp:'deepHelp',
  aiFullScanLabel:'fullScan',aiFullScanHelp:'fullScanHelp',aiContextLabel:'contextLabel',
  aiEvidenceTitle:'evidenceTitle',
  aiPilotRisk:'pilotTitle',aiPilotRiskText:'pilotText',aiPilotLink:'pilotLink'
 };
 for(const [id,key] of Object.entries(fields))set(id,t()[key]);
 set('aiRun',running?t().cancel:t().run);
 // These values affect warnings, never modify classifier outputs.
 const options=$('aiContext')?.options;
 if(options){
  const texts=lang()==='ar'?
   ['كتابة عامة','أكاديمية / تقنية','رسمية / منقحة','الإنجليزية كلغة ثانية']:
   ['General writing','Academic / technical','Formal / polished','English as a second language'];
  Array.from(options).forEach((option,i)=>{option.textContent=texts[i]||option.textContent;});
 }
 if(lastResult)render(lastResult);else set('aiShort',t().idle);
 set('navEditor',lang()==='ar'?'المحرر':'Editor');
 set('navResults',lang()==='ar'?'النتائج':'Results');
 set('navWriting',lang()==='ar'?'تحسين الكتابة':'Writing tools');
 set('navCleanup',lang()==='ar'?'التنظيف':'Cleanup');
 set('heroEyebrow',lang()==='ar'?'مساحة العمل / مراجعة المستند':'WORKSPACE / DOCUMENT REVIEW');
}
function eligible(text){
 const words=(text.match(/\S+/gu)||[]).length;
 if(!text.trim())return 'NO_TEXT';
 if(words<120)return 'MIN_WORDS';
 if(text.length>120000)return 'TEXT_TOO_LONG';
 const ar=(text.match(/\p{Script=Arabic}/gu)||[]).length,lat=(text.match(/[A-Za-z]/g)||[]).length;
 const letters=(text.match(/\p{L}/gu)||[]).length;
 if(lat<80||ar>Math.max(3,lat*.02)||letters-ar-lat>Math.max(10,lat*.1))return 'UNSUPPORTED_LANGUAGE';
 return null;
}
function start(){
 const text=$('source').value;
 const problem=eligible(text);
 if(problem){
  reset(problem==='NO_TEXT'?t().noText:problem==='MIN_WORDS'?t().short:
   problem==='UNSUPPORTED_LANGUAGE'?t().language:t().failed);
  $('aiMeter').scrollIntoView({block:'nearest'});return;
 }
 reset();running=true;inputSnapshot=text;
 currentRequest=String(Date.now())+'-'+String(++counter);
 $('aiRun').disabled=false;set('aiRun',t().cancel);status(t().loading);
 $('aiMeter').scrollIntoView({block:'nearest'});
 if(!child){
  child=document.createElement('iframe');
  child.id='tisOnDeviceModel';
  child.title='Optional, user-triggered AI model runtime';
  child.setAttribute('sandbox','allow-scripts allow-same-origin');
  child.setAttribute('referrerpolicy','no-referrer');
  child.setAttribute('aria-hidden','true');child.hidden=true;
  child.src='ai-runtime.html';$('aiMeter').append(child);
 }else if(ready)postRun();
}
function postRun(){
 if(!ready||!child||!currentRequest)return;
 child.contentWindow.postMessage({
  channel:'TIS_BROWSER_AI_V1',op:'RUN',requestId:currentRequest,
  text:inputSnapshot,deep:$('aiDeep').checked===true,
  full:$('aiFullScan').checked===true,
  context:$('aiContext').value
 },location.origin);
}
function element(name,className,textContent){
 const e=document.createElement(name);
 if(className)e.className=className;
 if(typeof textContent==='string')e.textContent=textContent;
 return e;
}
function row(parent,name,value){
 const section=element('div','ai-evidence-row');
 section.append(element('span','ai-evidence-label',name),element('strong','ai-evidence-value',value));
 parent.append(section);
 return section;
}
function renderEvidence(result){
 const container=$('aiEvidenceBody');
 container.replaceChildren();
 const summary=element('div','ai-model-summary');
 const models=Array.isArray(result.models)?result.models:[];
 for(const model of models){
  if(!model||!Number.isFinite(model.score))continue;
  const heading=model.model_id===PRIMARY?t().labelPrimary:t().labelSecondary;
  row(summary,heading,model.score.toFixed(1)+'%');
  row(summary,t().coverage,String(model.coverage)+'%');
  if(model.model_id!==PRIMARY)row(summary,t().modelReason,lang()==='ar'?'مقارنة مرجعية تاريخية':'Legacy cross-check');
 }
 if(Number.isFinite(result.agreementDifferencePoints)){
  row(summary,lang()==='ar'?'فرق النموذجين':'Difference between models',result.agreementDifferencePoints.toFixed(1)+' pp');
 }
 container.append(element('h4','',t().models),summary);
 const flags=Array.isArray(result.flags)?result.flags:[];
 const list=element('ul','ai-warnings');
 if(flags.length){
  for(const flag of flags){
   list.append(element('li','',t().flagMap[flag]||String(flag).slice(0,80)));
  }
 }else list.append(element('li','',t().noFlags));
 container.append(element('h4','',t().flags),list);
 if(result.primary?.segments?.length){
  container.append(element('h4','',t().segments));
  const displaySegments=result.primary.segments.slice(0,16);
  for(const [index,segment] of displaySegments.entries()){
   const start=segment.start,end=segment.end;
   if(!Number.isInteger(start)||!Number.isInteger(end)||start<0
    ||end>inputSnapshot.length||start>=end)continue;
   const box=element('div','ai-segment');
   const header=element('div','ai-segment-top');
   header.append(
    element('strong','',t().reportWindow+' '+(index+1)),
    element('span','ai-segment-score',String(segment.signal.toFixed(1))+'%')
   );
   box.append(header);
   const excerpt=inputSnapshot.slice(start,end).replace(/\s+/g,' ').trim();
   box.append(element('p','ai-segment-excerpt',
    (excerpt.length>210?excerpt.slice(0,210)+'…':excerpt)));
   box.append(element('small','',String(segment.words)+' '+(lang()==='ar'?'كلمة':'words')+
    ' · '+String(segment.tokens)+' '+(lang()==='ar'?'رمزًا':'tokens')));
   container.append(box);
  }
  if(result.primary.segments.length>displaySegments.length){
   container.append(element('p','help',t().overflow));
  }
 }
}
function render(result){
 if(!result||result.version!==VERSION||
  result.calibration!=='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE'
  ||result.primary?.model_id!==PRIMARY){
  error('UNVERIFIED_MODEL_LABEL');return;
 }
 const number=result.score;
 const hasNumber=Number.isFinite(number)&&number>=0&&number<=100;
 if($('aiMeterScore')?.firstChild)$('aiMeterScore').firstChild.textContent=hasNumber?number.toFixed(1)+'%':'—';
 const conflict=result.status==='MODEL_DISAGREEMENT';
 const lowCoverage=result.status==='INSUFFICIENT_COVERAGE';
 const hetero=result.status==='HETEROGENEOUS_DOCUMENT';
 set('aiShort',conflict?t().uncertain:lowCoverage?t().lowCoverage:hetero?t().hetero:
  result.status==='SECONDARY_UNAVAILABLE'?t().partial:t().measured);
 $('aiBar').hidden=!hasNumber;
 $('aiBar').value=hasNumber?number:0;
 $('aiEvidence').hidden=false;
 $('aiExport').hidden=false;
 $('aiRun').disabled=false;set('aiRun',t().run);
 status(t().done+(result.primary.coverage<100?' '+t().statusSampled:'')+
   (conflict?' '+t().modelReason:'')+
   (result.status==='AGREEMENT_UNCALIBRATED'?' '+t().statusAgreement:''));
 renderEvidence(result);
}
function error(code){
 $('aiRun').disabled=false;running=false;set('aiRun',t().run);
 $('aiBar').hidden=true;$('aiExport').hidden=true;
 const message=code==='UNVERIFIED_MODEL_LABEL'?t().unsupported:
  code==='MIN_WORDS'?t().short:
  code==='UNSUPPORTED_LANGUAGE'?t().language:t().failed;
 status(message);
}
function handleMessage(event){
 if(!child||event.source!==child.contentWindow||event.origin!==location.origin)return;
 const data=event.data;
 if(data?.channel!=='TIS_BROWSER_AI_V1')return;
 if(data.op==='READY'){ready=true;postRun();return;}
 if(!currentRequest||data.requestId!==currentRequest)return;
 if(data.op==='PROGRESS'){
  if(data.stage==='DOWNLOADING'&&Number.isFinite(data.percent)){
   status(t().download(data.percent,data.model==='secondary'?t().labelSecondary:t().labelPrimary));
  }else status(data.stage==='ANALYZING'?t().analyzing:t().loading);
 }else if(data.op==='RESULT'){
  currentRequest='';running=false;set('aiRun',t().run);
  if($('source').value!==inputSnapshot){reset(t().expired);return;}
  lastResult=data.result;render(lastResult);
 }else if(data.op==='ERROR'){
  currentRequest='';running=false;error(data.code);
 }
}
function exportResult(){
 if(!lastResult)return;
 const report={
  software:'Text Integrity Studio',createdAt:new Date().toISOString(),
  ...lastResult,privacy:t().noTextInReport,
  disclosure:'Models uncalibrated. Scores are not the fraction of AI-authored words and do not establish authorship.'
 };
 const bytes=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(bytes),a=document.createElement('a');
 a.href=url;a.download='ai-detection-evidence.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function setup(){
 if(!$('aiMeter'))return;
 $('aiRun').addEventListener('click',()=>{
  if(running){reset(t().cancelled);return;}
  start();
 });
 $('aiExport').addEventListener('click',exportResult);
 $('source')?.addEventListener('input',()=>{if(lastResult||running)reset(t().expired);});
 for(const id of ['clear','sample'])$(id)?.addEventListener('click',()=>reset());
 $('file')?.addEventListener('change',()=>reset());
 $('language')?.addEventListener('click',translate);
 window.addEventListener('message',handleMessage);
 translate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
else setup();
})();
