import { useState } from "react";
import { toast } from "react-toastify";
import { apiUrl } from "../utils/apiBase";

export default function Contact() {
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function readJson(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const trimmedFname = String(fname || "").trim();
    const trimmedLname = String(lname || "").trim();
    const trimmedEmail = String(email || "").trim();
    const trimmedMessage = String(message || "").trim();

    if (!trimmedFname || !trimmedLname || !trimmedEmail || !trimmedMessage) {
      toast.error("Please fill in all fields.");
      return;
    }

    setSaving(true);
    try {
      // Backend should insert this into DB table: `feedback`
      // Expected route: POST /api/feedback
      const res = await fetch(apiUrl("/api/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${trimmedFname} ${trimmedLname}`.trim(),
          // optional extra fields (backend can ignore these)
          fname: trimmedFname,
          lname: trimmedLname,
          email: trimmedEmail,
          message: trimmedMessage,
        }),
      });

      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to send message (HTTP ${res.status}).`
        );
      }

      setFname("");
      setLname("");
      setEmail("");
      setMessage("");
      toast.success("Thanks! Your message has been sent.");
    } catch (err) {
      toast.error(err?.message || "Failed to send message.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px", margin: "auto" }}>
      <h2>Contact Us</h2>
      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <label className="label-control">Fname</label>
        <input
          className="form-control"
          type="text"
          placeholder="Enter your first name..."
          required
          value={fname}
          onChange={(e) => setFname(e.target.value)}
          disabled={saving}
        />
        <label className="label-control">Lname</label>
        <input
          className="form-control"
          type="text"
          placeholder="Enter your last name..."
          required
          value={lname}
          onChange={(e) => setLname(e.target.value)}
          disabled={saving}
        />
        <label htmlFor="email">Email: </label>
        <input
          className="form-control"
          type="email"
          placeholder="Enter your email..."
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={saving}
        />
        <label>Message: </label>
        <textarea
          className="form-control"
          placeholder="Enter your message..."
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={saving}
          rows={5}
        />
        <button
          type="submit"
          disabled={saving}
          style={{
            backgroundColor: "#007bff",
            color: "white",
            padding: "10px",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.8 : 1,
          }}
        >
          {saving ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
