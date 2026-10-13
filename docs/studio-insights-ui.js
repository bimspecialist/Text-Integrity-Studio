/* Text Integrity Studio — local document review panel.
   This UI never sends source text to a service, auto-invents rewrites,
   or turns descriptive writing statistics into an AI-authorship percentage. */
(function(){
 'use strict';
 const core=globalThis.TextIntegrityStudioInsights;
 if(!core)return;
 const $=id=>document.getElementById(id);
 const source=$('source');
 if(!source||!$('studioReviewCards'))return;
 const E=(tag,cls,text)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=String(text);
  return n;
 };
 const labels={
  en:{
   untitled:'Untitled document',local:'Local draft',count:(w,p)=>w+' words · '+p+' sections',
   aiQuick:'AI model signal · research only',aiRun:'Analyze with on-device model',
   aiBadge:'EXPERIMENTAL',aiIntro:'English text, 120+ words. First use downloads model weights. Results are not authorship probabilities.',
   aiInconclusive:'INCONCLUSIVE',aiProgress:'Preparing optional on-device model…',
   mainScan:'Scan AI text',writingScan:'Review writing',cancelScan:'Cancel AI scan',
   privacy:'Private in this browser',exportTop:'Export report',advanced:'Advanced AI details and analyzed passages',
   confidence:'Uncalibrated research signal · not authorship probability',
   readyEnglish:'Ready to scan English text. First use downloads a ~126 MB research model.',
   needWords:n=>'Add '+n+' more English words (minimum 120) to run the research AI scan.',
   languageUnsupported:'AI detection supports English only. Arabic and mixed-language writing can still use writing review.',
   tooLong:'The detector supports at most 120,000 characters. Select a shorter document.',
   title:'Key writing insights',note:'Local style observations only — not evidence of AI authorship.',
   empty:'Your text has no warnings under these limited editorial heuristics. Review the meaning, numbers and citations yourself.',
   add:'Add text and choose Check my text to review writing suggestions.',
   all:'All',clarity:'Clarity',style:'Style',writing:'Review grammar fixes',
   guide:'Writing techniques with examples',sections:'Paragraph metrics and analyzed coverage',
   history:'Edit history (this session)',export:'Export writing report',saved:'Report saved locally',
   noExport:'Add text before exporting.',focus:'Find in editor',dismiss:'Dismiss',reference:'Writing reference',
   before:'Before',after:'After',historyInit:'No edits yet',historyEdit:'Text revised',
   histClear:'Draft changed',section:'Paragraph',words:'words',diversity:'Vocabulary diversity',
   avg:'Average sentence length',coverage:'Measured windows',unseen:'No valid model evidence',
   modelSignal:'Experimental model-window signal',limited:'Partial window coverage; no per-paragraph signal',
   notProof:'Model windows are uncalibrated. Highlighted text is not an authorship judgment.',
   mapTitle:'Analyzed text map · research signals',
   mapNotice:'Colors reflect only inspected model windows, never a probability that someone used AI.',
   low:'Lower signal',medium:'Mixed signal',high:'Higher signal',unreviewed:'Not evaluated',
   preview:(n,t,c)=>'Preview: '+n+' of '+t+' characters · '+c+'% of preview covered by model windows. Gray text has not been evaluated.',
   truncated:' Long document: heatmap preview is truncated; use Advanced Details for model-wide coverage.',
   partial:'Partial style analysis — some paragraphs were not examined.',
   insufficient:'Insufficient model evidence to show a supported signal.'
  },
  ar:{
   untitled:'مستند بلا اسم',local:'مسودة محلية',count:(w,p)=>w+' كلمة · '+p+' مقطع',
   aiQuick:'إشارة نموذج AI · بحثية فقط',aiRun:'التحليل بالنموذج داخل الجهاز',
   aiBadge:'تجريبي',aiIntro:'نص إنجليزي 120 كلمة فأكثر. تُنزّل أوزان النموذج عند الطلب. النتائج ليست احتمال تأليف النص.',
   aiInconclusive:'غير حاسم',aiProgress:'تجهيز النموذج الاختياري داخل الجهاز…',
   mainScan:'فحص AI للنص',writingScan:'تحسين الكتابة',cancelScan:'إلغاء فحص AI',
   privacy:'المستند خاص داخل هذا المتصفح',exportTop:'تصدير التقرير',advanced:'التفاصيل العلمية والمقاطع المفحوصة',
   confidence:'إشارة بحثية غير معايرة · ليست احتمال تأليف النص',
   readyEnglish:'النص الإنجليزي جاهز للفحص. أول تشغيل ينزّل نموذجًا بحثيًا بحجم 126 ميجابايت تقريبًا.',
   needWords:n=>'أضف '+n+' كلمة إنجليزية (120 كلمة على الأقل) لبدء فحص AI البحثي.',
   languageUnsupported:'كشف AI يدعم الإنجليزية فقط حاليًا. أدوات تحسين الكتابة متاحة للعربية والنص المختلط.',
   tooLong:'يدعم الفحص 120 ألف حرف كحد أقصى. اختر نصًا أقصر.',
   title:'أبرز ملاحظات الكتابة',note:'ملاحظات أسلوبية محلية فقط، وليست دليلًا على مصدر النص.',
   empty:'لا توجد ملاحظات ضمن قواعد التحرير المحدودة. راجع المعنى والأرقام والمراجع بنفسك.',
   add:'أضف نصًا ثم اضغط فحص النص لعرض الاقتراحات.',
   all:'الكل',clarity:'الوضوح',style:'الأسلوب',writing:'مراجعة تصحيحات اللغة',
   guide:'تقنيات الكتابة مع أمثلة',sections:'مؤشرات الفقرات وتغطية الفحص',
   history:'سجل التعديلات (هذه الجلسة)',export:'تصدير تقرير الكتابة',saved:'تم حفظ التقرير على جهازك',
   noExport:'أضف نصًا قبل التصدير.',focus:'اذهب إلى النص',dismiss:'تجاهل',reference:'مرجع للكتابة',
   before:'قبل',after:'بعد',historyInit:'لا توجد تعديلات بعد',historyEdit:'تم تعديل النص',
   histClear:'تغيرت المسودة',section:'الفقرة',words:'كلمة',diversity:'تنوع المفردات',
   avg:'متوسط طول الجمل',coverage:'تغطية نموذج الفحص',unseen:'لا توجد أدلة نموذج صالحة',
   modelSignal:'إشارة نموذج تجريبية للمقطع',limited:'تغطية جزئية؛ لا توجد إشارة موثوقة للمقطع',
   notProof:'إشارات المقاطع غير معايرة، ولا تمثل حكمًا على مؤلف النص.',
   mapTitle:'خريطة المقاطع المفحوصة · إشارات بحثية',
   mapNotice:'تعرض الألوان مقاطع فحصها النموذج فقط؛ ولا تمثل احتمال استخدام AI.',
   low:'إشارة منخفضة',medium:'إشارة مختلطة',high:'إشارة مرتفعة',unreviewed:'لم يُفحص',
   preview:(n,t,c)=>'المعاينة: '+n+' من '+t+' حرف · تغطية مقاطع النموذج '+c+'٪. النص الرمادي لم يُفحص.',
   truncated:' المستند طويل: المعاينة جزئية؛ راجع التفاصيل المتقدمة لتغطية المستند كاملة.',
   partial:'تحليل أسلوبي جزئي؛ لم تُحلّل بعض الفقرات.',
   insufficient:'الأدلة غير كافية لإظهار إشارة مدعومة.'
  }
 };
 const state={profile:null,filter:'all',dismissed:new Set(),model:null,history:[],
              aiRunning:false,lastText:source.value,scanTimer:null,historyTimer:null};
 const t=()=>labels[document.documentElement.lang==='ar'?'ar':'en'];
 const round=n=>Math.round(n*10)/10;
 function readinessNote(){
  const policy=window.TISEligibilityPolicy;
  if(!policy||typeof policy.assess!=='function')return t().languageUnsupported;
  const result=policy.assess(source.value);
  if(result.eligible)return t().readyEnglish;
  if(result.reason==='NO_TEXT')return t().aiIntro;
  if(result.reason==='TEXT_TOO_LONG')return t().tooLong;
  if(result.reason==='MIN_WORDS')return t().needWords(Math.max(0,120-result.words));
  return t().languageUnsupported;
 }
 function set(id,value){if($(id))$(id).textContent=value;}
 function addHistory(label){
  state.history.unshift({label,time:new Date().toLocaleTimeString(
   document.documentElement.lang==='ar'?'ar-SA':'en-US',{hour:'2-digit',minute:'2-digit'})});
  state.history.length=Math.min(state.history.length,15);
  renderHistory();
 }
 function renderHistory(){
  const list=$('studioHistoryList');list.replaceChildren();
  if(!state.history.length){list.append(E('li','studio-muted',t().historyInit));return;}
  for(const h of state.history)list.append(E('li','',h.label+' · '+h.time));
 }
 function documentName(){
  const file=$('file')?.files?.[0];
  const meta=core.safeFileMetadata(file);
  set('studioDocumentTitle',file?file.name:t().untitled);
  set('studioTopDocument',file?file.name:t().untitled);
  set('studioDocumentFormat',meta&&meta.extension!=='unsupported'
   ?meta.extension.toUpperCase()+' · '+Math.round((meta.bytes||0)/1024)+' KB':t().local);
 }
 function profileNow(){
  try{state.profile=core.analyzeDocument(source.value,{locale:document.documentElement.lang});}
  catch{state.profile=null;}
  documentName();
  const p=state.profile;
  set('studioDocumentStats',p?t().count(p.statistics.words,p.paragraphs.total):t().count(0,0));
  renderCards();
  renderSections();
  if(!state.model&&!state.aiRunning)set('studioAiQuickNote',readinessNote());
 }
 function renderCards(){
  const root=$('studioReviewCards');root.replaceChildren();
  const profile=state.profile,dict=t();
  set('studioReviewTitle',dict.title);
  const listed=profile?.suggestions.filter(x=>!state.dismissed.has(x.id))||[];
  set('studioReviewCount',listed.length);
  set('studioReviewNote',source.value.trim()
   ?dict.note+(profile.partial?' '+dict.partial:''):dict.add);
  if(!source.value.trim()){return;}
  const selected=listed.filter(x=>state.filter==='all'||x.category===state.filter);
  if(!selected.length){root.append(E('p','studio-muted',dict.empty));return;}
  const first=selected.slice(0,12);
  for(const suggestion of first){
   const panel=E('article','studio-suggestion');
   const top=E('div','studio-suggestion-top');
   top.append(E('strong','',suggestion.title),E('span','studio-suggestion-type',dict.section+' '+suggestion.section));
   panel.append(top,E('p','',suggestion.reason));
   const action=E('div','studio-suggestion-actions');
   const focus=E('button','',dict.focus);focus.type='button';
   focus.dataset.studioFocus=suggestion.id;
   focus.addEventListener('click',()=>{
    const span=state.profile?.sections.find(x=>x.id===suggestion.section);
    if(!span)return;
    source.focus();source.setSelectionRange(span.start,span.end);
    source.scrollIntoView({block:'nearest'});
   });
   const ignore=E('button','',dict.dismiss);ignore.type='button';ignore.className='studio-dismiss';
   ignore.addEventListener('click',()=>{state.dismissed.add(suggestion.id);renderCards();});
   const link=E('a','studio-ref',dict.reference);
   link.href=suggestion.reference;link.target='_blank';link.rel='noopener noreferrer';
   action.append(focus,ignore,link);panel.append(action);root.append(panel);
  }
  if(selected.length>first.length)root.append(E('p','studio-muted',
   (selected.length-first.length)+' '+(document.documentElement.lang==='ar'?'ملاحظات إضافية في التقرير':'additional notes available in export')));
 }
 function modelProjection(){
  if(!state.model)return null;
  const documents=globalThis.TISDocumentSession;
  const mapping=globalThis.TISEvidenceProjection;
  if(!documents?.createDocumentSession||!mapping?.projectEvidence)return null;
  try{
   const snapshot=documents.createDocumentSession(source.value).read();
   const signal=Number.isFinite(state.model.displayedSignalPercent)?
    state.model.displayedSignalPercent:null;
   return mapping.projectEvidence(snapshot,{
    revision:snapshot.revision,
    kind:signal===null?'INCONCLUSIVE':'RESEARCH_SIGNAL',
    signal,documentCoverageWordsPercent:state.model.documentCoverage,
    segments:state.model.segments
   },{maxOverviewSections:Math.min(1000,Math.max(1,snapshot.paragraphs.length))});
  }catch{return null;}
 }
 function modelPerSection(span,projected){
  if(!state.model)return null;
  const found=projected?.sections?.find(x=>x.start===span.start&&x.end===span.end);
  return found?{
   coverage:found.paragraphCoverageCharactersPercent,signal:found.windowSignal
  }:{coverage:0,signal:null};
 }
 function renderSections(){
  const root=$('studioSectionList');root.replaceChildren();
  const profile=state.profile;
  if(!source.value.trim()||!profile?.sections.length){root.append(E('p','studio-muted',t().add));return;}
  const shown=profile.sections.slice(0,24);
  const projection=modelProjection();
  for(const sec of shown){
   const card=E('div','studio-section-item'),m=sec.statistics;
   card.append(E('strong','',t().section+' '+sec.id+' · '+m.words+' '+t().words));
   card.append(E('small','',t().avg+': '+m.averageSentenceWords+' · '+t().diversity+': '+m.lexicalDiversity));
   const signal=modelPerSection(sec,projection);
   if(signal){
    card.append(E('small','',t().coverage+': '+signal.coverage+'% · '+(signal.signal===null?t().limited:t().modelSignal+': '+signal.signal+'%')));
   }else card.append(E('small','',t().unseen));
   root.append(card);
  }
  if(profile.sections.length>shown.length)
   root.append(E('p','studio-muted',profile.sections.length+' '+(document.documentElement.lang==='ar'?'فقرة محلّلة؛ التفاصيل الكاملة في التقرير':'paragraphs analyzed; full details in export')));
 }
 function renderExamples(){
  const root=$('studioExamplesList');root.replaceChildren();
  for(const ex of core.editorialExamples(document.documentElement.lang)){
   const card=E('article','studio-example');
   card.append(E('strong','',ex.title),E('p','studio-muted',ex.description),
    E('small','',t().before),E('blockquote','',ex.before),
    E('small','',t().after),E('blockquote','',ex.after));
   const link=E('a','studio-ref',t().reference);link.href=ex.reference;
   link.target='_blank';link.rel='noopener noreferrer';card.append(link);
   root.append(card);
  }
 }
 function resetEvidence(){
  state.model=null;
  set('studioAiQuickValue','—');
  set('studioAiQuickNote',t().aiIntro);
  $('studioEvidence').hidden=true;
  $('studioEvidence').open=false;
  $('studioHeatmap').replaceChildren();
  set('studioMapCoverage','');
 }
 function renderHeatmap(){
  if(!state.model)return resetEvidence();
  const text=source.value;
  const mapped=core.mapModelSegments(text,state.model.segments,{maxPreviewCharacters:6500});
  const target=$('studioHeatmap');target.replaceChildren();
  for(const chunk of mapped.chunks){
   const node=E(chunk.signal===null?'span':'mark','studio-highlight studio-'+chunk.tier,text.slice(chunk.start,chunk.end));
   if(chunk.signal!==null){
    node.title=t().modelSignal+': '+chunk.signal+'%';
    node.setAttribute('aria-label',node.title);
   }
   target.append(node);
  }
  $('studioEvidence').hidden=false;
  set('studioEvidenceNotice',t().mapNotice);
  set('studioMapCoverage',t().preview(mapped.previewCharacters,mapped.fullCharacters,mapped.coveragePercent)+
   (mapped.previewTruncated?t().truncated:''));
  renderSections();
 }
 function exportReview(){
  if(!source.value.trim()||!state.profile){set('studioExportStatus',t().noExport);return;}
  const modelParagraphProjection=modelProjection();
  const report={
   application:'Text Integrity Studio',version:'TIS_STYLE_V1',createdAt:new Date().toISOString(),
   sourceMetadata:core.safeFileMetadata($('file')?.files?.[0]),
   analysis:state.profile,
   optionalModelEvidence:state.model?{
    model_id:state.model.model_id,
    revision:'Browser-provided model revision; see original AI evidence export',
    status:state.model.status,
    measuredParagraphs:state.profile.sections.map(s=>({id:s.id,...modelPerSection(s,modelParagraphProjection)}))
   }:null,
   disclaimer:'No source text, original file name, copied passages or individual authorship inference is included. Local editable text stays in the current tab.'
  };
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=E('a');a.href=url;a.download='text-integrity-writing-review.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  set('studioExportStatus',t().saved);
 }
 function setAnalyzeLabel(){
  const button=$('scanAI'),first=button?.querySelector('.v5-action-title'),second=button?.querySelector('.v5-action-sub');
  if(!first||!second){set('scanAI',state.aiRunning?t().cancelScan:t().mainScan);return;}
  const arabic=document.documentElement.lang==='ar';
  first.textContent=state.aiRunning?(arabic?'إلغاء التحليل':'Cancel analysis'):(arabic?'تحليل النص باستخدام AI':'Analyze Text');
  second.textContent=state.aiRunning?(arabic?'Cancel analysis':'إلغاء التحليل'):(arabic?'Analyze Text':'حلّل النص');
  button.setAttribute('aria-label',first.textContent);
 }
 function translate(){
  setAnalyzeLabel();
  set('scan',t().writingScan);
  set('studioPrivacyLabel',t().privacy);
  set('studioExportTop',t().exportTop);
  set('aiDetectorTechnicalLabel',t().advanced);
  set('studioAiConfidence',t().confidence);
  set('studioReviewTitle',t().title);
  set('studioAiQuickLabel',t().aiQuick);
  set('studioAiQuickRun',t().aiRun);
  set('studioAiQuickBadge',t().aiBadge);
  if(!state.model&&!state.aiRunning)set('studioAiQuickNote',readinessNote());
  set('studioFilterAll',t().all);set('studioFilterClarity',t().clarity);set('studioFilterStyle',t().style);
  set('studioOpenWritingLab',t().writing);set('studioStyleGuideLabel',t().guide);
  set('studioSectionsLabel',t().sections);set('studioHistoryLabel',t().history);
  set('studioExportReview',t().export);set('studioEvidenceLabel',t().mapTitle);
  for(const [id,key] of [['studioFilterAll','all'],['studioFilterClarity','clarity'],['studioFilterStyle','style']]){
   $(id).setAttribute('aria-label',t()[key]);
  }
  const legend=$('studioHeatmapLegend').querySelectorAll('span');
  [t().low,t().medium,t().high,t().unreviewed].forEach((l,i)=>{if(legend[i])legend[i].textContent=l;});
  renderExamples();renderHistory();
  profileNow();if(state.model)renderHeatmap();
 }
 function refresh(){
  if(state.lastText!==source.value){
   state.lastText=source.value;
   state.dismissed.clear();
   resetEvidence();
   addHistory(t().historyEdit);
  }
  profileNow();
 }
 function setup(){
  for(const button of document.querySelectorAll('[data-studio-filter]')){
   button.addEventListener('click',()=>{
    state.filter=button.dataset.studioFilter;
    for(const b of document.querySelectorAll('[data-studio-filter]'))
     b.setAttribute('aria-pressed',b===button?'true':'false');
    renderCards();
   });
  }
  source.addEventListener('input',()=>{
   resetEvidence();
   clearTimeout(state.scanTimer);
   state.scanTimer=setTimeout(refresh,260);
  });
  $('scan').addEventListener('click',()=>{clearTimeout(state.scanTimer);refresh();});
  for(const id of ['sample','clear','undo','redo','apply','labApply','wordPreview']){
   $(id)?.addEventListener('click',()=>{queueMicrotask(refresh);});
  }
  $('file')?.addEventListener('change',()=>{
   resetEvidence();state.dismissed.clear();documentName();
   setTimeout(refresh,400);
  });
  $('language').addEventListener('click',()=>{translate();});
  $('studioAiQuickRun').addEventListener('click',()=>{$('aiRun')?.click();});
  // A single explicit user action runs safe writing review first, then the
  // optional English model only when eligibility checks in ai-score-ui pass.
  $('scanAI').addEventListener('click',()=>{
   if(!state.aiRunning)$('scan')?.click();
   $('aiRun')?.click();
  });
  $('studioExportTop').addEventListener('click',()=>{$('studioExportReview')?.click();});
  window.addEventListener('tis:ai-status',event=>{
   const message=event.detail?.text||'';
   set('studioAiQuickStatus',message);
   if(message)$('studioAiQuick').dataset.state=event.detail?.running?'running':'failed';
   else if(!state.model)delete $('studioAiQuick').dataset.state;
  });
  window.addEventListener('tis:ai-progress',event=>{
   const bar=$('studioAiQuickProgress');const detail=event.detail||{};
   state.aiRunning=!['IDLE','DONE','ERROR','CANCELLED'].includes(detail.stage);
   setAnalyzeLabel();
   set('studioAiQuickRun',state.aiRunning?t().cancelScan:t().aiRun);
   $('scanAI').setAttribute('aria-pressed',state.aiRunning?'true':'false');
   if(state.aiRunning)$('studioAiQuick').dataset.state='running';
   else if(detail.stage==='DONE')$('studioAiQuick').dataset.state='complete';
   else if(detail.stage==='ERROR')$('studioAiQuick').dataset.state='failed';
   else if(!state.model)delete $('studioAiQuick').dataset.state;
   if(detail.stage==='IDLE'||detail.stage==='DONE'||detail.stage==='ERROR'||detail.stage==='CANCELLED'){
    bar.hidden=true;bar.removeAttribute('value');return;
   }
   bar.hidden=false;
   if(detail.stage==='DOWNLOADING'&&Number.isFinite(detail.percent)&&detail.percent>=0&&detail.percent<=100){
    bar.value=detail.percent;
   }else bar.removeAttribute('value');
  });
  $('studioOpenWritingLab').addEventListener('click',()=>{
   const details=$('writingTools');
   if(details){details.open=true;details.scrollIntoView({block:'start',behavior:'auto'});}
   $('labAnalyze')?.click();
  });
  $('studioExportReview').addEventListener('click',exportReview);
  // Only the explicitly triggered, verified model UI emits this event.
  window.addEventListener('tis:ai-evidence',event=>{
   const detail=event.detail;
   if(!detail){resetEvidence();renderSections();return;}
   if(detail.version!=='TIS_CONSENSUS_V2_2026_10'||
      detail.calibration!=='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE'||
      detail.model_id!=='onnx-community/tmr-ai-text-detector-ONNX'||
      detail.sourceLength!==source.value.length||!Array.isArray(detail.segments))return;
   const signal=detail.displayedSignalPercent;
   set('studioAiQuickValue',Number.isFinite(signal)&&signal>=0&&signal<=100
    ?signal.toFixed(1)+'%':t().aiInconclusive);
   set('studioAiQuickNote',t().aiIntro);
   $('studioAiQuick').dataset.state='complete';
   state.model={...detail,segments:detail.segments.filter(x=>
    Number.isInteger(x.start)&&Number.isInteger(x.end)&&
    x.start>=0&&x.end<=source.value.length&&x.end>x.start&&
    Number.isFinite(x.signal)&&x.signal>=0&&x.signal<=100)};
   renderHeatmap();
  });
  for(const id of ['words','flags']){
   if($(id))new MutationObserver(()=>{clearTimeout(state.scanTimer);state.scanTimer=setTimeout(refresh,260);})
    .observe($(id),{childList:true,subtree:true,characterData:true});
  }
  translate();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})();