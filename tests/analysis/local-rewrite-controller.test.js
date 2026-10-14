'use strict';
const assert=require('node:assert/strict');
const {createLocalRewriteController}=require('../../docs/analysis/local-rewrite-controller.js');
const {createDocumentSession}=require('../../docs/analysis/document-session.js');
const planner=require('../../docs/analysis/rewrite-chunk-planner.js');
const integrity=require('../../docs/analysis/rewrite-integrity-check.js');
const model={modelId:'onnx-community/Qwen3-0.6B-ONNX',revision:'558750086ed49d78cb701ed6fa85af33fd16453f'};
function rig({text='A good report.',kind='paste',partial=false,changedFact=false,deferred=false}={}){
 const session=createDocumentSession(text,kind),log=[];
 let finish;
 const bridge={
  load:async info=>{log.push({op:'load',...info});return {status:'MODEL_READY'};},
  generate:args=>{
   log.push({op:'generate',args});
   const result={status:'COMPLETED',chunks:args.chunks.map(c=>({
    id:c.id,text:changedFact?c.text.replace('240 V','250 V'):c.text.replace('good','clear')
   }))};
   return deferred?new Promise(r=>{finish=()=>r(result);}):Promise.resolve(result);
  },
  cancel:()=>{log.push({op:'cancel'});return true;},
  dispose:()=>log.push({op:'dispose'})
 };
 const registry={select:()=>({...model,estimatedTransferBytes:1})};
 const capability={assess:()=>({supported:true,reason:'NONE'})};
 const chunkPlanner={plan:(snapshot,opts)=>{
  if(partial)return {status:'PARTIAL',sourceCoverage:{coveredCharacters:4,totalCharacters:snapshot.text.length},
   uncoveredSpans:[{start:4,end:snapshot.text.length}],
   chunks:[{id:'chunk-0',start:0,end:4,text:snapshot.text.slice(0,4)}]};
  return planner.planRewriteChunks(snapshot,{countTokens:s=>Array.from(s).length,
   maxInputTokens:100,reservedPromptTokens:5,reservedOutputTokens:5});
 }};
 const controller=createLocalRewriteController({
  session,bridge,registry,capability,planner:chunkPlanner,integrity,
  manifest:{schemaVersion:'test'},deviceInfo:{},navigatorInfo:{}
 });
 return {session,controller,log,complete:()=>finish?.()};
}
const request={language:'en',style:'natural',consentToken:'only-explicit'};
async function main(){
 {const r=rig();
  assert.equal(r.controller.getState().status,'NOT_REQUESTED');
  const done=await r.controller.requestRewrite(request);
  assert.equal(done.status,'DRAFT_READY');
  assert.equal(r.session.read().text,'A good report.','generation never applies automatically');
  assert.equal(r.controller.getState().text,undefined,'private source not exposed by status');
  const draft=r.controller.getDraftChunks();
  assert.equal(draft.length,1);
  assert.match(draft[0].proposed,'clear');
  assert.equal(r.controller.acceptReviewed().accepted,false,'draft cannot self-approve');
  assert.equal(r.controller.approveChunk(draft[0].id).approved,true);
  assert.equal(r.controller.acceptReviewed().accepted,true);
  assert.equal(r.session.read().text,'A clear report.');
  assert.equal(r.session.read().revision,1);
  assert.equal(r.controller.undo().restored,true);
  assert.equal(r.session.read().text,'A good report.');
  assert.equal(r.session.read().revision,2);
  r.controller.dispose();
 }
 {const r=rig({text:'Load was 240 V.',changedFact:true});
  await r.controller.requestRewrite(request);
  const draft=r.controller.getDraftChunks()[0];
  assert.equal(r.controller.approveChunk(draft.id).approved,false);
  assert.equal(r.controller.acceptReviewed().accepted,false);
  assert.equal(r.session.read().text,'Load was 240 V.');
  r.controller.dispose();
 }
 {const r=rig({partial:true});
  const out=await r.controller.requestRewrite(request);
  assert.equal(out.status,'PARTIAL');
  assert.equal(r.controller.acceptReviewed().accepted,false);
  assert.equal(r.session.read().text,'A good report.');
  r.controller.dispose();
 }
 {const r=rig({kind:'docx'});
  await r.controller.requestRewrite(request);
  const id=r.controller.getDraftChunks()[0].id;
  r.controller.approveChunk(id);
  assert.deepEqual(r.controller.acceptReviewed(),{accepted:false,reason:'WORD_READ_ONLY'});
  assert.equal(r.session.read().sourceKind,'docx');
  assert.equal(r.session.read().text,'A good report.');
  r.controller.dispose();
 }
 {const r=rig({deferred:true});
  const p=r.controller.requestRewrite(request);
  await new Promise(resolve=>setImmediate(resolve));
  r.session.replaceText('A nice report.','paste');
  r.complete();
  const result=await p;
  assert.equal(result.status,'STALE');
  assert.equal(r.controller.getDraftChunks().length,0);
  r.controller.dispose();
 }
 {const r=rig({deferred:true});
  const p=r.controller.requestRewrite(request);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.controller.cancel(),true);
  r.complete();
  assert.equal((await p).status,'CANCELLED');
  assert.equal(r.session.read().text,'A good report.');
  r.controller.dispose();
 }
 {const r=rig();
  await r.controller.requestRewrite(request);
  r.session.replaceText('Completely new report.','paste');
  assert.equal(r.controller.acceptReviewed().accepted,false);
  assert.equal(r.controller.undo().restored,false);
  r.controller.dispose();
 }
 console.log('PASS L6: reviewed source-revision-safe drafts, undo, partial, Word protection and cancel');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
