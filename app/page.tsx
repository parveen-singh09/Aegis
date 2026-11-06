"use client";

import { useEffect, useState } from "react";
import s from "./page.module.css";
import { ACCEPT, extractText } from "./lib/extractText";

type FieldStatus =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "file"; name: string }
  | { kind: "error"; message: string };

type Flag = {
  severity: "high" | "medium" | "low";
  issue: string;
  guideline_quote: string;
  offending_text: string;
  suggested_fix: string;
};
type ReviewResult = {
  flags: Flag[];
  meta: { model: string; total_raised: number; dropped_unsupported: number };
};
type Decision = "pending" | "accepted" | "dismissed";

const SAMPLE_GUIDELINES = `BRAND VOICE
- Always refer to the product as "Aegis" (capital A). Never "the Aegis" or "aegis".
- Use the verb "sign up" (two words). Never "register" or "signup".

CLAIMS
- Never make ranking claims such as "#1", "best", or "number one" unless an approved source is cited.
- Do not state specific uptime figures. The only approved availability statement is "highly reliable".

TONE
- Keep a calm, professional tone. Do not use all-caps words for emphasis.`;

const SAMPLE_CONTENT = `Register today and see why the Aegis is the #1 brand platform in India!
Our service has 99.999% uptime and is TRUSTED by thousands.`;

const SEV_LABEL: Record<Flag["severity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function countBySeverity(flags: Flag[]): Record<Flag["severity"], number> {
  return flags.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<Flag["severity"], number>,
  );
}

