/* Text Integrity Studio — bilingual editorial review interface */
(function(){
'use strict';
const api=globalThis.TextIntegrityRules;
if(!api)return;
const $=id=>document.getElementById(id);
let current=[],dismissed=new Set(),lastText='',lastMode='';
const copy={
en:{head:'04 · Writing improvement lab',note:'Human-reviewed improvements for clarity, grammar, punctuation and structure. No artificial typos, false claims, or detector-gaming.',tone:'Editing style',clear:'Clear and concise',academic:'Academic — preserve formality',professional:'Professional — concise',analyze:'Find suggestions',preview:'Preview selected improvements',apply:'Apply selected to text',copy:'Copy proposed text',export:'Export revised TXT',empty:'Paste text, then choose Find suggestions.',ready:'suggestions for review',none:'No suggestions under these deterministic checks. This does not prove your text is error-free.',review:'Optional — review meaning before applying',ignore:'Ignore',accept:'Apply this change',before:'Original',after:'Suggested',word:'Word mode: select improvements to include in your DOCX export. Enable Track changes to review each edit in Microsoft Word. Complex field-coded or previously revised paragraphs are skipped to protect formatting.',noAI:'Editorial checks are not an AI detector; changes do not prove human authorship or guarantee any external detector score.',unchanged:'Text changed. Scan again before applying.',changed:'Improvement applied.',select:'Select',all:'Selected',reset:'Refresh',safe:'Review references, numbers, terminology and quotations before accepting edits.'},
ar:{head:'04 · مختبر تحسين الكتابة',note:'اقتراحات قابلة للمراجعة لتحسين الوضوح والقواعد والترقيم والبنية. لا نضيف أخطاء متعمدة أو ادعاءات غير صحيحة أو تحايلًا على أدوات الكشف.',tone:'أسلوب التحرير',clear:'واضح ومختصر',academic:'أكاديمي — الحفاظ على الرسمية',professional:'مهني — مختصر',analyze:'استخراج الاقتراحات',preview:'معاينة التحسينات المحددة',apply:'تطبيق المحدد على النص',copy:'نسخ النص المقترح',export:'تصدير TXT بعد التحسين',empty:'ألصق نصًا ثم اضغط استخراج الاقتراحات.',ready:'اقتراحًا للمراجعة',none:'لا توجد اقتراحات ضمن القواعد المحددة. هذا لا يعني أن النص خالٍ من الأخطاء.',review:'اختياري — راجع المعنى قبل التطبيق',ignore:'تجاهل',accept:'تطبيق هذا التعديل',before:'النص الأصلي',after:'الاقتراح',word:'في Word اختر الاقتراحات التي تريد تضمينها في ملف DOCX. يمكنك تفعيل تعقب التغييرات لمراجعتها داخل Microsoft Word. يتم تجاوز الفقرات المعقدة لحماية التنسيق.',noAI:'التدقيق التحريري ليس كشفًا للذكاء الاصطناعي، ولا يثبت أن النص بشري أو يضمن نتيجة أي أداة كشف خارجية.',unchanged:'تغير النص. أعد الفحص قبل تطبيق الاقتراح.',changed:'تم تطبيق التعديل.',select:'اختيار',all:'محدد',reset:'تحديث',safe:'راجع المراجع والأرقام والمصطلحات والاقتباسات قبل قبول التعديلات.'}
};
function l(){return copy[lang==='ar'?'ar':'en'];}
function create(tag,cls,content){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(content!==undefined)el.textContent=content;
 return el;
}
function notify(msg){const p=$('labStatus');p.textContent=msg;p.setAttribute('role','status');}
function setup(){
 
 const panel=create('section','panel writing-panel');panel.id='writingLab';
 panel.innerHTML='<div class="writing-header"><h2 id="labHeading"></h2><span id="labCount" class="small">0</span></div><p id="labNote" class="notice"></p><div class="writing-bar"><label><span id="labTone"></span><select id="labMode" aria-label="Editing style"><option value="clear"></option><option value="academic"></option><option value="professional"></option></select></label><button id="labAnalyze" class="primary" type="button"></button></div><p id="labStatus" class="writing-status" aria-live="polite"></p><div id="labResults" class="writing-results"></div><div class="writing-bar"><button id="labPreview" type="button"></button><button id="labApply" type="button"></button></div><label id="labPreviewLabel" for="labPreviewText"></label><textarea id="labPreviewText" class="writing-preview" readonly aria-label="Proposed reviewed text"></textarea><div class="writing-bar"><button id="labCopy" type="button"></button><button id="labExport" type="button"></button></div><p class="writing-note" id="labWord"></p><p class="writing-note" id="labAI"></p><p class="writing-note" id="labSafe"></p>';
 document.querySelector('.workspace > div:first-child').append(panel);
 $('labAnalyze').onclick=scan;
 $('labMode').onchange=scan;
 $('labPreview').onclick=preview;
 $('labApply').onclick=applySelected;
 $('labCopy').onclick=async()=>{preview();try{await navigator.clipboard.writeText($('labPreviewText').value);notify(lang==='ar'?'تم نسخ النسخة المقترحة':'Proposed revision copied.');}catch{notify(lang==='ar'?'النسخ غير متاح في هذا السياق. استخدم Ctrl+C.':'Clipboard unavailable here. Select the text and copy it.');}};
 $('labExport').onclick=()=>{preview();download('text-integrity-edited.txt',$('labPreviewText').value,'text/plain;charset=utf-8');};
 $('source').addEventListener('input',()=>{if(lastText!==$('source').value)invalidate();});
 if($('wordToolbar')){const observer=new MutationObserver(()=>{if($('wordToolbar').hidden)invalidate();else scan();});observer.observe($('wordToolbar'),{attributes:true,attributeFilter:['hidden']});}
 $('language').addEventListener('click',translateUI);
 ['clear','sample'].forEach(id=>$(id).addEventListener('click',invalidate));
 translateUI();invalidate();
}
function translateUI(){
 const v=l();const k={
 labHeading:'head',labNote:'note',labTone:'tone',labAnalyze:'analyze',labPreview:'preview',labApply:'apply',
 labCopy:'copy',labExport:'export',labWord:'word',labAI:'noAI',labSafe:'safe'
 };
 for(const [id,name] of Object.entries(k))$(id).textContent=v[name];
 $('labMode').options[0].textContent=v.clear;$('labMode').options[1].textContent=v.academic;$('labMode').options[2].textContent=v.professional;
 $('labPreviewLabel').textContent=v.preview;
 render();
}
function invalidate(){
 current=[];dismissed.clear();lastText='';lastMode='';
 $('labPreviewText').value='';$('labResults').replaceChildren();$('labCount').textContent='0';
 notify(l().empty);
}
function scan(){
 const txt=$('source').value;
 const response=isWord()&&bridge()?bridge().getSuggestions($('labMode').value):api.analyze(txt,$('labMode').value);
 current=response.suggestions;
 if(isWord())current.forEach(s=>s.enabled=false);
 dismissed.clear();lastText=txt;lastMode=$('labMode').value;
 render();preview();
 notify(isWord()&&response.skipped?(lang==='ar'?'تم تجاهل '+response.skipped+' فقرة معقدة حفاظًا على التنسيق.':'Skipped '+response.skipped+' complex paragraphs to protect formatting.'):response.truncated?(lang==='ar'?'تحليل جزئي: تمت مراجعة أول '+response.scannedCharacters+' حرف فقط.':'Partial analysis: only the first '+response.scannedCharacters+' characters were reviewed.'):(current.length ? current.length+' '+l().ready:l().none));
}
function active(){return current.filter(s=>!dismissed.has(s.id)&&s.enabled!==false);}
function isWord(){return $('source').readOnly;}
function bridge(){return globalThis.TextIntegrityWordBridge;}
function syncWord(){if(isWord()&&bridge())bridge().setSelection(active().map(s=>s.id),$('labMode').value);}
function render(){
 if(!$('labResults'))return;
 const root=$('labResults');root.replaceChildren();
 $('labCount').textContent=active().length+' '+l().ready;
 $('labApply').disabled=!active().length;
 if(!current.length){const p=create('p','empty',l().empty);root.append(p);return;}
 current.forEach(s=>{
  if(dismissed.has(s.id))return;
  const card=create('div','writing-card');
  const head=create('div','row between');
  const id='lab-option-'+s.id.replace(/[^a-z0-9]/gi,'-');
  const input=create('input');input.type='checkbox';input.id=id;input.checked=s.enabled!==false;input.addEventListener('change',()=>{s.enabled=input.checked;updateButtons();syncWord();preview();});
  const title=create('label','',s.category+' · '+(s.risk==='medium'?l().review:l().select));title.htmlFor=id;
  head.append(input,title);
  const reason=create('p','',lang==='ar'?s.reasonAr:s.reason);
  const pair=create('div','pair');
  const left=create('div','');left.append(create('small','',l().before),create('div','chunk',s.original));
  const right=create('div','');right.append(create('small','',l().after),create('div','chunk after',s.replacement||'∅'));
  pair.append(left,right);
  const actions=create('div','row');
  const ignore=create('button','',l().ignore);ignore.type='button';ignore.onclick=()=>{dismissed.add(s.id);syncWord();render();preview();};
  const apply=create('button','',l().accept);apply.type='button';apply.onclick=()=>{
    if(isWord()){s.enabled=true;syncWord();render();preview();notify(lang==='ar'?'تم تحديد الاقتراح لتصدير Word.':'Suggestion queued for Word export.');return;}
    try{snapshot();$('source').value=api.apply($('source').value,s);analyze();scan();notify(l().changed);}
    catch{notify(l().unchanged);scan();}
  };
  actions.append(ignore,apply);card.append(head,reason,pair,actions);root.append(card);
 });
 updateButtons();
}
function updateButtons(){
 $('labApply').disabled=!active().length;
 $('labCount').textContent=active().length+' '+l().ready;
}
async function preview(){
 const text=$('source').value;
 if(lastText!==text||lastMode!==$('labMode').value){scan();return;}
 try{
   if(isWord()&&bridge()){
     syncWord();$('labPreviewText').value=await bridge().previewSelected();
   }else $('labPreviewText').value=api.previewAll(text,active());
 }catch(error){$('labPreviewText').value=text;notify(l().unchanged);}
}
function applySelected(){
 if(isWord()){
   if(!active().length)return;
   if(active().some(s=>s.risk==='medium')&&!confirm(lang==='ar'?'هل راجعت المصطلحات والمراجع قبل وضع التعديلات في Word؟':'Have you reviewed terminology and references before queuing Word edits?'))return;
   syncWord();preview();notify(lang==='ar'?'التعديلات جاهزة ضمن تنزيل Word. اضغط تنزيل Word.':'Edits queued for Word export. Use Download Word DOCX.');return;
 }
 if(lastText!==$('source').value){notify(l().unchanged);scan();return;}
 if(!active().length)return;
 if(active().some(s=>s.risk==='medium')&&!confirm(lang==='ar'?'تتضمن الاقتراحات تغييرات أسلوبية. هل راجعت المعنى والمصطلحات؟':'Some changes affect style. Have you checked meaning and terminology?'))return;
 try{const changed=api.previewAll($('source').value,active());snapshot();$('source').value=changed;analyze();scan();notify(l().changed);}
 catch{notify(l().unchanged);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();