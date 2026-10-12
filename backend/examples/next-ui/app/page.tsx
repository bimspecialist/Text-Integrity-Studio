"use client";
import { useMemo, useRef, useState, type FormEvent } from "react";

type Tier = "HIGH_AI_SIGNAL" | "UNCERTAIN_MIXED" | "LOW_AI_SIGNAL" | "UNASSESSED";
type Segment = {
  start: number; end: number; tier: Tier; status: string;
  ai_probability_percent: number | null; confidence_level: string; reasons?: string[];
};
type Evidence = {
  analysis_status: string; language: string; disclaimer: string;
  document: {
    ai_probability_percent: number | null; confidence_level: string; tier: Tier;
    status: string; word_count: number; reasons: string[];
    indicators?: {
      perplexity: number | null; burstiness_nll_cv: number | null;
      semantic_coherence_mean_cosine: number | null;
      ngram_class_log_likelihood_ratio: number | null;
    };
  };
  segments: Segment[]; extracted_text?: string;
  input_file?: { format: string; page_count: number | null; warnings: string[] };
  segmentation?: { truncated: boolean; returned: number };
};

const labels = {
  en: {
    heading: "Check your document",
    subtitle: "Upload a document or paste text. Review the results, and open more details only if you need them.",
    input: "1 · Add a document or text", button: "Check document", idle: "Your results appear here after checking.",
    results: "2 · Results", preview: "3 · Review highlighted passages", reasons: "Why the result is inconclusive",
    warning: "Even a calibrated percentage is a model signal, not the fraction of AI-written words.",
    help: "This private service requires sign-in. For scanned PDFs, use the free browser OCR tool first.",
    upload: "Choose Word, PDF, or TXT (up to 6 MiB)", removeFile: "Remove file",
    steps: ["Add text or file", "Check", "Review"],
    optional: "More options", technical: "Detailed indicators and explanations",
    unverified: "No verified AI estimate", unavailable: "Not available",
    localTools: "Free writing, cleanup & OCR tools", clear: "Clear",
    checked: "Text checked", file: "Document",
  },
  ar: {
    heading: "افحص مستندك بسهولة",
    subtitle: "ارفع ملفًا أو الصق النص، ثم افحصه وراجع النتائج. التفاصيل المتقدمة اختيارية.",
    input: "1 · أضف النص أو المستند", button: "افحص المستند", idle: "ستظهر النتائج هنا بعد الفحص.",
    results: "2 · النتائج", preview: "3 · راجع الفقرات المميزة", reasons: "لماذا لا توجد نتيجة حاسمة؟",
    warning: "حتى النسبة المعايرة لا تمثل نسبة الكلمات المكتوبة بالذكاء الاصطناعي ولا تثبت الكاتب.",
    help: "تتطلب الخدمة الخاصة تسجيل الدخول. للملفات المصوّرة استخدم أداة OCR المجانية أولًا.",
    upload: "اختر Word أو PDF أو TXT (حتى 6 ميجابايت)", removeFile: "إزالة الملف",
    steps: ["أضف النص أو الملف", "افحص", "راجع"],
    optional: "خيارات إضافية", technical: "المؤشرات التفصيلية والأسباب",
    unverified: "لا توجد نسبة AI معتمدة", unavailable: "غير متاح",
    localTools: "أدوات مجانية للتحسين والتنظيف وOCR", clear: "مسح",
    checked: "تم فحص النص", file: "الملف",
  },
};

function color(tier: Tier, status: string): string {
  if (status !== "CALIBRATED_ESTIMATE") return "tier-gray";
  if (tier === "HIGH_AI_SIGNAL") return "tier-red";
  if (tier === "UNCERTAIN_MIXED") return "tier-yellow";
  if (tier === "LOW_AI_SIGNAL") return "tier-green";
  return "tier-gray";
}

