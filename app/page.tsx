"use client";

import { useState } from "react";

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

const SEVERITY: Record<Flag["severity"], { label: string; color: string; bg: string }> = {
  high: { label: "High", color: "#b00020", bg: "#fdecef" },
  medium: { label: "Medium", color: "#8a5a00", bg: "#fff6e5" },
  low: { label: "Low", color: "#334155", bg: "#eef2f7" },
};

export default function Home() {
  const [guidelines, setGuidelines] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [finalDecision, setFinalDecision] = useState<"approved" | "rejected" | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function decide(i: number, d: Decision) {
    setDecisions((prev) => prev.map((x, idx) => (idx === i ? d : x)));
  }

  function loadExample() {
    setGuidelines(SAMPLE_GUIDELINES);
    setContent(SAMPLE_CONTENT);
    setResult(null);
    setError(null);
    setFinalDecision(null);
  }

  const openCount = decisions.filter((d) => d === "accepted").length;
  const reviewed = result && decisions.every((d) => d !== "pending");

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.brandRow}>
          <span style={S.logo}>⬡ Aegis</span>
          <span style={S.tagline}>Brand Governance Checkpoint</span>
        </div>
        <p style={S.sub}>
          Paste your approved brand guidelines and a piece of content. Aegis flags each issue, quotes the exact
          rule it breaks, and suggests a fix. A human makes the final call.{" "}
          <span style={S.disclose}>AI review by Google Gemini.</span>
        </p>
      </header>

      <section style={S.inputs}>
        <div style={S.col}>
          <div style={S.labelRow}>
            <label style={S.label}>1 · Brand guidelines</label>
            <button type="button" style={S.linkBtn} onClick={loadExample}>
              Load example
            </button>
          </div>
          <textarea
            style={S.textarea}
            placeholder="Paste approved brand rules, terminology, claim policy…"
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
          />
        </div>
        <div style={S.col}>
          <label style={S.label}>2 · Content to review</label>
          <textarea
            style={S.textarea}
            placeholder="Paste the draft that is about to be published…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </section>

      <div style={S.actionRow}>
        <button
          type="button"
          style={{ ...S.primary, ...(loading || !guidelines.trim() || !content.trim() ? S.primaryOff : {}) }}
          onClick={runReview}
          disabled={loading || !guidelines.trim() || !content.trim()}
        >
          {loading ? "Reviewing…" : "Review content →"}
        </button>
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {result && (
        <section style={S.results}>
          <div style={S.summary}>
            <strong>
              {result.flags.length === 0
                ? "No issues found — content complies with the guidelines."
                : `${result.flags.length} issue${result.flags.length > 1 ? "s" : ""} found`}
            </strong>
            {result.meta.dropped_unsupported > 0 && (
              <span style={S.dropped}>
                {result.meta.dropped_unsupported} unsupported flag
                {result.meta.dropped_unsupported > 1 ? "s" : ""} dropped (no matching rule)
              </span>
            )}
          </div>

          {result.flags.map((f, i) => {
            const sev = SEVERITY[f.severity] ?? SEVERITY.low;
            const d = decisions[i];
            return (
              <article key={i} style={{ ...S.card, opacity: d === "dismissed" ? 0.55 : 1 }}>
                <div style={S.cardTop}>
                  <span style={{ ...S.badge, color: sev.color, background: sev.bg }}>{sev.label}</span>
                  <span style={S.issue}>{f.issue}</span>
                  {d !== "pending" && (
                    <span style={{ ...S.state, color: d === "accepted" ? "#b00020" : "#64748b" }}>
                      {d === "accepted" ? "✓ accepted as issue" : "✕ dismissed"}
                    </span>
                  )}
                </div>

                <div style={S.quoteBlock}>
                  <div style={S.quoteLabel}>Breaks this rule</div>
                  <blockquote style={S.quote}>“{f.guideline_quote}”</blockquote>
                </div>

                <div style={S.row2}>
                  <div style={S.half}>
                    <div style={S.miniLabel}>In the content</div>
                    <code style={S.bad}>{f.offending_text}</code>
                  </div>
                  <div style={S.half}>
                    <div style={S.miniLabel}>Suggested fix</div>
                    <code style={S.good}>{f.suggested_fix}</code>
                  </div>
                </div>

                <div style={S.flagActions}>
                  <button
                    type="button"
                    style={{ ...S.smallBtn, ...(d === "accepted" ? S.smallBtnActive : {}) }}
                    onClick={() => decide(i, "accepted")}
                  >
                    Accept issue
                  </button>
                  <button
                    type="button"
                    style={{ ...S.smallBtn, ...(d === "dismissed" ? S.smallBtnMuted : {}) }}
                    onClick={() => decide(i, "dismissed")}
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            );
          })}

          <div style={S.finalBox}>
            <div style={S.finalLeft}>
              <strong>Final decision</strong>
              <span style={S.finalHint}>
                {result.flags.length === 0
                  ? "No blocking issues. You can approve this content."
                  : reviewed
                    ? `${openCount} accepted issue${openCount === 1 ? "" : "s"} remaining.`
                    : "Review each flag above, then decide."}
              </span>
            </div>
            <div style={S.finalBtns}>
              <button
                type="button"
                style={{ ...S.approve, ...(finalDecision === "approved" ? S.approveOn : {}) }}
                onClick={() => setFinalDecision("approved")}
              >
                Approve
              </button>
              <button
                type="button"
                style={{ ...S.reject, ...(finalDecision === "rejected" ? S.rejectOn : {}) }}
                onClick={() => setFinalDecision("rejected")}
              >
                Reject & send back
              </button>
            </div>
          </div>

          {finalDecision && (
            <div
              style={{
                ...S.verdict,
                background: finalDecision === "approved" ? "#eafaf2" : "#fdecef",
                color: finalDecision === "approved" ? "#0a7c58" : "#b00020",
              }}
            >
              {finalDecision === "approved"
                ? "✓ Approved — marked publish-ready."
                : "✕ Rejected — returned to the creator for revision."}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960, margin: "0 auto", padding: "32px 20px 80px", fontFamily: "system-ui, sans-serif" },
  header: { marginBottom: 24 },
  brandRow: { display: "flex", alignItems: "baseline", gap: 12 },
  logo: { fontSize: 26, fontWeight: 800, color: "#1f4eeb", letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: "#64748b", fontWeight: 600 },
  sub: { marginTop: 8, fontSize: 14.5, lineHeight: 1.55, color: "#475569", maxWidth: 680 },
  disclose: { color: "#94a3b8" },
  inputs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  col: { display: "flex", flexDirection: "column" },
  labelRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 13, fontWeight: 700, color: "#1b2330", marginBottom: 6 },
  linkBtn: { background: "none", border: "none", color: "#1f4eeb", fontSize: 12.5, cursor: "pointer", fontWeight: 600, padding: 0 },
  textarea: {
    minHeight: 190, padding: 12, border: "1px solid #d7dde6", borderRadius: 10, fontSize: 13.5,
    lineHeight: 1.5, resize: "vertical", fontFamily: "ui-monospace, Menlo, monospace", color: "#15181d", background: "#fff",
  },
  actionRow: { marginTop: 16 },
  primary: {
    background: "#1f4eeb", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
  primaryOff: { background: "#9fb0e8", cursor: "not-allowed" },
  errorBox: { marginTop: 16, padding: "12px 14px", background: "#fdecef", color: "#b00020", borderRadius: 10, fontSize: 14 },
  results: { marginTop: 28 },
  summary: { display: "flex", alignItems: "center", gap: 14, fontSize: 15.5, marginBottom: 14, flexWrap: "wrap" },
  dropped: { fontSize: 12.5, color: "#64748b", background: "#f1f5f9", padding: "3px 9px", borderRadius: 999 },
  card: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 14, background: "#fff" },
  cardTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  badge: { fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, textTransform: "uppercase" },
  issue: { fontSize: 15, fontWeight: 600, color: "#15181d", flex: 1 },
  state: { fontSize: 12.5, fontWeight: 700 },
  quoteBlock: { marginTop: 12 },
  quoteLabel: { fontSize: 11.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4 },
  quote: {
    margin: "4px 0 0", padding: "8px 12px", borderLeft: "3px solid #1f4eeb", background: "#f5f7ff",
    fontSize: 13.5, color: "#1e293b", fontStyle: "italic", borderRadius: "0 6px 6px 0",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 },
  half: { display: "flex", flexDirection: "column", gap: 4 },
  miniLabel: { fontSize: 11.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4 },
  bad: { padding: "8px 10px", background: "#fdecef", color: "#9f1239", borderRadius: 6, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  good: { padding: "8px 10px", background: "#eafaf2", color: "#065f46", borderRadius: 6, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  flagActions: { marginTop: 12, display: "flex", gap: 8 },
  smallBtn: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  smallBtnActive: { borderColor: "#b00020", background: "#fdecef", color: "#b00020" },
  smallBtnMuted: { borderColor: "#94a3b8", background: "#f1f5f9", color: "#64748b" },
  finalBox: {
    marginTop: 8, padding: 18, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fafbfc",
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
  },
  finalLeft: { display: "flex", flexDirection: "column", gap: 2 },
  finalHint: { fontSize: 13, color: "#64748b" },
  finalBtns: { display: "flex", gap: 10 },
  approve: { background: "#fff", color: "#0a7c58", border: "2px solid #0a7c58", borderRadius: 10, padding: "9px 20px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  approveOn: { background: "#0a7c58", color: "#fff" },
  reject: { background: "#fff", color: "#b00020", border: "2px solid #b00020", borderRadius: 10, padding: "9px 20px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  rejectOn: { background: "#b00020", color: "#fff" },
  verdict: { marginTop: 14, padding: "12px 16px", borderRadius: 10, fontSize: 15, fontWeight: 700, textAlign: "center" },
};
