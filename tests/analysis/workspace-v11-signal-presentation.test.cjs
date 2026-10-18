'use strict';
/* Presentation contract fixtures only; not a model accuracy benchmark. */
const assert=require('node:assert/strict');
const {researchDisplay}=require('../../docs/analysis/workspace-v11-guided.js');
const valid={status:'RESEARCH_SIGNAL',revision:14,signal:64.125,
 evidence:{kind:'RESEARCH_SIGNAL',signal:64.125,documentCoverageWordsPercent:79.64}};
const okay=researchDisplay(valid,14);
assert.deepEqual(okay,{measured:true,signal:64.1,coverage:79.6});
assert.equal(Object.isFrozen(okay),true);
const denied=[
 {...valid,status:'WRITING_ONLY'},
 {...valid,status:'INCONCLUSIVE'},
 {...valid,revision:13},
 {...valid,signal:NaN},
 {...valid,signal:-5,evidence:{...valid.evidence,signal:-5}},
 {...valid,signal:102,evidence:{...valid.evidence,signal:102}},
 {...valid,evidence:{...valid.evidence,kind:'UNKNOWN'}},
 {...valid,evidence:{...valid.evidence,signal:99.9}},
 {...valid,signal:null,evidence:{...valid.evidence,signal:null}},
 null
];
for(const state of denied)assert.deepEqual(researchDisplay(state,14),
 {measured:false,signal:null,coverage:null},'Unverified or stale signals must not be displayed');
const partial=researchDisplay({...valid,evidence:{...valid.evidence,documentCoverageWordsPercent:NaN}},14);
assert.equal(partial.measured,true);
assert.equal(partial.coverage,null,'Unknown coverage may never be fabricated');
console.log('PASS V11 research score presentation: raw validated same-revision signal only, explicit abstention otherwise (synthetic UI fixtures, not model accuracy).');