function SegmentText({ source, segments }: { source: string; segments: Segment[] }) {
  const nodes = useMemo(() => {
    // API offsets are Python code points. Array.from avoids UTF-16 emoji errors.
    const characters = Array.from(source);
    const elements: React.ReactNode[] = [];
    let position = 0;
    const ordered = [...segments].sort((a, b) => a.start - b.start);
    ordered.forEach((part, index) => {
      if (!Number.isInteger(part.start) || !Number.isInteger(part.end) ||
        part.start < position || part.end > characters.length || part.end <= part.start) return;
      if (part.start > position) elements.push(<span key={"gap-" + index}>
        {characters.slice(position, part.start).join("")}</span>);
      const explanation = part.status === "CALIBRATED_ESTIMATE" && part.ai_probability_percent !== null
        ? String(part.ai_probability_percent) + "% · " + part.confidence_level + " · " + part.tier
        : "INCONCLUSIVE: " + (part.reasons?.join("; ") || "Not validated");
      elements.push(<mark key={"part-" + index} className={"segment " + color(part.tier, part.status)}
        title={explanation} aria-label={explanation}>
        {characters.slice(part.start, part.end).join("")}
      </mark>);
      position = part.end;
    });
    elements.push(<span key="remainder">{characters.slice(position).join("")}</span>);
    return elements;
  }, [source, segments]);
  return <div className="text-preview" dir="auto" role="document">{nodes}</div>;
}

