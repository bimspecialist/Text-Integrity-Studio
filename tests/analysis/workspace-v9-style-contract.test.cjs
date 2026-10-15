'use strict';
/* V9 style targets are explicit; browser suite verifies actual geometry. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('docs/analysis/workspace-v9.css','utf8');
assert.match(css,/body\.tis-v9 #reportPanel\s*\{[^}]*max-height:none/,'results use normal document scroll');
assert.match(css,/body\.tis-v9 \.tis-v8-context\s*\{[^}]*display:none/,'remove duplicate workspace title');
assert.match(css,/body\.tis-v9 \.v5-input-tab\s*\{[^}]*display:none/,'source editor needs no redundant input tab');
assert.match(css,/@media\s*\(max-width:900px\)/,'tablet stacks content');
assert.match(css,/@media\s*\(max-width:560px\)/,'mobile has dedicated controls');
assert.match(css,/body\.tis-v9 #tisV9Summary/,'show a short contextual result');
console.log('PASS V9 style contract: single task hierarchy, responsive layouts, no nested report scroll');
