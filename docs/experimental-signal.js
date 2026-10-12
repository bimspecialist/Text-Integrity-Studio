/* Text Integrity Studio — strictly experimental, local char-TFIDF model runtime.
 * A number here is NOT a percentage of AI-origin words or an authorship verdict.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TextIntegrityExperimentalSignal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const FORMAT='TIS-char-tfidf-logreg-v1',MAX_FEATURES=70000,MAX_NGRAMS=600000;
function validate(model){
 if(!model||model.format!==FORMAT||model.status!=='UNVERIFIED_RESEARCH_ONLY')throw Error('Expected a Text Integrity experimental model export.');
 const vocab=model.vocabulary, weights=model.weights,idf=model.idf;
 if(!vocab||Array.isArray(vocab)||typeof vocab!=='object'||!Array.isArray(weights)||!Array.isArray(idf)||!weights.length||weights.length>MAX_FEATURES||idf.length!==weights.length)
   throw Error('Invalid vocabulary or coefficient shape.');
 if(model.ngram_range?.[0]!==3||model.ngram_range?.[1]!==5)throw Error('Unsupported character ngram range.');
 if(!Number.isFinite(model.intercept)||!Number.isFinite(model.calibration?.coef)||!Number.isFinite(model.calibration?.intercept))
   throw Error('Invalid calibration coefficients.');
 if(!Array.isArray(model.declared_languages)||model.declared_languages.length>40||!model.declared_languages.every(x=>typeof x==='string'&&x.length<40))
   throw Error('Unsupported language metadata.');
 if(!Array.isArray(model.declared_domains)||model.declared_domains.length>100)throw Error('Invalid model domain metadata.');
 for(let i=0;i<weights.length;i++){
   if(!Number.isFinite(weights[i])||!Number.isFinite(idf[i])||idf[i]<=0)throw Error('Invalid model weights.');
 }
 const seen=new Set();
 for(const [term,index] of Object.entries(vocab)){
   if(Array.from(term).length<3||Array.from(term).length>5||!Number.isInteger(index)||index<0||index>=weights.length||seen.has(index))
     throw Error('Invalid ngram vocabulary.');
   seen.add(index);
 }
 if(seen.size!==weights.length)throw Error('Vocabulary and weight count mismatch.');
 return model;
}
function inferLanguage(text){
 const ar=(text.match(/\p{Script=Arabic}/gu)||[]).length,latin=(text.match(/[A-Za-z]/g)||[]).length;
 if(ar&&latin&&Math.min(ar,latin)/(ar+latin)>.15)return'mixed';
 return ar>latin?'ar':'en';
}
function predict(text,model,opts={}){
 validate(model);
 if(typeof text!=='string')throw TypeError('Expected text.');
 const words=(text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu)||[]).length;
 const lang=inferLanguage(text);
 const result={status:'ABSTAIN',model_status:'UNVERIFIED_RESEARCH_ONLY',words,language:lang,
   caveat:'Research model signal only; not proof of document origin or a percentage of AI-written words.'};
 if(words<Math.max(75,Number(model.word_limit_minimum)||75)){result.reason='Too little text for the defined experimental eligibility rule.';return result;}
 if(!model.declared_languages.includes(lang)){result.reason='This document language is outside the model declared data.';return result;}
 if(text.length>120000){result.reason='Document too long for calibrated use.';return result;}
 // Match scikit-learn's default TfidfVectorizer(analyzer='char') preprocessing:
 // lowercase text but preserve whitespace and punctuation, including repeated spaces.
 const normalized=text.toLowerCase();
 const chars=Array.from(normalized);const vocab=model.vocabulary, frequencies=new Map();
 let observed=0;
 for(let n=3;n<=5;n++){
   for(let i=0;i<=chars.length-n;i++){
     const term=chars.slice(i,i+n).join('');
     if(Object.prototype.hasOwnProperty.call(vocab,term)){
       const idx=vocab[term];frequencies.set(idx,(frequencies.get(idx)||0)+1);observed++;
       if(observed>MAX_NGRAMS){result.reason='Feature coverage budget exceeded.';return result;}
     }
   }
 }
 const total=Math.max(1,(chars.length-2)+(chars.length-3)+(chars.length-4));
 const coverage=observed/total;
 result.ngram_coverage=coverage;
 if(!frequencies.size||coverage<.08){result.reason='Out of distribution: insufficient known character features.';return result;}
 const values=new Map();let sumSquares=0;
 for(const [i,count] of frequencies.entries()){
   const value=(1+Math.log(count))*model.idf[i];values.set(i,value);sumSquares+=value*value;
 }
 const norm=Math.sqrt(sumSquares);if(!norm){result.reason='Zero feature weight';return result;}
 let decision=model.intercept;
 for(const [i,val] of values.entries())decision+=model.weights[i]*val/norm;
 const signalLogit=model.calibration.coef*decision+model.calibration.intercept;
 const signal=1/(1+Math.exp(-Math.max(-100,Math.min(100,signalLogit))));
 return {...result,status:'EXPERIMENTAL_SIGNAL_ONLY',raw_model_decision:decision,
   validation_calibrated_signal:signal,calibration_scope:'internal_validation_not_independently_audited',
   reason:'Human review required. Domain and group false-positive confidence bounds are unverified.'};
}
return Object.freeze({validate,predict,inferLanguage,format:FORMAT});
});