'use strict';
/* Negative control: insert a real iframe navigation (intercepted to inert HTML)
 * into the existing writing journey. The normal journey test MUST reject it.
 * No real model, external URL, user data or inference is involved. */
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['tests/analysis/workspace-v12-browser.test.cjs'],{
 encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024,
 env:{...process.env,TIS_V12_TEST_FORBIDDEN_RUNTIME:'1'}
});
if(result.error)throw result.error;
assert.notEqual(result.status,0,'VACUOUS_RUNTIME_GUARD: an injected same-origin runtime navigation passed the writing-only test');
assert.match(result.stdout+result.stderr,/NO_IMPLICIT_MODEL_RUNTIME/,
 'Negative control must fail at the runtime guard, not navigation, setup or an unrelated assertion');
console.log('PASS V12 negative control: real forbidden iframe navigation is caught by the actual writing-flow guard');
