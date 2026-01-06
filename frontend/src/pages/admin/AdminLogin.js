import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  adminLogin,
  isAdminLoggedIn,
} from "../../utils/adminStorage";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdminLoggedIn()) navigate("/admin", { replace: true });
  }, [navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await adminLogin({ email: email.trim(), password });
      if (!res.ok) {
        setError(res.message || "Login failed.");
        return;
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 6 }}>Admin Login</h2>
      

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
          placeholder="admin@example.com"
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
          placeholder="admin123"
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
        <div style={{ display: "flex", gap: 14 }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            ← Back to site
          </Link>
          <Link to="/admin/register" style={{ textDecoration: "none" }}>
            Create admin account →
          </Link>
        </div>
      </div>
    </div>
  );
}


