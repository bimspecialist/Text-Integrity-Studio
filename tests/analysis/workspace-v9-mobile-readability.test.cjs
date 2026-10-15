'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('docs/analysis/workspace-v9.css','utf8');
const mobile=css.slice(css.indexOf('@media(max-width:560px)'),css.indexOf('@media(max-width:360px)'));
const small=css.slice(css.indexOf('@media(max-width:360px)'));
assert.match(mobile,/body\.tis-v9 \.tis-mode-tab\{[^}]*font-size:(?:12|13|14)px/u);
assert.match(small,/body\.tis-v9 \.tis-mode-tab\{[^}]*font-size:(?:12|13|14)px/u);
console.log('PASS V9 phone tab readability: >=12 CSS pixels at 390px and 320px');
