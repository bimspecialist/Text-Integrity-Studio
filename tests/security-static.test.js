'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('docs/index.html','utf8');
const privacy=fs.readFileSync('docs/privacy.html','utf8');
const scripts=['docs/app.js','docs/word-docx.js','docs/writing-lab.js','docs/docx-editor.js','docs/writing-rules.js','docs/studio-insights-core.js','docs/studio-insights-ui.js'];
for(const file of scripts){
 const text=fs.readFileSync(file,'utf8');
 assert(!/document\.createElement\(['"]style['"]\)/.test(text),'No dynamic inline styles: '+file);
 assert(!/\beval\s*\(/.test(text),'No runtime eval: '+file);
 assert(!/\bnew Function\s*\(/.test(text),'No dynamic JS compile: '+file);
}
for(const text of [html,privacy]){
 assert(/http-equiv="Content-Security-Policy"/.test(text),'CSP in every HTML page');
 assert(text.includes("connect-src 'self'")&&text.includes("script-src 'self'")&&text.includes("style-src 'self'"),'Restrictive policy');
 assert(!/<script\b[^>]*>(?=[\s\S]*?<\/script>)\s*[^<\s]/i.test(text),'No inline executable script');
 assert(!/<style\b/i.test(text),'No inline stylesheet');
 assert(!/\sstyle=/.test(text),'No inline style attributes');
 assert(!/\son[a-z]{3,}="/i.test(text),'No inline event handlers');
}
assert(html.includes('src="docx-editor.js"')&&html.includes('src="app.js"'),'First-party modules referenced');
assert(html.includes('href="privacy.html"'),'Privacy disclosure linked');
assert(fs.existsSync('docs/vendor/JSZIP_LICENSE.txt'),'Bundled library license included');
console.log('PASS static CSP, local scripts, disclosure and dependency-license checks');
