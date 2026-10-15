/* V8.8 — Unicode-aware literal search/replace for the REVIEWED DRAFT only.
 * Returns new strings; never mutates the source, submits network requests or
 * applies changes to DocumentSession. Non-user regex patterns are forbidden.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISDraftFindReplace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_MATCHES=1000,MAX_CHARS=240000;
 function validate(text,needle,replacement=null){
  if(typeof text!=='string'||typeof needle!=='string'||
   (replacement!==null&&typeof replacement!=='string'))
   throw new TypeError('TEXT_AND_QUERY_STRINGS_REQUIRED');
  if(Array.from(needle).length>512)throw new RangeError('SEARCH_QUERY_TOO_LONG');
  if(replacement!==null&&replacement.length>10000)
   throw new RangeError('REPLACEMENT_TOO_LONG');
 }
 function matches(text,needle,{caseSensitive=false,limit=MAX_MATCHES}={}){
  validate(text,needle);
  if(typeof caseSensitive!=='boolean'||!Number.isSafeInteger(limit)||
   limit<1||limit>MAX_MATCHES)throw new RangeError('INVALID_SEARCH_OPTIONS');
  if(!needle)return Object.freeze({items:Object.freeze([]),truncated:false});
  // Encode every code point as a literal Unicode escape. Metacharacters
  // such as + . [ ] * and user text "$&" cannot change regex semantics.
  const escaped=Array.from(needle,ch=>'\\u{'+ch.codePointAt(0).toString(16)+'}').join('');
  const matcher=new RegExp(escaped,caseSensitive?'gu':'giu');
  const found=[];let truncated=false;
  for(const m of text.matchAll(matcher)){
   if(found.length>=limit){truncated=true;break;}
   found.push(Object.freeze({start:m.index,end:m.index+m[0].length}));
  }
  return Object.freeze({items:Object.freeze(found),truncated});
 }
 function next(text,needle,from=0,options){
  if(!Number.isSafeInteger(from)||from<0)throw new RangeError('INVALID_CURSOR');
  const result=matches(text,needle,options);
  const item=result.items.find(x=>x.start>=from)||result.items[0]||null;
  return Object.freeze({item,truncated:result.truncated,count:result.items.length});
 }
 function replaceOne(text,needle,replacement,from=0,options){
  validate(text,needle,replacement);
  const result=next(text,needle,from,options);
  if(result.truncated)return Object.freeze({status:'TOO_MANY',text,replacements:0});
  if(!result.item)return Object.freeze({status:'NO_MATCH',text,replacements:0});
  const item=result.item;
  if(text.length-(item.end-item.start)+replacement.length>MAX_CHARS)
   return Object.freeze({status:'OUTPUT_TOO_LARGE',text,replacements:0});
  return Object.freeze({
   status:'REPLACED',
   text:text.slice(0,item.start)+replacement+text.slice(item.end),
   replacements:1,caret:item.start+replacement.length
  });
 }
 function replaceAll(text,needle,replacement,options){
  validate(text,needle,replacement);
  const result=matches(text,needle,options);
  if(result.truncated)return Object.freeze({status:'TOO_MANY',text,replacements:0});
  if(!result.items.length)return Object.freeze({status:'NO_MATCH',text,replacements:0});
  const removed=result.items.reduce((sum,m)=>sum+m.end-m.start,0);
  if(text.length-removed+result.items.length*replacement.length>MAX_CHARS)
   return Object.freeze({status:'OUTPUT_TOO_LARGE',text,replacements:0});
  const parts=[];let end=0;
  for(const m of result.items){
   parts.push(text.slice(end,m.start),replacement);
   end=m.end;
  }
  parts.push(text.slice(end));
  return Object.freeze({status:'REPLACED',text:parts.join(''),
   replacements:result.items.length});
 }
 return Object.freeze({matches,next,replaceOne,replaceAll,MAX_MATCHES});
});
