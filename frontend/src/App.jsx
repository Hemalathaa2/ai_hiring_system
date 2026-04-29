import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import AnalyzePage from "./pages/AnalyzePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Navbar from "./components/Navbar";
import "./index.css";

export default function App() {
  const [page, setPage] = useState("home");
  // analyzeKey forces AnalyzePage to fully remount and reset state
  // every time the user navigates to it — fixes blank page on "New Analysis"
  const [analyzeKey, setAnalyzeKey] = useState(0);

  const [user, setUser] = useState(() => localStorage.getItem("email") || null);

  const login = (email, token) => {
    localStorage.setItem("email", email);
    localStorage.setItem("token", token);
    setUser(email);
  };

  const logout = () => {
    localStorage.removeItem("email");
    localStorage.removeItem("token");
    setUser(null);
    setPage("home");
  };

  const [results, setResults] = useState(() => {
    try {
      const raw = sessionStorage.getItem("results");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const saveResults = (r) => {
    setResults(r);
    try {
      sessionStorage.setItem("results", JSON.stringify(r));
    } catch (e) {
      console.warn("Could not persist results to sessionStorage:", e);
    }
  };

  const navigate = (p) => {
    // Every time user navigates to analyze, bump the key so it remounts fresh
    if (p === "analyze") {
      setAnalyzeKey(k => k + 1);
    }
    setPage(p);
  };

  return (
    <div className="app-root">
      <Navbar page={page} navigate={navigate} user={user} onLogout={logout} />
      <AnimatePresence mode="wait">
        {page === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <HomePage navigate={navigate} user={user} />
          </motion.div>
        )}
        {page === "analyze" && (
          <motion.div key={`analyze-${analyzeKey}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AnalyzePage navigate={navigate} setResults={saveResults} user={user} />
          </motion.div>
        )}
        {page === "dashboard" && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <DashboardPage results={results} navigate={navigate} />
          </motion.div>
        )}
        {page === "login" && (
          <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LoginPage navigate={navigate} onLogin={login} />
          </motion.div>
        )}
        {page === "signup" && (
          <motion.div key="signup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SignupPage navigate={navigate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
