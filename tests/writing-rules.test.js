'use strict';
const assert=require('node:assert/strict');
const rules=require('../docs/writing-rules.js');
const suggest=(s,mode)=>rules.analyze(s,mode).suggestions;
{
 const s='This is is a test.';
 const result=suggest(s);
 assert(result.some(x=>x.rule==='en-repeated'));
 assert.equal(rules.previewAll(s,result),'This is a test.');
}
{
 const s='teh calculation,which is definately wrong';
 const out=rules.previewAll(s,suggest(s));
 assert.equal(out,'the calculation, which is definitely wrong');
}
{
 const s='هاذا مثال لاكن فيه خطا';
 const out=rules.previewAll(s,suggest(s,'academic'));
 assert(out.includes('هذا مثال لكن'));
}
{
 const s='مرحبا\u200d بالعالم\nThe pressure is 450 kPa, and the pump efficiency is 87%.';
 const out=rules.previewAll(s,suggest(s,'professional'));
 assert(out.includes('450 kPa')&&out.includes('87%')&&out.includes('\u200d'));
}
{
 const s='In order to test , we proceed.';
 const a=rules.analyze(s,'academic').suggestions;
 const c=rules.analyze(s,'clear').suggestions;
 assert(!a.some(x=>x.rule.startsWith('concise-')));
 assert(c.some(x=>x.rule.startsWith('concise-')));
 assert.equal(rules.previewAll(s,c),'To test, we proceed.');
}
{
 const s='A  B';
 const x=suggest(s)[0];
 assert(x.optional===true,'Never force suggestions automatically');
 assert.equal(rules.apply(s,x),'A B');
 assert.throws(()=>rules.apply('Different text',x),/Text changed/);
}
{
 const text='teh teh value ,which';
 const result=suggest(text);
 for(let i=1;i<result.length;i++)assert(result[i].start>=result[i-1].end,'Overlapping suggestions not allowed');
}
{
 const s='To save time,please include figures.\n';
 const a=rules.analyze(s,'professional');
 const b=rules.analyze(s,'professional');
 assert.deepEqual(a,b,'Suggestions reproducible');
 assert(!JSON.stringify(a).includes('authorshipProbability'),'No fabricated probability');
}
console.log('PASS writing rules: English/Arabic, opt-in edits, engineering terms, reproducibility and safeguards');
