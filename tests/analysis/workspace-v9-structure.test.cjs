'use strict';
/* V9: one simple first-level path; preserve all existing canonical hooks. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('docs/index.html','utf8');
const count=(pattern)=>[...html.matchAll(pattern)].length;
assert.equal(count(/<header\b/gu),1,'only one product header');
assert.equal(count(/<main\b/gu),1,'only one main document task');
assert.equal(count(/<aside\b[^>]*class="app-sidebar"/gu),0,'no duplicate sidebar navigation');
assert.match(html,/<body\s+class="tis-v9"/u,'V9 isolated style scope');
assert.match(html,/href="analysis\/workspace-v9\.css\?v=[^"]+"/u,'load V9 semantic theme');
for(const id of ['source','file','scanAI','tisRevisedText','tisModes','tisModePanel','tisTabDetection','tisTabHumanize','tisTabEditor','tisDraftApply','tisDraftUndo','v5Toolbox']) {
 assert.equal(count(new RegExp('\\bid="'+id+'"','gu')),1,'one canonical #'+id);
}
assert.equal(count(/\brole="tab"/gu),3,'three discoverable modes');
assert.match(html,/id="v5Toolbox"/u,'all advanced tools retained');
assert.doesNotMatch(html,/<div\s+class="steps"/u,'remove redundant three-step banner');
console.log('PASS V9 structure: one header, no sidebar, 3 modes, one canonical editor/action and retained tools');
