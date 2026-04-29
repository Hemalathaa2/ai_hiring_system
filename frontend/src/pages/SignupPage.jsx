import { useState } from "react";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "https://ai-hiring-system-gx0m.onrender.com";

export default function SignupPage({ navigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const signup = async () => {
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Signup failed");
      navigate("login");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: "5rem auto", padding: "0 1.5rem" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "2rem", marginBottom: 8 }}>Create account</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Start analyzing resumes with AI</p>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.75rem 1rem", fontSize: "0.88rem", color: "#ef4444" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Email</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Password</label>
            <input className="input-field" type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Confirm Password</label>
            <input className="input-field" type="password" placeholder="Repeat your password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && signup()} />
          </div>

          <button
            className="btn btn-primary"
            onClick={signup}
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <button onClick={() => navigate("login")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.85rem" }}>
              Log in
            </button>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