export default function Home() {
  const [guidelines, setGuidelines] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [finalDecision, setFinalDecision] = useState<"approved" | "rejected" | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [guidelineStatus, setGuidelineStatus] = useState<FieldStatus>({ kind: "idle" });
  const [contentStatus, setContentStatus] = useState<FieldStatus>({ kind: "idle" });
  const [applied, setApplied] = useState<boolean[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const stored = root.dataset.theme;
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("aegis-theme", next);
      } catch {}
      return next;
    });
  }

  async function runReview() {
    setLoading(true);
    setError(null);
    setResult(null);
    setFinalDecision(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidelines, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed.");
      setResult(data);
      setDecisions(new Array(data.flags.length).fill("pending"));
      setApplied(new Array(data.flags.length).fill(false));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function decide(i: number, d: Decision) {
    setDecisions((prev) => prev.map((x, idx) => (idx === i ? d : x)));
  }

  function editContent(v: string) {
    setContent(v);
    if (result) setDirty(true);
  }

  function applyFix(i: number) {
    const flag = result?.flags[i];
    if (!flag || !flag.offending_text) return;
    setContent((prev) => {
      if (!prev.includes(flag.offending_text)) return prev;
      return prev.replace(flag.offending_text, flag.suggested_fix);
    });
    setApplied((prev) => prev.map((x, idx) => (idx === i ? true : x)));
    setDirty(true);
  }

  function fixAll() {
    if (!result) return;
    let text = content;
    const nowApplied = [...applied];
    result.flags.forEach((f, i) => {
      if (f.offending_text && text.includes(f.offending_text)) {
        text = text.replace(f.offending_text, f.suggested_fix);
        nowApplied[i] = true;
      }
    });
    if (text !== content) {
      setContent(text);
      setApplied(nowApplied);
      setDirty(true);
    }
  }

  function loadExample() {
    setGuidelines(SAMPLE_GUIDELINES);
    setContent(SAMPLE_CONTENT);
    setResult(null);
    setError(null);
    setFinalDecision(null);
    setGuidelineStatus({ kind: "idle" });
    setContentStatus({ kind: "idle" });
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    setValue: (v: string) => void,
    setStatus: (s: FieldStatus) => void,
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus({ kind: "busy", message: "Reading file…" });
    try {
      const text = await extractText(file, (message) => setStatus({ kind: "busy", message }));
      setValue(text);
      setStatus({ kind: "file", name: file.name });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Could not read that file." });
    }
  }

  function renderStatus(st: FieldStatus) {
    if (st.kind === "busy") return <span className={s.statusBusy}>{st.message}</span>;
    if (st.kind === "error") return <span className={s.statusErr}>{st.message}</span>;
    if (st.kind === "file")
      return (
        <span className={s.statusFile}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          Loaded {st.name}
        </span>
      );
    return null;
  }

  function downloadReport() {
    if (!result) return;
    const now = new Date();
    const counts = countBySeverity(result.flags);
    const lines: string[] = [
      "AEGIS — BRAND GOVERNANCE REPORT",
      "=".repeat(48),
      `Generated: ${now.toISOString()}`,
      `Review engine: ${result.meta.model}`,
      `Final decision: ${(finalDecision ?? "undecided").toUpperCase()}`,
      "",
      `Issues found: ${result.flags.length}  (high ${counts.high} · medium ${counts.medium} · low ${counts.low})`,
      `Uncited flags dropped: ${result.meta.dropped_unsupported}`,
      "",
      "-".repeat(48),
    ];
    result.flags.forEach((f, i) => {
      lines.push(
        "",
        `ISSUE ${i + 1} — ${f.severity.toUpperCase()} — ${decisions[i].toUpperCase()}`,
        `  Problem      : ${f.issue}`,
        `  Cited rule   : "${f.guideline_quote}"`,
        `  In content   : ${f.offending_text}`,
        `  Suggested fix: ${f.suggested_fix}`,
      );
    });
    lines.push("", "=".repeat(48), "Reviewed by a human. Aegis suggests; it never publishes on its own.");

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-governance-report-${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canReview = !loading && guidelines.trim().length > 0 && content.trim().length > 0;
  const acceptedCount = decisions.filter((d) => d === "accepted").length;
  const allReviewed = result !== null && decisions.every((d) => d !== "pending");
  const counts = result ? countBySeverity(result.flags) : { high: 0, medium: 0, low: 0 };
  const fixableCount = result
    ? result.flags.filter((f, i) => !applied[i] && f.offending_text && content.includes(f.offending_text)).length
    : 0;

  return (
    <div className={s.shell}>
      <header className={s.masthead}>
        <div className={s.mastheadInner}>
          <svg className={s.mark} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z"
              fill="currentColor"
              opacity="0.12"
            />
            <path
              d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="m8.5 11.5 2.5 2.5 4.5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={s.wordmark}>Aegis</span>
          <span className={s.kicker}>Brand Governance</span>
          <span className={s.model}>
            <span className={s.dot} />
            Gemini review engine
          </span>
          <button
            type="button"
            className={s.themeToggle}
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className={s.main}>
        <section className={s.panels}>
          <div className={s.field}>
            <div className={s.fieldHead}>
              <span className={s.label}>
                <span className={s.labelNum}>01</span> Approved guidelines
              </span>
              <span className={s.headActions}>
                <label className={s.uploadBtn}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Upload
                  <input
                    type="file"
                    accept={ACCEPT}
                    hidden
                    onChange={(e) => handleUpload(e, setGuidelines, setGuidelineStatus)}
                  />
                </label>
                <button type="button" className={s.exampleBtn} onClick={loadExample}>
                  Load example
                </button>
              </span>
            </div>
            <textarea
              className={s.textarea}
              placeholder="Paste or upload approved brand rules, terminology, claim policy…"
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              spellCheck={false}
            />
            <div className={s.status}>{renderStatus(guidelineStatus)}</div>
          </div>

          <div className={s.field}>
            <div className={s.fieldHead}>
              <span className={s.label}>
                <span className={s.labelNum}>02</span> Content under review
              </span>
              <span className={s.headActions}>
                {content.length > 0 && <span className={s.count}>{content.length} chars</span>}
                <label className={s.uploadBtn}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Upload
                  <input
                    type="file"
                    accept={ACCEPT}
                    hidden
                    onChange={(e) => handleUpload(e, setContent, setContentStatus)}
                  />
                </label>
              </span>
            </div>
            <textarea
              className={s.textarea}
              placeholder="Paste or upload the draft that is about to be published…"
              value={content}
              onChange={(e) => editContent(e.target.value)}
              spellCheck={false}
            />
            <div className={s.status}>{renderStatus(contentStatus)}</div>
          </div>
        </section>

        <div className={s.actionBar}>
          <button
            type="button"
            className={`${s.review} ${loading ? s.busy : ""}`}
            onClick={runReview}
            disabled={!canReview}
          >
            {loading && <span className={s.spinner} aria-hidden="true" />}
            {loading ? "Checking against guidelines…" : "Run governance check"}
          </button>
          <span className={s.hint}>Every flag is tied to a rule you supplied. You decide what ships.</span>
        </div>

        {error && <div className={s.errorBox}>{error}</div>}

        {result && (
          <section className={s.results}>
            {result.flags.length === 0 ? (
              <div className={s.clean}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="var(--ok)" opacity="0.15" />
                  <path
                    d="m8 12 2.5 2.5L16 9"
                    stroke="var(--ok)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                No issues found — the content complies with every rule you supplied.
              </div>
            ) : (
              <>
                <div className={s.summary}>
                  <span className={s.summaryTitle}>
                    {result.flags.length} governance {result.flags.length === 1 ? "issue" : "issues"}
                  </span>
                  <span className={s.counts}>
                    {counts.high > 0 && <span className={`${s.countPill} ${s.high}`}>{counts.high} high</span>}
                    {counts.medium > 0 && (
                      <span className={`${s.countPill} ${s.medium}`}>{counts.medium} medium</span>
                    )}
                    {counts.low > 0 && <span className={`${s.countPill} ${s.low}`}>{counts.low} low</span>}
                  </span>
                  {result.meta.dropped_unsupported > 0 && (
                    <span className={s.dropped}>
                      {result.meta.dropped_unsupported} uncited{" "}
                      {result.meta.dropped_unsupported === 1 ? "flag" : "flags"} dropped
                    </span>
                  )}
                  {fixableCount > 0 && (
                    <button type="button" className={s.fixAll} onClick={fixAll}>
                      Fix all ({fixableCount})
                    </button>
                  )}
                </div>

                {dirty && (
                  <div className={s.staleBar}>
                    <span>Content changed since this review. Re-run to verify your fixes.</span>
                    <button
                      type="button"
                      className={`${s.rerun} ${loading ? s.busy : ""}`}
                      onClick={runReview}
                      disabled={!canReview}
                    >
                      {loading && <span className={s.spinner} aria-hidden="true" />}
                      {loading ? "Re-checking…" : "Re-run check"}
                    </button>
                  </div>
                )}

                {result.flags.map((f, i) => {
                  const sev = SEV_LABEL[f.severity] ?? "Low";
                  const d = decisions[i];
                  return (
                    <article
                      key={i}
                      className={`${s.card} ${s[f.severity] ?? s.low} ${d === "dismissed" ? s.dismissed : ""}`}
                    >
                      <div className={s.cardHead}>
                        <span className={`${s.tag} ${s[f.severity] ?? s.low}`}>{sev}</span>
                        <span className={s.issue}>{f.issue}</span>
                        {d === "accepted" && <span className={`${s.decided} ${s.accepted}`}>Accepted</span>}
                        {d === "dismissed" && <span className={`${s.decided} ${s.dismissed}`}>Dismissed</span>}
                      </div>

                      <div className={s.ruleRow}>
                        <div className={s.ruleLabel}>Cited rule</div>
                        <div className={s.ruleQuote}>“{f.guideline_quote}”</div>
                      </div>

                      <div className={s.triad}>
                        <div className={s.cell}>
                          <span className={s.cellLabel}>In the content</span>
                          <code className={`${s.span} ${s.bad}`}>{f.offending_text}</code>
                        </div>
                        <div className={s.cell}>
                          <span className={s.cellLabel}>Suggested fix</span>
                          <code className={`${s.span} ${s.good}`}>{f.suggested_fix}</code>
                        </div>
                      </div>

                      <div className={s.cardActions}>
                        <button
                          type="button"
                          className={s.applyFix}
                          onClick={() => applyFix(i)}
                          disabled={applied[i] || !content.includes(f.offending_text)}
                        >
                          {applied[i] ? "Fix applied" : "Apply fix"}
                        </button>
                        <span className={s.spacer} />
                        <button
                          type="button"
                          className={`${s.chip} ${d === "accepted" ? s.acceptOn : ""}`}
                          onClick={() => decide(i, "accepted")}
                        >
                          Accept issue
                        </button>
                        <button
                          type="button"
                          className={`${s.chip} ${d === "dismissed" ? s.dismissOn : ""}`}
                          onClick={() => decide(i, "dismissed")}
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })}
              </>
            )}

            <div className={s.finalBar}>
              <div className={s.finalText}>
                <span className={s.finalTitle}>Reviewer decision</span>
                <span className={s.finalHint}>
                  {result.flags.length === 0
                    ? "No blocking issues — safe to approve."
                    : allReviewed
                      ? `${acceptedCount} ${acceptedCount === 1 ? "issue" : "issues"} accepted as blocking.`
                      : "Triage each flag above, then record your decision."}
                </span>
              </div>
              <div className={s.finalBtns}>
                <button
                  type="button"
                  className={`${s.approve} ${finalDecision === "approved" ? s.on : ""}`}
                  onClick={() => setFinalDecision("approved")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={`${s.reject} ${finalDecision === "rejected" ? s.on : ""}`}
                  onClick={() => setFinalDecision("rejected")}
                >
                  Reject & return
                </button>
              </div>
            </div>

            {finalDecision && (
              <div className={`${s.verdict} ${finalDecision === "approved" ? s.approved : s.rejected}`}>
                <span>
                  {finalDecision === "approved"
                    ? "Approved — marked publish-ready."
                    : "Rejected — returned to the creator for revision."}
                </span>
                <button type="button" className={s.download} onClick={downloadReport}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Download report
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
