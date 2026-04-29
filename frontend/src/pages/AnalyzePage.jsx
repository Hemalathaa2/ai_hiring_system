import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "https://ai-hiring-system-gx0m.onrender.com";

const VALID_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const LOADING_MSGS = [
  "Extracting text from resumes...",
  "Computing semantic embeddings...",
  "Matching skills against job description...",
  "Scoring candidates...",
  "Generating AI explanations...",
  "Almost done...",
];

export default function AnalyzePage({ navigate, setResults, user }) {
  const [jdOption, setJdOption] = useState("text");
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [openings, setOpenings] = useState(5);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const resumeInputRef = useRef();
  const jdInputRef = useRef();
  const intervalRef = useRef();

  // Reset all form state when the page mounts fresh
  // This fixes the blank page issue when clicking "New Analysis"
  useEffect(() => {
    setJdOption("text");
    setJdText("");
    setJdFile(null);
    setResumeFiles([]);
    setOpenings(5);
    setLoading(false);
    setLoadingMsg(0);
    setError("");
    setProgress(0);
    setDragOver(false);
  }, []);

  const startLoadingCycle = () => {
    let i = 0;
    setProgress(5);
    intervalRef.current = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length;
      setLoadingMsg(i);
      setProgress(p => Math.min(p + 12, 92));
    }, 3000);
  };

  const stopLoadingCycle = () => {
    clearInterval(intervalRef.current);
    setProgress(100);
  };

  const addFiles = useCallback((fileList) => {
    const all = Array.from(fileList);
    const valid = all.filter(f => VALID_MIME_TYPES.includes(f.type) || f.name.match(/\.(pdf|docx)$/i));
    const skipped = all.length - valid.length;
    if (skipped > 0) setError(`${skipped} file(s) skipped — only PDF or DOCX accepted`);
    setResumeFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))];
    });
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (idx) => setResumeFiles(prev => prev.filter((_, i) => i !== idx));

  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleSubmit = async () => {
    setError("");

    if (!user) {
      setError("Please log in to analyze resumes.");
      navigate("login");
      return;
    }
    if (jdOption === "text" && !jdText.trim()) { setError("Please paste a job description."); return; }
    if (jdOption === "file" && !jdFile) { setError("Please upload a JD file."); return; }
    if (resumeFiles.length === 0) { setError("Please upload at least one resume."); return; }
    if (resumeFiles.length > 50) { setError("Maximum 50 resumes per batch."); return; }

    setLoading(true);
    setLoadingMsg(0);
    startLoadingCycle();

    try {
      const formData = new FormData();
      if (jdOption === "file" && jdFile) {
        formData.append("jd_file", jdFile);
      } else {
        formData.append("jd_text", jdText);
      }
      resumeFiles.forEach(f => formData.append("files", f));
      formData.append("openings", openings);

      const submitRes = await fetch(`${API_URL}/analyze/`, {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      });

      if (submitRes.status === 401) {
        stopLoadingCycle();
        setLoading(false);
        setError("Session expired. Please log in again.");
        navigate("login");
        return;
      }

      if (!submitRes.ok) {
        const errData = await submitRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error ${submitRes.status}`);
      }

      const { job_id, results } = await submitRes.json();

      if (results) {
        stopLoadingCycle();
        setResults({ results, openings });
        navigate("dashboard");
        return;
      }

      if (job_id) {
        const pollResult = await pollJob(job_id);
        stopLoadingCycle();
        setResults({ results: pollResult, openings });
        navigate("dashboard");
      }
    } catch (e) {
      stopLoadingCycle();
      setLoading(false);
      setProgress(0);
      if (e.message.includes("rate limit") || e.message.includes("429")) {
        setError("Rate limit reached — max 5 analyses per minute. Please wait and try again.");
      } else if (e.message.includes("timeout") || e.message.includes("timed out")) {
        setError("The server took too long. Try with fewer resumes or try again in 30 seconds.");
      } else {
        setError(`Error: ${e.message}`);
      }
    }
  };

  const pollJob = async (jobId) => {
    let delay = 2000;
    const MAX_POLLS = 30;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.3, 8000);

      try {
        const res = await fetch(`${API_URL}/job/${jobId}`, { headers: getAuthHeader() });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === "done") return data.results;
        if (data.status === "error") throw new Error(data.message || "Processing failed");
      } catch (e) {
        if (e.message !== "Processing failed") continue;
        throw e;
      }
    }
    throw new Error("Job timed out after 3 minutes. Try with fewer resumes.");
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.78rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Resume Analyzer</p>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "0.5rem" }}>Analyze Candidates</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Paste your job description, upload resumes, and get AI-powered rankings.</p>
        </div>

        {!user && (
          <div style={{ background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 10, padding: "0.85rem 1.2rem", marginBottom: "1.5rem", fontSize: "0.9rem", color: "var(--accent)" }}>
            You need to{" "}
            <button onClick={() => navigate("login")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600, padding: 0, textDecoration: "underline" }}>
              log in
            </button>
            {" "}to analyze resumes.
          </div>
        )}

        {/* Section 1: JD */}
        <Section number="01" title="Job Description">
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
            {["text", "file"].map(opt => (
              <button key={opt} onClick={() => setJdOption(opt)}
                style={{
                  padding: "0.4rem 1rem", borderRadius: 8, border: "1px solid",
                  borderColor: jdOption === opt ? "var(--accent)" : "var(--border)",
                  background: jdOption === opt ? "rgba(108,99,255,0.12)" : "transparent",
                  color: jdOption === opt ? "var(--accent)" : "var(--text-muted)",
                  fontSize: "0.85rem", cursor: "pointer", fontFamily: "var(--sans)", transition: "all 0.15s",
                }}
              >{opt === "text" ? "Paste Text" : "Upload File"}</button>
            ))}
          </div>

          {jdOption === "text" ? (
            <textarea
              className="input-field"
              placeholder="Paste the full job description here..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              style={{ minHeight: 160 }}
            />
          ) : (
            <div onClick={() => jdInputRef.current?.click()}
              style={{
                border: "1px dashed var(--border-hover)", borderRadius: 10, padding: "2rem",
                textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                background: jdFile ? "rgba(108,99,255,0.06)" : "transparent",
              }}>
              <input ref={jdInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
                onChange={e => setJdFile(e.target.files[0])} />
              {jdFile ? (
                <div style={{ color: "var(--accent)", fontWeight: 500 }}>📄 {jdFile.name}</div>
              ) : (
                <div>
                  <div style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--text-dim)" }}>+</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Click to upload PDF, DOCX, or TXT</div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Section 2: Resumes */}
        <Section number="02" title={`Upload Resumes ${resumeFiles.length > 0 ? `(${resumeFiles.length}/50)` : ""}`}>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => resumeInputRef.current?.click()}
            style={{
              border: `1px dashed ${dragOver ? "var(--accent)" : "var(--border-hover)"}`,
              borderRadius: 12, padding: "2.5rem", textAlign: "center", cursor: "pointer",
              background: dragOver ? "rgba(108,99,255,0.08)" : "transparent",
              transition: "all 0.2s", marginBottom: "1rem",
            }}
          >
            <input ref={resumeInputRef} type="file" multiple accept=".pdf,.docx" style={{ display: "none" }}
              onChange={e => addFiles(e.target.files)} />
            <div style={{ fontSize: "2rem", marginBottom: 10, color: "var(--text-dim)" }}>↑</div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Drag & drop resumes here</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>or click to browse — PDF, DOCX supported · max 50 files · 10MB each</div>
          </div>

          {resumeFiles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
              {resumeFiles.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "var(--bg-card2)", border: "1px solid var(--border)", borderRadius: 8,
                    padding: "0.5rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "var(--accent)", fontSize: "0.9rem" }}>📄</span>
                    <span style={{ fontSize: "0.88rem" }}>{f.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeFile(i); }}
                    style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}>×</button>
                </motion.div>
              ))}
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
                {resumeFiles.length} file{resumeFiles.length > 1 ? "s" : ""} selected
              </div>
            </div>
          )}
        </Section>

        {/* Section 3: Config */}
        <Section number="03" title="Settings">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", minWidth: 160 }}>Number of openings</label>
            <input type="number" min={1} max={50} value={openings} onChange={e => setOpenings(Number(e.target.value))}
              className="input-field" style={{ width: 100 }} />
          </div>
        </Section>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "0.85rem 1.2rem", marginBottom: "1.5rem", fontSize: "0.9rem", color: "#ef4444" }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{LOADING_MSGS[loadingMsg]}</span>
              </div>
              <div className="score-bar-wrap">
                <motion.div className="score-bar-fill"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2))" }}
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 8 }}>
                Processing {resumeFiles.length} resume{resumeFiles.length > 1 ? "s" : ""}...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={loading || !user}
          style={{ width: "100%", justifyContent: "center", opacity: loading || !user ? 0.6 : 1, cursor: loading || !user ? "not-allowed" : "pointer" }}>
          {loading
            ? "Analyzing..."
            : !user
            ? "Log in to Analyze"
            : `Analyze ${resumeFiles.length > 0 ? resumeFiles.length + " " : ""}Candidate${resumeFiles.length !== 1 ? "s" : ""} →`}
        </button>

      </motion.div>
    </main>
  );
}

function Section({ number, title, children }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600, flexShrink: 0,
        }}>{number}</div>
        <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>{title}</h2>
      </div>
      <div style={{ paddingLeft: 40 }}>{children}</div>
      <div style={{ height: 1, background: "var(--border)", marginTop: "2rem" }} />
    </div>
  );
}


// import { useState, useRef, useCallback } from "react";
// import { motion, AnimatePresence } from "framer-motion";

// const API_URL = import.meta.env.VITE_API_URL || "https://ai-hiring-system-gx0m.onrender.com";

// const VALID_MIME_TYPES = [
//   "application/pdf",
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
// ];

// const LOADING_MSGS = [
//   "Extracting text from resumes...",
//   "Computing semantic embeddings...",
//   "Matching skills against job description...",
//   "Scoring candidates...",
//   "Generating AI explanations...",
//   "Almost done...",
// ];

// export default function AnalyzePage({ navigate, setResults, user }) {
//   const [jdOption, setJdOption] = useState("text");
//   const [jdText, setJdText] = useState("");
//   const [jdFile, setJdFile] = useState(null);
//   const [resumeFiles, setResumeFiles] = useState([]);
//   const [openings, setOpenings] = useState(5);
//   const [loading, setLoading] = useState(false);
//   const [loadingMsg, setLoadingMsg] = useState(0);
//   const [error, setError] = useState("");
//   const [progress, setProgress] = useState(0);
//   const [dragOver, setDragOver] = useState(false);
//   const resumeInputRef = useRef();
//   const jdInputRef = useRef();
//   const intervalRef = useRef();

//   const startLoadingCycle = () => {
//     let i = 0;
//     setProgress(5);
//     intervalRef.current = setInterval(() => {
//       i = (i + 1) % LOADING_MSGS.length;
//       setLoadingMsg(i);
//       setProgress(p => Math.min(p + 12, 92));
//     }, 3000);
//   };

//   const stopLoadingCycle = () => {
//     clearInterval(intervalRef.current);
//     setProgress(100);
//   };

//   const addFiles = useCallback((fileList) => {
//     const all = Array.from(fileList);
//     const valid = all.filter(f => VALID_MIME_TYPES.includes(f.type) || f.name.match(/\.(pdf|docx)$/i));
//     const skipped = all.length - valid.length;
//     if (skipped > 0) setError(`${skipped} file(s) skipped — only PDF or DOCX accepted`);
//     setResumeFiles(prev => {
//       const existing = new Set(prev.map(f => f.name + f.size));
//       return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))];
//     });
//   }, []);

//   const handleDrop = useCallback((e) => {
//     e.preventDefault();
//     setDragOver(false);
//     addFiles(e.dataTransfer.files);
//   }, [addFiles]);

//   const removeFile = (idx) => setResumeFiles(prev => prev.filter((_, i) => i !== idx));

//   const getAuthHeader = () => {
//     const token = localStorage.getItem("token");
//     return token ? { Authorization: `Bearer ${token}` } : {};
//   };

//   const handleSubmit = async () => {
//     setError("");

//     if (!user) {
//       setError("Please log in to analyze resumes.");
//       navigate("login");
//       return;
//     }
//     if (jdOption === "text" && !jdText.trim()) { setError("Please paste a job description."); return; }
//     if (jdOption === "file" && !jdFile) { setError("Please upload a JD file."); return; }
//     if (resumeFiles.length === 0) { setError("Please upload at least one resume."); return; }
//     if (resumeFiles.length > 50) { setError("Maximum 50 resumes per batch."); return; }

//     setLoading(true);
//     setLoadingMsg(0);
//     startLoadingCycle();

//     try {
//       const formData = new FormData();
//       if (jdOption === "file" && jdFile) {
//         formData.append("jd_file", jdFile);
//       } else {
//         formData.append("jd_text", jdText);
//       }
//       resumeFiles.forEach(f => formData.append("files", f));
//       formData.append("openings", openings);

//       const submitRes = await fetch(`${API_URL}/analyze/`, {
//         method: "POST",
//         headers: getAuthHeader(),
//         body: formData,
//       });

//       if (submitRes.status === 401) {
//         stopLoadingCycle();
//         setLoading(false);
//         setError("Session expired. Please log in again.");
//         navigate("login");
//         return;
//       }

//       if (!submitRes.ok) {
//         const errData = await submitRes.json().catch(() => ({}));
//         throw new Error(errData.detail || `Server error ${submitRes.status}`);
//       }

//       const { job_id, results } = await submitRes.json();

//       if (results) {
//         stopLoadingCycle();
//         setResults({ results, openings });
//         navigate("dashboard");
//         return;
//       }

//       if (job_id) {
//         const pollResult = await pollJob(job_id);
//         stopLoadingCycle();
//         setResults({ results: pollResult, openings });
//         navigate("dashboard");
//       }
//     } catch (e) {
//       stopLoadingCycle();
//       setLoading(false);
//       setProgress(0);
//       if (e.message.includes("rate limit") || e.message.includes("429")) {
//         setError("Rate limit reached — max 5 analyses per minute. Please wait and try again.");
//       } else if (e.message.includes("timeout") || e.message.includes("timed out")) {
//         setError("The server took too long. Try with fewer resumes or try again in 30 seconds.");
//       } else {
//         setError(`Error: ${e.message}`);
//       }
//     }
//   };

//   // Exponential backoff polling — avoids hammering the server
//   const pollJob = async (jobId) => {
//     let delay = 2000;
//     const MAX_POLLS = 30;
//     for (let i = 0; i < MAX_POLLS; i++) {
//       await new Promise(r => setTimeout(r, delay));
//       delay = Math.min(delay * 1.3, 8000); // max 8s between polls

//       try {
//         const res = await fetch(`${API_URL}/job/${jobId}`, { headers: getAuthHeader() });
//         if (!res.ok) continue;
//         const data = await res.json();
//         if (data.status === "done") return data.results;
//         if (data.status === "error") throw new Error(data.message || "Processing failed");
//       } catch (e) {
//         if (e.message !== "Processing failed") continue; // network hiccup — retry
//         throw e;
//       }
//     }
//     throw new Error("Job timed out after 3 minutes. Try with fewer resumes.");
//   };

//   return (
//     <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
//       <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

//         <div style={{ marginBottom: "2.5rem" }}>
//           <p style={{ fontSize: "0.78rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Resume Analyzer</p>
//           <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "0.5rem" }}>Analyze Candidates</h1>
//           <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Paste your job description, upload resumes, and get AI-powered rankings.</p>
//         </div>

//         {!user && (
//           <div style={{ background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 10, padding: "0.85rem 1.2rem", marginBottom: "1.5rem", fontSize: "0.9rem", color: "var(--accent)" }}>
//             You need to{" "}
//             <button onClick={() => navigate("login")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600, padding: 0, textDecoration: "underline" }}>
//               log in
//             </button>
//             {" "}to analyze resumes.
//           </div>
//         )}

//         {/* Section 1: JD */}
//         <Section number="01" title="Job Description">
//           <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
//             {["text", "file"].map(opt => (
//               <button key={opt} onClick={() => setJdOption(opt)}
//                 style={{
//                   padding: "0.4rem 1rem", borderRadius: 8, border: "1px solid",
//                   borderColor: jdOption === opt ? "var(--accent)" : "var(--border)",
//                   background: jdOption === opt ? "rgba(108,99,255,0.12)" : "transparent",
//                   color: jdOption === opt ? "var(--accent)" : "var(--text-muted)",
//                   fontSize: "0.85rem", cursor: "pointer", fontFamily: "var(--sans)", transition: "all 0.15s",
//                 }}
//               >{opt === "text" ? "Paste Text" : "Upload File"}</button>
//             ))}
//           </div>

//           {jdOption === "text" ? (
//             <textarea
//               className="input-field"
//               placeholder="Paste the full job description here..."
//               value={jdText}
//               onChange={e => setJdText(e.target.value)}
//               style={{ minHeight: 160 }}
//             />
//           ) : (
//             <div onClick={() => jdInputRef.current?.click()}
//               style={{
//                 border: "1px dashed var(--border-hover)", borderRadius: 10, padding: "2rem",
//                 textAlign: "center", cursor: "pointer", transition: "all 0.2s",
//                 background: jdFile ? "rgba(108,99,255,0.06)" : "transparent",
//               }}>
//               <input ref={jdInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
//                 onChange={e => setJdFile(e.target.files[0])} />
//               {jdFile ? (
//                 <div style={{ color: "var(--accent)", fontWeight: 500 }}>📄 {jdFile.name}</div>
//               ) : (
//                 <div>
//                   <div style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--text-dim)" }}>+</div>
//                   <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Click to upload PDF, DOCX, or TXT</div>
//                 </div>
//               )}
//             </div>
//           )}
//         </Section>

//         {/* Section 2: Resumes */}
//         <Section number="02" title={`Upload Resumes ${resumeFiles.length > 0 ? `(${resumeFiles.length}/50)` : ""}`}>
//           <div
//             onDrop={handleDrop}
//             onDragOver={e => { e.preventDefault(); setDragOver(true); }}
//             onDragLeave={() => setDragOver(false)}
//             onClick={() => resumeInputRef.current?.click()}
//             style={{
//               border: `1px dashed ${dragOver ? "var(--accent)" : "var(--border-hover)"}`,
//               borderRadius: 12, padding: "2.5rem", textAlign: "center", cursor: "pointer",
//               background: dragOver ? "rgba(108,99,255,0.08)" : "transparent",
//               transition: "all 0.2s", marginBottom: "1rem",
//             }}
//           >
//             <input ref={resumeInputRef} type="file" multiple accept=".pdf,.docx" style={{ display: "none" }}
//               onChange={e => addFiles(e.target.files)} />
//             <div style={{ fontSize: "2rem", marginBottom: 10, color: "var(--text-dim)" }}>↑</div>
//             <div style={{ fontWeight: 500, marginBottom: 4 }}>Drag & drop resumes here</div>
//             <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>or click to browse — PDF, DOCX supported · max 50 files · 10MB each</div>
//           </div>

//           {resumeFiles.length > 0 && (
//             <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
//               {resumeFiles.map((f, i) => (
//                 <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
//                   style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
//                     background: "var(--bg-card2)", border: "1px solid var(--border)", borderRadius: 8,
//                     padding: "0.5rem 1rem" }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//                     <span style={{ color: "var(--accent)", fontSize: "0.9rem" }}>📄</span>
//                     <span style={{ fontSize: "0.88rem" }}>{f.name}</span>
//                     <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{(f.size / 1024).toFixed(0)} KB</span>
//                   </div>
//                   <button onClick={e => { e.stopPropagation(); removeFile(i); }}
//                     style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}>×</button>
//                 </motion.div>
//               ))}
//               <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
//                 {resumeFiles.length} file{resumeFiles.length > 1 ? "s" : ""} selected
//               </div>
//             </div>
//           )}
//         </Section>

//         {/* Section 3: Config */}
//         <Section number="03" title="Settings">
//           <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
//             <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", minWidth: 160 }}>Number of openings</label>
//             <input type="number" min={1} max={50} value={openings} onChange={e => setOpenings(Number(e.target.value))}
//               className="input-field" style={{ width: 100 }} />
//           </div>
//         </Section>

//         {/* Error */}
//         <AnimatePresence>
//           {error && (
//             <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
//               style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "0.85rem 1.2rem", marginBottom: "1.5rem", fontSize: "0.9rem", color: "#ef4444" }}>
//               {error}
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Loading */}
//         <AnimatePresence>
//           {loading && (
//             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
//               style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
//                 <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
//                 <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{LOADING_MSGS[loadingMsg]}</span>
//               </div>
//               <div className="score-bar-wrap">
//                 <motion.div className="score-bar-fill"
//                   style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2))" }}
//                   animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
//               </div>
//               <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 8 }}>
//                 Processing {resumeFiles.length} resume{resumeFiles.length > 1 ? "s" : ""}...
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Submit */}
//         <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={loading || !user}
//           style={{ width: "100%", justifyContent: "center", opacity: loading || !user ? 0.6 : 1, cursor: loading || !user ? "not-allowed" : "pointer" }}>
//           {loading
//             ? "Analyzing..."
//             : !user
//             ? "Log in to Analyze"
//             : `Analyze ${resumeFiles.length > 0 ? resumeFiles.length + " " : ""}Candidate${resumeFiles.length !== 1 ? "s" : ""} →`}
//         </button>

//       </motion.div>
//     </main>
//   );
// }

// function Section({ number, title, children }) {
//   return (
//     <div style={{ marginBottom: "2rem" }}>
//       <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
//         <div style={{
//           width: 28, height: 28, borderRadius: "50%",
//           background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)",
//           display: "flex", alignItems: "center", justifyContent: "center",
//           fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600, flexShrink: 0,
//         }}>{number}</div>
//         <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>{title}</h2>
//       </div>
//       <div style={{ paddingLeft: 40 }}>{children}</div>
//       <div style={{ height: 1, background: "var(--border)", marginTop: "2rem" }} />
//     </div>
//   );
// }
