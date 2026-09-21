"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) return;

    setLoading(true);
    try {
      const response = await fetch("/api/admin/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat akun.");
      alert("Akun admin berhasil dibuat. Silakan login.");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f7fb",
      padding: "20px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%",
        maxWidth: "400px",
        padding: "32px",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, textAlign: "center" }}>Buat Akun Admin</h1>
        <p style={{ margin: "0 0 8px", color: "#666", textAlign: "center", fontSize: "14px" }}>
          Daftar akun admin baru
        </p>

        {error && (
          <div style={{
            background: "#fff0f2",
            color: "#c73d4d",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "13px",
            marginBottom: "8px"
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@domain.com"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #dfe5ef",
                borderRadius: "9px",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box"
              }}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #dfe5ef",
                borderRadius: "9px",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box"
              }}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: loading ? "#a5a5d9" : "#6d5dfc",
            color: "white",
            border: "none",
            borderRadius: "11px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s"
          }}
        >
          {loading ? "Membuat..." : "Buat Akun"}
        </button>

        <p style={{ margin: "16px 0 0", textAlign: "center", color: "#888", fontSize: "13px" }}>
          <a href="/login" style={{ color: "#6d5dfc", textDecoration: "none" }}>Sudah punya akun? Login</a>
        </p>
      </form>
    </main>
  );
}