import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

function scoreColor(s) {
  if (s >= 0.7) return "var(--green)";
  if (s >= 0.4) return "var(--amber)";
  return "var(--red)";
}

function verdict(s) {
  if (s >= 0.7) return { label: "Strong Match", cls: "badge-green" };
  if (s >= 0.4) return { label: "Moderate Match", cls: "badge-amber" };
  return { label: "Low Match", cls: "badge-red" };
}

function ScoreBar({ value, color }) {
  return (
    <div className="score-bar-wrap" style={{ flex: 1 }}>
      <motion.div
        className="score-bar-fill"
        initial={{ width: 0 }}
        animate={{ width: `${Math.round((value || 0) * 100)}%` }}
        transition={{ duration: 0.8, delay: 0.1 }}
        style={{ background: color }}
      />
    </div>
  );
}

function CandidateCard({ r, rank, isTop, expanded, toggle }) {
  const v = verdict(r?.final_score || 0);
  const pct = (n) => `${Math.round((n || 0) * 100)}%`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      style={{
        background: isTop ? "rgba(108,99,255,0.06)" : "var(--bg-card)",
        border: `1px solid ${isTop ? "rgba(108,99,255,0.3)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: "0.75rem",
      }}
    >
      {/* Header row — always visible */}
      <div
        onClick={toggle}
        style={{
          padding: "1.1rem 1.4rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}
      >
        {/* Rank badge */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: rank === 0 ? "var(--accent)" : "var(--bg-elevated)",
          border: `1px solid ${rank === 0 ? "var(--accent)" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.8rem", fontWeight: 600,
          color: rank === 0 ? "#fff" : "var(--text-muted)",
        }}>#{rank + 1}</div>

        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>
              {r?.name?.replace(/\.(pdf|docx)$/i, "") || "Candidate"}
            </span>
            <span className={`badge ${v.cls}`}>{v.label}</span>
            {rank === 0 && <span className="badge badge-purple">Top Pick</span>}
          </div>
        </div>

        {/* Score bar + percentage */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
          <ScoreBar value={r?.final_score || 0} color={scoreColor(r?.final_score || 0)} />
          <span style={{
            fontSize: "0.95rem", fontWeight: 600,
            color: scoreColor(r?.final_score || 0), minWidth: 44, textAlign: "right",
          }}>
            {pct(r?.final_score)}
          </span>
        </div>

        {/* Chevron */}
        <span style={{
          color: "var(--text-dim)", fontSize: "1rem",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s", display: "inline-block",
        }}>▾</span>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid var(--border)", padding: "1.25rem 1.4rem" }}>

              {/* Sub-score cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
                {[
                  ["Semantic Match", r.semantic_score],
                  ["Skill Match", r.skill_score],
                  ["Experience", r.experience_score ?? 0],
                ].map(([label, val]) => (
                  <div key={label} className="stat-card" style={{ padding: "0.9rem 1rem" }}>
                    <div className="stat-label">{label}</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 600, color: scoreColor(val), marginTop: 4 }}>
                      {pct(val)}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <ScoreBar value={val} color={scoreColor(val)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Skills */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Matched Skills
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(r.matched_skills || []).length > 0
                      ? r.matched_skills.map(s => <span key={s} className="chip chip-match">{s}</span>)
                      : <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>None detected</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Missing Skills
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(r.missing_skills || []).length > 0
                      ? r.missing_skills.map(s => <span key={s} className="chip chip-missing">{s}</span>)
                      : <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>None missing</span>}
                  </div>
                </div>
              </div>

              {/* AI Explanation */}
              <div style={{
                background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "1rem 1.2rem",
              }}>
                <div style={{ fontSize: "0.78rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  AI Analysis
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {r.llm_explanation && r.llm_explanation !== "AI explanation unavailable."
                    ? r.llm_explanation
                    : "AI explanation is generated for the top 3 candidates only."}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function DashboardPage({ results, navigate }) {
  const [expanded, setExpanded] = useState(new Set([0]));
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");

  const raw = results?.results || [];
  const openings = results?.openings || 5;

  if (!results || raw.length === 0) {
    return (
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
        <h2 style={{ fontFamily: "var(--serif)", marginBottom: "0.75rem" }}>No results yet</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
          Analyze some resumes first, then your ranked candidates will appear here.
        </p>
        <button className="btn btn-primary" onClick={() => navigate("analyze")}>
          Go to Analyzer →
        </button>
      </main>
    );
  }

  const top = raw[0];
  const avg = raw.reduce((s, r) => s + (r.final_score || 0), 0) / raw.length;
  const strongCount = raw.filter(r => r.final_score >= 0.7).length;

  const filtered = useMemo(() => {
    let list = [...raw];
    if (search) list = list.filter(r => r?.name?.toLowerCase().includes(search.toLowerCase()));
    if (filter === "strong") list = list.filter(r => r.final_score >= 0.7);
    if (filter === "moderate") list = list.filter(r => r.final_score >= 0.4 && r.final_score < 0.7);
    if (filter === "weak") list = list.filter(r => r.final_score < 0.4);
    if (sortBy === "score") list.sort((a, b) => b.final_score - a.final_score);
    if (sortBy === "skills") list.sort((a, b) => b.skill_score - a.skill_score);
    if (sortBy === "semantic") list.sort((a, b) => b.semantic_score - a.semantic_score);
    return list;
  }, [raw, search, filter, sortBy]);

  const toggle = (i) => setExpanded(prev => {
    const s = new Set(prev);
    s.has(i) ? s.delete(i) : s.add(i);
    return s;
  });

  const downloadCSV = () => {
    const headers = ["Rank","Name","Final Score %","Semantic %","Skills %","Experience %","Matched Skills","Missing Skills","Verdict"];
    const rows = raw.map((r, i) => [
      i + 1,
      r.name,
      (r.final_score * 100).toFixed(1),
      (r.semantic_score * 100).toFixed(1),
      (r.skill_score * 100).toFixed(1),
      ((r.experience_score ?? 0) * 100).toFixed(1),
      (r.matched_skills || []).join("; "),
      (r.missing_skills || []).join("; "),
      verdict(r.final_score).label,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv," + encodeURIComponent(csv);
    a.download = "resume_analysis.csv";
    a.click();
  };

  const pct = n => `${Math.round((n || 0) * 100)}%`;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              Analysis Results
            </p>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
              Candidate Dashboard
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline" onClick={downloadCSV}>↓ Download CSV</button>
            <button className="btn btn-primary" onClick={() => navigate("analyze")}>+ New Analysis</button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid-4" style={{ marginBottom: "2rem" }}>
          {[
            { label: "Total Candidates", value: raw.length, sub: "analyzed" },
            { label: "Top Score", value: pct(top.final_score), sub: top.name.replace(/\.(pdf|docx)$/i, "").slice(0, 22) },
            { label: "Average Score", value: pct(avg), sub: "across all candidates" },
            { label: "Strong Matches", value: strongCount, sub: `of ${raw.length} candidates` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          ))}
        </div>

        {/* Shortlist banner */}
        <div style={{
          background: "rgba(0,212,170,0.07)", border: "1px solid rgba(0,212,170,0.2)",
          borderRadius: "var(--radius)", padding: "0.85rem 1.25rem", marginBottom: "2rem",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent2)", display: "block", flexShrink: 0 }} />
          <span style={{ fontSize: "0.9rem", color: "var(--accent2)" }}>
            <strong>{Math.min(openings, raw.length)}</strong> candidate{openings !== 1 ? "s" : ""} shortlisted for <strong>{openings}</strong> opening{openings !== 1 ? "s" : ""}
            {" — "}top {Math.min(openings, raw.length)} shown highlighted
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <input
            className="input-field"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200, padding: "0.45rem 0.9rem" }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {[["all","All"], ["strong","Strong"], ["moderate","Moderate"], ["weak","Weak"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: "0.4rem 0.85rem", borderRadius: 8, border: "1px solid",
                borderColor: filter === k ? "var(--accent)" : "var(--border)",
                background: filter === k ? "rgba(108,99,255,0.12)" : "transparent",
                color: filter === k ? "var(--accent)" : "var(--text-muted)",
                fontSize: "0.82rem", cursor: "pointer", fontFamily: "var(--sans)", transition: "all 0.15s",
              }}>{l}</button>
            ))}
          </div>
          <select
            className="input-field" value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ width: 180, padding: "0.45rem 0.9rem" }}
          >
            <option value="score">Sort: Final Score</option>
            <option value="skills">Sort: Skill Match</option>
            <option value="semantic">Sort: Semantic Match</option>
          </select>
          <span style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginLeft: "auto" }}>
            {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Candidate cards */}
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-dim)" }}>No candidates match this filter.</div>
          : filtered.map((r, i) => (
            <CandidateCard
              key={r.name + i}
              r={r}
              rank={i}
              isTop={i < openings && filter === "all" && !search}
              expanded={expanded.has(i)}
              toggle={() => toggle(i)}
            />
          ))
        }

      </motion.div>
    </main>
  );
}
