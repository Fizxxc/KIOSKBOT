"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BroadcastForm({ totalUsers }: { totalUsers: number }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", message: "", cta_label: "", cta_url: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.title.trim() || !form.message.trim()) {
      setError("Judul dan pesan wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal membuat broadcast.");
      router.push(`/admin/broadcasts/${data.broadcast.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-grid">
      {error && <div className="notice error" style={{ gridColumn: "1 / -1" }}>{error}</div>}
      <div className="field full">
        <label>Judul Broadcast</label>
        <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Promo Akhir Tahun" required />
      </div>
      <div className="field full">
        <label>Pesan</label>
        <textarea className="textarea" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tulis pesan broadcast..." required />
      </div>
      <div className="field">
        <label>CTA Label (opsional)</label>
        <input className="input" value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="Contoh: Lihat Promo" />
      </div>
      <div className="field">
        <label>CTA URL (opsional)</label>
        <input className="input" value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="https://..." />
      </div>
      <div className="field full" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 13 }}>Draft akan mencakup {totalUsers} user aktif saat dikirim.</span>
      </div>
      <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
        <Link className="button ghost" href="/admin/broadcasts">Batal</Link>
        <button className="button primary" disabled={loading}>{loading ? "Menyimpan..." : "Simpan Draft"}</button>
      </div>
    </form>
  );
}