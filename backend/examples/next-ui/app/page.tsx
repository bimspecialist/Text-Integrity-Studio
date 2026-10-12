"use client";
import { useMemo, useState, type FormEvent } from "react";

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
    heading: "Text Integrity · Hybrid Evidence",
    subtitle: "Evidence-aware text analysis. A model cannot establish authorship.",
    input: "Paste text or select a file", button: "Analyze document", idle: "No verified estimate available",
    results: "Analysis results", preview: "Annotated document", reasons: "Reasons for abstention",
    warning: "Even a calibrated percentage is a model signal, not the fraction of AI-written words.",
    help: "An existing authenticated session is required. Scanned PDFs need OCR first.",
  },
  ar: {
    heading: "Text Integrity · التحليل المتقدم",
    subtitle: "تحليل مؤشرات النص دون ادعاء إثبات من كتب المحتوى.",
    input: "ألصق النص أو اختر ملفًا", button: "فحص المستند", idle: "لا تتوفر نسبة موثّقة",
    results: "نتائج التحليل", preview: "النص مع المؤشرات", reasons: "أسباب امتناع النموذج عن التقدير",
    warning: "حتى النسبة المعايرة لا تمثل نسبة الكلمات المكتوبة بالذكاء الاصطناعي ولا تثبت الكاتب.",
    help: "تحتاج جلسة تسجيل دخول موثقة. ملفات PDF المصوّرة تحتاج OCR أولاً.",
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

  const score = result?.document.ai_probability_percent;
  const assessed = result?.analysis_status === "CALIBRATED_ESTIMATE" && score !== null && score !== undefined;

  return <main className="shell" dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className="topbar"><strong className="brand">Text Integrity Studio</strong>
      <button type="button" className="secondary" onClick={() => setLocale(locale === "en" ? "ar" : "en")}>
        {locale === "en" ? "العربية" : "English"}</button></header>
    <div className="hero"><p className="eyebrow">Hybrid NLP · Bilingual · Private evidence</p>
      <h1>{t.heading}</h1><p>{t.subtitle}</p></div>

    <div className="columns">
      <form className="panel" onSubmit={submit}>
        <h2>{t.input}</h2>
        <textarea aria-label={t.input} dir="auto" rows={10} maxLength={120000}
          value={text} disabled={!!file} onChange={e => setText(e.target.value)} />
        <label className="field">PDF · Word DOCX · TXT (max 6 MiB)
          <input type="file" accept=".pdf,.docx,.txt" onChange={e => {setFile(e.target.files?.[0] || null);setResult(null);}} /></label>
        {file && <p className="help">{file.name} · {(file.size / 1024).toFixed(1)} KiB</p>}
        <div className="selectors">
          <label className="field">Language
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="auto">Auto</option><option value="en">English</option>
              <option value="ar">العربية</option><option value="mixed">Mixed</option>
            </select></label>
          <label className="field">Writing context
            <select value={writingContext} onChange={e => setWritingContext(e.target.value)}>
              <option value="general">General</option><option value="academic">Academic</option>
              <option value="formal">Formal</option><option value="non_native">Non-native</option>
            </select></label>
          <label className="field">Segments
            <select value={segmentBy} onChange={e => setSegmentBy(e.target.value)}>
              <option value="paragraph">Paragraphs</option><option value="sentence">Sentences</option>
            </select></label>
        </div>
        <div className="actions"><button type="submit" className="primary"
          disabled={busy || (!file && !text.trim())}>{busy ? "Analyzing…" : t.button}</button>
          <button type="button" className="secondary" onClick={() => {
            setText(""); setFile(null); setResult(null); setDisplay(""); setError("");
          }}>Clear</button></div>
        <p className="help">{t.help}</p>
      </form>

      <section className="panel" aria-live="polite" aria-busy={busy}>
        <h2>{t.results}</h2>
        {!result ? <p className="notice">{error || t.idle}</p> : <>
          <div className={"score-banner " + (assessed ? color(result.document.tier, result.document.status) : "tier-gray")}>
            <strong>{assessed ? String(score) + "%" : "INCONCLUSIVE"}</strong>
            <span>{assessed ? result.document.confidence_level + " confidence" : t.idle}</span>
          </div>
          <p className="help">{result.document.word_count} words · {result.language}</p>
          {!!result.document.reasons?.length && <div><h3>{t.reasons}</h3><ul>
            {result.document.reasons.map((why, index) => <li key={index}>{why}</li>)}</ul></div>}
          {result.input_file && <p className="help">File type: {result.input_file.format} ·
            {result.input_file.warnings.join("; ")}</p>}
          <h3>Indicator breakdown</h3>
          <dl className="metrics">
            <div><dt>Perplexity</dt><dd>{result.document.indicators?.perplexity ?? "Unavailable"}</dd></div>
            <div><dt>Burstiness</dt><dd>{result.document.indicators?.burstiness_nll_cv ?? "Unavailable"}</dd></div>
            <div><dt>Semantic coherence</dt><dd>{result.document.indicators?.semantic_coherence_mean_cosine ?? "Unavailable"}</dd></div>
            <div><dt>N-gram ratio</dt><dd>{result.document.indicators?.ngram_class_log_likelihood_ratio ?? "Unavailable"}</dd></div>
          </dl><p className="help">{result.disclaimer}</p>
        </>}
      </section>
    </div>

    {result && display && <section className="panel">
      <h2>{t.preview}</h2>
      <div className="legend"><span className="tier-red">Higher AI signal</span>
        <span className="tier-yellow">Mixed / uncertain</span>
        <span className="tier-green">Lower AI signal</span>
        <span className="tier-gray">Not assessed</span></div>
      <SegmentText source={display} segments={result.segments} />
      {result.segmentation?.truncated && <p className="help">Preview limited to
        {result.segmentation.returned} annotated segments.</p>}
    </section>}
    <footer className="footer">{t.warning}</footer>
  </main>;
}
