"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function DevLogin() {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/dev-session", {
        method: "POST", cache: "no-store",
        headers: { "X-Dev-Setup-Key": key },
      });
      setKey("");
      if (!response.ok) throw Error("Development session refused");
      setMessage("Private local dev session active for 30 minutes. Return to the document analyzer.");
    } catch { setMessage("Could not establish a local dev session. Check .env.local and use npm run dev."); }
    finally { setBusy(false); }
  }
  return <main className="shell">
    <header className="topbar"><strong>Text Integrity Studio · Local development</strong>
      <Link href="/">Back to analyzer</Link></header>
    <section className="panel">
      <h1>Local-only developer session</h1>
      <p>This form cannot issue sessions in production. It requires an independently generated server-side
        setup key and runs only with <code>npm run dev</code> on localhost.</p>
      <form onSubmit={login}>
        <label className="field">TIS_LOCAL_DEV_SETUP_KEY
          <input type="password" autoComplete="off" value={key}
            onChange={e => setKey(e.target.value)} minLength={32} />
        </label>
        <button className="primary" type="submit" disabled={busy || key.length < 32}>Enable private dev session</button>
      </form>
      <p className="help" role="status">{message}</p>
    </section>
  </main>;
}
