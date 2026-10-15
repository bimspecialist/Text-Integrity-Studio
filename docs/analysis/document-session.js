/* Text Integrity Studio — immutable, browser-local document snapshots.
 * Only the active session owns source text. No storage, network or diagnostics.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISDocumentSession=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SOURCE_KINDS=new Set(['paste','txt','docx','pdf','ocr']);
 function assertSource(text,sourceKind){
  if(typeof text!=='string')throw new TypeError('Document text must be a string');
  if(!SOURCE_KINDS.has(sourceKind))throw new TypeError('Unsupported document source kind');
 }
 function paragraphSpans(text){
  const out=[];
  const separator=/\r?\n[ \t]*\r?\n/gu;
  let cursor=0,match;
  const add=(from,to)=>{
   while(from<to&&/\s/u.test(text.charAt(from)))from++;
   while(to>from&&/\s/u.test(text.charAt(to-1)))to--;
   if(from<to)out.push(Object.freeze({start:from,end:to}));
  };
  while((match=separator.exec(text))!==null){
   add(cursor,match.index);
   cursor=separator.lastIndex;
  }
  add(cursor,text.length);
  return Object.freeze(out);
 }
 function createDocumentSession(initialText='',sourceKind='paste'){
  assertSource(initialText,sourceKind);
  let revision=0;
  const subscribers=new Set();
  function snapshot(text,kind){
   return Object.freeze({
    revision,
    text,
    sourceKind:kind,
    paragraphs:paragraphSpans(text),
    createdAt:Date.now()
   });
  }
  let current=snapshot(initialText,sourceKind);
  function replaceText(text,kind='paste'){
   assertSource(text,kind);
   if(text===current.text&&kind===current.sourceKind)return current;
   revision++;
   current=snapshot(text,kind);
   for(const listener of subscribers)listener(current);
   return current;
  }
  function subscribe(listener){
   if(typeof listener!=='function')throw new TypeError('Subscriber must be a function');
   subscribers.add(listener);
   return ()=>subscribers.delete(listener);
  }
  return Object.freeze({read:()=>current,replaceText,subscribe});
 }
 return Object.freeze({createDocumentSession,paragraphSpans});
});
