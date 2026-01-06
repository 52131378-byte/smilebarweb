import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminRegister, isAdminLoggedIn } from "../../utils/adminStorage";

export default function AdminRegister() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdminLoggedIn()) navigate("/admin", { replace: true });
  }, [navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const u = String(username || "").trim();
    const e1 = String(email || "").trim().toLowerCase();

    if (!u) return setError("Username is required.");
    if (!e1) return setError("Email is required.");
    if (!e1.includes("@")) return setError("Email is not valid.");
    if (!password || password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword)
      return setError("Passwords do not match.");

    setLoading(true);
    try {
      const res = await adminRegister({ username: u, email: e1, password });
      if (!res.ok) {
        setError(res.message || "Register failed.");
        return;
      }

      setSuccess("Admin registered successfully. Please login.");
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => navigate("/admin/login", { replace: true }), 900);
    } catch (err) {
      setError(err?.message || "Register failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 20 }}>
      <h2 style={{ marginBottom: 6 }}>Admin Register</h2>
      
      <form
        onSubmit={onSubmit}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <label style={{ display: "block", marginBottom: 6 }}>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 12,
          }}
        />

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
          placeholder="******"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 12,
          }}
        />

        <label style={{ display: "block", marginBottom: 6 }}>
          Confirm Password
        </label>
        <input
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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

        {success ? (
          <div
            style={{
              background: "#e6ffed",
              border: "1px solid #b7f0c3",
              color: "#1f5f2b",
              padding: 10,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {success}
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
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <div style={{ marginTop: 14, display: "flex", gap: 14 }}>
        <Link to="/admin/login" style={{ textDecoration: "none" }}>
          ← Back to admin login
        </Link>
        <Link to="/" style={{ textDecoration: "none" }}>
          Back to site →
        </Link>
      </div>
    </div>
  );
}