export default function Page() {
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState("auto");
  const [writingContext, setWritingContext] = useState("general");
  const [segmentBy, setSegmentBy] = useState("paragraph");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Evidence | null>(null);
  const [display, setDisplay] = useState("");
  const [error, setError] = useState("");
  const t = labels[locale];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setResult(null); setError("");
    try {
      let response: Response;
      if (file) {
        if (file.size > 6 * 1024 * 1024) throw Error("The maximum file size is 6 MiB.");
        const payload = new FormData();
        payload.set("file", file);
        payload.set("language", language);
        payload.set("writing_context", writingContext);
        payload.set("segment_by", segmentBy);
        payload.set("include_segments", "true");
        response = await fetch("/api/analyze-file", { method: "POST", body: payload, cache: "no-store" });
      } else {
        if (!text.trim()) throw Error("Enter text or choose a document.");
        response = await fetch("/api/analyze", {
          method: "POST", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language, writing_context: writingContext,
            segment_by: segmentBy, include_segments: true }),
        });
      }
      const answer = await response.json();
      if (!response.ok) {
        const message = answer.detail || answer.error || "Private backend unavailable";
        throw Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      if (!answer.document || !Array.isArray(answer.segments)) throw Error("Unexpected server response");
      setResult(answer as Evidence);
      setDisplay(file ? String(answer.extracted_text || "") : text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally { setBusy(false); }
  }

  function resetFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFile(null); setResult(null); setError("");
  }
  function clearAll() {
    resetFile(); setText(""); setDisplay(""); setResult(null); setError("");
  }
  function downloadReport() {
    if (!result) return;
    const data = JSON.stringify({
      ...result, extracted_text: undefined, privacy_note: "No source text stored in this report."
    }, null, 2);
    const url = URL.createObjectURL(new Blob([data], {type: "application/json"}));
    const link = document.createElement("a");
    link.href = url; link.download = "text-integrity-report.json";
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const score = result?.document.ai_probability_percent;
  const assessed = result?.analysis_status === "CALIBRATED_ESTIMATE" && score !== null && score !== undefined;

  return <main className="shell simple-mode" dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className="topbar"><strong className="brand">Text Integrity Studio</strong>
      <nav className="top-actions" aria-label="Tools">
        <a href="https://bimspecialist.github.io/Text-Integrity-Studio/"
          className="tool-link" target="_blank" rel="noopener noreferrer">{t.localTools}</a>
        <button type="button" className="secondary" onClick={() => setLocale(locale === "en" ? "ar" : "en")}>
          {locale === "en" ? "العربية" : "English"}
        </button>
      </nav>
    </header>
    <div className="hero"><h1>{t.heading}</h1><p>{t.subtitle}</p></div>
    <div className="steps" aria-label="Three steps">
      {t.steps.map((step,i)=><span key={step}>{i + 1} · {step}</span>)}
    </div>

    <div className="columns">
      <form className="panel" onSubmit={submit}>
        <h2>{t.input}</h2>
        <label className="field source-field">{t.input}
          <textarea aria-label={t.input} dir="auto" rows={9} maxLength={120000}
            value={text} disabled={!!file} onChange={e => setText(e.target.value)}
            placeholder={locale === "ar" ? "الصق النص هنا…" : "Paste your text here…"} />
        </label>
        <label className="field file-picker">{t.upload}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={e=>{
            setFile(e.target.files?.[0] || null);setResult(null);
          }}/>
        </label>
        {file && <div className="file-selection" role="status">
          <span>{file.name} · {(file.size / 1024).toFixed(1)} KiB</span>
          <button className="secondary" type="button" onClick={resetFile}>{t.removeFile}</button>
        </div>}
        <details className="advanced-options" id="additionalOptions">
          <summary>{t.optional}</summary>
          <div className="selectors">
            <label className="field">Language / اللغة
              <select value={language} onChange={e=>setLanguage(e.target.value)}>
                <option value="auto">Auto / تلقائي</option><option value="en">English</option>
                <option value="ar">العربية</option><option value="mixed">Mixed / مختلط</option>
              </select>
            </label>
            <label className="field">Writing context / سياق الكتابة
              <select value={writingContext} onChange={e=>setWritingContext(e.target.value)}>
                <option value="general">General / عام</option><option value="academic">Academic / أكاديمي</option>
                <option value="formal">Formal / رسمي</option><option value="non_native">Non-native / لغة ثانية</option>
              </select>
            </label>
            <label className="field">Analysis detail / مستوى التفصيل
              <select value={segmentBy} onChange={e=>setSegmentBy(e.target.value)}>
                <option value="paragraph">Paragraphs / فقرات</option>
                <option value="sentence">Sentences / جمل</option>
              </select>
            </label>
          </div>
        </details>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy || (!file && !text.trim())}>
            {busy ? (locale === "ar" ? "جاري الفحص…" : "Checking…") : t.button}
          </button>
          <button type="button" className="secondary" onClick={clearAll}>{t.clear}</button>
        </div>
        <p className="help">{t.help}</p>
      </form>

      <section className="panel result-panel" aria-live="polite" aria-busy={busy}>
        <h2>{t.results}</h2>
        {!result ? <p className={error ? "notice error" : "notice"} role="status">{error || t.idle}</p> : <>
          <div className={"score-banner " + (assessed ? color(result.document.tier, result.document.status) : "tier-gray")}>
            <strong>{assessed ? String(score) + "%" : t.unverified}</strong>
            <span>{assessed ? result.document.confidence_level : "INCONCLUSIVE"}</span>
          </div>
          <p className="help">{result.document.word_count} {locale === "ar" ? "كلمة" : "words"} · {result.language}</p>
          {result.document.reasons?.[0] && <p className="notice">
            {locale === "ar" && !assessed ? t.unverified + " · " : ""}
            {result.document.reasons[0]}
          </p>}
          {result.input_file && <p className="help">{t.file}: {result.input_file.format}
            {result.input_file.page_count ? " · " + result.input_file.page_count + " pages" : ""}
          </p>}
          <details className="advanced-options" id="technicalDetails">
            <summary>{t.technical}</summary>
            {result.document.reasons.length > 0 && <>
              <h3>{t.reasons}</h3>
              <ul>{result.document.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>
            </>}
            <dl className="metrics">
              <div><dt>Perplexity</dt><dd>{result.document.indicators?.perplexity ?? t.unavailable}</dd></div>
              <div><dt>Burstiness</dt><dd>{result.document.indicators?.burstiness_nll_cv ?? t.unavailable}</dd></div>
              <div><dt>Semantic coherence</dt><dd>{result.document.indicators?.semantic_coherence_mean_cosine ?? t.unavailable}</dd></div>
              <div><dt>N-gram evidence</dt><dd>{result.document.indicators?.ngram_class_log_likelihood_ratio ?? t.unavailable}</dd></div>
            </dl>
            {result.input_file?.warnings?.map((warning,i)=><p className="help" key={i}>{warning}</p>)}
            <button type="button" className="secondary" onClick={downloadReport}>
              {locale === "ar" ? "تنزيل تقرير JSON" : "Download JSON report"}
            </button>
          </details>
          <p className="help caution">{t.warning}</p>
        </>}
      </section>
    </div>

    {result && !!display && <section className="panel preview-panel">
      <h2>{t.preview}</h2>
      <div className="legend" aria-label="Analysis tiers">
        <span className="tier-red">{locale === "ar" ? "إشارة أعلى" : "Higher AI signal"}</span>
        <span className="tier-yellow">{locale === "ar" ? "غير محسوم" : "Uncertain"}</span>
        <span className="tier-green">{locale === "ar" ? "إشارة أقل" : "Lower AI signal"}</span>
        <span className="tier-gray">{locale === "ar" ? "لم يُقيّم" : "Not assessed"}</span>
      </div>
      <SegmentText source={display} segments={result.segments} />
      {result.segmentation?.truncated && <p className="help">
        {locale === "ar" ? "عُرضت أول " : "Showing first "}
        {result.segmentation.returned}
        {locale === "ar" ? " فقرة أو جملة فقط." : " annotated passages only."}
      </p>}
    </section>}
    <footer className="footer">{t.warning}</footer>
  </main>;
}
