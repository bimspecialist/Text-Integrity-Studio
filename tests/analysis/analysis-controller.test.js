'use strict';
const assert=require('node:assert/strict');
const {createDocumentSession}=require('../../docs/analysis/document-session.js');
const policy=require('../../docs/analysis/eligibility-policy.js');
const validator=require('../../docs/analysis/evidence-contract.js');
const {createAnalysisController}=require('../../docs/analysis/analysis-controller.js');
const english=Array(130).fill('measured').join(' ');
const arabic=Array(130).fill('المبنى').join(' ');
class FakeClock{
 constructor(){this.ms=1000;this.jobs=new Map();this.next=0;}
 now(){return this.ms;}
 setTimeout(fn,delay){const id=++this.next;this.jobs.set(id,{when:this.ms+delay,fn});return id;}
 clearTimeout(id){this.jobs.delete(id);}
 advance(ms){
  const until=this.ms+ms;
  for(let i=0;i<1000;i++){
   const queued=[...this.jobs].filter(([,job])=>job.when<=until).sort((a,b)=>a[1].when-b[1].when);
   if(!queued.length)break;
   const [id,job]=queued[0];this.jobs.delete(id);this.ms=job.when;job.fn();
  }
  this.ms=until;
 }
}
class FakeBridge{
 constructor(){this.calls=[];this.cancels=[];this.listeners=new Set();this.closed=false;}
 subscribe(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 run(snapshot,options,id){this.calls.push({snapshot,options,id});return true;}
 cancel(id){this.cancels.push(id);return true;}
 emit(op,id,payload={}){for(const listener of [...this.listeners])listener({op,requestId:id,payload});}
 dispose(){this.closed=true;this.listeners.clear();}
}
function fixture(initialText=english){
 const session=createDocumentSession(initialText);
 const bridge=new FakeBridge(),clock=new FakeClock(),states=[],reviews=[];
 const controller=createAnalysisController({session,policy,bridge,validator,clock,
  onState:s=>states.push(s),onWritingReview:s=>reviews.push(s.revision)});
 return {session,bridge,clock,states,reviews,controller};
}
function result(snapshot,{lowCoverage=false,deep=false,full=false}={}){
 const coverage=lowCoverage?50:100;
 const primary={model_id:validator.PRIMARY_ID,revision:validator.PRIMARY_REV,
  score:64.2,coverage,coverageRawPercent:coverage,words:130,wordsAnalyzed:130,
  consistency:'CONSISTENT_PASSAGES',dispersion:0.01,
  segments:[{start:0,end:snapshot.text.length,words:130,tokens:200,signal:64.2}]};
 const secondary=deep?{...primary,model_id:validator.SECONDARY_ID,revision:validator.SECONDARY_REV,
  score:70.1,segments:[{...primary.segments[0],signal:70.1}]}:null;
 return {version:'TIS_CONSENSUS_V2_2026_10',
  status:lowCoverage?'INSUFFICIENT_COVERAGE':deep?'AGREEMENT_UNCALIBRATED':'SINGLE_UNCALIBRATED_MODEL',
  score:lowCoverage?null:64.2,primary,secondary,models:secondary?[primary,secondary]:[primary],
  calibration:'NOT_INDEPENDENTLY_CALIBRATED_FOR_THIS_WEBSITE',
  score_type:'UNCALIBRATED_CLASSIFIER_SIGNAL_NOT_AUTHORSHIP_PROBABILITY',
  processing:'CLIENT_ON_DEVICE_NO_REMOTE_INFERENCE',valid_for_authorship_decisions:false,
  language:'en',deepRequested:deep,extendedScanRequested:full};
}
(function test_exactly_one_active_run_and_signal(){
 const h=fixture();
 assert.equal(h.controller.getState().status,'READY');
 assert.equal(h.controller.analyze(),true);
 assert.equal(h.controller.analyze(),false,'double-click cannot start a second run');
 assert.equal(h.bridge.calls.length,1);
 assert.equal(h.controller.getState().status,'LOADING');
 const req=h.bridge.calls[0];
 assert.strictEqual(req.snapshot,h.session.read());
 h.bridge.emit('READY',req.id);
 h.bridge.emit('PROGRESS',req.id,{stage:'ANALYZING',percent:20});
 assert.equal(h.controller.getState().status,'ANALYZING');
 h.bridge.emit('RESULT',req.id,{result:result(req.snapshot)});
 assert.equal(h.controller.getState().status,'RESEARCH_SIGNAL');
 assert.equal(h.controller.getState().signal,64.2);
 assert.equal(h.controller.getState().evidence.kind,'RESEARCH_SIGNAL');
 assert.equal(h.bridge.cancels.length,0);
 assert(Object.isFrozen(h.controller.getState()));
 assert.equal(h.reviews.length,1);
 h.controller.dispose();
})();

(function test_same_length_text_edit_and_docx_import_stale(){
 const h=fixture();
 h.controller.analyze();const req=h.bridge.calls[0];
 const changed=h.session.replaceText(english.replace('measured','recorded'));
 assert.equal(changed.text.length,req.snapshot.text.length);
 assert.equal(h.controller.getState().status,'STALE');
 assert.deepEqual(h.bridge.cancels,[req.id]);
 h.bridge.emit('RESULT',req.id,{result:result(req.snapshot)});
 assert.equal(h.controller.getState().signal,null);
 assert.equal(h.controller.getState().status,'STALE');
 assert.equal(h.controller.analyze(),true);
 const next=h.bridge.calls[1];
 h.session.replaceText('This is an imported Word document with a new source.','docx');
 assert(h.bridge.cancels.includes(next.id));
 assert.equal(h.controller.getState().status,'STALE');
 h.bridge.emit('ERROR',next.id,{code:'MODEL_TIMEOUT'});
 assert.equal(h.controller.getState().status,'STALE');
 h.controller.dispose();
})();

(function test_cancel_then_late_error_and_new_request(){
 const h=fixture();h.controller.analyze();
 const id=h.bridge.calls[0].id;
 assert.equal(h.controller.cancel(),true);
 assert.equal(h.controller.getState().status,'CANCELLED');
 assert.equal(h.controller.getState().signal,null);
 h.bridge.emit('ERROR',id,{code:'MODEL_UNAVAILABLE'});
 h.bridge.emit('RESULT',id,{result:result(h.session.read())});
 assert.equal(h.controller.getState().status,'CANCELLED');
 h.controller.analyze();
 assert.notEqual(id,h.bridge.calls[1].id);
 h.controller.dispose();
 assert.equal(h.bridge.listeners.size,0);
})();

(function test_loading_inactivity_and_absolute_watchdogs(){
 const h=fixture();
 h.controller.analyze();
 h.clock.advance(29999);
 assert.equal(h.controller.getState().status,'LOADING');
 h.clock.advance(1);
 assert.equal(h.controller.getState().status,'ERROR');
 assert.equal(h.controller.getState().errorCode,'RUNTIME_INIT_TIMEOUT');
 h.controller.analyze();
 const id=h.bridge.calls.at(-1).id;
 h.bridge.emit('READY',id);
 h.clock.advance(179999);
 assert.notEqual(h.controller.getState().status,'ERROR');
 h.clock.advance(1);
 assert.equal(h.controller.getState().status,'ERROR');
 assert.equal(h.controller.getState().errorCode,'MODEL_TIMEOUT');
 h.controller.analyze();
 const third=h.bridge.calls.at(-1).id;
 h.bridge.emit('READY',third);
 h.clock.advance(150000);
 h.bridge.emit('PROGRESS',third,{stage:'DOWNLOADING',percent:10});
 h.clock.advance(150000);
 assert.notEqual(h.controller.getState().status,'ERROR','progress extends inactivity only');
 h.clock.advance(240000);
 assert.equal(h.controller.getState().status,'ERROR','absolute cap cannot be defeated by progress');
 assert.equal(h.controller.getState().errorCode,'MODEL_TIMEOUT');
 h.controller.dispose();
})();

(function test_writing_only_arabic_and_blank_never_touch_model(){
 const empty=fixture('');
 assert.equal(empty.controller.getState().status,'EMPTY');
 assert.equal(empty.controller.analyze(),false);
 assert.equal(empty.bridge.calls.length,0);
 assert.equal(empty.reviews.length,0);
 empty.controller.dispose();
 const short=fixture('Brief academic sentence.');
 assert.equal(short.controller.analyze(),false);
 assert.equal(short.controller.getState().status,'WRITING_ONLY');
 assert.equal(short.bridge.calls.length,0);
 assert.equal(short.reviews.length,1);
 short.controller.dispose();
 const ar=fixture(arabic);
 assert.equal(ar.controller.analyze(),false);
 assert.equal(ar.controller.getState().status,'UNSUPPORTED');
 assert.equal(ar.controller.getState().eligibleReason,'UNSUPPORTED_LANGUAGE');
 assert.equal(ar.bridge.calls.length,0);
 assert.equal(ar.reviews.length,1);
 ar.controller.dispose();
})();

(function test_deep_full_options_and_null_abstention(){
 const deep=fixture();
 assert.equal(deep.controller.analyze({deep:true,full:true,context:'academic'}),true);
 const r=deep.bridge.calls[0];
 assert.deepEqual(r.options,{deep:true,full:true,context:'academic'});
 deep.bridge.emit('READY',r.id);
 deep.bridge.emit('RESULT',r.id,{result:result(r.snapshot,{deep:true,full:true})});
 assert.equal(deep.controller.getState().status,'RESEARCH_SIGNAL');
 assert.equal(deep.controller.getState().evidence.scanOptions.context,'academic');
 deep.controller.dispose();
 const h=fixture();h.controller.analyze();
 const req=h.bridge.calls[0];
 h.bridge.emit('READY',req.id);
 h.bridge.emit('RESULT',req.id,{result:result(req.snapshot,{lowCoverage:true})});
 assert.equal(h.controller.getState().status,'INCONCLUSIVE');
 assert.equal(h.controller.getState().signal,null);
 assert.equal(h.controller.getState().evidence.signal,null);
 h.controller.dispose();
})();

(function test_bad_revision_and_private_text_do_not_become_result(){
 const secret=english+' PRIVATE_SENTINEL_9382';
 const h=fixture(secret);h.controller.analyze();
 const req=h.bridge.calls[0];h.bridge.emit('READY',req.id);
 const bad=result(req.snapshot);bad.primary.revision='not-the-pinned-checkpoint';
 h.bridge.emit('RESULT',req.id,{result:bad});
 assert.equal(h.controller.getState().status,'ERROR');
 assert.equal(h.controller.getState().signal,null);
 assert.match(h.controller.getState().errorCode,/EVIDENCE/i);
 for(const s of h.states)assert(!JSON.stringify(s).includes('PRIVATE_SENTINEL_9382'),
  'controller state and diagnostic listeners must not include raw text');
 h.controller.dispose();
})();
console.log('PASS R6 single analysis owner, timeouts, stale edits, protected model evidence and local-only writing');
