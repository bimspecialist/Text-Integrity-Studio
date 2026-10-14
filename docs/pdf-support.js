/* Text Integrity Studio — private PDF text extraction and opt-in OCR.
 * Uses bundled, maintained PDF.js/Tesseract only; never uploads document text.
 */
(function(){
'use strict';
const MAX_FILE=24*1024*1024, MAX_PAGES=80, MAX_OCR_PAGES=12, MAX_TEXT=350000;
const $=id=>document.getElementById(id);
let session=null,busy=false,task=null,language='en';
const strings={
en:{
  title:'PDF document lab',pick:'Choose PDF',description:'Text PDFs are extracted locally. For scanned pages, run English/Arabic OCR on selected pages (slower). This never uploads your PDF.',
  status:'Ready for PDF document',from:'First page',to:'Last page',lang:'OCR language',eng:'English',ara:'Arabic',both:'Arabic + English',
  ocr:'Run OCR for pages without text',txt:'Export extracted TXT',info:'No PDF loaded',scanned:'Pages without readable text',copy:'Copy extracted text',
  limitation:'PDF extraction is a best-effort copy. Verify reading order, columns, formulas and Arabic. Editing output does not rewrite the original PDF. Export TXT and use Word for authored edits.',
  error:'Could not read this PDF',size:'Choose a PDF smaller than 24 MB.',pages:'pages',partial:'Partial extraction: safety limit',
  scanWarning:'Some pages have no extractable text. Select a page range, then use OCR.',
  noImage:'OCR is limited to 12 pages per run; select a smaller range.',
  finished:'PDF text imported. Review it before editing.',done:'OCR finished. Review recognition accuracy.',loading:'Extracting PDF locally',progress:'OCR processing',
  stale:'The document changed during OCR. The outdated result was discarded; your latest text was kept.',
  missing:'Local PDF/OCR assets are not yet available. Check the GitHub Pages deployment and reload.',nothing:'No text available yet.'
},
ar:{
  title:'مختبر ملفات PDF',pick:'اختر ملف PDF',description:'يستخرج الموقع النص من PDF محليًا. للصفحات المصورة استخدم OCR باللغة العربية أو الإنجليزية على الصفحات المحددة.',
  status:'جاهز لفحص PDF',from:'أول صفحة',to:'آخر صفحة',lang:'لغة OCR',eng:'الإنجليزية',ara:'العربية',both:'العربية + الإنجليزية',
  ocr:'استخراج النص من الصفحات المصوّرة (OCR)',txt:'تصدير النص TXT',info:'لم يتم تحميل ملف PDF',scanned:'صفحات بلا نص قابل للقراءة',copy:'نسخ النص المستخرج',
  limitation:'استخراج النص تقريبي؛ راجع ترتيب الأعمدة والمعادلات والعربية. لا يعيد الموقع كتابة ملف PDF الأصلي؛ صدّر TXT للتحرير.',
  error:'تعذر فتح ملف PDF',size:'اختر ملف PDF أصغر من 24 ميجابايت.',pages:'صفحات',partial:'استخراج جزئي بسبب حد الأمان',
  scanWarning:'بعض الصفحات لا تحتوي على نص قابل للاستخراج. حدد الصفحات واستخدم OCR.',
  noImage:'يسمح OCR بحد أقصى 12 صفحة في كل عملية. حدد نطاقًا أصغر.',
  finished:'تم استخراج النص. راجعه قبل تعديله.',done:'اكتمل OCR. راجع دقة التعرف الضوئي.',loading:'جارٍ استخراج PDF محليًا',progress:'جارٍ التعرف الضوئي',
  stale:'تغيّر المستند أثناء OCR؛ تجاهلنا النتيجة القديمة وحافظنا على أحدث تعديل للنص.',
  missing:'مكتبات PDF/OCR المحلية غير متاحة بعد. تحقق من نشر GitHub Pages وحدّث الصفحة.',nothing:'لا يوجد نص مستخرج حتى الآن.'
}};
function t(k){return strings[lang][k];}
function status(k,extra='',error=false){const el=$('pdfStatus');if(!el)return;el.textContent=(strings[lang][k]||k)+(extra?' · '+extra:'');el.classList.toggle('danger',!!error);}
function updateLabels(){
 lang=document.documentElement.lang==='ar'?'ar':'en';
 for(const [id,key] of [['pdfTitle','title'],['pdfPick','pick'],['pdfDescription','description'],['pdfFromLabel','from'],['pdfToLabel','to'],['pdfLangLabel','lang'],['pdfOcr','ocr'],['pdfExport','txt'],['pdfLimitation','limitation'],['pdfCopy','copy']])$(id).textContent=t(key);
 ['eng','ara','both'].forEach((key,i)=>$('pdfLanguage').options[i].textContent=t(key));
 $('pdfFacts').textContent=session?session.file.name+' · '+session.pages.length+' '+t('pages')+' · '+session.pages.filter(p=>p.extracted.trim().length<20).length+' '+t('scanned'):t('info');
 if(!session)status('status');
}
async function reset(){
 const prior=session;
 session=null;
 $('pdfDetails').hidden=true;
 if(prior&&prior.pdf){try{await prior.pdf.destroy();}catch{}}
 updateLabels();
}
async function getLibrary(){
 try{
   const pdfjs=await import('./vendor/pdfjs/pdf.mjs');
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',document.baseURI).href;
   return pdfjs;
 }catch(error){throw new Error(t('missing')+' '+error.message);}
}
async function loadPdf(file,ticket){
 if(busy)return;
 if(!file||!file.name.toLowerCase().endsWith('.pdf')||file.size>MAX_FILE){status('size','',true);return;}
 const bytes=new Uint8Array(await file.arrayBuffer());
 // A delayed PDF read is never allowed to replace a newer user edit/file.
 if(!globalThis.TISFileImportGuard.isCurrent(ticket))return;
 if(new TextDecoder('latin1').decode(bytes.subarray(0,8)).indexOf('%PDF-')<0){status('error','Not a PDF file',true);return;}
 busy=true;status('loading',file.name);$('pdfDetails').hidden=false;
 if(globalThis.TextIntegrityWordBridge?.isActive())globalThis.TextIntegrityWordBridge.reset();
 await reset();
 try{
   if(!globalThis.TISFileImportGuard.isCurrent(ticket))return;
   await new Promise(r=>setTimeout(r,0));
   const lib=await getLibrary();
   const task=lib.getDocument({
     data:bytes,disableAutoFetch:true,disableStream:true,disableRange:true,isEvalSupported:false,
     useSystemFonts:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',document.baseURI).href,
     cMapUrl:new URL('./vendor/pdfjs/cmaps/',document.baseURI).href,cMapPacked:true
   });
   const pdf=await task.promise;
   if(!globalThis.TISFileImportGuard.isCurrent(ticket)){
    await pdf.destroy();return;
   }
   const count=Math.min(MAX_PAGES,pdf.numPages);
   const pages=[], warnings=[];
   for(let number=1;number<=count;number++){
     const page=await pdf.getPage(number);
     const content=await page.getTextContent();
     if(!globalThis.TISFileImportGuard.isCurrent(ticket)){
      page.cleanup();await pdf.destroy();return;
     }
     const text=content.items.filter(x=>typeof x.str==='string').map(x=>x.str+(x.hasEOL?'\n':' ')).join('').trim();
     pages.push({number,extracted:text.slice(0,MAX_TEXT),ocr:''});
     if(number%3===0||number===count)status('loading',number+'/'+count+' '+t('pages'));
     if(pages.reduce((n,p)=>n+p.extracted.length,0)>MAX_TEXT){warnings.push('Text limit 350,000');break;}
     page.cleanup();
   }
   if(!globalThis.TISFileImportGuard.isCurrent(ticket)){
    await pdf.destroy();return;
   }
   session={file,pdf,pages,warnings,fullPageCount:pdf.numPages};
   setText();
   $('pdfFrom').max=pages.length;$('pdfFrom').value=1;
   $('pdfTo').max=pages.length;$('pdfTo').value=Math.min(pages.length,MAX_OCR_PAGES);
   $('pdfDetails').hidden=false;updateLabels();
   status('finished',pages.length+'/'+pdf.numPages+(pdf.numPages>count?' · '+t('partial'):''));
   if(pages.some(p=>p.extracted.trim().length<20))status('scanWarning',pages.filter(p=>p.extracted.trim().length<20).length+' '+t('pages'));
 }catch(error){
   if(globalThis.TISFileImportGuard.isCurrent(ticket)){
    await reset();status('error',error?.message||'Unknown error',true);
   }
 }finally{
   busy=false;
   // A stale job must never clear the picker for a newer file.
   if($('file').files?.[0]===file)$('file').value='';
 }
}
function getFullText(){
 if(!session)return '';
 return session.pages.map(p=>p.ocr.trim()||p.extracted.trim()).filter(Boolean).join('\n\n').slice(0,MAX_TEXT);
}
function setText(){
 const content=getFullText();
 $('source').readOnly=false;
 snapshot();
 $('source').value=content;
 $('source').dispatchEvent(new Event('input',{bubbles:true}));
 if($('labAnalyze'))$('labAnalyze').click();
}
function loadScript(source){
 return new Promise((resolve,reject)=>{
   if(globalThis.Tesseract){resolve(globalThis.Tesseract);return;}
   const script=document.createElement('script');script.src=source;script.async=true;
   script.onload=()=>globalThis.Tesseract?resolve(globalThis.Tesseract):reject(Error('Tesseract unavailable'));
   script.onerror=()=>reject(Error('Could not load local OCR library'));
   document.head.append(script);
 });
}
async function doOCR(){
 if(busy||!session)return;
 const startedSession=session,startedText=$('source').value;
 const startedRevision=globalThis.TISAnalysisApp?.session?.read().revision;
 const current=()=>session===startedSession&&$('source').value===startedText&&
  (startedRevision===undefined||
   globalThis.TISAnalysisApp?.session?.read().revision===startedRevision);
 const stale=()=>{status('stale');};
 const recognized=new Map();
 let from=Number($('pdfFrom').value),to=Number($('pdfTo').value);
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>session.pages.length){status('error','Invalid page range',true);return;}
 if(to-from+1>MAX_OCR_PAGES){status('noImage','',true);return;}
 const wanted=session.pages.slice(from-1,to).filter(p=>p.extracted.trim().length<20);
 if(!wanted.length){status('finished','Selected pages already contain text');return;}
 busy=true;$('pdfOcr').disabled=true;
 let worker=null;
 try{
   const tesseract=await loadScript(new URL('./vendor/tesseract/tesseract.min.js',document.baseURI).href);
   if(!current()){stale();return;}
   const config={
     workerPath:new URL('./vendor/tesseract/worker.min.js',document.baseURI).href,
     corePath:new URL('./vendor/tesseract/core/',document.baseURI).href,
     langPath:new URL('./vendor/tesseract/lang',document.baseURI).href,
     workerBlobURL:false,cacheMethod:'none',gzip:true
   };
   worker=await tesseract.createWorker($('pdfLanguage').value,1,config);
   if(!current()){stale();return;}
   for(let i=0;i<wanted.length;i++){
     if(!current()){stale();return;}
     const p=wanted[i];
     status('progress',p.number+'/'+startedSession.fullPageCount);
     const page=await startedSession.pdf.getPage(p.number);
     if(!current()){page.cleanup();stale();return;}
     const viewport=page.getViewport({scale:1.8});
     const canvas=document.createElement('canvas');
     canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     if(canvas.width*canvas.height>16000000)throw new Error('Page image too large for OCR');
     const context=canvas.getContext('2d',{willReadFrequently:true});
     await page.render({canvasContext:context,canvas,viewport}).promise;
     if(!current()){
      canvas.width=0;canvas.height=0;page.cleanup();stale();return;
     }
     const outcome=await worker.recognize(canvas);
     canvas.width=0;canvas.height=0;page.cleanup();
     if(!current()){stale();return;}
     // Keep interim OCR output private; commit it atomically only when
     // the same document revision still owns the original source.
     recognized.set(p.number,String(outcome?.data?.text||'').trim());
   }
   if(!current()){stale();return;}
   for(const p of wanted)p.ocr=recognized.get(p.number)||'';
   setText();updateLabels();status('done',wanted.length+' '+t('pages'));
 }catch(error){if(!current())stale();else status('error',error?.message||t('missing'),true);}
 finally{
   if(worker)try{await worker.terminate();}catch{}
   busy=false;$('pdfOcr').disabled=false;
 }
}
function setup(){
 const report=document.createElement('section');report.id='pdfPanel';report.className='panel';
 report.innerHTML='<div class="panel-heading"><h2 id="pdfTitle">PDF document lab</h2><button id="pdfPick" type="button">Choose PDF</button></div><p id="pdfDescription" class="notice"></p><p id="pdfStatus" class="notice" role="status" aria-live="polite"></p><div id="pdfDetails" hidden><p id="pdfFacts" class="small"></p><div class="row pdf-controls"><label><span id="pdfFromLabel"></span><input id="pdfFrom" type="number" min="1" max="12" value="1"></label><label><span id="pdfToLabel"></span><input id="pdfTo" type="number" min="1" max="12" value="12"></label><label><span id="pdfLangLabel"></span><select id="pdfLanguage"><option value="eng">English</option><option value="ara">Arabic</option><option value="eng+ara">English + Arabic</option></select></label></div><div class="row"><button id="pdfOcr" type="button">Run OCR</button><button id="pdfCopy" type="button">Copy</button><button id="pdfExport" type="button">TXT</button></div><p id="pdfLimitation" class="notice"></p></div>';
 document.querySelector('.workspace > div:last-child').prepend(report);
 $('pdfPick').onclick=()=>$('file').click();
 $('pdfOcr').onclick=doOCR;
 $('pdfExport').onclick=()=>{if(!session||!getFullText())return status('nothing');download('pdf-extracted-text.txt',getFullText(),'text/plain;charset=utf-8');};
 $('pdfCopy').onclick=async()=>{if(!session)return;try{await navigator.clipboard.writeText(getFullText());status('finished','Copied');}catch{status('error','Clipboard unavailable',true);}};
 $('language').addEventListener('click',updateLabels);
 ['clear','sample'].forEach(id=>$(id).addEventListener('click',()=>{void reset();}));
 const older=readFile;
 readFile=async function(file,ticket){
   if(!file)return;
   const request=ticket||globalThis.TISFileImportGuard.begin(file);
   if(/\.pdf$/i.test(file.name))return loadPdf(file,request);
   if(!globalThis.TISFileImportGuard.isCurrent(request))return;
   await reset();
   if(!globalThis.TISFileImportGuard.isCurrent(request))return;
   return older(file,request);
 };
 $('file').accept='.pdf,.docx,.txt,.md,.csv,.json';
 const wordPick=$('wordDrop');
 if(wordPick){
    const heading=wordPick.querySelector('strong');
    if(heading)heading.textContent='DOCX / PDF · Private document analysis';
 }
 updateLabels();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();