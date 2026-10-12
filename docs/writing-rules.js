/* Text Integrity Studio - Writing Rules v1.0
 * Local, deterministic editorial suggestions: no claims of AI authorship.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TextIntegrityRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const EN_WORDS=[['teh','the'],['recieve','receive'],['recieved','received'],['seperate','separate'],['definately','definitely'],['occurence','occurrence'],['wich','which'],['adress','address'],['alot','a lot'],['enviroment','environment']];
const AR_WORDS=[['هاذا','هذا'],['هاذه','هذه'],['لاكن','لكن'],['اللذي','الذي'],['التى','التي'],['ايضا','أيضًا']];
function uppercaseReplacement(original,replacement){
  if(original.toUpperCase()===original)return replacement.toUpperCase();
  if(original[0]===original[0].toUpperCase())return replacement[0].toUpperCase()+replacement.slice(1);
  return replacement;
}
// Preserve quoted statements, citations, URLs, measurements and code.
function protectedRanges(text){
 const result=[];
 const patterns=[
  /https?:\/\/[^\s<>"']+/giu,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  /https?:\/\/doi\.org\/[^\s]+|\bdoi\s*:\s*10\.\d{4,9}\/\S+/giu,
  /\[[0-9]+(?:\s*[,;\-]\s*[0-9]+)*\]/gu,
  /\([A-Z][A-Za-z' .&-]+,\s*(?:19|20)\d{2}[a-z]?\)/g,
  /"[^"\n]{1,2000}"|“[^”\n]{1,2000}”|«[^»\n]{1,2000}»/gu,
  /\x60[^\x60\n]+\x60|\x60{3}[\s\S]*?\x60{3}/gu,
  /\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)/gu,
  /\b\d+(?:\.\d+)?\s*(?:%|mm|cm|m²|m³|km|kPa|MPa|Pa|kW|kWh|Hz|GHz|MB|GB|TB|°C)\b/giu,
  /\b(?:ISO|SBC|ASTM|ASCE|IEC|IEEE|Revit)\s*[- ]?\d{2,6}(?:[-:]\d+)?\b/giu
 ];
 for(const re of patterns){re.lastIndex=0;let m;while((m=re.exec(text))!==null){result.push([m.index,m.index+m[0].length]);if(m[0].length===0)re.lastIndex++;}}
 return result;
}
function analyze(text,mode='clear'){
 if(typeof text!=='string')throw new TypeError('Expected text');
 const originalLength=text.length;
 const MAX_CHARS=200000;
 const truncated=originalLength>MAX_CHARS;
 text=text.slice(0,MAX_CHARS);
 const result=[];let counter=0;
 const protectedSpans=protectedRanges(text);
 const overlapsProtected=(start,end)=>protectedSpans.some(([a,b])=>start<b&&end>a);
 function add(rule,start,end,replacement,category,explanation,arExplanation,risk='low'){
   const original=text.slice(start,end);
   if(!original||original===replacement||result.length>=300||overlapsProtected(start,end))return;
   result.push({id:rule+':'+start+':'+end,rule,start,end,original,replacement,category,risk,
     reason:explanation,reasonAr:arExplanation,optional:true});
 }
 function regex(regex,rule,category,explanation,arExplanation,map,risk='low'){
   let m; regex.lastIndex=0;
   while((m=regex.exec(text))!==null){
     if(++counter>12000)break;
     const change=map(m);if(change===null)continue;
     add(rule,m.index,m.index+m[0].length,change,category,explanation,arExplanation,risk);
     if(m[0].length===0)regex.lastIndex++;
   }
 }
 regex(/\b([A-Za-z][A-Za-z'-]*)[ \t]+\1\b/gi,'en-repeated','Grammar',
   'Possible repeated English word.','كلمة إنجليزية متكررة متجاورة.',m=>m[1]);
 regex(/([\p{Script=Arabic}][\p{Script=Arabic}\p{M}]{1,})[ \t]+\1/gu,'ar-repeated','Grammar',
   'Possible repeated Arabic word.','كلمة عربية متكررة متجاورة.',m=>m[1]);
 regex(/[ \t]+([,;!?،؛؟])/g,'space-before-punctuation','Punctuation',
   'Remove whitespace before punctuation.','إزالة مسافة قبل علامة الترقيم.',m=>m[1]);
 regex(/([,;:،؛])(?=[A-Za-z\p{Script=Arabic}])/gu,'missing-punctuation-space','Punctuation',
   'Insert a space after punctuation when appropriate.','إضافة مسافة بعد علامة الترقيم عند الحاجة.',m=>m[1]+' ');
 regex(/ {2,}/g,'multiple-spaces','Formatting',
   'Reduce repeated spaces (review table alignment first).','تقليل المسافات المتكررة، مع مراجعة تنسيق الجداول أولاً.',()=>' ','medium');
 regex(/[ \t]+$/gm,'trailing-space','Formatting',
   'Remove trailing whitespace.','إزالة المسافات في نهاية السطر.',()=>'');
 for(const [bad,good] of EN_WORDS){
   const rx=new RegExp('\\b'+bad+'\\b','gi');let m;
   while((m=rx.exec(text))!==null){
     add('en-spelling-'+bad,m.index,m.index+m[0].length,uppercaseReplacement(m[0],good),
       'Spelling','Common English spelling suggestion.','اقتراح لتصحيح تهجئة إنجليزية شائعة.');
   }
 }
 for(const [bad,good] of AR_WORDS){
   const rx=new RegExp('(?<![\\p{L}\\p{M}])'+bad+'(?![\\p{L}\\p{M}])','gu');let m;
   while((m=rx.exec(text))!==null){
     add('ar-spelling-'+bad,m.index,m.index+m[0].length,good,'Spelling',
       'Optional Modern Standard Arabic spelling suggestion; preserve dialect when intended.',
       'اقتراح إملائي للفصحى؛ احفظ اللهجة عندما تكون مقصودة.','medium');
   }
 }
 if(mode==='clear'||mode==='professional'){
   const phrases=[
     [/\bin order to\b/gi,'to','Tighten wording without changing intent.','اختصار التعبير مع الحفاظ على المعنى.'],
     [/\bdue to the fact that\b/gi,'because','Replace wordy expression.','تبسيط التعبير الطويل.'],
     [/\bat this point in time\b/gi,'now','Simplify a lengthy time expression when context allows.','تبسيط التعبير الزمني عند ملاءمة السياق.'],
     [/\bis able to\b/gi,'can','Use a concise expression where meaning is unchanged.','استخدم تعبيرًا مختصرًا عند عدم تغير المعنى.']
   ];
   for(let i=0;i<phrases.length;i++){const [rx,to,why,whyAr]=phrases[i];regex(rx,'concise-'+i,'Clarity',why,whyAr,m=>uppercaseReplacement(m[0],to),'medium');}
 }
 const sorted=result.sort((a,b)=>a.start-b.start||(a.risk==='low'?-1:1));
 const accepted=[],discarded=[];
 for(const s of sorted){const prior=accepted[accepted.length-1];if(prior&&s.start<prior.end){discarded.push(s);continue;}accepted.push(s);}
 return {suggestions:accepted,overlappingDiscarded:discarded.length,mode,
   truncated,scannedCharacters:text.length,totalCharacters:originalLength,protectedSpanCount:protectedSpans.length,
   wordCount:(text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu)||[]).length,
   caveat:'Deterministic editorial suggestions, not an AI detector or authorship estimator.'};
}
function apply(text,suggestion){
 if(typeof text!=='string'||!suggestion)throw new TypeError('Invalid text or suggestion');
 const {start,end,original,replacement}=suggestion;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>text.length||start>=end||text.slice(start,end)!==original)
   throw new Error('Text changed. Re-scan before applying this suggestion.');
 return text.slice(0,start)+replacement+text.slice(end);
}
function previewAll(text,suggestions){
 const chosen=[...suggestions].sort((a,b)=>b.start-a.start);let result=text;
 for(const s of chosen)result=apply(result,s);
 return result;
}
return Object.freeze({version:'1.0.0',analyze,apply,previewAll});
});