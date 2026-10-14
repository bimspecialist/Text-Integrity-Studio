/* V8.2 first differing range preview: source-preserving, bounded and
 * Unicode-aware. This is NOT a semantic diff, a model rewrite or proof of
 * authorship. Full originals remain exclusively in the two editors.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISDraftDiffPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function firstDifference(original,draft,{maxChangeChars=160,contextChars=32}={}){
  if(typeof original!=='string'||typeof draft!=='string')
   throw new TypeError('TWO_TEXT_VALUES_REQUIRED');
  if(!Number.isSafeInteger(maxChangeChars)||maxChangeChars<1||maxChangeChars>500||
   !Number.isSafeInteger(contextChars)||contextChars<0||contextChars>120)
   throw new RangeError('INVALID_PREVIEW_LIMIT');
  const before=Array.from(original),after=Array.from(draft);
  const common=Math.min(before.length,after.length);
  let prefix=0,suffix=0;
  while(prefix<common&&before[prefix]===after[prefix])prefix++;
  if(prefix===before.length&&prefix===after.length)
   return Object.freeze({
    status:'UNCHANGED',originalLength:before.length,draftLength:after.length,
    beforeExcerpt:'',afterExcerpt:'',beforeTruncated:false,
    afterTruncated:false,rangeCount:0,firstChangeOffset:null
   });
  while(suffix<common-prefix&&
   before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;
  const preceding=before.slice(Math.max(0,prefix-contextChars),prefix).join('');
  const following=before.slice(before.length-suffix,
   Math.min(before.length,before.length-suffix+contextChars)).join('');
  const oldChanged=before.slice(prefix,before.length-suffix);
  const newChanged=after.slice(prefix,after.length-suffix);
  const format=(items)=>{
   const truncated=items.length>maxChangeChars;
   return Object.freeze({
    excerpt:preceding+items.slice(0,maxChangeChars).join('')+
     (truncated?'…':'')+following,
    truncated
   });
  };
  const oldPreview=format(oldChanged),newPreview=format(newChanged);
  return Object.freeze({
   status:'CHANGED',
   originalLength:before.length,draftLength:after.length,
   beforeExcerpt:oldPreview.excerpt,afterExcerpt:newPreview.excerpt,
   beforeTruncated:oldPreview.truncated,afterTruncated:newPreview.truncated,
   rangeCount:1,firstChangeOffset:prefix
  });
 }
 return Object.freeze({firstDifference});
});
