"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Ad } from "@/lib/types";

function toInputValue(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export default function AdForm({ initial, adId }: { initial?: Partial<Ad>; adId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    message: initial?.message ?? "",
    image_url: initial?.image_url ?? "",
    cta_label: initial?.cta_label ?? "",
    cta_url: initial?.cta_url ?? "",
    is_active: initial?.is_active ?? true,
    starts_at: toInputValue(initial?.starts_at),
    ends_at: toInputValue(initial?.ends_at),
    sort_order: String(initial?.sort_order ?? 0),
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: unknown) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.title.trim() || !form.message.trim()) {
      setError("Judul dan pesan wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        image_url: form.image_url.trim() || null,
        cta_label: form.cta_label.trim() || null,
        cta_url: form.cta_url.trim() || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        sort_order: Number(form.sort_order) || 0,
      };
      const response = await fetch(adId ? `/api/admin/ads/${adId}` : "/api/admin/ads", {
        method: adId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan iklan.");
      router.replace("/admin/ads");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label>Judul Iklan</label><input className="input" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Promo hari ini" /></div>
        <div className="field"><label>Urutan Tampilan</label><input className="input" type="number" value={form.sort_order} onChange={(e) => update("sort_order", e.target.value)} /></div>
        <div className="field full"><label>Pesan Iklan</label><textarea className="textarea" required value={form.message} onChange={(e) => update("message", e.target.value)} rows={4} /></div>
        <div className="field full"><label>URL Gambar (opsional)</label><input className="input" value={form.image_url} onChange={(e) => update("image_url", e.target.value)} placeholder="https://..." /></div>
        <div className="field"><label>Label Tombol (opsional)</label><input className="input" value={form.cta_label} onChange={(e) => update("cta_label", e.target.value)} placeholder="Lihat Promo" /></div>
        <div className="field"><label>URL Tombol (opsional)</label><input className="input" value={form.cta_url} onChange={(e) => update("cta_url", e.target.value)} placeholder="https://..." /></div>
        <div className="field"><label>Mulai (opsional)</label><input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} /></div>
        <div className="field"><label>Selesai (opsional)</label><input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} /></div>
        <div className="field" style={{ alignItems: "flex-end" }}><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} /> Aktif</label></div>
      </div>
      {error && <div className="notice error" style={{ marginTop: 14 }}>{error}</div>}
      <div className="form-actions">
        <button className="button ghost" type="button" onClick={() => router.replace("/admin/ads")}>Batal</button>
        <button className="button primary" disabled={loading}>{loading ? "Menyimpan..." : adId ? "Perbarui" : "Simpan"}</button>
      </div>
    </form>
  );
}
