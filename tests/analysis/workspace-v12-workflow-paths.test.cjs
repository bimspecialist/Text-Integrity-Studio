'use strict';
// Contract for the small literal/single-star path subset used by this workflow.
// This does not simulate GitHub event dispatch; an actual PR run is still needed.
const assert=require('node:assert/strict'),fs=require('node:fs');
const workflow=fs.readFileSync('.github/workflows/v12-unified-preview.yml','utf8');
const block=workflow.match(/^  pull_request:\s*\n    paths:\s*\n([\s\S]*?)(?=^  [a-z_]+:)/m);
assert(block,'Expected explicit pull_request.paths list');
const patterns=Array.from(block[1].matchAll(/^      - '([^']+)'\s*$/gm),m=>m[1]);
assert(patterns.length>0,'No path filters parsed');
function matches(file,pattern){
 assert(!pattern.includes('**')&&!/[!\[\]?{}]/u.test(pattern),'Unsupported pattern in narrow test matcher: '+pattern);
 const escaped=pattern.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*');
 return new RegExp('^'+escaped+'$').test(file);
}
const tests=fs.readdirSync('tests/analysis').filter(n=>/^workspace-v12-.*\.test\.cjs$/u.test(n));
assert(tests.length>=3,'Expected original V12 suite');
const missing=tests.filter(n=>!patterns.some(p=>matches('tests/analysis/'+n,p)));
assert.deepEqual(missing,[],'V12_PR_PATH_GAP: every changed V12 test must trigger its workflow');
for(const name of tests)assert(workflow.includes('node tests/analysis/'+name),'V12_TEST_NOT_EXECUTED: '+name);
assert(!patterns.some(p=>matches('unrelated-notes.md',p)),'Unrelated files must not trigger the V12 suite');
console.log('PASS V12 PR path and command coverage for '+tests.length+' test files; actual PR dispatch checked separately');
