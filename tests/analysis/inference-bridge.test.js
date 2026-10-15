'use strict';
const assert=require('node:assert/strict');
const {createInferenceBridge}=require('../../docs/analysis/inference-bridge.js');

class FakeWindow{
 constructor(){this.listeners=new Set();this.crypto={getRandomValues(bytes){bytes.forEach((_,i)=>bytes[i]=i+1);return bytes;}};}
 addEventListener(type,fn){if(type==='message')this.listeners.add(fn);}
 removeEventListener(type,fn){if(type==='message')this.listeners.delete(fn);}
 emit(data,source,origin='https://tis.example'){for(const fn of [...this.listeners])fn({data,source,origin});}
}
function harness(){
 const host=new FakeWindow(),frames=[],children=[];
 const container={appendChild(frame){children.push(frame);frame.isConnected=true;frame.load?.();}};
 const documentObject={defaultView:host,createElement(type){
  assert.equal(type,'iframe');
  const attrs={};
  const frame={attrs,hidden:false,isConnected:false,
   setAttribute(k,v){attrs[k]=v;},
   addEventListener(type,cb){if(type==='load')frame.load=cb;},
   remove(){frame.isConnected=false;const ix=children.indexOf(frame);if(ix!==-1)children.splice(ix,1);},
   contentWindow:{posted:[],postMessage(message,origin){this.posted.push({message,origin});}}
  };
  frames.push(frame);return frame;
 }};
 const events=[];
 const bridge=createInferenceBridge({documentObject,origin:'https://tis.example',container,
  onEvent:event=>events.push(event)});
 const emit=(frame,op,requestId,extra={})=>
  host.emit({channel:'TIS_BROWSER_AI_V1',token:frame.attrs.token||frame.contentWindow.posted[0]?.message?.token,op,requestId,...extra},frame.contentWindow,'null');
 return {bridge,host,frames,children,events,emit};
}
const snapshot={text:'Private text for inference - never log this value.',revision:4};

(function test_optin_only_model_loading(){
 const h=harness();
 assert.equal(h.frames.length,0,'no iframe before user calls run');
 assert.equal(h.bridge.run(snapshot,{deep:true,full:true,context:'academic'},'r1'),true);
 assert.equal(h.frames.length,1);
 assert.equal(h.children.length,1);
 const frame=h.frames[0];
 assert.equal(frame.src,'ai-runtime.html');
 assert.equal(frame.attrs.referrerpolicy,'no-referrer');
 assert.match(frame.attrs.sandbox,/allow-scripts/);
 assert.equal(frame.attrs.sandbox,'allow-scripts','no same-origin privileges');
 assert.equal(frame.contentWindow.posted.length,1,'INIT only until authenticated READY');
 assert.equal(frame.contentWindow.posted[0].message.op,'INIT');
 h.emit(frame,'READY','');
 assert.equal(frame.contentWindow.posted.length,3);
 const sent=frame.contentWindow.posted[1];
 assert.equal(sent.origin,'*');
 assert.match(sent.message.token,/^[a-f0-9]{32}$/);
 assert.equal(sent.message.channel,'TIS_BROWSER_AI_V1');
 assert.equal(sent.message.op,'RUN');
 assert.equal(sent.message.text,snapshot.text);
 assert.equal(sent.message.requestId,'r1');
 assert.equal(sent.message.deep,true);
 assert.equal(sent.message.full,true);
 assert.equal(sent.message.context,'academic');
 h.emit(frame,'READY','');
 assert.equal(frame.contentWindow.posted.length,2,'duplicated READY never repeats a request');
 h.bridge.dispose();
 assert.equal(h.children.length,0);
 assert.equal(h.host.listeners.size,0);
})();

(function test_wrong_origin_source_channel_and_request_are_ignored(){
 const h=harness();
 h.bridge.run(snapshot,{},'r1');
 const frame=h.frames[0],other={postMessage(){}};
 h.host.emit({channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:''},frame.contentWindow,'https://attacker.example');
 h.host.emit({channel:'TIS_BROWSER_AI_V1',op:'READY',requestId:''},other);
 h.host.emit({channel:'evil',op:'READY',requestId:''},frame.contentWindow);
 assert.equal(frame.contentWindow.posted.length,1);
 h.emit(frame,'READY','');
 h.emit(frame,'RESULT','r-old',{result:{score:99}});
 h.emit(frame,'PROGRESS','r-old',{stage:'ANALYZING',percent:50});
 assert.equal(h.events.filter(x=>x.op==='RESULT'||x.op==='PROGRESS').length,0);
 h.emit(frame,'PROGRESS','r1',{stage:'ANALYZING',percent:25});
 assert.equal(h.events.filter(x=>x.op==='PROGRESS').length,1);
 h.bridge.dispose();
})();

