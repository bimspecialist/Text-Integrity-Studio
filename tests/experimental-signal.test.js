'use strict';
const assert=require('node:assert/strict');
const signal=require('../docs/experimental-signal.js');
function mock(){return {
 format:'TIS-char-tfidf-logreg-v1',status:'UNVERIFIED_RESEARCH_ONLY',
 ngram_range:[3,5],vocabulary:{the:0},idf:[1],weights:[2],intercept:0,
 calibration:{coef:1,intercept:0},declared_languages:['en'],declared_domains:['test'],
 word_limit_minimum:75
};}
assert.equal(signal.validate(mock()).weights.length,1,'Accept bounded model');
const good=signal.predict('the '.repeat(95),mock());
assert.equal(good.status,'EXPERIMENTAL_SIGNAL_ONLY');
assert(good.validation_calibrated_signal>.8&&good.validation_calibrated_signal<1);
assert(good.ngram_coverage>.08);
const short=signal.predict('the '.repeat(65),mock());
assert.equal(short.status,'ABSTAIN');
const arabic=signal.predict('هذه دراسة هندسية تشرح التجربة '.repeat(90),mock());
assert.equal(arabic.status,'ABSTAIN');
assert.equal(arabic.language,'ar');
const out=signal.predict('unrelated '.repeat(100),mock());
assert.equal(out.status,'ABSTAIN','Out-of-vocabulary text not scored');
const bad=mock();bad.vocabulary={"the":99};
assert.throws(()=>signal.validate(bad),/Invalid ngram/);
const bad2=mock();bad2.weights=[Infinity];assert.throws(()=>signal.validate(bad2),/weights/);
const prototype=mock();prototype.status='APPROVED';
assert.throws(()=>signal.validate(prototype),/Expected/,'Do not trust arbitrary approval metadata');
assert(!JSON.stringify(good).includes('authorship_probability'),'No authorship percentage fabricated');
console.log('PASS local research model numeric inference, short/OOD abstention and untrusted JSON validation');
