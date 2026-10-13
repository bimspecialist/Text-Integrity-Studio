/* Approved public V5: presentation and measured-only passage breakdown.
   The existing V2 ONNX pipeline is authoritative. This file never fabricates
   classifications or transmits document text. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const source=$('source');
 const ring=$('v5SignalRing');
 if(!source||!ring||!$('v5BreakdownRows'))return;
 const copy={
  en:{
   tagline:'Write with confidence.',privacy:'Private in your browser',
   headline:'Check your text for AI content',
   sub:'Paste, type, or upload your text. One action reviews your writing and runs an optional on-device AI scan when English input is eligible.',
   tab:'Text input',upload:'Upload file',counts:(w,p)=>w+' words · '+p+' sections',
   click:'One action checks writing locally. For eligible English text, the research AI model downloads only after you click.',
   result:'Analysis Results',resultSub:'AI model evidence and writing insights',
   signal:'AI model signal',ring:'Research signal',ready:'Ready to analyze',
   writingReady:'Writing reviewed — AI scan unavailable',
   analyzing:'Analyzing your document…',measured:'Model research signal measured',
   inconclusive:'Inconclusive — no supported whole-document score',
   error:'Research model unavailable',confidence:'Research signal only · not a calibrated authorship probability',
   insights:'Key writing insights',insightsSub:'Editorial observations, not evidence of authorship',
   breakdown:'Text breakdown',breakdownSub:'Model-window signals per paragraph, not authorship probabilities',
   empty:'Analyze supported English text to see the model-window breakdown.',
   insufficient:'Not enough of this paragraph was scanned',section:i=>'Section '+i,
   uncovered:'Unscanned',modelSignal:'Model signal',more:'More analyzed sections are available in Advanced Details.',
   noText:'Paste or upload text to begin.',export:'Export report',advanced:'Advanced details',
   action:'Analyze Text',actionSub:'حلّل النص',cancel:'Cancel analysis',cancelSub:'إلغاء التحليل',moreTools:'More document tools',
   wordTools:'Word document tools',wordNotice:'DOCX · Read-only text extraction. Your original document is unchanged. Use More document tools for Word-specific editing and export.',
   pdfNotice:'PDF · Extracted text. Verify reading order and formulas; OCR and export are in More document tools.',
   reasonHetero:'Model signals vary considerably between passages; one overall percentage would hide that disagreement.',
   reasonDisagree:'The two research models disagree. Their outputs cannot justify one combined number.',
   reasonCoverage:'Only {coverage} of this document was analyzed. The research engine requires at least 60% coverage to summarize its sampled signal.',
   reasonOther:'The research engine withheld a document-wide score because the available evidence is inconclusive.',
   coverageNote:'Document sampled: {coverage}. Passage signals are not authorship probabilities.',
   windowCoverage:'{coverage} passage coverage · model-window signal'
  },
  ar:{
   tagline:'اكتب بثقة.',privacy:'مستنداتك خاصة داخل المتصفح',
   headline:'افحص النص وحسّن كتابته',
   sub:'الصق النص أو اكتبه أو ارفع ملفًا. زر واحد يراجع الكتابة ويشغّل نموذج AI المحلي للنصوص الإنجليزية المدعومة.',
   tab:'كتابة النص',upload:'رفع ملف',counts:(w,p)=>w+' كلمة · '+p+' مقطع',
   click:'زر واحد لمراجعة الكتابة محليًا، وتنزيل نموذج AI البحثي عند الضغط فقط إذا كان النص الإنجليزي مدعومًا.',
   result:'نتائج التحليل',resultSub:'إشارات AI البحثية وملاحظات الكتابة',
   signal:'إشارة نموذج AI',ring:'إشارة بحثية',ready:'جاهز للتحليل',
   writingReady:'اكتملت مراجعة الكتابة · كشف AI غير متاح لهذا النص',
   analyzing:'جارٍ تحليل المستند…',measured:'ظهرت إشارة النموذج البحثية',
   inconclusive:'النتيجة غير حاسمة — لا توجد نسبة مستند موثوقة',
   error:'نموذج AI غير متاح',confidence:'إشارة بحثية فقط · ليست احتمالًا معايرًا لتأليف النص',
   insights:'أبرز ملاحظات الكتابة',insightsSub:'ملاحظات تحريرية لا تثبت مصدر النص',
   breakdown:'تحليل المقاطع',breakdownSub:'إشارات المقاطع المفحوصة، وليست احتمالات تأليف النص',
   empty:'افحص نصًا إنجليزيًا مدعومًا لعرض إشارات المقاطع.',
   insufficient:'لم تُفحص أجزاء كافية من هذا المقطع',section:i=>'المقطع '+i,
   uncovered:'لم يُفحص',modelSignal:'إشارة النموذج',more:'تظهر التفاصيل الإضافية في قسم التفاصيل المتقدمة.',
   noText:'الصق نصًا أو ارفع ملفًا أولًا.',export:'تصدير التقرير',advanced:'التفاصيل المتقدمة',
   action:'Analyze Text',actionSub:'حلّل النص',cancel:'إلغاء التحليل',cancelSub:'Cancel analysis',moreTools:'المزيد من أدوات المستندات',
   wordTools:'أدوات مستند Word',wordNotice:'DOCX · النص المستخرج للقراءة فقط. المستند الأصلي محفوظ دون تغيير. أدوات Word والتصدير موجودة تحت المزيد من أدوات المستندات.',
   pdfNotice:'PDF · النص مستخرج. راجع ترتيب الأسطر والمعادلات؛ أدوات OCR والتصدير تحت المزيد من أدوات المستندات.',
   reasonHetero:'إشارات النموذج تختلف بين المقاطع، لذلك النسبة الموحدة قد تخفي هذا الاختلاف.',
   reasonDisagree:'النموذجان البحثيان مختلفان في النتيجة؛ لا يمكن دمج إشاراتهما في رقم واحد موثوق.',
   reasonCoverage:'تم فحص {coverage} من المستند فقط. يتطلب عرض إشارة إجمالية تغطية 60% على الأقل.',
   reasonOther:'لم يعرض المحرك نسبة شاملة لأن الأدلة البحثية المتاحة غير حاسمة.',
   coverageNote:'نسبة المستند التي جرى فحصها: {coverage}. إشارات المقاطع ليست احتمالات تأليف.',
   windowCoverage:'تغطية المقطع {coverage} · إشارة النموذج'
  }
 };
 const current=()=>copy[document.documentElement.lang==='ar'?'ar':'en'];
 const set=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
 const state={details:null,lastText:source.value,active:false,model:null};
 const baseline=()=>{
  ring.style.setProperty('--v5-signal','0%');
  ring.style.setProperty('--v5-ring-color','#5293c9');
 };
 function sectionStats(){
  const words=(source.value.match(/\S+/gu)||[]).length;
  const paragraphs=(source.value.split(/\n\s*\n/g).filter(p=>p.trim())).length;
  set('v5TopCounts',current().counts(words,paragraphs));
 }
 function localize(){
  const t=current();
  for(const [id,value] of Object.entries({
   v5Tagline:t.tagline,v5PrivateLabel:t.privacy,v5Headline:t.headline,
   v5Subtitle:t.sub,v5TextTab:'▤  '+t.tab,v5UploadTab:'↥  '+t.upload,
   v5ClickNote:t.click,titleAudit:t.result,v5ResultsSubtitle:t.resultSub,
   v5RingCaption:t.ring,studioAiQuickLabel:t.signal,studioAiConfidence:t.confidence,
   v5InsightsSubtitle:t.insightsSub,v5BreakdownTitle:t.breakdown,
   v5BreakdownCaption:t.breakdownSub,v5ToolboxLabel:t.moreTools
  }))set(id,value);
  // The editor owns the actual ONNX start/cancel state and the action label.
  if(!state.model&&!state.active&&!source.value.trim())set('v5ResultHeadline',t.ready);
  if($('v5UploadTab'))$('v5UploadTab').setAttribute('aria-label',t.upload);
  sectionStats();
  if(state.model){renderBreakdown(state.model);showConclusion(state.model);showCoverage(state.model);}
  else if(!$('v5BreakdownRows').querySelector('.v5-breakdown-row'))renderEmpty();
  updateDocumentNotice();
  set('v6WordToolsLabel',t.wordTools);
 }
 function updateDocumentNotice(){
  const note=$('v6DocumentNote'),word=$('wordToolbar'),pdf=$('pdfDetails');
  if(!note)return;
  const isWord=!!word&&!word.hidden;
  const isPdf=!isWord&&!!pdf&&!pdf.hidden&&source.value.trim().length>0;
  document.body.classList.toggle('v6-docx-active',isWord);
  note.hidden=!(isWord||isPdf);
  if(isWord){
   const documentStatus=$('wordStatus')?.textContent?.trim()||'';
   note.textContent=(documentStatus?documentStatus+' · ':'')+current().wordNotice;
  }
  else if(isPdf)note.textContent=current().pdfNotice;
  else note.textContent='';
 }
 function showCoverage(detail){
  const note=$('v6CoverageNote');
  if(!note)return;
  const percent=detail&&Number.isFinite(detail.documentCoverage)&&
   detail.documentCoverage>=0&&detail.documentCoverage<=100?detail.documentCoverage:null;
  note.hidden=percent===null;
  note.textContent=percent===null?'':current().coverageNote.replace('{coverage}',percent.toFixed(1)+'%');
 }
 function showConclusion(detail){
  const note=$('v6ConclusionReason');
  if(!note)return;
  const score=detail&&Number.isFinite(detail.displayedSignalPercent)&&
   detail.displayedSignalPercent>=0&&detail.displayedSignalPercent<=100;
  const inconclusive=!!detail&&!score;
  note.hidden=!inconclusive;
  if(!inconclusive){note.textContent='';return;}
  const t=current(),status=detail.status;
  let explanation=status==='HETEROGENEOUS_DOCUMENT'?t.reasonHetero:
   status==='MODEL_DISAGREEMENT'?t.reasonDisagree:status==='INSUFFICIENT_COVERAGE'?
   t.reasonCoverage.replace('{coverage}',Number.isFinite(detail.documentCoverage)?
    detail.documentCoverage.toFixed(1)+'%':t.uncovered):t.reasonOther;
  note.textContent=explanation;
 }
 function renderEmpty(){
  const node=$('v5BreakdownRows');node.replaceChildren();
  const p=document.createElement('p');p.className='studio-muted';
  p.textContent=current().empty;node.append(p);
 }
 function textGroupScores(span,signals){
  const start=span.start,end=span.end;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
  const overlapping=signals.filter(s=>s.start<end&&s.end>start);
  if(!overlapping.length)return null;
  const boundaries=[start,end];
  for(const s of overlapping){
   boundaries.push(Math.max(start,s.start),Math.min(end,s.end));
  }
  boundaries.sort((a,b)=>a-b);
  const distinct=boundaries.filter((b,i)=>i===0||b!==boundaries[i-1]);
  let measured=0,weighted=0;
  for(let i=1;i<distinct.length;i++){
   const lo=distinct[i-1],hi=distinct[i],width=hi-lo;
   if(width<=0)continue;
   const hits=overlapping.filter(s=>s.start<hi&&s.end>lo);
   if(!hits.length)continue;
   measured+=width;
   weighted+=width*hits.reduce((acc,s)=>acc+s.signal,0)/hits.length;
  }
  const coverage=measured/(end-start)*100;
  return measured?{coverage,signal:weighted/measured}:null;
 }
 function renderBreakdown(detail){
  const target=$('v5BreakdownRows');target.replaceChildren();
  if(!detail||!Array.isArray(detail.segments))return renderEmpty();
  const core=globalThis.TextIntegrityStudioInsights;
  if(!core||typeof core.analyzeDocument!=='function')return renderEmpty();
  let sections=[];
  try{sections=core.analyzeDocument(source.value,{maxSections:500}).sections;}catch{return renderEmpty();}
  const valid=detail.segments.filter(s=>s&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&
   s.start>=0&&s.end<=source.value.length&&s.end>s.start&&
   typeof s.signal==='number'&&Number.isFinite(s.signal)&&s.signal>=0&&s.signal<=100);
  if(!valid.length||!sections.length)return renderEmpty();
  // Sample the document rather than reporting only the opening heading blocks.
  const sampled=sections.length<=8?sections:Array.from({length:8},(_,i)=>
   sections[Math.round(i*(sections.length-1)/7)]);
  let count=0;
  for(const section of sampled){
   const score=textGroupScores(section,valid);
   const assessed=score&&score.coverage>=60;
   const row=document.createElement('div');row.className='v5-breakdown-row';
   if(!assessed)row.classList.add('is-unscored');
   const title=document.createElement('span');
   title.textContent=current().section(section.id);
   const value=document.createElement('strong');
   value.textContent=assessed?score.signal.toFixed(1)+'%':current().uncovered;
   value.title=assessed?current().modelSignal+' · '+score.coverage.toFixed(0)+'% coverage':current().insufficient;
   const coverage=document.createElement('small');coverage.className='v6-window-coverage';
   coverage.textContent=score?current().windowCoverage.replace('{coverage}',score.coverage.toFixed(0)+'%'):current().insufficient;
   const bar=document.createElement('div');bar.className='v5-breakdown-bar';
   bar.setAttribute('aria-label',value.title);
   const fill=document.createElement('i');
   fill.style.width=assessed?score.signal.toFixed(1)+'%':'0%';
   bar.append(fill);row.append(title,value,bar,coverage);target.append(row);count++;
  }
  if(!count)renderEmpty();
  if(sections.length>8){
   const p=document.createElement('p');p.className='studio-muted';
   p.textContent=current().more;target.append(p);
  }
 }
 function setRing(raw){
  const eligible=typeof raw==='number'&&Number.isFinite(raw)&&raw>=0&&raw<=100;
  if(!eligible)return baseline();
  ring.style.setProperty('--v5-signal',raw.toFixed(2)+'%');
  const color=raw>=80?'#f36376':raw>=50?'#f2ac60':'#54b9a5';
  ring.style.setProperty('--v5-ring-color',color);
 }
 function clearResult(){
  state.model=null;baseline();renderEmpty();showCoverage(null);showConclusion(null);
  if(!state.active)set('v5ResultHeadline',current().ready);
 }
 function handleEvidence(event){
  const d=event.detail;
  if(!d){clearResult();return;}
  if(d.version!=='TIS_CONSENSUS_V2_2026_10'||
    d.calibration!=='NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE'||
    d.model_id!=='onnx-community/tmr-ai-text-detector-ONNX'||
    d.sourceLength!==source.value.length||!Array.isArray(d.segments))return;
  state.model=d;
  const score=Number.isFinite(d.displayedSignalPercent)&&d.displayedSignalPercent>=0&&d.displayedSignalPercent<=100;
  if(!score)set('studioAiQuickValue','—');
  ring.classList.toggle('v6-ring-inconclusive',!score);
  showCoverage(d);showConclusion(d);
  setRing(d.displayedSignalPercent);
  set('v5ResultHeadline',Number.isFinite(d.displayedSignalPercent)?current().measured:current().inconclusive);
  renderBreakdown(d);
 }
 function handleStatus(event){
  const d=event.detail||{},message=String(d.text||'');
  if(d.running){state.active=true;set('v5ResultHeadline',current().analyzing);return;}
  if(state.model)return;
  if(message&&source.value.trim())set('v5ResultHeadline',current().writingReady);
  else set('v5ResultHeadline',current().ready);
 }
 function handleProgress(event){
  const d=event.detail||{};
  state.active=!['IDLE','DONE','ERROR','CANCELLED'].includes(d.stage);
  if(state.active)set('v5ResultHeadline',current().analyzing);
  if(d.stage==='DONE'&&state.model)
   set('v5ResultHeadline',Number.isFinite(state.model.displayedSignalPercent)?current().measured:current().inconclusive);
  if(d.stage==='ERROR'&&!state.model)set('v5ResultHeadline',current().error);
 }
 function arrangeSecondaryTools(){
  const toolbox=$('v5Toolbox'),items=$('v5ToolboxItems'),technical=$('aiDetectorTechnical');
  if(!toolbox||!items||!technical)return;
  const wordDetails=document.createElement('details');wordDetails.id='v6WordTools';
  wordDetails.className='tool-details tool-disclosure v6-word-tools';
  const summary=document.createElement('summary');summary.id='v6WordToolsLabel';
  summary.textContent=current().wordTools;wordDetails.append(summary);
  const contents=document.createElement('div');contents.className='v6-word-tools-inner';
  for(const id of ['wordDrop','wordToolbar','wordReport']){
   const control=$(id);if(control)contents.append(control);
  }
  wordDetails.append(contents);items.append(wordDetails);
  for(const id of ['writingTools','cleanupTools','pdfTools','wordReportTools','wordPickerOptions','aboutResults','researchTools']){
   const el=$(id);if(el)items.append(el);
  }
  // Hide scientific and extended editorial controls inside one advanced area.
  for(const id of ['studioStyleGuide','studioSectionDetails','studioEditHistory','reportMore']){
   const el=$(id);if(el)technical.append(el);
  }
  const history=$('studioEditHistory'),exportRow=document.querySelector('.studio-export-row');
  if(history&&exportRow)history.append(exportRow);
  for(const link of document.querySelectorAll('.side-navigation a[href^="#"]')){
   link.addEventListener('click',event=>{
    const id=link.getAttribute('href')?.slice(1);
    if(!id||!items.contains($(id)))return;
    event.preventDefault();
    toolbox.open=true;
    const details=$(id);if(details?.tagName==='DETAILS')details.open=true;
    details?.scrollIntoView({block:'start',behavior:'auto'});
   });
  }
  // Opening a file must not open a long advanced panel over the main CTA.
  const refresh=()=>updateDocumentNotice();
  for(const id of ['wordToolbar','pdfDetails']){
   const n=$(id);if(n)new MutationObserver(refresh).observe(n,{attributes:true,attributeFilter:['hidden']});
  }
  for(const id of ['wordMeta','wordStatus','pdfStatus']){
   const n=$(id);if(n)new MutationObserver(refresh).observe(n,{childList:true,subtree:true,characterData:true});
  }
 }
 function setup(){
  arrangeSecondaryTools();
  baseline();renderEmpty();localize();
  const tab=$('v5UploadTab');
  tab?.addEventListener('keydown',e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file')?.click();}
  });
  source.addEventListener('input',()=>{
   sectionStats();
   if(state.model||state.lastText!==source.value){
    clearResult();state.lastText=source.value;
   }
  });
  $('file')?.addEventListener('change',()=>{clearResult();sectionStats();updateDocumentNotice();});
  // Imported Word/PDF content may be applied without an input event.
  const count=$('studioDocumentStats');
  if(count)new MutationObserver(sectionStats).observe(count,{subtree:true,childList:true,characterData:true});
  $('language')?.addEventListener('click',localize);
  window.addEventListener('tis:ai-evidence',handleEvidence);
  window.addEventListener('tis:ai-progress',handleProgress);
  window.addEventListener('tis:ai-status',handleStatus);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})();