(function test_old_ready_and_result_ignored(){
 const h=harness();
 h.bridge.run(snapshot,{},'r1');
 const old=h.frames[0];
 assert.equal(h.bridge.cancel('r1'),true);
 assert.equal(h.children.length,0);
 assert.equal(old.contentWindow.posted.at(-1).message.op,'CANCEL');
 h.bridge.run({...snapshot,text:'second source',revision:5},{full:true},'r2');
 const current=h.frames[1];
 h.emit(old,'READY','');
 h.emit(old,'RESULT','r1',{result:{score:90}});
 assert.equal(current.contentWindow.posted.length,1,'stale previous iframe cannot ready new run');
 assert.equal(h.events.some(x=>x.op==='RESULT'),false);
 h.emit(current,'READY','');
 assert.equal(current.contentWindow.posted.length,2);
 assert.equal(current.contentWindow.posted[1].message.requestId,'r2');
 h.emit(current,'RESULT','r2',{result:{status:'INCONCLUSIVE',score:null}});
 assert.equal(h.events.filter(x=>x.op==='RESULT').length,1);
 assert.equal(h.events.at(-1).payload.result.score,null);
 h.bridge.dispose();
})();

(function test_cancel_then_late_error_and_retry_after_timeout(){
 const h=harness();
 h.bridge.run(snapshot,{},'r1');
 const old=h.frames[0];
 h.emit(old,'READY','');
 assert.equal(h.bridge.run(snapshot,{},'r-double'),false,'one active run at a time');
 assert.equal(h.bridge.cancel('wrong'),false,'only matching request can cancel');
 assert.equal(h.bridge.cancel('r1'),true);
 h.emit(old,'ERROR','r1',{code:'MODEL_TIMEOUT'});
 assert.equal(h.events.some(x=>x.op==='ERROR'),false);
 assert.equal(h.events.filter(x=>x.op==='CANCELLED').length,1);
 assert.equal(h.bridge.cancel('r1'),false);
 assert.equal(h.bridge.run(snapshot,{},'r2'),true);
 const second=h.frames[1];
 h.emit(second,'READY','');
 h.emit(second,'ERROR','r2',{code:'MODEL_UNAVAILABLE'});
 assert.equal(h.events.at(-1).op,'ERROR');
 assert.equal(h.children.length,0,'failed iframe is destroyed for a clean retry');
 assert.equal(h.bridge.run(snapshot,{},'r3'),true);
 assert.notStrictEqual(h.frames[2],old);
 h.bridge.dispose();
})();

(function test_source_validation_and_safe_reuse(){
 const h=harness();
 assert.throws(()=>h.bridge.run({text:null}, {},'bad'),TypeError);
 assert.throws(()=>h.bridge.run(snapshot,{},''),/request/i);
 assert.equal(h.frames.length,0);
 h.bridge.run(snapshot,{},'r1');
 const frame=h.frames[0];h.emit(frame,'READY','');
 h.emit(frame,'RESULT','r1',{result:{score:50}});
 h.bridge.run({...snapshot,text:'different text'}, {},'r2');
 assert.equal(h.frames.length,1,'successful model iframe can be reused');
 assert.equal(frame.contentWindow.posted.at(-1).message.requestId,'r2');
 assert.equal(frame.contentWindow.posted.length,2);
 h.bridge.dispose();
 assert.equal(h.bridge.run(snapshot,{},'late'),false);
 assert.throws(()=>createInferenceBridge({
  documentObject:h.bridge,container:{appendChild(){}},origin:'https://tis.example',
  src:'https://attacker.example/runtime.html'
 }),/origin|same/i);
})();

(function test_subscribe_and_unsubscribe(){
 const h=harness();
 let count=0;
 const unsubscribe=h.bridge.subscribe(()=>count++);
 h.bridge.run(snapshot,{},'r1');h.emit(h.frames[0],'READY','');
 assert.equal(count,1);
 unsubscribe();
 h.emit(h.frames[0],'PROGRESS','r1',{stage:'LOADING'});
 assert.equal(count,1);
 h.bridge.dispose();
})();
console.log('PASS R5 trusted lazy iframe bridge, cancellation, single READY, stale frames, retry and opt-in');
