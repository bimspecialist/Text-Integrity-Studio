/* Text Integrity Studio — source-accurate paragraph coverage projection.
 * Document coverage counts sampled source words; per-paragraph coverage
 * counts UTF-16 characters. Neither value is authorship probability.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISEvidenceProjection=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const round=value=>Math.round(value*10)/10;
 function selectIndices(total,count){
  if(total<=count)return Array.from({length:total},(_,i)=>i);
  if(count===1)return [Math.floor((total-1)/2)];
  return Array.from({length:count},(_,i)=>Math.round(i*(total-1)/(count-1)));
 }
 function paragraphEvidence(span,segments){
  const start=span.start,end=span.end;
  const relevant=segments.filter(x=>x.start<end&&x.end>start);
  const points=[start,end];
  for(const x of relevant){
   points.push(Math.max(start,x.start),Math.min(end,x.end));
  }
  points.sort((a,b)=>a-b);
  const sorted=points.filter((v,i)=>i===0||v!==points[i-1]);
  let coveredCharacters=0,weighted=0;
  for(let i=1;i<sorted.length;i++){
   const lo=sorted[i-1],hi=sorted[i],width=hi-lo;
   if(width<=0)continue;
   const hits=relevant.filter(x=>x.start<hi&&x.end>lo);
   if(!hits.length)continue;
   coveredCharacters+=width;
   const local=hits.reduce((total,x)=>total+x.signal,0)/hits.length;
   weighted+=width*local;
  }
  const size=end-start;
  const rawCoverage=size>0?coveredCharacters/size*100:0;
  return {
   coveredCharacters,
   uncoveredCharacters:Math.max(0,size-coveredCharacters),
   paragraphCoverageCharactersPercent:round(rawCoverage),
   windowSignal:rawCoverage>=60&&coveredCharacters>0?round(weighted/coveredCharacters):null
  };
 }
 function projectEvidence(snapshot,outcome,{maxOverviewSections=8}={}){
  if(!snapshot||typeof snapshot.text!=='string'||!Array.isArray(snapshot.paragraphs)||
   !outcome||!Number.isInteger(snapshot.revision)||
   !Number.isInteger(outcome.revision)||snapshot.revision!==outcome.revision)
   throw new TypeError('Stale document revision or invalid evidence snapshot');
  const size=snapshot.text.length;
  const windows=Array.isArray(outcome.segments)?outcome.segments.filter(s=>
   s&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&
   s.start>=0&&s.end>s.start&&s.end<=size&&
   Number.isFinite(s.signal)&&s.signal>=0&&s.signal<=100):[];
  const paragraphs=snapshot.paragraphs;
  const valid=paragraphs.map((p,i)=>{
   if(!p||!Number.isInteger(p.start)||!Number.isInteger(p.end)||
    p.start<0||p.end<=p.start||p.end>size)throw new TypeError('Invalid source paragraph offsets');
   return {id:i+1,start:p.start,end:p.end,...paragraphEvidence(p,windows)};
  });
  const requested=Math.floor(Number(maxOverviewSections));
  const count=Number.isFinite(requested)?Math.max(1,Math.min(1000,requested)):8;
  const sections=selectIndices(valid.length,count).map(i=>Object.freeze(valid[i]));
  const wordsCoverage=Number.isFinite(outcome.documentCoverageWordsPercent)&&
   outcome.documentCoverageWordsPercent>=0&&outcome.documentCoverageWordsPercent<=100?
   outcome.documentCoverageWordsPercent:null;
  return Object.freeze({
   sections:Object.freeze(sections),
   totalParagraphs:valid.length,
   documentCoverageWordsPercent:wordsCoverage,
   overallSignal:outcome.kind==='RESEARCH_SIGNAL'&&Number.isFinite(outcome.signal)&&
    outcome.signal>=0&&outcome.signal<=100?outcome.signal:null,
   hasPartialSampling:wordsCoverage===null||wordsCoverage<100||
    valid.some(p=>p.uncoveredCharacters>0)
  });
 }
 return Object.freeze({projectEvidence});
});
