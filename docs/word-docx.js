/* Text Integrity Studio — Word DOCX companion
 * Parses Word Open XML in memory without network calls.
 * JSZip vendor license: docs/vendor/JSZIP_LICENSE.txt
 */
(function(){
'use strict';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const MAX_FILE=18*1024*1024,MAX_UNPACKED=115*1024*1024,MAX_XML=16*1024*1024,MAX_ENTRIES=1200;
const TEXT_PART=/^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i;
let session=null,busy=false;
const ui={
en:{
  pick:'Choose Word document (.docx)',or:'or drag and drop a DOCX into this text box',privacy:'Word stays on your device · no upload',
  loaded:'Document loaded',parts:'text sections',hidden:'explicitly hidden runs',revision:'tracked changes',watermark:'possible watermark shapes',
  wordTitle:'Word document inspection',wordNote:'Only explicitly hidden Word text runs are detected; hidden styles, drawing objects, headers and tracked changes need manual review.',
  removeHidden:'Also clear explicitly hidden Word-run text (advanced, OFF by default)',
  download:'Download cleaned Word (.docx)',preview:'Preview Word cleanup',safe:'Review the detected changes before saving. The original document is never overwritten.',
  readOnly:'The Word text shown above is a read-only extraction. Downloading DOCX cleans the original document’s text runs, preserving document structure and formatting as far as possible.',
  busy:'Inspecting Word document locally…',done:'Word document inspected',processing:'Preparing clean Word document…',
  noChanges:'No supported characters found for removal. Word can still be downloaded as a new copy.',
  blocked:'This Word file could not be processed safely.',invalid:'Please select an unencrypted .docx file under 18 MB.',
  warning:'The export does NOT remove visual watermarks, AI statistical watermarks, images, metadata, tracked-change history or inherited hidden styles.',
  confirm:'This will clear explicitly hidden Word text. Some documents use hidden runs intentionally. Continue?',
  count:'removed hidden characters',removedHidden:'hidden Word text runs cleared',more:'View Word inspection details',
  empty:'This Word file did not contain extractable text in supported sections.',
  manual:'For scanned pages or images inside Word, OCR is not included.',
  WordPlain:'Switch back to plain-text mode with Clear or Try sample.'
},
ar:{
  pick:'اختر ملف Word (.docx)',or:'أو اسحب ملف Word إلى مساحة النص',privacy:'ملف Word يبقى على جهازك · بدون رفع',
  loaded:'تم فتح المستند',parts:'أقسام نصية',hidden:'نصوص مخفية بخصائص Word',revision:'تغييرات متعقبة',watermark:'أشكال يُحتمل أنها علامات مائية',
  wordTitle:'فحص مستند Word',wordNote:'نكتشف خصائص الإخفاء الصريحة؛ قد تحتاج الأنماط الموروثة والصور والرؤوس والتغييرات المتعقبة إلى مراجعة يدوية.',
  removeHidden:'امسح أيضًا نصوص Word المخفية صراحةً (متقدم، معطل افتراضيًا)',
  download:'تنزيل Word منظّف (.docx)',preview:'معاينة تنظيف Word',safe:'راجع التغييرات قبل الحفظ. لا يتغير المستند الأصلي.',
  readOnly:'النص الظاهر بالأعلى استخراج للقراءة فقط. تنزيل DOCX ينظّف النصوص داخل المستند الأصلي مع المحافظة على البنية والتنسيق قدر الإمكان.',
  busy:'جارٍ فحص ملف Word محليًا…',done:'اكتمل فحص مستند Word',processing:'جارٍ إنشاء نسخة Word منظّفة…',
  noChanges:'لم نجد أحرفًا مدعومة للإزالة. يمكنك تنزيل نسخة جديدة من Word.',
  blocked:'تعذرت معالجة مستند Word بأمان.',invalid:'اختر ملف DOCX غير مشفر بحجم أقل من 18 ميجابايت.',
  warning:'التصدير لا يزيل العلامات المائية المرئية أو الإحصائية للذكاء الاصطناعي أو الصور أو الميتاداتا أو سجل التغييرات أو الأنماط الموروثة المخفية.',
  confirm:'سيتم مسح نصوص Word المخفية صراحةً، وقد يستخدمها المستند عن قصد. هل تريد المتابعة؟',
  count:'أحرف مخفية تمت إزالتها',removedHidden:'نصوص Word مخفية مُسحت',more:'عرض تفاصيل فحص Word',
  empty:'لم نستخرج نصًا من الأقسام المدعومة في مستند Word.',
  manual:'لا تتضمن الأداة OCR لاستخراج الكتابة من الصور الممسوحة.',
  WordPlain:'للعودة للنص العادي، اختر مسح أو المثال.'
}};
function tr(key){return ui[lang==='ar'?'ar':'en'][key];}
function setNotice(message,isError){const node=document.getElementById('wordStatus');node.textContent=message;node.style.color=isError?'#ffb4b4':'#a5dac1';}
function localPartName(filename){return filename.split('/').pop();}
function wordTag(node,tag){return node && node.namespaceURI===W&&node.localName===tag;}
function attrWord(node,name){return node.getAttributeNS(W,name)||node.getAttribute('w:'+name)||node.getAttribute(name)||'';}
function childNamed(node,ns,name){return Array.from(node.childNodes).find(c=>c.nodeType===1&&c.namespaceURI===ns&&c.localName===name)||null;}
function trueProp(node){const val=attrWord(node,'val').toLowerCase();return !['false','0','off','no'].includes(val);}
function isHidden(run){const pr=childNamed(run,W,'rPr');if(!pr)return false;return Array.from(pr.childNodes).some(n=>n.nodeType===1&&n.namespaceURI===W&&['vanish','webHidden','specVanish'].includes(n.localName)&&trueProp(n));}
function textNodes(run){return Array.from(run.getElementsByTagNameNS(W,'t'));}
function parseXML(str,path){const doc=new DOMParser().parseFromString(str,'application/xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName==='parsererror')throw Error('Invalid Word XML: '+path);return doc;}
function extract(doc){
 const rows=[],paras=doc.getElementsByTagNameNS(W,'p');
 for(const p of paras){
   let str='';
   const walker=doc.createTreeWalker(p,NodeFilter.SHOW_ELEMENT);
   while(walker.nextNode()){
     const e=walker.currentNode;
     if((e.namespaceURI===W&&e.localName==='t')||(e.namespaceURI===A&&e.localName==='t'))str+=e.textContent;
     else if(e.namespaceURI===W&&e.localName==='tab')str+='\t';
     else if(e.namespaceURI===W&&(['br','cr'].includes(e.localName)))str+='\n';
   }
   if(str.trim())rows.push(str);
 }
 return rows.join('\n');
}
function inspectDoc(doc,path){
 const runs=Array.from(doc.getElementsByTagNameNS(W,'r')),hidden=runs.filter(isHidden).filter(r=>textNodes(r).some(x=>x.textContent));
 const all=doc.getElementsByTagName('*');let revisions=0,watermarks=0;
 for(const e of all){
   if(e.namespaceURI===W&&['ins','del','moveFrom','moveTo'].includes(e.localName))revisions++;
   if(/watermark/i.test([e.getAttribute('id'),e.getAttribute('name'),e.getAttribute('title'),e.getAttribute('descr')].filter(Boolean).join(' ')))watermarks++;
 }
 return {path,hiddenRuns:hidden.length,hiddenPreview:hidden.slice(0,4).map(r=>textNodes(r).map(n=>n.textContent).join('').slice(0,60)),revisions,possibleWatermarkShapes:watermarks};
}
function checkZipLimits(zip,file){
 if(file.size>MAX_FILE)throw Error(tr('invalid'));
 const members=Object.values(zip.files);if(members.length>MAX_ENTRIES)throw Error('Word archive has too many entries.');
 let total=0;for(const part of members){
   const uncompressed=part._data&&part._data.uncompressedSize||0;
   const compressed=part._data&&part._data.compressedSize||0;
   if(part.name.endsWith('.xml')&&uncompressed>MAX_XML)throw Error('Word XML part exceeds the safety limit: '+part.name);
   total+=uncompressed;
   if(uncompressed>2000000&&compressed>0&&uncompressed/compressed>400)throw Error('Word archive has an unsafe compression ratio.');
 }
 if(total>MAX_UNPACKED)throw Error('Word archive expands beyond the safety limit.');
 if(!zip.file('[Content_Types].xml')||!zip.file('word/document.xml'))throw Error('Not a supported DOCX package.');
}
async function loadWord(file){
 if(busy)return; if(!file||!file.name.toLowerCase().endsWith('.docx')||file.size>MAX_FILE){setNotice(tr('invalid'),true);return;}
 if(typeof JSZip==='undefined'){setNotice('JSZip library did not load. Please refresh the page.',true);return;}
 busy=true;setNotice(tr('busy'));document.getElementById('wordDrop').classList.add('is-loading');
 try{
   await new Promise(r=>setTimeout(r,16));
   const bytes=await file.arrayBuffer();
   const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
   checkZipLimits(zip,file);
   const names=Object.keys(zip.files).filter(k=>TEXT_PART.test(k)).sort((x,y)=>x==='word/document.xml'?-1:y==='word/document.xml'?1:x.localeCompare(y));
   const parts=[];let hidden=0,revisions=0,watermarks=0;
   for(const name of names){
      const xml=await zip.file(name).async('string');
      if(xml.length>MAX_XML)throw Error('Word XML part exceeds safety limit.');
      const doc=parseXML(xml,name),check=inspectDoc(doc,name);
      hidden+=check.hiddenRuns;revisions+=check.revisions;watermarks+=check.possibleWatermarkShapes;
      parts.push({name,xml,text:extract(doc),check});
   }
   session={name:file.name,bytes,parts,hidden,revisions,watermarks,zip};
   $('source').readOnly=true;
   history=[];future=[];histButtons();
   $('source').value=parts.map(p=>p.text).filter(Boolean).join('\n\n');
   $('source').style.minHeight='270px';
   $('resultbox').hidden=true;
   $('wordToolbar').hidden=false;$('wordReport').hidden=false;
   $('stripHidden').checked=false;
   $('file').value='';
   analyze();updateWord();
   setNotice(tr('done')+' · '+file.name);
   const labels=[tr('loaded'),file.name,parts.length+' '+tr('parts')];if(hidden)labels.push(hidden+' '+tr('hidden'));
   document.getElementById('wordMeta').textContent=labels.join(' · ');
   if(!$('source').value)toast(tr('empty'));
 }catch(error){resetWord();setNotice(tr('blocked')+' '+(error.message||''),true);console.error('DOCX inspection:',error);}
 finally{busy=false;document.getElementById('wordDrop').classList.remove('is-loading');}
}
function mode(){return $('mode').value;}
function transformDoc(doc,opt){
 let changed=0,normalized=0,removedHidden=0;
 for(const el of Array.from(doc.getElementsByTagNameNS(W,'t'))){
   const parent=el.parentNode;
   const run=parent&&parent.namespaceURI===W&&parent.localName==='r'?parent:null;
   if(opt.stripHidden&&run&&isHidden(run)){
      if(el.textContent){removedHidden++;el.textContent='';}
      continue;
   }
   const before=el.textContent;
   const clean=cleanup(before,opt.mode);
   if(before!==clean.text){
      el.textContent=clean.text;
      changed+=clean.removed;
      normalized+=clean.normalized;
      if(/^\s|\s$/u.test(clean.text))el.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
   }
 }
 // DrawingML text runs are part of visible text in text boxes/charts.
 for(const el of Array.from(doc.getElementsByTagNameNS(A,'t'))){
   const before=el.textContent;const clean=cleanup(before,opt.mode);
   if(before!==clean.text){el.textContent=clean.text;changed+=clean.removed;normalized+=clean.normalized;}
 }
 return {changed,normalized,removedHidden,text:extract(doc)};
}
async function prepareWord(){
 if(!session)throw Error('No document loaded');
 const config={mode:mode(),stripHidden:$('stripHidden').checked};
 const next=[];let removed=0,norm=0,hiddenRuns=0;
 for(const part of session.parts){
   const xmlDoc=parseXML(part.xml,part.name);
   const outcome=transformDoc(xmlDoc,config);
   removed+=outcome.changed;norm+=outcome.normalized;hiddenRuns+=outcome.removedHidden;
   next.push({name:part.name,xml:outcome.changed||outcome.normalized||outcome.removedHidden?new XMLSerializer().serializeToString(xmlDoc):null,text:outcome.text});
 }
 return {next,removed,norm,hiddenRuns,text:next.map(x=>x.text).filter(Boolean).join('\n\n')};
}
async function previewWord(){
 if(!session||busy)return;
 try{
   const out=await prepareWord();
   cleaned=out.text;$('result').value=cleaned;$('before').textContent=$('source').value.slice(0,400)||'∅';$('after').textContent=cleaned.slice(0,400)||'∅';
   $('resultbox').hidden=false;$('apply').hidden=true;
   $('changeInfo').textContent=out.removed+' '+tr('count')+' · '+out.hiddenRuns+' '+tr('removedHidden')+' · '+out.norm+' spaces normalized';
   if(!out.removed&&!out.hiddenRuns&&!out.norm)toast(tr('noChanges'));
 }catch(e){setNotice(tr('blocked')+' '+e.message,true);}
}
async function downloadWord(){
 if(!session||busy)return;
 const snapshot=session;
 if($('stripHidden').checked&&!window.confirm(tr('confirm')))return;
 busy=true;setNotice(tr('processing'));$('wordDownload').disabled=true;
 try{
   await new Promise(r=>setTimeout(r,16));
   const result=await prepareWord();
   const out=await JSZip.loadAsync(snapshot.bytes,{checkCRC32:false});
   for(const part of result.next)if(part.xml!==null)out.file(part.name,part.xml);
   const blob=await out.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4},streamFiles:true});
   const name=snapshot.name.replace(/\.docx$/i,'')+'-cleaned.docx';
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);
   setNotice(tr('done')+' · '+name);toast(tr('done'));
 }catch(e){setNotice(tr('blocked')+' '+e.message,true);console.error('DOCX export:',e);}
 finally{busy=false;$('wordDownload').disabled=false;}
}
function resetWord(){session=null;$('source').readOnly=false;$('wordToolbar').hidden=true;$('wordReport').hidden=true;$('apply').hidden=false;$('resultbox').hidden=true;$('source').style.minHeight='';}
function updateWord(){
 $('wordPick').textContent=tr('pick');$('wordOr').textContent=tr('or');$('wordPrivate').textContent=tr('privacy');$('wordTitle').textContent=tr('wordTitle');
 $('wordNote').textContent=tr('wordNote');$('stripHiddenLabel').textContent=tr('removeHidden');$('wordDownload').textContent=tr('download');
 $('wordPreview').textContent=tr('preview');$('wordSafe').textContent=tr('safe');$('wordReadOnly').textContent=tr('readOnly');$('wordWarning').textContent=tr('warning');
 $('loadText').textContent=tr('pick');if(session){
    const list=$('wordStats');list.replaceChildren();
    const stats=[
       [tr('parts'),session.parts.length],[tr('hidden'),session.hidden],[tr('revision'),session.revisions],[tr('watermark'),session.watermarks]
    ];
    for(const [label,count] of stats){
       const box=document.createElement('div');box.className='wordStat';const num=document.createElement('strong');num.textContent=count;const desc=document.createElement('small');desc.textContent=label;box.append(num,desc);list.append(box);
    }
    $('wordDetails').replaceChildren();
    for(const p of session.parts){
       const item=document.createElement('li');item.textContent=localPartName(p.name)+' — '+p.check.hiddenRuns+' '+tr('hidden')+', '+p.check.revisions+' '+tr('revision');
       $('wordDetails').append(item);
    }
 }
}
function setup(){
 const style=document.createElement('style');style.textContent='.wordDrop{margin:0 0 16px;padding:21px;border:1px dashed #4b80b0;border-radius:12px;background:#132941;display:flex;flex-wrap:wrap;align-items:center;gap:12px}.wordDrop.is-loading{opacity:.7}.wordDrop small{color:#99bbdd;display:block;margin-top:5px}.wordTool{border:1px solid #39796e;border-radius:12px;padding:16px;background:#102b30;margin-top:12px}.wordTool h3{margin:0 0 5px;color:#baf9e5}.wordTool .row{margin-top:12px}.wordTool label{display:flex;align-items:flex-start;gap:10px}.wordTool input[type=checkbox]{width:17px;height:17px;flex:0 0 17px}.wordStats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:16px 0}.wordStat{border:1px solid #314763;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:4px}.wordStat strong{font-size:25px}.wordStat small{font-size:11px;color:#b7c7dd}.wordTip{font-size:12px;color:#b3c7dd;line-height:1.6}.wordReport ul{padding-inline-start:17px;color:#b9cce5;max-height:180px;overflow:auto}.wordReport li{margin:7px 0;overflow-wrap:anywhere}@media(max-width:550px){.wordDrop{padding:12px}.wordStats{grid-template-columns:1fr 1fr}}';document.head.append(style);
 const drop=document.createElement('div');drop.id='wordDrop';drop.className='wordDrop';
 drop.innerHTML='<div style="flex:1;min-width:180px"><strong>Word DOCX · Local document scanner</strong><small id="wordOr"></small><small id="wordPrivate"></small><small id="wordStatus" aria-live="polite"></small></div><button id="wordPick" type="button" class="primary"></button>';
 $('source').parentElement.insertBefore(drop,$('source'));
 const tool=document.createElement('div');tool.id='wordToolbar';tool.hidden=true;tool.className='wordTool';
 tool.innerHTML='<h3>DOCX</h3><div class="small" id="wordMeta"></div><p id="wordReadOnly" class="wordTip"></p><label><input id="stripHidden" type="checkbox"><span id="stripHiddenLabel"></span></label><div class="row"><button id="wordPreview" type="button"></button><button id="wordDownload" type="button" class="primary"></button></div><p id="wordSafe" class="wordTip"></p>';
 $('source').parentElement.insertBefore(tool,$('source').nextSibling);
 const report=document.createElement('section');report.id='wordReport';report.hidden=true;report.className='panel wordReport';
 report.innerHTML='<h2 id="wordTitle"></h2><div id="wordStats" class="wordStats"></div><p id="wordNote" class="wordTip"></p><details><summary id="wordMore">Sections inspected</summary><ul id="wordDetails"></ul></details><p id="wordWarning" class="wordTip" style="color:#e3be8e"></p>';
 const right=document.querySelector('.workspace > div:last-child');right.insertBefore(report,right.firstChild);
 $('wordPick').onclick=()=>$('file').click();$('wordPreview').onclick=previewWord;$('wordDownload').onclick=downloadWord;
 $('wordDrop').addEventListener('dragover',e=>{e.preventDefault();drop.style.borderColor='#7ce3b6';});
 $('wordDrop').addEventListener('dragleave',()=>drop.style.borderColor='');
 $('wordDrop').addEventListener('drop',e=>{e.preventDefault();drop.style.borderColor='';if(e.dataTransfer.files[0])readFile(e.dataTransfer.files[0]);});
 $('file').accept='.docx,.txt,.md,.csv,.json';
 const oldRead=readFile;
 readFile=async function(file){if(!file)return;if(/\.docx$/i.test(file.name))return loadWord(file);resetWord();return oldRead(file);};
 const oldPreview=$('preview').onclick;
 $('preview').onclick=function(){return session?previewWord():oldPreview();};
 const oldApply=$('apply').onclick;
 $('apply').onclick=function(){return session?toast(tr('readOnly')):oldApply();};
 $('sample').addEventListener('click',resetWord);
 $('clear').addEventListener('click',resetWord);
 $('language').addEventListener('click',()=>{updateWord();$('wordMore').textContent=lang==='ar'?'الأقسام التي تم فحصها':'Sections inspected';});
 $('mode').addEventListener('change',()=>{if(session)$('resultbox').hidden=true;});
 $('stripHidden').addEventListener('change',()=>{if(session)$('resultbox').hidden=true;});
 $('source').addEventListener('paste',e=>{if(session)e.preventDefault();});
 $('wordMore').textContent=lang==='ar'?'الأقسام التي تم فحصها':'Sections inspected';
 updateWord();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();