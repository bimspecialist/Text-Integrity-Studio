'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const JSZip=require('../docs/vendor/jszip.min.js');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
class Parser extends DOMParser {
  parseFromString(...args){
    const doc=super.parseFromString(...args);
    doc.createTreeWalker=function(root){
       const elements=[];
       function walk(node){for(let child=node.firstChild;child;child=child.nextSibling){if(child.nodeType===1)elements.push(child);walk(child);}}
       walk(root);let index=0;
       return {currentNode:null,nextNode(){if(index>=elements.length)return false;this.currentNode=elements[index++];return true;}};
    };
    return doc;
  }
}
const html=fs.readFileSync('docs/index.html','utf8');
assert(html.includes('vendor/jszip.min.js')&&html.includes('word-docx.js'),'DOCX scripts linked');
assert(html.indexOf('vendor/jszip.min.js')<html.indexOf('word-docx.js'),'JSZip should load first');
const cleanup=(text,mode)=>{
 const SAFE=new Set([0x00ad,0x200b,0x2060,0xfeff]);
 const REVIEW=new Set([0x061c,0x200c,0x200d,0x200e,0x200f,...Array.from({length:5},(_,i)=>0x202a+i),...Array.from({length:4},(_,i)=>0x2066+i)]);
 const SPACE=new Set([0xa0,0x202f]);
 let out='',removed=0,normalized=0;
 for(const c of text){const cp=c.codePointAt(0);
   if(SAFE.has(cp)||cp===127||(cp<32&&![9,10,13].includes(cp))||(mode==='thorough'&&REVIEW.has(cp))){removed++;continue;}
   if(SPACE.has(cp)){out+=' ';normalized++;}else out+=c;
 }
 return {text:out,removed,normalized};
};
let script=fs.readFileSync('docs/word-docx.js','utf8');
script=script.replace('if(document.readyState===','globalThis.__wordTests={parseXML,extract,inspectDoc,transformDoc,checkZipLimits};if(document.readyState===');
const ctx={document:{readyState:'loading',addEventListener(){}},DOMParser:Parser,XMLSerializer,NodeFilter:{SHOW_ELEMENT:1},cleanup,JSZip,lang:'en',console,window:{}};
vm.runInNewContext(script,ctx,{filename:'word-docx.js'});
const api=ctx.__wordTests;
assert(api&&api.parseXML&&api.transformDoc&&api.checkZipLimits,'Word engine available');
const xml='<?xml version="1.0" encoding="UTF-8"?>'+
'<w:document xmlns:w="'+W+'"><w:body>'+
'<w:p><w:r><w:t>Before\u200b after</w:t></w:r></w:p>'+
'<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden note</w:t></w:r>'+
'<w:r><w:t>مرحبا\u200d بالعالم</w:t></w:r></w:p>'+
'<w:p><w:ins><w:r><w:t>tracked text</w:t></w:r></w:ins></w:p>'+
'</w:body></w:document>';
const document=api.parseXML(xml,'word/document.xml');
assert.equal(api.inspectDoc(document,'word/document.xml').hiddenRuns,1);
assert.equal(api.inspectDoc(document,'word/document.xml').revisions,1);
const before=api.extract(document);
assert(before.includes('\u200b'),'Extract invisible chars');
assert(before.includes('Hidden note'),'Extract hidden Word text for inspection');
const result=api.transformDoc(document,{mode:'safe',stripHidden:false});
assert.equal(result.changed,1);
assert(result.text.includes('Before after'),'Invisible character removed from Word text');
assert(result.text.includes('Hidden note'),'Hidden run preserved unless explicitly requested');
assert(result.text.includes('\u200d'),'Arabic joiner remains in safe mode');
const result2=api.transformDoc(document,{mode:'safe',stripHidden:true});
assert.equal(result2.removedHidden,1);
assert(!result2.text.includes('Hidden note'),'Optional hidden Word text cleared');
const serialized=new XMLSerializer().serializeToString(document);
assert(serialized.includes('w:vanish'),'Word formatting survives XML edit');
async function roundtrip(){
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');zip.file('word/document.xml',xml);zip.file('word/media/image1.png',Buffer.from([137,80,78,71]));
 const original=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 const parsed=await JSZip.loadAsync(original,{checkCRC32:false});
 api.checkZipLimits(parsed,{size:original.byteLength});
 const cleanedDoc=api.parseXML(await parsed.file('word/document.xml').async('string'),'word/document.xml');
 api.transformDoc(cleanedDoc,{mode:'safe',stripHidden:true});
 parsed.file('word/document.xml',new XMLSerializer().serializeToString(cleanedDoc));
 const output=await parsed.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 const reopened=await JSZip.loadAsync(output);
 assert.deepEqual(await reopened.file('word/media/image1.png').async('nodebuffer'),Buffer.from([137,80,78,71]),'Embedded binary image preserved');
 const finalXml=await reopened.file('word/document.xml').async('string');
 assert(!finalXml.includes('\u200b')&&!finalXml.includes('Hidden note'),'Cleaned file is valid ZIP containing cleaned Word XML');
 assert(finalXml.includes('مرحبا\u200d'),'Arabic joiner preserved after DOCX roundtrip');
 const bad=new JSZip();bad.file('word/document.xml',xml);
 const badZip=await JSZip.loadAsync(await bad.generateAsync({type:'nodebuffer'}));
 assert.throws(()=>api.checkZipLimits(badZip,{size:100}),/DOCX package/,'Invalid archives refused');
 assert.throws(()=>api.checkZipLimits(parsed,{size:19*1024*1024}),/invalid|Word|unencrypted|docx/i,'Large archives refused');
 console.log('PASS 16 DOCX engine, privacy, formatting and archive checks');
}
roundtrip().catch(error=>{console.error(error);process.exit(1);});
