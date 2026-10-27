/* Small, source-free V12 discoverability adapter. No document data transfer. */
(function(root){
 'use strict';
 if(!root?.document)return;
 function mount(){
  const link=root.document.getElementById('v12PreviewLink');
  if(!link)return;
  function update(){
   const ar=root.document.documentElement.lang==='ar';
   link.textContent=ar?'جرّب V12 الجديدة':'Try new V12 workspace';
   link.setAttribute('aria-label',link.dataset[ar?'ar':'en']);
   link.title=link.dataset[ar?'ar':'en'];
  }
  update();
  const observer=new root.MutationObserver(update);
  observer.observe(root.document.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})(typeof window!=='undefined'?window:null);
