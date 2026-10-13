/* Text Integrity Studio — descriptive writing evidence only.
   The metrics below are local editorial heuristics, NEVER AI-authorship probabilities.
   No source excerpts are returned or persisted in this module's report. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TextIntegrityStudioInsights=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const VERSION='TIS_STYLE_V1';
 const GUIDES={
  clarity:'https://www.plainlanguage.gov/guidelines/',
  references:'https://owl.purdue.edu/owl/research_and_citation/resources.html',
  writing:'https://owl.purdue.edu/owl/general_writing/academic_writing/index.html'
 };
 const STOP=new Set(('the and that with from they their this have were there about which into using over very when would '+
  'was for are has had did you your them our but not its can all more also one each than those these '+
  'في من على إلى الى عن هذا هذه ذلك التي الذي هو هي كان كانت وقد تم مع وما هنا على بين '+
  'أن إن ثم كما وقد عبر بعد قبل عند لدى منه فيها بها وقد هو هم').toLocaleLowerCase().split(/\s+/u));
 const round=(n,d=1)=>Number(n.toFixed(d));
 function wordsOf(text){return (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’_-]*/gu)||[]);}
 function sentenceCounts(text){
  const groups=text.match(/[^.!?؟。！？\r\n]+(?:[.!?؟。！？]+|$)/gu)||[];
  return groups.map(s=>wordsOf(s).length).filter(Boolean);
 }
 function languageOf(text,override){
  if(override==='ar'||override==='en')return override;
  const ar=(text.match(/\p{Script=Arabic}/gu)||[]).length;
  const latin=(text.match(/[A-Za-z]/g)||[]).length;
  return ar>latin*.5?'ar':'en';
 }
 function stats(text){
  const list=wordsOf(text),lower=list.map(w=>w.toLocaleLowerCase());
  const sentenceLengths=sentenceCounts(text);
  const n=sentenceLengths.length;
  const avg=n?sentenceLengths.reduce((a,b)=>a+b,0)/n:0;
  const std=n?Math.sqrt(sentenceLengths.reduce((sum,k)=>sum+(k-avg)**2,0)/n):0;
  const freq=new Map();
  for(const word of lower){
   if(word.length>=4&&!STOP.has(word))freq.set(word,(freq.get(word)||0)+1);
  }
  const ranked=[...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const top=ranked[0]||null;
  return {
   words:list.length,characters:text.length,sentences:n,
   averageSentenceWords:round(avg),sentenceWordStdDev:round(std),
   longestSentenceWords:sentenceLengths.length?Math.max(...sentenceLengths):0,
   lexicalDiversity:list.length?round(new Set(lower).size/list.length,3):0,
   repeatedTermCount:top?top[1]:0,
   repeatedTermShare:list.length&&top?round(top[1]/list.length,3):0,
   // This number describes expression only; it is not a distinctive author identity.
   styleVectorVersion:1
  };
 }
 function sectionsOf(text){
  const sections=[];const pattern=/\r?\n[ \t]*\r?\n/g;
  let previous=0;let match;
  function add(begin,end){
   while(begin<end&&/\s/u.test(text.charAt(begin)))begin++;
   while(end>begin&&/\s/u.test(text.charAt(end-1)))end--;
   if(end>begin)sections.push({start:begin,end});
  }
  while((match=pattern.exec(text))!==null){
   add(previous,match.index);previous=pattern.lastIndex;
  }
  add(previous,text.length);
  return sections;
 }
 const msg={
  LONG_SENTENCE:{
   en:['Consider splitting this long sentence','Separate distinct ideas where meaning remains intact. Check technical links and citations after editing.','clarity'],
   ar:['راجع الجملة الطويلة','قسّم الأفكار المستقلة إن أمكن دون تغيير المعنى، وراجع المصطلحات والمراجع بعد التحرير.','clarity']},
  REPEATED_TERM:{
   en:['Repeated terminology','Check whether repeating the same word is required technically. Replace only unnecessary repetition.','style'],
   ar:['تكرار المصطلحات','تحقق هل تكرار المصطلح ضروري فنيًا، وعدّل التكرار غير الضروري فقط.','style']},
  UNIFORM_RHYTHM:{
   en:['Review sentence rhythm','Check whether combining or separating sentences improves the flow; variation is not proof of authorship.','style'],
   ar:['راجع إيقاع الجمل','يمكن دمج بعض الجمل أو تقسيمها لتحسين القراءة عند الحاجة، ولا يدل التنوع على هوية الكاتب.','style']}
 };
 function suggestion(code,index,locale,metric){
  const entry=msg[code][locale==='ar'?'ar':'en'];
  return {
   id:'style-'+index+'-'+code,code,section:index+1,category:entry[2],
   title:entry[0],reason:entry[1],metric,
   reference:code==='REPEATED_TERM'?GUIDES.writing:GUIDES.clarity,
   manualReview:true
  };
 }
 function analyzeDocument(raw,options={}){
  if(typeof raw!=='string')throw new TypeError('Text must be a string');
  const maxChars=Math.max(100,Math.min(120000,Number(options.maxCharacters)||120000));
  const maxSections=Math.max(1,Math.min(1000,Number(options.maxSections)||500));
  const sliced=raw.slice(0,maxChars);
  const loc=languageOf(sliced,options.locale);
  const all=sectionsOf(sliced);
  const picked=all.slice(0,maxSections);
  const resultSections=[];
  const suggestions=[];
  for(const [i,span] of picked.entries()){
   const p=sliced.slice(span.start,span.end);
   const stat=stats(p);
   resultSections.push({id:i+1,start:span.start,end:span.end,statistics:stat});
   if(stat.longestSentenceWords>=36)
    suggestions.push(suggestion('LONG_SENTENCE',i,loc,stat.longestSentenceWords));
   if(stat.words>=35&&stat.repeatedTermCount>=6&&stat.repeatedTermShare>=.12)
    suggestions.push(suggestion('REPEATED_TERM',i,loc,stat.repeatedTermShare));
   if(stat.words>=70&&stat.sentences>=3&&stat.averageSentenceWords>=12&&stat.sentenceWordStdDev<3)
    suggestions.push(suggestion('UNIFORM_RHYTHM',i,loc,stat.sentenceWordStdDev));
  }
  const processedText=picked.map(x=>sliced.slice(x.start,x.end)).join('\n\n');
  const measured=stats(processedText);
  const analyzedCharacters=picked.reduce((n,x)=>n+x.end-x.start,0);
  const availableCharacters=Math.max(1,raw.length);
  return {
   version:VERSION,language:loc,partial:raw.length>sliced.length||all.length>picked.length,
   paragraphs:{total:all.length+(raw.length>sliced.length?1:0),analyzed:picked.length},
   statistics:{
    ...measured,characters:raw.length,
    analyzedCharacters,
    coveragePercent:round(analyzedCharacters/availableCharacters*100)
   },
   sections:resultSections,
   suggestions,
   disclaimer:'Descriptive editorial heuristics; no AI-authorship probability, identity fingerprint or independent confidence interval. Partial document analyses are explicitly reported.'
  };
 }
 function safeFileMetadata(file){
  if(!file||typeof file!=='object')return null;
  const name=String(file.name||'');
  const ext=((name.match(/\.([a-z0-9]{1,8})$/i)||[])[1]||'').toLowerCase();
  const supported=new Set(['txt','md','csv','tsv','json','docx','pdf','log','yaml','yml','tex','srt','vtt']);
  const size=Number(file.size);
  const date=Number(file.lastModified);
  return {
   extension:supported.has(ext)?ext:'unsupported',
   bytes:Number.isSafeInteger(size)&&size>=0?size:null,
   modifiedIso:Number.isFinite(date)&&date>0&&date<=8640000000000000?new Date(date).toISOString():null
  };
 }
 function mapModelSegments(text,segments,options={}){
  if(typeof text!=='string')throw new TypeError('Text must be a string');
  const max=Math.max(1,Math.min(16000,Number(options.maxPreviewCharacters)||6500));
  const length=Math.min(max,text.length);
  const ranges=(Array.isArray(segments)?segments:[]).filter(s=>
   s&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&
   s.start>=0&&s.end<=text.length&&s.end>s.start&&
   typeof s.signal==='number'&&Number.isFinite(s.signal)&&s.signal>=0&&s.signal<=100
  ).map(s=>({start:Math.min(s.start,length),end:Math.min(s.end,length),signal:s.signal}))
   .filter(s=>s.end>s.start);
  const points=[0,length,...ranges.flatMap(s=>[s.start,s.end])];
  points.sort((a,b)=>a-b);
  const unique=points.filter((n,i)=>i===0||n!==points[i-1]);
  const chunks=[];let covered=0;
  for(let i=1;i<unique.length;i++){
   const start=unique[i-1],end=unique[i];
   if(end<=start)continue;
   const hits=ranges.filter(s=>s.start<end&&s.end>start);
   const signal=hits.length?round(hits.reduce((n,s)=>n+s.signal,0)/hits.length):null;
   const tier=signal===null?'unreviewed':signal>=75?'high':signal<=35?'low':'medium';
   if(hits.length)covered+=end-start;
   const prev=chunks[chunks.length-1];
   if(prev&&prev.end===start&&prev.tier===tier&&prev.signal===signal)prev.end=end;
   else chunks.push({start,end,signal,tier});
  }
  return {
   chunks,fullCharacters:text.length,previewCharacters:length,
   previewTruncated:text.length>length,coveredCharacters:covered,
   coveragePercent:length?round(covered/length*100):0,
   disclaimer:'Highlight colors show only observed uncalibrated ONNX window signals. Gray passages were not scored; colors never prove who authored text.'
  };
 }
 function editorialExamples(locale){
  const ar=locale==='ar';
  const source=GUIDES.clarity;
  return ar?[
   {kind:'rhythm',title:'تنويع طول الجمل للوضوح',before:'أجرينا القياس. جمعنا البيانات. راجعنا النتائج.',after:'أجرينا القياس وجمعنا البيانات. وبعد مراجعة النتائج، سجّلنا القيود.',description:'الدمج والتقسيم لتحسين تدفق الأفكار، وليس للتحايل على الكشف.',reference:source},
   {kind:'real_context',title:'إضافة تفاصيل حقيقية',before:'كانت التجربة مفيدة.',after:'في التجربة قارن الفريق قراءات الأسبوعين الأول والثاني؛ أضف الأرقام الفعلية عند توفرها.',description:'لا تخترع تجربة شخصية أو نتائج أو مراجع.',reference:GUIDES.references},
   {kind:'local_voice',title:'اختيار لغة مناسبة للقارئ',before:'تم الانتهاء من تنفيذ الخطوات المذكورة أعلاه.',after:'أكملنا الخطوات الموضحة في القسم السابق.',description:'استخدم الصياغات المحلية أو المهنية حين تناسب السياق فقط.',reference:source},
   {kind:'paraphrase',title:'إعادة صياغة مع حفظ المعنى',before:'إن استخدام الطريقة قد ينتج عنه تحسين النتائج.',after:'قد تحسّن هذه الطريقة النتائج إذا دعمتها البيانات.',description:'حافظ على المصطلحات والأرقام ونسبة الأفكار لمصادرها.',reference:GUIDES.references},
   {kind:'accuracy',title:'تصحيح الأخطاء لا اختراعها',before:'تم اخذ النتايج بشكب دقيق.',after:'أُخذت النتائج بدقة.',description:'لا تضف أخطاءً متعمدة لإظهار النص كأنه بشري.',reference:source}
  ]:[
   {kind:'rhythm',title:'Vary sentence length for clarity',before:'We measured the site. We recorded the values. We checked the findings.',after:'We measured the site and recorded the values. Next, we checked the findings against the field notes.',description:'Change rhythm only where it improves reading; not as detector evasion.',reference:source},
   {kind:'real_context',title:'Use verifiable personal detail',before:'The test was interesting and successful.',after:'The team compared the first and second readings; add measured values only if available.',description:'Do not invent experiences, examples, data or references.',reference:GUIDES.references},
   {kind:'local_voice',title:'Choose audience-appropriate phrasing',before:'The aforementioned process was subsequently completed.',after:'We then completed the process described above.',description:'Use natural professional or regional phrasing when it accurately fits the audience.',reference:source},
   {kind:'paraphrase',title:'Paraphrase without changing evidence',before:'This solution may potentially improve the project outcome.',after:'This solution may improve the project outcome if the measurements support it.',description:'Keep technical terminology and attribution when rephrasing.',reference:GUIDES.references},
   {kind:'accuracy',title:'Correct errors rather than adding them',before:'The measurments was done acurately.',after:'The measurements were completed accurately.',description:'Deliberate typos mislead readers and do not validate authorship.',reference:source}
  ];
 }
 return Object.freeze({analyzeDocument,safeFileMetadata,mapModelSegments,editorialExamples});
});