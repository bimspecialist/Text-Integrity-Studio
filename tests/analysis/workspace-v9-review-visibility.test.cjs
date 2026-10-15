'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('docs/analysis/workspace-v9.css','utf8');
assert.match(css,/body\.tis-v9\[data-tis-v9-mode="humanize"\]\s+#studioReview\s*,\s*body\.tis-v9\[data-tis-v9-mode="editor"\]\s+#studioReview\s*\{\s*display:block!important/u,
 'writing/editor must not hide local suggestions after a source revision');
console.log('PASS V9 review visibility in both writing modes');
