import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clientLogin, isClientLoggedIn } from "../utils/clientStorage";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isClientLoggedIn()) {
      const from = location?.state?.from;
      navigate(typeof from === "string" && from ? from : "/", { replace: true });
    }
  }, [location?.state?.from, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await clientLogin({ email: email.trim(), password });
      if (!res.ok) {
        setError(res.message || "Login failed.");
        return;
      }
      const from = location?.state?.from;
      navigate(typeof from === "string" && from ? from : "/", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 6 }}>Client Login</h2>
      

      <form
        onSubmit={onSubmit}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <label style={{ display: "block", marginBottom: 6 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 12,
          }}
        />

        <label style={{ display: "block", marginBottom: 6 }}>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="******"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 12,
          }}
        />

        {error ? (
          <div
            style={{
              background: "#ffe5e5",
              border: "1px solid #ffb3b3",
              color: "#8a1f1f",
              padding: 10,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: "#111",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            ← Back to site
          </Link>
          <Link to="/register" style={{ textDecoration: "none" }}>
            Create account →
          </Link>
          <Link to="/admin/login" style={{ textDecoration: "none" }}>
            Admin login →
          </Link>
        </div>
      </div>
    </div>
  );
}


