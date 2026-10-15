/* Text Integrity Studio — explicit local editorial review and reversible edits.
 * Never modifies DOCX source bytes or applies human-writing suggestions
 * without an intentional user action. All history is in-memory per session.
 */
(function(root,factory){
 'use strict';
 const rules=root&&root.TextIntegrityRules||
  (typeof module==='object'&&module.exports?require('../writing-rules.js'):null);
 const api=factory(rules);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISEditorialReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(rules){
 'use strict';
 const MAX_UNDO=15;
 function createEditorialReview({session,advisor,wordBridge=null}={}){
  if(!session||typeof session.read!=='function'||typeof session.replaceText!=='function'||
   typeof advisor?.suggest!=='function'||typeof rules?.apply!=='function')
   throw new TypeError('A revisioned document session and local editorial advisor are required');
  let suggestions=[],suggestionRevision=-1;
  let dismissed=new Set(),dismissedRevision=-1;
  const undoHistory=[];
  function refresh(){
   const source=session.read();
   if(dismissedRevision!==source.revision){
    dismissed.clear();
    dismissedRevision=source.revision;
   }
   const review=advisor.suggest(source,{
    locale:/\p{Script=Arabic}/u.test(source.text)?'ar':'en',
    mode:'academic',
    limit:100
   });
   suggestions=Array.isArray(review.suggestions)?review.suggestions:[];
   suggestionRevision=source.revision;
   return getSuggestions();
  }
  function getSuggestions(){
   if(suggestionRevision!==session.read().revision)refresh();
   return Object.freeze(suggestions.filter(item=>!dismissed.has(item.id)));
  }
  function lookup(id){
   if(typeof id!=='string'||!id)return null;
   return getSuggestions().find(item=>item.id===id)||null;
  }
  function preview(id){
   const item=lookup(id);
   if(!item)return null;
   const current=session.read();
   if(item.revision!==current.revision||current.text.slice(item.start,item.end)!==item.original)return null;
   return Object.freeze({
    before:item.original,after:item.proposedReplacement,
    revision:item.revision,risk:item.risk
   });
  }
  function apply(id){
   // A suggestion may have been issued before an intervening source change.
   // Do not rescan and then silently apply an equivalent-looking new range.
   const previous=suggestions.find(item=>item.id===id);
   const current=session.read();
   if(previous&&previous.revision!==current.revision)
    return {applied:false,reason:'STALE_REVISION'};
   const suggestion=lookup(id);
   if(!suggestion)return {applied:false,reason:'NOT_FOUND'};
   if(suggestion.revision!==current.revision||
    current.text.slice(suggestion.start,suggestion.end)!==suggestion.original)
    return {applied:false,reason:'STALE_REVISION'};
   if(suggestion.proposedReplacement===null||suggestion.risk!=='low')
    return {applied:false,reason:'MANUAL_ONLY'};
   if(current.sourceKind==='docx')return {applied:false,reason:'WORD_READ_ONLY'};
   let next;
   try{
    next=rules.apply(current.text,{
     start:suggestion.start,end:suggestion.end,
     original:suggestion.original,
     replacement:suggestion.proposedReplacement
    });
   }catch{
    return {applied:false,reason:'STALE_REVISION'};
   }
   if(next===current.text)return {applied:false,reason:'NO_CHANGE'};
   const updated=session.replaceText(next,current.sourceKind);
   undoHistory.push({
    beforeText:current.text,beforeKind:current.sourceKind,
    afterText:updated.text,afterRevision:updated.revision
   });
   if(undoHistory.length>MAX_UNDO)undoHistory.shift();
   suggestions=[];suggestionRevision=-1;
   return {applied:true,snapshot:updated};
  }
  function undo(){
   const edit=undoHistory[undoHistory.length-1];
   if(!edit)return {restored:false,reason:'NO_HISTORY'};
   const current=session.read();
   if(current.revision!==edit.afterRevision||current.text!==edit.afterText){
    undoHistory.length=0;
    return {restored:false,reason:'STALE_REVISION'};
   }
   undoHistory.pop();
   const restored=session.replaceText(edit.beforeText,edit.beforeKind);
   const previous=undoHistory[undoHistory.length-1];
   if(previous&&previous.afterText===restored.text)
    previous.afterRevision=restored.revision;
   suggestions=[];suggestionRevision=-1;
   return {restored:true,snapshot:restored};
  }
  function dismiss(id){
   const item=lookup(id);
   if(item)dismissed.add(id);
  }
  return Object.freeze({getSuggestions,preview,apply,undo,dismiss,refresh});
 }
 return Object.freeze({createEditorialReview});
});
