export default function Navbar({ page, navigate, user, onLogout }) {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      borderBottom: "1px solid var(--border)",
      background: "rgba(10,10,15,0.85)",
      backdropFilter: "blur(20px)",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem",
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>

        {/* Logo */}
        <button onClick={() => navigate("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>R</div>
          <span style={{ fontFamily: "var(--serif)", fontSize: "1.2rem", color: "var(--text)" }}>ResumeAI</span>
        </button>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[
            { key: "home", label: "Home" },
            { key: "analyze", label: "Analyze" },
            { key: "dashboard", label: "Dashboard" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => navigate(key)} style={{
              background: page === key ? "var(--bg-elevated)" : "none",
              border: page === key ? "1px solid var(--border-hover)" : "1px solid transparent",
              borderRadius: 8, padding: "0.4rem 0.9rem",
              color: page === key ? "var(--text)" : "var(--text-muted)",
              fontFamily: "var(--sans)", fontSize: "0.88rem", cursor: "pointer",
              transition: "all 0.15s", fontWeight: page === key ? 500 : 400,
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Auth area */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {user ? (
            <>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user}
              </span>
              <button className="btn btn-ghost" onClick={onLogout} style={{ fontSize: "0.85rem" }}>
                Log out
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => navigate("login")} style={{ fontSize: "0.85rem" }}>
                Log in
              </button>
              <button className="btn btn-primary" onClick={() => navigate("signup")} style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem" }}>
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
