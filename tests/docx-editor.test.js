'use strict';
const assert=require('node:assert/strict');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const rules=require('../docs/writing-rules.js');
const editor=require('../docs/docx-editor.js');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const docXml='<w:document xmlns:w="'+W+'"><w:body>'+
'<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>teh value,which</w:t></w:r></w:p>'+
'<w:p><w:r><w:t>due to the </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>fact that the pump works.</w:t></w:r></w:p>'+
'<w:p><w:r><w:t>Reference [1] ISO 19650 500 kPa "teh".</w:t></w:r></w:p>'+
'<w:p><w:hyperlink w:anchor="foo"><w:r><w:t>teh link</w:t></w:r></w:hyperlink></w:p>'+
'<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:t>teh field</w:t></w:r></w:p>'+
'<w:p><w:ins w:id="19"><w:r><w:t>teh tracked</w:t></w:r></w:ins></w:p>'+
'</w:body></w:document>';
function parse(){return new DOMParser().parseFromString(docXml,'application/xml');}
const planned=editor.planDocument(parse(),rules,{part:'word/document.xml',mode:'clear'});
assert(planned.suggestions.length>=3,'Regular paragraphs generate suggestions');
assert(planned.skipped>=3,'Fields, hyperlinks and existing revisions are skipped');
assert(!planned.suggestions.some(x=>x.original==='teh'&&x.paragraphIndex===2),'Citation and quote protection');
const basic=planned.suggestions.filter(s=>s.paragraphIndex===0||s.paragraphIndex===1);
const accepted=basic.map(s=>s.id);
assert(accepted.length>=3);
const trackedDoc=parse();
const tracked=editor.applyDocument(trackedDoc,rules,accepted,{part:'word/document.xml',mode:'clear',track:true,author:'TIS QA',date:'2026-10-12T00:00:00Z'});
assert.equal(tracked.applied,accepted.length,'All supported edits tracked');
const xml=new XMLSerializer().serializeToString(trackedDoc);
assert(xml.includes('w:ins')&&xml.includes('w:del')&&xml.includes('w:delText'),'Word revision markup emitted');
assert(xml.includes('w:b')&&xml.includes('w:i'),'Formatting from original runs retained');
assert(xml.includes('w:author="TIS QA"'),'Tracked changes record author');
assert(xml.includes('w:id="20"'),'Revision IDs avoid colliding with existing tracked change IDs');
assert(xml.includes('w:hyperlink')&&xml.includes('teh field'),'Complex untouched paragraphs preserved');
assert(xml.includes('500 kPa')&&xml.includes('ISO 19650')&&xml.includes('Reference [1]'),'Protected quantities and citations intact');
const cleanDoc=parse();
const result=editor.applyDocument(cleanDoc,rules,accepted,{part:'word/document.xml',mode:'clear',track:false});
assert.equal(result.applied,accepted.length);
const cleanXml=new XMLSerializer().serializeToString(cleanDoc);
const paragraphs=Array.from(cleanDoc.getElementsByTagNameNS(W,'p'));
const plain=p=>Array.from(p.getElementsByTagNameNS(W,'t')).map(n=>n.textContent).join('');
assert(plain(paragraphs[0]).includes('the value, which'),'Single-run grammar correction');
assert(plain(paragraphs[1]).includes('because the pump works.'),'Across-run rewriting');
assert(!cleanXml.includes('w:delText'),'Non-tracked export has no revision markers');
assert(cleanXml.includes('w:i'),'Text run styles still retained');
assert.equal(editor.applyDocument(parse(),rules,['forged-invalid-id'],{part:'word/document.xml',mode:'clear'}).applied,0,'Untrusted IDs cannot force edits');
const originalClone=new XMLSerializer().serializeToString(parse());
editor.applyDocument(parse(),rules,accepted,{part:'word/document.xml',mode:'clear',track:true});
assert.equal(new XMLSerializer().serializeToString(parse()),originalClone,'Original document remains untouched');
console.log('PASS DOCX tracked/clean edits, style preservation, protected spans and complex Word skip rules');
