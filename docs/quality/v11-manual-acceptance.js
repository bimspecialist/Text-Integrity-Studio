'use strict';
/* V11 QA browser desk. A TEST RECORD is never a test execution.
 * No remote access, server APIs, localStorage, analytics, or auto approval.
 */
(function(){
 const pairs=[
  ['MAN-01-EN','Windows NVDA — English','قارئ NVDA على Windows — الإنجليزية','Windows Chrome/Edge + NVDA; keyboard only','Windows + Chrome/Edge وNVDA ولوحة المفاتيح'],
  ['MAN-01-AR','Windows NVDA — Arabic','قارئ NVDA على Windows — العربية','Windows NVDA with RTL and mixed numerals','Windows وNVDA مع نص عربي وأرقام إنجليزية'],
  ['MAN-02-ANDROID-EN','Android TalkBack — English','TalkBack على Android — الإنجليزية','Physical Android Chrome and TalkBack','جهاز Android فعلي ومتصفح Chrome وTalkBack'],
  ['MAN-02-ANDROID-AR','Android TalkBack — Arabic','TalkBack على Android — العربية','Physical Android TalkBack with RTL','جهاز Android فعلي مع TalkBack والاتجاه العربي'],
  ['MAN-02-IOS-EN','iOS VoiceOver — English','VoiceOver على iPhone — الإنجليزية','Physical iOS Safari and VoiceOver','جهاز iPhone فعلي وSafari وVoiceOver'],
  ['MAN-02-IOS-AR','iOS VoiceOver — Arabic','VoiceOver على iPhone — العربية','Physical iOS Safari and Arabic VoiceOver','جهاز iPhone وSafari وVoiceOver بالعربية'],
  ['MAN-03-ZOOM-EN','Actual browser zoom 200% / 400% — English','تكبير المتصفح الحقيقي 200% / 400% — الإنجليزية','Chrome/Edge/Safari actual browser zoom','تكبير حقيقي عبر Chrome/Edge/Safari'],
  ['MAN-03-ZOOM-AR','Actual browser zoom 200% / 400% — Arabic','تكبير المتصفح الحقيقي 200% / 400% — العربية','Actual 200% / 400% zoom with Arabic labels','تكبير حقيقي 200% و400% مع واجهة عربية'],
  ['MAN-04-HC-EN','Windows High Contrast — English','التباين العالي في Windows — الإنجليزية','Physical system forced-colors mode','التباين العالي الفعلي في إعدادات النظام'],
  ['MAN-04-HC-AR','Windows High Contrast — Arabic','التباين العالي في Windows — العربية','System contrast and reduced motion with RTL','التباين العالي وتقليل الحركة مع العربية'],
  ['MAN-05-QUALITY-EN','Independent editorial review — English','مراجعة بشرية مستقلة — الإنجليزية','30 authentic source-verified EN samples and two reviewers','30 نصًا إنجليزيًا موثق المصدر ومراجعان مستقلان'],
  ['MAN-05-QUALITY-AR','Independent editorial review — Arabic','مراجعة بشرية مستقلة — العربية','30 authentic source-verified AR samples and two reviewers','30 نصًا عربيًا موثق المصدر ومراجعان مستقلان'],
  ['MAN-06-DOCS-EN','Real DOCX and PDF — English','ملفات Word وPDF حقيقية — الإنجليزية','Rights-cleared sample files; long and mixed text','ملفات اختبار مسموح بها، بينها ملفات طويلة ومختلطة'],
  ['MAN-06-DOCS-AR','Real DOCX and PDF — Arabic','ملفات Word وPDF حقيقية — العربية','Real Arabic RTL and mixed Latin units/references','ملفات عربية مع وحدات وأرقام ومراجع إنجليزية'],
  ['MAN-07-SECURITY','Independent privacy/security review','مراجعة أمنية وخصوصية مستقلة','Independent assessor of network/CSP and code','مراجع مستقل للشبكة وسياسة الأمان والتبعيات'],
  ['MAN-08-VISUAL-EN','Owner visual approval — English','اعتماد التصميم بصريًا — الإنجليزية','Actual V11 UI on desktop/mobile, not a mockup','واجهة V11 الحقيقية على سطح المكتب والجوال'],
  ['MAN-08-VISUAL-AR','Owner visual approval — Arabic','اعتماد التصميم بصريًا — العربية','Actual RTL V11 interface, labels and feedback','واجهة V11 العربية واتجاه النص ورسائل التعديل'],
  ['MAN-08-RELEASE','Independent publication authorization','إذن مستقل للدمج والنشر','Separate explicit decision after reviewing all evidence','قرار جديد وصريح بعد مراجعة جميع الأدلة']
 ];
 const caseSteps={
  "01":["Navigate using Tab and Shift+Tab; use Review text, Preview, Apply, Undo and Dismiss; listen to screen-reader names and status; check focus recovery.",
        "استخدم Tab وShift+Tab، ثم «مراجعة النص» و«معاينة» و«تطبيق» و«تراجع» و«تجاهل». استمع للتسميات وإعلان الحالة وعودة التركيز."],
  "02":["Use the real phone screen reader; navigate entry, upload, local results and suggestions; open/close preview; inspect spoken labels, scrolling and 44px targets.",
        "شغّل قارئ الشاشة على هاتف فعلي. اختبر الإدخال والرفع والنتائج والمعاينة والإغلاق، ووضوح التسميات والتمرير وأهداف اللمس."],
  "03":["Set actual browser zoom to 200%, then 400%. Revisit input, long results, feedback, preview, confirmation and Undo. Record any lost content or clipping.",
        "اضبط تكبير المتصفح الحقيقي إلى 200% ثم 400%. اختبر الإدخال والنتائج الطويلة والمعاينة والتطبيق والتراجع، وسجّل أي قص أو فقد للمحتوى."],
  "04":["Enable actual Windows High Contrast and reduced-motion; navigate all visible focus outlines; verify manual-only/disabled actions and before/after distinction.",
        "فعّل وضع التباين العالي الحقيقي وتقليل الحركة في Windows. تأكد من ظهور التركيز والتمييز بين الأزرار المتاحة والمعطلة ونص قبل/بعد."],
  "05":["Use 30 licensed, independently sourced texts in this language. Two different human reviewers score every real suggestion separately, preserving fact/dialect correctness.",
        "استخدم 30 نصًا مشروعًا وموثق المصدر لهذه اللغة. يقيّم مراجعان مختلفان الاقتراحات الحقيقية بصورة مستقلة مع حفظ المعنى والحقائق واللهجة."],
  "06":["Import representative genuine DOCX and PDF; inspect RTL/mixed terms, long text, errors, source protection and JSON export; compare with original files.",
        "ارفع ملفات Word وPDF حقيقية مسموح بها. افحص النصوص المختلطة والطويلة والأخطاء وحماية الأصل والتصدير وقارن النتائج بالملف الأصلي."],
  "07":["Independently review CSP, dependencies/licenses, network requests, model opt-in, hostile text, browser storage and downloaded report; attach redacted findings.",
        "راجع مستقلاً CSP والتبعيات والتراخيص والشبكة وموافقة النموذج والنص غير الموثوق وتخزين المتصفح والتقرير؛ سجّل دلائل منقّحة."],
  "08":["Inspect the actual V11 preview and all recorded PASS/FAIL/BLOCKED; verify the advisory wording; do not infer publication consent from the checkbox.",
        "راجع معاينة V11 الحقيقية وجميع نتائج PASS/FAIL/BLOCKED وتفسير الملاحظات. هذا الاختبار لا يمنح إذنًا تلقائيًا للنشر."]
 };
 const words={
  ar:{brand:'لوحة اختبار V11 — معاينة فقط',preview:'تجربة V11 على الموقع ↗',eyebrow:'اختبار يدوي — لا توجد نتائج مفترضة',
   title:'مراجعة جاهزية V11 على الموقع',intro:'جرّب V11 في نافذة أخرى وسجّل هنا ما تحقق على جهازك. هذه الصفحة لا تفحص جهازك تلقائيًا ولا ترفع بياناتك.',
   hold:'حالة الإصدار: HOLD',holdBody:'كل اختبار يبدأ «لم يُنفذ». لا يعني تصدير النتائج الإذن بالدمج أو النشر.',
   pass:'ناجح',fail:'فشل / عائق',notRun:'لم يُنفذ',samples:'عينات مكتملة',
   tabCases:'اختبارات الأجهزة',tabSamples:'تقييم الكتابة',tabSummary:'ملخص القرار',
   privacy:'خصوصيتك: البيانات تبقى في ذاكرة هذه الصفحة فقط. احفظ JSON قبل المغادرة، ولا تدخل معلومات حساسة.',
   import:'استيراد JSON',export:'حفظ النتائج JSON',caseHead:'فحص الأجهزة والوصول',
   caseIntro:'اختر اختبارًا. لا تسجل PASS إلا بعد إجرائه وتوثيقه.',
   caseStatus:'الحالة',tester:'رمز المختبر (دون اسم حقيقي)',device:'الجهاز / النظام / المتصفح / نسخة قارئ الشاشة',
   observation:'ما شاهدته فعليًا',evidence:'مرجع دليل منقّح',prev:'السابق',next:'التالي',save:'حفظ الحالة',
   sourceHead:'تقييم فائدة اقتراحات الكتابة',sourceIntro:'30 نصًا عربيًا و30 إنجليزيًا من مصادر مشروعـة وموثقة يقيّمها مراجعان مستقلان.',
   a:'رمز المراجع الأول',b:'رمز المراجع الثاني',sample:'رمز العينة',provenance:'مرجع المصدر المرخص (لا تضع النص)',
   verified:'تحققت من المصدر والحق باستخدام العينة',total:'عدد الاقتراحات الحقيقي',
   help:'يراجع كل مراجع جميع اقتراحات العينة. لا تستخدم أرقامًا مختلقة.',
   reviewed:'تمت مراجعتها',useful:'مفيدة وتحافظ على المعنى',risk:'تعديلات خطرة على الحقائق',
   prevSample:'العينة السابقة',nextSample:'العينة التالية',saveSample:'حفظ تقييم العينة',
   summaryHead:'ملخص قرار الاختبار',summaryText:'الاختبارات الآلية لا تكفي. تتطلب الجاهزية اختبار أجهزة فعلية ومراجعة بشرية.',
   release:'هذه الصفحة لا تدمج ولا تنشر V11. يلزم إذن جديد وصريح بعد إغلاق جميع بوابات القبول.',
   footer:'العودة إلى معاينة V11',buttonLang:'English',
   needs:'لا يمكن تسجيل PASS دون رمز مختبر وجهاز وملاحظة ومرجع دليل.',
   done:'تم تسجيل الحالة وفق البيانات المقدمة، وليس تحققًا آليًا منها.',
   sampleNotComplete:'العينة غير مكتملة: يلزم مرجع موثق ومراجعان مختلفان وأعداد متطابقة مع جميع الاقتراحات.',
   sampleDone:'التقييم صالح حسابيًا؛ لا يثبت صحة التقييمات دون تدقيق بشري.',
   importFail:'تعذر استيراد ملف نتائج صالح؛ تحقق من الصيغة والحجم.',importDone:'تم استيراد ملف النتائج. راجع مصدرها قبل الاعتماد.',
   draft:'التقييم غير متاح بعد',languageEn:'الإنجليزية',languageAr:'العربية'
  },
  en:{brand:'V11 testing desk — preview only',preview:'Try V11 on the website ↗',eyebrow:'Manual review — no assumed outcomes',
   title:'V11 website acceptance review',intro:'Try V11 in another tab and record only what you actually observed. This page cannot run a physical-device test or send submissions.',
   hold:'Release status: HOLD',holdBody:'All checks begin NOT RUN. Exporting evidence is not permission to merge or publish.',
   pass:'Passed',fail:'Failed / blocked',notRun:'Not run',samples:'Complete samples',
   tabCases:'Device tests',tabSamples:'Editorial usefulness',tabSummary:'Release decision',
   privacy:'Privacy: entries stay in this page memory only. Export JSON before leaving and omit sensitive information.',
   import:'Import JSON',export:'Export evidence JSON',caseHead:'Physical device and accessibility',
   caseIntro:'Select a case. Record PASS only after the test is performed with evidence.',
   caseStatus:'Status',tester:'Tester code (not real name)',device:'Device / OS / browser / screen reader version',
   observation:'What you actually observed',evidence:'Redacted evidence reference',prev:'Previous',next:'Next',save:'Save result',
   sourceHead:'Independent editorial usefulness',sourceIntro:'30 legitimate sourced Arabic and 30 English texts, evaluated independently by two humans.',
   a:'Reviewer A code',b:'Reviewer B code',sample:'Sample code',provenance:'Licensed source reference (no full text)',
   verified:'I verified source provenance and usage rights',total:'Actual generated suggestions',
   help:'Each reviewer must assess all real suggestions; never insert fabricated scores.',
   reviewed:'Suggestions reviewed',useful:'Useful and meaning-preserving',risk:'Risky factual edits',
   prevSample:'Previous sample',nextSample:'Next sample',saveSample:'Save sample',
   summaryHead:'Release review summary',summaryText:'Automation alone is insufficient. Physical-device and independent editorial results are required.',
   release:'This page never merges or deploys V11. Separate explicit approval is mandatory.',
   footer:'Return to V11 preview',buttonLang:'العربية',
   needs:'PASS requires a tester code, device, observation and redacted evidence reference.',
   done:'Result recorded as entered, not independently verified.',
   sampleNotComplete:'Incomplete: verified source, distinct reviewers and consistent per-suggestion counts are required.',
   sampleDone:'This entry is numerically valid; human evidence still needs independent verification.',
   importFail:'Could not import valid evidence. Check schema and size.',importDone:'Evidence imported. Verify provenance before accepting it.',
   draft:'Not yet evaluated',languageEn:'English',languageAr:'Arabic'
  }
 };
 const statuses=['NOT_RUN','PASS','FAIL','BLOCKED'];
 const statusLabels={ar:{NOT_RUN:'لم يُنفذ',PASS:'ناجح',FAIL:'فشل',BLOCKED:'عائق'},en:{NOT_RUN:'NOT RUN',PASS:'PASS',FAIL:'FAIL',BLOCKED:'BLOCKED'}};
 const SAMPLES=[...Array.from({length:30},(_,i)=>'EN'+String(i+1).padStart(3,'0')),
  ...Array.from({length:30},(_,i)=>'AR'+String(i+1).padStart(3,'0'))];
 const max=id=>id==='caseObservation'?2000:180;
 const freshCase=()=>({status:'NOT_RUN',tester:'',device:'',observation:'',evidence:''});
 const freshSample=id=>({id,sourceRef:'',verified:false,total:'',aReviewed:'',aUseful:'',aHighRisk:'',bReviewed:'',bUseful:'',bHighRisk:''});
 const state={lang:'ar',selectedCase:0,selectedSample:0,reviewerA:'',reviewerB:'',
  cases:Object.fromEntries(pairs.map(c=>[c[0],freshCase()])),
  samples:SAMPLES.map(freshSample)};
 const el=id=>document.getElementById(id),t=()=>words[state.lang];
 const text=(id,value)=>{el(id).textContent=value;};
 function stepsFor(id){
  const n=id.startsWith('MAN-01')?'01':id.startsWith('MAN-02')?'02':id.startsWith('MAN-03')?'03':
   id.startsWith('MAN-04')?'04':id.startsWith('MAN-05')?'05':id.startsWith('MAN-06')?'06':
   id.startsWith('MAN-07')?'07':'08';
  return caseSteps[n][state.lang==='ar'?1:0].split(/[.;؛]/).map(x=>x.trim()).filter(Boolean);
 }
 function validCase(c){return ['tester','device','observation','evidence'].every(x=>typeof c[x]==='string'&&c[x].trim().length>=2);}
 function cleanCase(c){
  const out=freshCase();
  for(const key of ['tester','device','observation','evidence'])
   out[key]=typeof c?.[key]==='string'?c[key].slice(0,key==='observation'?2000:180):'';
  out.status=statuses.includes(c?.status)?c.status:'NOT_RUN';
  if(out.status==='PASS'&&!validCase(out))out.status='NOT_RUN';
  return out;
 }
 const naturalInt=value=>/^\d{1,3}$/.test(String(value))?Number(value):null;
 function validSample(s){
  if(!s.verified||s.sourceRef.trim().length<2||!state.reviewerA.trim()||!state.reviewerB.trim()||state.reviewerA.trim()===state.reviewerB.trim())return false;
  const total=naturalInt(s.total);
  if(total===null||total<=0)return false;
  for(const r of ['a','b']){
   const reviewed=naturalInt(s[r+'Reviewed']),useful=naturalInt(s[r+'Useful']),risk=naturalInt(s[r+'HighRisk']);
   if(reviewed!==total||useful===null||useful>reviewed||risk===null||risk>reviewed)return false;
  }
  return true;
 }
 function progress(){
  const cs=Object.values(state.cases);
  return {pass:cs.filter(x=>x.status==='PASS').length,fail:cs.filter(x=>x.status==='FAIL'||x.status==='BLOCKED').length,
   unrun:cs.filter(x=>x.status==='NOT_RUN').length,complete:state.samples.filter(validSample).length};
 }
 function metric(){
  const p=progress();text('statPass',String(p.pass));text('statFail',String(p.fail));
  text('statNotRun',String(p.unrun));text('statSamples',p.complete+' / 60');
 }
 function saveCase(silent=false){
  const key=pairs[state.selectedCase][0],previous=state.cases[key];
  const incoming={status:el('caseStatus').value};
  for(const item of ['Tester','Device','Observation','Evidence'])
   incoming[item.toLowerCase()]=el('case'+item).value.slice(0,max('case'+item));
  const checked=cleanCase(incoming);
  state.cases[key]=checked;
  const demoted=incoming.status==='PASS'&&checked.status!=='PASS';
  if(!silent){
   text('caseValidation',demoted?t().needs:t().done);el('caseValidation').dataset.error=demoted?'true':'false';
  }
  metric();renderList();return !demoted;
 }
 function renderList(){
  el('caseList').replaceChildren();
  for(let i=0;i<pairs.length;i++){
   const item=pairs[i],button=document.createElement('button');
   button.type='button';button.setAttribute('aria-current',i===state.selectedCase?'page':'false');
   const label=document.createElement('span');
   label.textContent=item[0]+' — '+item[state.lang==='ar'?2:1];
   const status=document.createElement('span');status.className='state';status.textContent=statusLabels[state.lang][state.cases[item[0]].status];
   button.append(label,status);
   button.addEventListener('click',()=>{saveCase(true);state.selectedCase=i;renderList();renderCase()});
   el('caseList').append(button);
  }
 }
 function renderCase(){
  const c=pairs[state.selectedCase],data=state.cases[c[0]];
  text('caseTitle',c[0]+' — '+c[state.lang==='ar'?2:1]);
  text('caseContext',c[state.lang==='ar'?4:3]);
  el('caseSteps').replaceChildren();
  for(const step of stepsFor(c[0])){const li=document.createElement('li');li.textContent=step;el('caseSteps').append(li)}
  el('caseStatus').value=data.status;
  for(const item of ['Tester','Device','Observation','Evidence'])el('case'+item).value=data[item.toLowerCase()];
  text('caseValidation','');metric();
 }
 const numericFields={sampleTotal:'total',aReviewed:'aReviewed',aUseful:'aUseful',aRisk:'aHighRisk',
  bReviewed:'bReviewed',bUseful:'bUseful',bRisk:'bHighRisk'};
 function saveSample(silent=false){
  const s=state.samples[state.selectedSample];
  state.reviewerA=el('reviewerA').value.slice(0,60);
  state.reviewerB=el('reviewerB').value.slice(0,60);
  s.sourceRef=el('sampleSource').value.slice(0,180);s.verified=el('sampleVerified').checked;
  for(const [id,key] of Object.entries(numericFields))s[key]=el(id).value.replace(/[^0-9]/g,'').slice(0,3);
  if(!silent){
   const ok=validSample(s);
   text('sampleValidation',ok?t().sampleDone:t().sampleNotComplete);
   el('sampleValidation').dataset.error=ok?'false':'true';
  }
  metric();
 }
 function renderSample(){
  const s=state.samples[state.selectedSample];
  el('sampleSelect').value=s.id;el('reviewerA').value=state.reviewerA;el('reviewerB').value=state.reviewerB;
  el('sampleSource').value=s.sourceRef;el('sampleVerified').checked=s.verified;
  for(const [id,key] of Object.entries(numericFields))el(id).value=s[key];
  text('sampleValidation','');
 }
 function usefulness(lang){
  const group=state.samples.filter(s=>s.id.startsWith(lang)),complete=group.filter(validSample);
  if(complete.length!==30)return {complete:complete.length,ratio:null,risk:null};
  let useful=0,reviewed=0,risk=0;
  for(const s of complete){
   useful+=Number(s.aUseful)+Number(s.bUseful);
   reviewed+=Number(s.aReviewed)+Number(s.bReviewed);
   risk+=Number(s.aHighRisk)+Number(s.bHighRisk);
  }
  return {complete:complete.length,ratio:reviewed>0?Math.round(useful/reviewed*1000)/10:null,risk};
 }
 function renderSummary(){
  const p=progress(),en=usefulness('EN'),ar=usefulness('AR');
  const list=document.createElement('dl');
  const items=[
   [state.lang==='ar'?'اختبارات مكتملة ناجحة':'Passing checks',p.pass+' / 18'],
   [state.lang==='ar'?'حالات غير منفذة':'Not run',String(p.unrun)],
   [state.lang==='ar'?'فشل أو عائق':'Failures / blockers',String(p.fail)],
   [state.lang==='ar'?'عينات إنجليزية مكتملة':'Complete English samples',en.complete+' / 30'],
   [state.lang==='ar'?'عينات عربية مكتملة':'Complete Arabic samples',ar.complete+' / 30'],
   [state.lang==='ar'?'فائدة المقترحات — إنجليزي':'English suggestion usefulness',en.ratio===null?t().draft:en.ratio+'%'],
   [state.lang==='ar'?'فائدة المقترحات — عربي':'Arabic suggestion usefulness',ar.ratio===null?t().draft:ar.ratio+'%']
  ];
  for(const [key,value] of items){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;list.append(dt,dd)}
  el('summaryContent').replaceChildren(list);
  metric();
 }
 function view(name){
  const pages={cases:'casesPanel',samples:'samplesPanel',summary:'summaryPanel'},
   tabs={cases:'tabCases',samples:'tabSamples',summary:'tabSummary'};
  for(const k of Object.keys(pages)){el(pages[k]).hidden=k!==name;el(tabs[k]).setAttribute('aria-current',k===name?'page':'false')}
  if(name==='summary')renderSummary();
 }
 function locale(lang){
  state.lang=lang;document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  const x=t();
  const labels={
   brandNote:'brand',livePreview:'preview',eyebrow:'eyebrow',pageTitle:'title',introduction:'intro',
   holdTitle:'hold',holdText:'holdBody',passLabel:'pass',failLabel:'fail',notRunLabel:'notRun',samplesLabel:'samples',
   tabCases:'tabCases',tabSamples:'tabSamples',tabSummary:'tabSummary',privacyNote:'privacy',
   importEvidence:'import',exportEvidence:'export',casesHeading:'caseHead',casesIntro:'caseIntro',
   statusLabel:'caseStatus',testerLabel:'tester',deviceLabel:'device',observationLabel:'observation',
   evidenceLabel:'evidence',previousCase:'prev',nextCase:'next',saveCase:'save',
   samplesHeading:'sourceHead',samplesIntro:'sourceIntro',reviewerALabel:'a',reviewerBLabel:'b',
   sampleSelectLabel:'sample',sampleSourceLabel:'provenance',verifiedLabel:'verified',
   sampleTotalLabel:'total',sampleInstructions:'help',legendA:'a',legendB:'b',
   aReviewedLabel:'reviewed',aUsefulLabel:'useful',aRiskLabel:'risk',
   bReviewedLabel:'reviewed',bUsefulLabel:'useful',bRiskLabel:'risk',
   previousSample:'prevSample',nextSample:'nextSample',saveSample:'saveSample',
   summaryHeading:'summaryHead',summaryText:'summaryText',releaseWarning:'release',footerPreview:'footer',
   toggleLanguage:'buttonLang'
  };
  for(const [id,key] of Object.entries(labels))text(id,x[key]);
  const select=el('caseStatus');
  for(let i=0;i<statuses.length;i++)select.options[i].textContent=statusLabels[lang][statuses[i]];
  renderList();renderCase();renderSample();renderSummary();
 }
 function evidencePayload(){
  return {schema:'tis-v11-m5-manual-v1',exportedAt:new Date().toISOString(),
   repository:'bimspecialist/Text-Integrity-Studio',
   sourcePage:'quality/v11-manual-acceptance.html',releaseStatus:'HOLD',
   summary:progress(),checks:state.cases,samples:state.samples,
   reviewerA:state.reviewerA,reviewerB:state.reviewerB,advisoryOnly:true};
 }
 function exportEvidence(){
  saveCase(true);saveSample(true);
  const output=JSON.stringify(evidencePayload(),null,2);
  const blob=new Blob([output],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='tis-v11-manual-evidence-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 function importEvidence(json){
  if(!json||json.schema!=='tis-v11-m5-manual-v1'||!json.checks||!Array.isArray(json.samples))
   throw new TypeError('Unexpected evidence schema');
  for(const [id] of pairs)state.cases[id]=cleanCase(json.checks[id]);
  state.reviewerA=typeof json.reviewerA==='string'?json.reviewerA.slice(0,60):'';
  state.reviewerB=typeof json.reviewerB==='string'?json.reviewerB.slice(0,60):'';
  for(const original of state.samples){
   const incoming=json.samples.find(x=>x?.id===original.id);
   Object.assign(original,freshSample(original.id));
   if(!incoming)continue;
   original.verified=incoming.verified===true;
   original.sourceRef=typeof incoming.sourceRef==='string'?incoming.sourceRef.slice(0,180):'';
   for(const key of Object.values(numericFields))
    original[key]=/^\d{1,3}$/.test(String(incoming[key]))?String(incoming[key]):'';
  }
  renderList();renderCase();renderSample();renderSummary();
 }
 async function importFile(file){
  if(!file||file.size>4*1024*1024)throw new Error('Invalid file');
  const raw=await file.text();
  const parsed=JSON.parse(raw);
  importEvidence(parsed);
 }
 function init(){
  const select=el('sampleSelect');
  for(const id of SAMPLES){const option=document.createElement('option');option.value=id;option.textContent=id;select.append(option)}
  el('tabCases').addEventListener('click',()=>{saveSample(true);view('cases')});
  el('tabSamples').addEventListener('click',()=>{saveCase(true);view('samples')});
  el('tabSummary').addEventListener('click',()=>{saveCase(true);saveSample(true);view('summary')});
  el('toggleLanguage').addEventListener('click',()=>{saveCase(true);saveSample(true);locale(state.lang==='ar'?'en':'ar')});
  el('previousCase').addEventListener('click',()=>{saveCase(true);state.selectedCase=Math.max(0,state.selectedCase-1);renderList();renderCase();el('caseTitle').focus()});
  el('nextCase').addEventListener('click',()=>{saveCase(true);state.selectedCase=Math.min(pairs.length-1,state.selectedCase+1);renderList();renderCase();el('caseTitle').focus()});
  el('saveCase').addEventListener('click',()=>saveCase());
  el('caseStatus').addEventListener('change',()=>saveCase());
  el('sampleSelect').addEventListener('change',()=>{saveSample(true);state.selectedSample=SAMPLES.indexOf(el('sampleSelect').value);renderSample()});
  el('previousSample').addEventListener('click',()=>{saveSample(true);state.selectedSample=Math.max(0,state.selectedSample-1);renderSample()});
  el('nextSample').addEventListener('click',()=>{saveSample(true);state.selectedSample=Math.min(59,state.selectedSample+1);renderSample()});
  el('saveSample').addEventListener('click',()=>saveSample());
  el('exportEvidence').addEventListener('click',exportEvidence);
  el('importEvidence').addEventListener('click',()=>el('evidenceFile').click());
  el('evidenceFile').addEventListener('change',async()=>{
   try{await importFile(el('evidenceFile').files?.[0]);text('caseValidation',t().importDone)}
   catch{ text('caseValidation',t().importFail);el('caseValidation').dataset.error='true'; }
   finally{el('evidenceFile').value=''}
  });
  locale('ar');view('cases');
 }
 init();
})();
