import { motion } from "framer-motion";

const FEATURES = [
  { icon: "◈", title: "AI-Powered Analysis", desc: "Deep semantic matching using sentence transformers and LLM explanations for each candidate." },
  { icon: "◐", title: "Skill Gap Detection", desc: "Automatically identifies matched and missing skills between JD and resume." },
  { icon: "◑", title: "Experience Scoring", desc: "Extracts and compares years of experience to rank candidates objectively." },
  { icon: "◉", title: "Batch Processing", desc: "Upload dozens of resumes at once. Our API handles them in parallel with async processing." },
  { icon: "◈", title: "Detailed Reports", desc: "Download full CSV reports or view the interactive dashboard for every candidate." },
  { icon: "◐", title: "Fast & Reliable", desc: "Background job queuing ensures no timeouts — results stream back as they complete." },
];

const STEPS = [
  { n: "01", title: "Paste your JD", desc: "Add the job description as text or upload a PDF/DOCX file." },
  { n: "02", title: "Upload resumes", desc: "Drag and drop multiple PDF or DOCX resumes for batch analysis." },
  { n: "03", title: "Get AI rankings", desc: "Receive ranked candidates with scores, skill gaps, and AI explanations." },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function HomePage({ navigate }) {
  return (
    <main style={{ position: "relative", overflow: "hidden" }}>

      {/* Background orbs */}
      <div className="orb" style={{ width: 500, height: 500, background: "var(--accent-glow)", top: -100, left: "20%", opacity: 0.4 }} />
      <div className="orb" style={{ width: 400, height: 400, background: "var(--accent2-glow)", top: 200, right: "5%", opacity: 0.3 }} />

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "7rem 1.5rem 5rem", textAlign: "center", position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", borderRadius: 100, padding: "6px 16px", marginBottom: "2rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent2)", display: "block" }} />
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>Powered by Groq LLaMA + Sentence Transformers</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.8rem, 6vw, 5rem)", lineHeight: 1.1, color: "var(--text)", marginBottom: "1.5rem" }}
        >
          AI Resume Checker<br />
          <span style={{ color: "var(--accent)", fontStyle: "italic" }}>Built for Recruiters</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ fontSize: "1.15rem", color: "var(--text-muted)", maxWidth: 560, margin: "0 auto 2.5rem", lineHeight: 1.7 }}
        >
          Upload your job description and batch of resumes. Get AI-ranked candidates with semantic scores, skill gap analysis, and LLM-written explanations — in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
        >
          <button className="btn btn-primary btn-lg" onClick={() => navigate("analyze")}>
            Analyze Resumes →
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => navigate("dashboard")}>
            View Dashboard
          </button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          style={{ display: "flex", gap: "2.5rem", justifyContent: "center", marginTop: "4rem", flexWrap: "wrap" }}
        >
          {[["98%", "Accuracy"], ["< 30s", "Per Resume"], ["50+", "Batch Size"], ["Free", "To Use"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--text)" }}>{v}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 1.5rem" }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.p variants={fadeUp} style={{ fontSize: "0.78rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>How it works</motion.p>
          <motion.h2 variants={fadeUp} style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.8rem, 3vw, 2.6rem)", marginBottom: "3rem" }}>Three steps to hire smarter</motion.h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {STEPS.map(({ n, title, desc }) => (
              <motion.div key={n} variants={fadeUp} className="card" style={{ position: "relative", overflow: "hidden" }}>
                <div style={{ fontSize: "3.5rem", fontFamily: "var(--serif)", color: "var(--border-hover)", lineHeight: 1, marginBottom: "1rem" }}>{n}</div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 8 }}>{title}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 1.5rem" }}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.p variants={fadeUp} style={{ fontSize: "0.78rem", color: "var(--accent2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Features</motion.p>
          <motion.h2 variants={fadeUp} style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.8rem, 3vw, 2.6rem)", marginBottom: "3rem" }}>Everything you need</motion.h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            {FEATURES.map(({ icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="card" style={{ display: "flex", gap: 16 }}>
                <div style={{ fontSize: "1.4rem", color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>{icon}</div>
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 6 }}>{title}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA banner */}
      <section style={{ maxWidth: 1200, margin: "2rem auto 6rem", padding: "0 1.5rem" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{
            background: "linear-gradient(135deg, rgba(108,99,255,0.2) 0%, rgba(0,212,170,0.15) 100%)",
            border: "1px solid var(--border-hover)",
            borderRadius: "var(--radius-xl)",
            padding: "3.5rem 2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "1rem" }}>Ready to hire smarter?</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem", fontSize: "1rem" }}>Start analyzing candidates instantly. No signup required.</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("analyze")}>Get Started Free →</button>
        </motion.div>
      </section>
    </main>
  );
}