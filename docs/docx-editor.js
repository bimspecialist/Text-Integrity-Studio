/* Text Integrity Studio — local tracked editorial revisions for Word DOCX.
 * Safe scope: ordinary wordprocessingml paragraphs with simple direct text runs.
 * All other paragraphs are explicitly skipped, never flattened/reformatted.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TextIntegrityDocxEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML='http://www.w3.org/XML/1998/namespace';
const is=(node,name)=>!!node&&node.nodeType===1&&node.namespaceURI===W&&node.localName===name;
const children=node=>Array.from(node.childNodes||[]).filter(n=>n.nodeType===1);
const descendants=(node,name)=>Array.from(node.getElementsByTagNameNS(W,name));
function paragraphRuns(p){
 const elements=children(p);
 if(elements.some(n=>!is(n,'pPr')&&!is(n,'r')))return null;
 const runs=[];
 for(const run of elements.filter(n=>is(n,'r'))){
   const contents=children(run).filter(n=>!is(n,'rPr'));
   if(contents.length!==1||!is(contents[0],'t'))return null;
   if(run.childNodes&&Array.from(run.childNodes).some(n=>n.nodeType===3&&n.textContent.trim()))return null;
   if(descendants(run,'fldChar').length||descendants(run,'instrText').length)return null;
   const t=contents[0],value=t.textContent||'';
   if(!value)continue;
   const hidden=descendants(run,'rPr').some(pr=>children(pr).some(n=>['vanish','webHidden','specVanish'].includes(n.localName)&&n.namespaceURI===W));
   if(hidden)return null;
   runs.push({run,t,value,start:0,end:0});
 }
 if(!runs.length)return null;
 let pos=0;
 for(const r of runs){r.start=pos;pos+=r.value.length;r.end=pos;}
 return {runs,text:runs.map(x=>x.value).join('')};
}
function planDocument(doc,rules,options={}){
 if(!rules||typeof rules.analyze!=='function')throw new TypeError('Writing rules unavailable');
 const part=options.part||'word/document.xml',mode=options.mode||'academic';
 const paragraphs=descendants(doc,'p');
 let skipped=0,eligible=0;const suggestions=[];
 paragraphs.forEach((p,index)=>{
   const data=paragraphRuns(p);
   if(!data){if(children(p).some(n=>is(n,'r')))skipped++;return;}
   eligible++;
   // Analyze each paragraph independently, so no suggestion spans headings or tables.
   const response=rules.analyze(data.text,mode);
   for(const s of response.suggestions){
     if(s.start<0||s.end>data.text.length||data.text.slice(s.start,s.end)!==s.original)continue;
     suggestions.push({...s,id:[part,index,s.id].join('|'),part,paragraphIndex:index,paragraphPreview:data.text.slice(0,150)});
   }
 });
 return {part,mode,paragraphs:paragraphs.length,eligible,skipped,suggestions,coverageWarning:skipped>0};
}
function makeRunFragment(entry,start,end,doc,deletion=false){
 const value=entry.value.slice(start-entry.start,end-entry.start);
 if(!value)return null;
 const clone=entry.run.cloneNode(true),old=descendants(clone,'t')[0];
 if(!old)throw new Error('Original text run could not be cloned');
 if(deletion){
   const delText=doc.createElementNS(W,'w:delText');
   delText.textContent=value; if(/^\s|\s$/u.test(value))delText.setAttributeNS(XML,'xml:space','preserve');
   old.parentNode.replaceChild(delText,old);
 }else{
   old.textContent=value;
   if(/^\s|\s$/u.test(value))old.setAttributeNS(XML,'xml:space','preserve');
 }
 return clone;
}
function insertRun(entry,text,doc){
 if(!text)return null;
 const clone=entry.run.cloneNode(true),target=descendants(clone,'t')[0];
 target.textContent=text;
 if(/^\s|\s$/u.test(text))target.setAttributeNS(XML,'xml:space','preserve');
 return clone;
}
function wrap(doc,kind,run,id,options){
 const el=doc.createElementNS(W,'w:'+kind);
 el.setAttributeNS(W,'w:id',String(id));
 el.setAttributeNS(W,'w:author',options.author||'Text Integrity Studio');
 el.setAttributeNS(W,'w:date',options.date||new Date().toISOString());
 el.appendChild(run);
 return el;
}
function maxRevisionId(doc){
 let max=0;
 for(const name of ['ins','del','moveFrom','moveTo']){
   for(const el of descendants(doc,name)){
     const raw=el.getAttributeNS(W,'id')||el.getAttribute('w:id');
     if(raw&&/^\d+$/.test(raw))max=Math.max(max,+raw);
   }
 }
 return max;
}
function rewriteParagraph(doc,p,edits,track,nextId,options){
 const data=paragraphRuns(p);
 if(!data)return {applied:0,skipped:edits.length,nextId};
 const ordered=[...edits].sort((a,b)=>a.start-b.start);
 let previousEnd=0;
 for(const edit of ordered){
   if(edit.start<previousEnd||edit.start<0||edit.end>data.text.length||data.text.slice(edit.start,edit.end)!==edit.original)
     return {applied:0,skipped:edits.length,nextId};
   previousEnd=edit.end;
 }
 const original=Array.from(p.childNodes);
 const fragments=[];
 function plain(from,to,asDeletion){
   if(from===to)return;
   for(const entry of data.runs){
     const begin=Math.max(from,entry.start),end=Math.min(to,entry.end);
     if(begin>=end)continue;
     const run=makeRunFragment(entry,begin,end,doc,asDeletion);
     fragments.push(asDeletion?wrap(doc,'del',run,++nextId,options):run);
   }
 }
 let cursor=0;
 for(const edit of ordered){
   plain(cursor,edit.start,false);
   if(track)plain(edit.start,edit.end,true);
   const originalEntry=data.runs.find(r=>r.start<=edit.start&&r.end>edit.start)||data.runs[data.runs.length-1];
   const insertion=insertRun(originalEntry,edit.replacement,doc);
   if(insertion)fragments.push(track?wrap(doc,'ins',insertion,++nextId,options):insertion);
   cursor=edit.end;
 }
 plain(cursor,data.text.length,false);
 const ppr=original.filter(n=>is(n,'pPr'));
 while(p.firstChild)p.removeChild(p.firstChild);
 for(const prop of ppr)p.appendChild(prop);
 for(const run of fragments)p.appendChild(run);
 return {applied:ordered.length,skipped:0,nextId};
}
function applyDocument(doc,rules,ids,options={}){
 const info=planDocument(doc,rules,options);
 const selected=new Set(ids||[]),selectedEdits=info.suggestions.filter(s=>selected.has(s.id));
 const byPara=new Map();
 for(const item of selectedEdits){
   if(!byPara.has(item.paragraphIndex))byPara.set(item.paragraphIndex,[]);
   byPara.get(item.paragraphIndex).push(item);
 }
 const nodes=descendants(doc,'p');
 let applied=0,skipped=0,nextId=maxRevisionId(doc);
 const config={author:options.author||'Text Integrity Studio',date:options.date};
 for(const [index,edits] of byPara.entries()){
   const result=rewriteParagraph(doc,nodes[index],edits,options.track!==false,nextId,config);
   applied+=result.applied;skipped+=result.skipped;nextId=result.nextId;
 }
 return {applied,skipped,available:info.suggestions.length,eligibleParagraphs:info.eligible,skippedParagraphs:info.skipped,
  tracked:options.track!==false,selected:selectedEdits.length};
}
return Object.freeze({version:'1.0.0',planDocument,applyDocument,paragraphRuns});
});