/* Text Integrity Studio — same-origin transport for optional browser ONNX.
 * Owns a lazily created iframe and message authentication, NOT classifier state.
 * Original document bytes are never logged or sent to external inference APIs.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TISInferenceBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CHANNEL='TIS_BROWSER_AI_V1';
 function createInferenceBridge({documentObject,origin,container,src='ai-runtime.html',onEvent=()=>{}}={}){
  if(typeof origin!=='string'||!/^https?:\/\//u.test(origin))
   throw new TypeError('Expected a trusted same-origin URL');
  const iframeURL=new URL(src,origin);
  if(iframeURL.origin!==origin||!['http:','https:'].includes(iframeURL.protocol))
   throw new Error('AI runtime iframe must use the same origin');
  if(!documentObject||typeof documentObject.createElement!=='function'||
   !container||typeof container.appendChild!=='function'||
   typeof onEvent!=='function')throw new TypeError('Invalid iframe bridge dependencies');
  const host=documentObject.defaultView;
  if(!host||typeof host.addEventListener!=='function')throw new TypeError('Browser message target missing');
  let iframe=null,ready=false,active=null,disposed=false,frameToken=null;
  // Unique token binds every opaque-origin frame to its creator (including retries).
  function freshToken(){
   const bytes=new Uint8Array(16);
   const crypto=host.crypto||globalThis.crypto;
   if(typeof crypto?.getRandomValues!=='function')throw Error('Secure RNG required');
   crypto.getRandomValues(bytes);
   return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  const subscribers=new Set([onEvent]);
  function broadcast(op,requestId,payload={}){
   const event=Object.freeze({op,requestId,payload});
   for(const subscriber of [...subscribers])subscriber(event);
  }
  function destroyFrame(){
   if(iframe&&typeof iframe.remove==='function')iframe.remove();
   iframe=null;ready=false;frameToken=null;
  }
  function ensureFrame(){
   if(iframe)return;
   const frame=documentObject.createElement('iframe');
   frame.id='tisOnDeviceModel';
   frame.title='Optional, user-triggered on-device AI model runtime';
   frame.hidden=true;
   // No allow-same-origin: remote executable cannot inspect parent DOM.
   frame.setAttribute('sandbox','allow-scripts');
   frame.setAttribute('referrerpolicy','no-referrer');
   frame.setAttribute('aria-hidden','true');
   frame.src=src;
   frameToken=freshToken();
   iframe=frame;
   frame.addEventListener('load',()=>{
    if(disposed||frame!==iframe)return;
    frame.contentWindow?.postMessage({channel:CHANNEL,op:'INIT',token:frameToken},'*');
   },{once:true});
   container.appendChild(frame);
  }
  function send(message){
   if(iframe?.contentWindow)
    iframe.contentWindow.postMessage({channel:CHANNEL,token:frameToken,...message},'*');
  }
  function sendRun(){
   if(!active||active.started||!ready)return;
   active.started=true;
   send({op:'RUN',requestId:active.id,text:active.text,
    deep:active.deep,full:active.full,context:active.context});
  }
  function onMessage(event){
   if(disposed||!iframe||event.origin!=='null'||
    event.source!==iframe.contentWindow)return;
   const message=event.data;
   if(!message||message.channel!==CHANNEL||
    message.token!==frameToken||typeof message.op!=='string')return;
   if(message.op==='READY'){
    if(!active||ready)return;
    ready=true;
    broadcast('READY',active.id);
    sendRun();
    return;
   }
   if(!active||!active.started||message.requestId!==active.id)return;
   const requestId=active.id;
   if(message.op==='PROGRESS'){
    broadcast('PROGRESS',requestId,{
     stage:typeof message.stage==='string'?message.stage:'LOADING',
     model:typeof message.model==='string'?message.model:null,
     percent:Number.isFinite(message.percent)?message.percent:null
    });
   }else if(message.op==='RESULT'){
    active=null;
    broadcast('RESULT',requestId,{result:message.result});
   }else if(message.op==='ERROR'){
    active=null;
    destroyFrame();
    broadcast('ERROR',requestId,{code:typeof message.code==='string'?message.code:'MODEL_UNAVAILABLE'});
   }
  }
  host.addEventListener('message',onMessage);
  function run(snapshot,options={},requestId){
   if(disposed||active)return false;
   if(!snapshot||typeof snapshot.text!=='string')throw new TypeError('Expected exact source snapshot');
   if(typeof requestId!=='string'||!requestId||requestId.length>80)
    throw new TypeError('Valid request ID required');
   const {deep=false,full=false,context='general'}=options||{};
   active={id:requestId,text:snapshot.text,started:false,
    deep:deep===true,full:full===true,context:String(context||'general')};
   ensureFrame();
   sendRun();
   return true;
  }
  function cancel(requestId){
   if(disposed||!active||requestId!==active.id)return false;
   const previous=active.id;
   send({op:'CANCEL',requestId:previous});
   active=null;
   // A new frame identity ensures a late READY or RESULT cannot revive
   // cancelled work or complete a different request.
   destroyFrame();
   broadcast('CANCELLED',previous);
   return true;
  }
  function subscribe(listener){
   if(typeof listener!=='function')throw new TypeError('Event subscriber must be a function');
   if(disposed)return ()=>{};
   subscribers.add(listener);
   return ()=>subscribers.delete(listener);
  }
  function dispose(){
   if(disposed)return;
   disposed=true;active=null;
   host.removeEventListener('message',onMessage);
   destroyFrame();subscribers.clear();
  }
  return Object.freeze({run,cancel,dispose,subscribe});
 }
 return Object.freeze({createInferenceBridge});
});
