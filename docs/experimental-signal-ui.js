/* Research-only browser model loader. No model ships, no data uploads, no verdicts. */
(function(){
'use strict';
const api=globalThis.TextIntegrityExperimentalSignal;
if(!api)return;
const $=id=>document.getElementById(id);
let model=null,last=null;
const dict={
en:{title:'Experimental AI research lab',description:'A trained model is NOT bundled. Load your own approved-use local experimental model export to inspect its raw signal. This cannot establish authorship or a percentage of AI-written words.',
file:'Load local research model JSON',run:'Evaluate current text',clear:'Unload model',report:'Export signal report',
none:'No model loaded — AI detection NOT EVALUATED.',loaded:'Local research model loaded',bad:'Invalid experimental model',
inconclusive:'INCONCLUSIVE — no score shown',signal:'Unverified model signal',lab:'Internal validation only; independent false-positive/fairness evidence missing.',
warning:'Do not use a signal to accuse or clear an author. Short or unsupported-language text is marked inconclusive.',
waiting:'Research model available locally. No user text has been analyzed.',
changed:'Text changed; analyze again to update its research signal.'},
ar:{title:'مختبر أبحاث الكشف التجريبي',description:'لا يتضمن الموقع نموذجًا مدربًا مسبقًا. يمكنك رفع ملف نموذج تجريبي مصرح باستخدامه محليًا لفحص إشارته فقط. النتيجة لا تثبت من كتب النص ولا تمثل نسبة كلمات كتبها AI.',
file:'رفع نموذج بحثي محلي JSON',run:'تحليل النص الحالي',clear:'إفراغ النموذج',report:'تصدير تقرير الإشارة',
none:'لم يُرفع نموذج — كشف AI غير مُقيّم.',loaded:'تم تحميل النموذج البحثي محليًا',bad:'ملف النموذج التجريبي غير صالح',
inconclusive:'النتيجة غير حاسمة — لا نعرض رقمًا',signal:'إشارة نموذج غير معتمد',lab:'معايرة داخلية فقط؛ لا توجد أدلة مستقلة كافية على الخطأ والانحياز.',
warning:'لا تستخدم الإشارة لإثبات أو نفي مصدر النص. النص القصير أو اللغة غير المدعومة تكون نتيجته غير حاسمة.',
waiting:'النموذج محمل على جهازك. لم يتم فحص النص بعد.',
changed:'تغير النص؛ أعد التحليل لتحديث الإشارة.'}};
function tr(k){return dict[document.documentElement.lang==='ar'?'ar':'en'][k];}
function message(s){$('signalStatus').textContent=s;}
function draw(){
 for(const [id,key] of [['signalTitle','title'],['signalNote','description'],['signalFileLabel','file'],['signalGo','run'],['signalClear','clear'],['signalExport','report'],['signalWarning','warning']])$(id).textContent=tr(key);
 $('signalGo').disabled=!model;
 $('signalExport').disabled=!last;
 if(!model){message(tr('none'));$('signalResult').textContent='';}
 else if(!last){message(tr('waiting'));}
}
function report(result){
 const panel=$('signalResult');panel.replaceChildren();
 const status=document.createElement('strong');status.textContent=result.status==='EXPERIMENTAL_SIGNAL_ONLY'?tr('signal'):tr('inconclusive');
 const p=document.createElement('p');p.className='notice';p.textContent=result.reason;
 panel.append(status,p);
 if(result.status==='EXPERIMENTAL_SIGNAL_ONLY'){
   const raw=document.createElement('p');raw.className='notice';
   raw.textContent=(document.documentElement.lang==='ar'?'قيمة الإشارة التجريبية: ':'Experimental validation signal: ')+result.validation_calibrated_signal.toFixed(4)+'. '+tr('lab');
   panel.append(raw);
 }else{
   const line=document.createElement('p');line.className='notice';
   line.textContent=(document.documentElement.lang==='ar'?'سبب الامتناع: ':'Abstention reason: ')+(result.reason||'');
   panel.append(line);
 }
}
async function load(f){
 if(!f||f.size>18*1024*1024||!f.name.endsWith('.json')){message(tr('bad'));return;}
 try{
   const contents=JSON.parse(await f.text());
   api.validate(contents);
   model=contents;last=null;
   draw();message(tr('loaded')+' · '+contents.weights.length+' features');
 }catch(err){model=null;last=null;draw();message(tr('bad')+' · '+err.message);}
}
function analyze(){
 if(!model)return;
 try{
   last=api.predict($('source').value,model);
   report(last);message(last.status==='ABSTAIN'?tr('inconclusive'):tr('signal'));
   $('signalExport').disabled=false;
 }catch(err){last=null;message(tr('bad')+' · '+err.message);}
}
function setup(){
 const panel=document.createElement('section');panel.className='panel';panel.id='researchSignal';
 panel.innerHTML='<h2 id="signalTitle"></h2><p id="signalNote" class="notice"></p><label for="signalModelFile" id="signalFileLabel"></label><input id="signalModelFile" type="file" accept=".json,application/json" class="signal-file"><div class="row"><button id="signalGo" type="button" class="primary" disabled></button><button id="signalClear" type="button"></button><button id="signalExport" type="button" disabled></button></div><p id="signalStatus" class="notice" role="status" aria-live="polite"></p><div id="signalResult"></div><p id="signalWarning" class="notice"></p>';
 document.querySelector('.workspace > div:last-child').append(panel);
 $('signalModelFile').onchange=e=>load(e.target.files?.[0]);
 $('signalGo').onclick=analyze;
 $('signalClear').onclick=()=>{model=null;last=null;$('signalModelFile').value='';draw();};
 $('signalExport').onclick=()=>{if(!last)return;download('experimental-ai-signal.json',JSON.stringify({...last,generation_note:'No user text stored or transmitted',source:'user-provided private research model'},null,2),'application/json;charset=utf-8');};
 $('source').addEventListener('input',()=>{if(last){last=null;draw();message(tr('changed'));}});
 $('language').addEventListener('click',()=>{draw();if(last)report(last);});
 draw();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();