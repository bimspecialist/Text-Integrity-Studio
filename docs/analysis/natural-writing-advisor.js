/* Text Integrity Studio — local editorial advice only.
 * Source-derived rules and descriptive style observations; no AI score is
 * accepted as an input and no part of the user's text is sent anywhere.
 */
(function(root,factory){
 'use strict';
 const rules=root&&root.TextIntegrityRules||
  (typeof module==='object'&&module.exports?require('../writing-rules.js'):null);
 const insights=root&&root.TextIntegrityStudioInsights||
  (typeof module==='object'&&module.exports?require('../studio-insights-core.js'):null);
 const api=factory(rules,insights);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISNaturalWritingAdvisor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(rules,insights){
 'use strict';
 if(typeof rules?.analyze!=='function'||typeof insights?.analyzeDocument!=='function')
  throw Error('Local writing rules and insights are required');
 const BASIS='LOCAL_EDITORIAL_HEURISTIC';
 const GUIDES=Object.freeze({
  clarity:'https://www.plainlanguage.gov/guidelines/',
  references:'https://owl.purdue.edu/owl/research_and_citation/resources.html',
  writing:'https://owl.purdue.edu/owl/general_writing/academic_writing/index.html'
 });
 const RISK_DESC={
  en:'Local editorial heuristics only; suggestions are not AI-authorship findings or guaranteed detector-score reductions.',
  ar:'ملاحظات تحرير محلية فقط؛ لا تثبت من كتب النص ولا تضمن تغيير نتيجة كاشف الذكاء الاصطناعي.'
 };
 function protectiveSpans(text){
  const spans=[];
  const patterns=[
   /https?:\/\/[^\s<>"']+/giu,
   /\[[0-9]+(?:\s*[,;–-]\s*[0-9]+)*\]/gu,
   /\([A-Z][A-Za-z' .&-]+,\s*(?:19|20)\d{2}[a-z]?\)/g,
   /["“«][^"”»\n]{1,2000}["”»]/gu,
   /\b(?:ISO|SBC|ASTM|ASCE|IEC|IEEE)\s*[- ]?\d{2,6}(?:[-:]\d+)?\b/giu,
   /\b\d+(?:[.,]\d+)?(?:\s*(?:%|mm|cm|m|kPa|MPa|Pa|Hz|kW|kWh|MB|GB|°C))?\b/giu,
   /\b\d{1,2}[:/]\d{2}(?:[:/]\d{2,4})?\b/gu,
   /\b(?:[A-Za-z]\s*[=+*/-]\s*[A-Za-z0-9]+)(?:\s*[=+*/-]\s*[A-Za-z0-9]+)*\b/gu,
   /`[^`\n]+`/gu
  ];
  for(const re of patterns){
   for(const m of text.matchAll(re))spans.push([m.index,m.index+m[0].length]);
  }
  return spans;
 }
 function categoryOf(rule){
  if(rule==='en-repeated'||rule==='ar-repeated')return 'repetition';
  if(rule.startsWith('concise-'))return 'clarity';
  return 'grammar';
 }
 function sectionOf(spans,start,end){
  const i=spans.findIndex(p=>p.start<=start&&p.end>=end);
  return i<0?null:i+1;
 }
 function suggest(snapshot,{locale='en',mode='academic',limit=20}={}){
  if(!snapshot||typeof snapshot.text!=='string'||!Number.isInteger(snapshot.revision)||
   !Array.isArray(snapshot.paragraphs))throw new TypeError('Immutable document snapshot required');
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new RangeError('Invalid advice limit');
  const text=snapshot.text;
  const loc=locale==='ar'?'ar':'en';
  const paragraphs=snapshot.paragraphs;
  const spans=protectiveSpans(text);
  const intersects=(start,end)=>spans.some(([a,b])=>start<b&&end>a);
  const rulesMode=mode==='professional'?'professional':mode==='clear'?'clear':'academic';
  const grammar=rules.analyze(text,rulesMode);
  const style=insights.analyzeDocument(text,{locale:loc,maxCharacters:120000,maxSections:500});
  const found=[];
  for(const raw of grammar.suggestions){
   if(!Number.isInteger(raw.start)||!Number.isInteger(raw.end)||
    raw.start<0||raw.end>text.length||raw.end<=raw.start||
    text.slice(raw.start,raw.end)!==raw.original||intersects(raw.start,raw.end))continue;
   const section=sectionOf(paragraphs,raw.start,raw.end);
   if(!section)continue;
   // For Arabic dialect, 'هاذا' etc. are intentional in some writing.
   // Medium-risk, formalization and generic phrasing ALWAYS require manual review.
   const safe=raw.risk==='low'&&!raw.rule.startsWith('ar-spelling-')&&
    !/^\d/.test(raw.original)&&!(/^[A-Z]/.test(raw.original));
   const proposedReplacement=safe&&typeof raw.replacement==='string'&&
    raw.replacement!==raw.original?raw.replacement:null;
   const category=categoryOf(raw.rule);
   found.push(Object.freeze({
    id:'h1-rule-'+snapshot.revision+'-'+raw.id,
    revision:snapshot.revision,category,section,
    start:raw.start,end:raw.end,original:raw.original,
    proposedReplacement,
    reason:loc==='ar'?raw.reasonAr:raw.reason,
    reasonBasis:BASIS,locale:loc,risk:proposedReplacement!==null?'low':'manual',
    reference:category==='clarity'?GUIDES.clarity:GUIDES.writing
   }));
  }
  const kinds={LONG_SENTENCE:'clarity',REPEATED_TERM:'repetition',UNIFORM_RHYTHM:'rhythm'};
  for(const suggestion of style.suggestions){
   const range=style.sections.find(s=>s.id===suggestion.section);
   if(!range||!(suggestion.code in kinds))continue;
   const start=range.start;
   // Human action prompts show only bounded exact excerpts; they cannot
   // fabricate a full paragraph by automatic text generation.
   const end=Math.min(range.end,start+Math.min(400,range.end-start));
   if(start===end)continue;
   found.push(Object.freeze({
    id:'h1-style-'+snapshot.revision+'-'+suggestion.id,
    revision:snapshot.revision,
    category:kinds[suggestion.code],
    section:sectionOf(paragraphs,start,end)||suggestion.section,
    start,end,original:text.slice(start,end),
    proposedReplacement:null,
    reason:suggestion.reason,
    reasonBasis:BASIS,locale:loc,risk:'manual',reference:suggestion.reference||GUIDES.clarity
   }));
  }
  // Prefer deterministic low-risk corrections over qualitative prompts;
  // this ranking is independent of detector signals and predicted authorship.
  found.sort((a,b)=>((a.risk==='low'?0:1)-(b.risk==='low'?0:1))||
   a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
  return Object.freeze({
   revision:snapshot.revision,
   suggestions:Object.freeze(found.slice(0,limit)),
   isPartial:grammar.truncated===true||style.partial===true,
   disclaimer:RISK_DESC[loc]
  });
 }
 return Object.freeze({suggest});
});
