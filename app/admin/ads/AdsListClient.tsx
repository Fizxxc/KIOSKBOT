"use client";

import { useState } from "react";
import Link from "next/link";
import { Ad } from "@/lib/types";

export default function AdsListClient({ ads }: { ads: Ad[] }) {
  const [items, setItems] = useState<Ad[]>(ads);
  const [acting, setActing] = useState<string | null>(null);

  async function toggleActive(id: string, next: boolean) {
    setActing(id);
    try {
      const response = await fetch(`/api/admin/ads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || "Gagal");
        return;
      }
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: next } : a)));
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setActing(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus iklan ini?")) return;
    setActing(id);
    try {
      const response = await fetch(`/api/admin/ads/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || "Gagal");
        return;
      }
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setActing(null);
    }
  }

  const dateRange = (ad: Ad) => {
    const parts: string[] = [];
    if (ad.starts_at) parts.push(`Mulai: ${new Date(ad.starts_at).toLocaleString("id-ID")}`);
    if (ad.ends_at) parts.push(`Selesai: ${new Date(ad.ends_at).toLocaleString("id-ID")}`);
    return parts.join(" • ") || "Tanpa jadwal";
  };

  if (!items.length) {
    return <div className="empty">Belum ada iklan. Klik " Tambah Iklan" untuk memulai.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Judul</th>
            <th>Aktif</th>
            <th>Jadwal</th>
            <th>CTA</th>
            <th>Diperbarui</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((ad) => (
            <tr key={ad.id}>
              <td>
                <strong>{ad.title}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{ad.message.slice(0, 50)}{ad.message.length > 50 ? "..." : ""}</div>
              </td>
              <td>
                <span className={`badge ${ad.is_active ? "success" : "warning"}`}>
                  {ad.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td className="muted" style={{ fontSize: 12 }}>{dateRange(ad)}</td>
              <td className="muted" style={{ fontSize: 12 }}>{ad.cta_label || "-"}</td>
              <td className="muted">{new Date(ad.updated_at).toLocaleDateString("id-ID")}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="button ghost small"
                    disabled={acting === ad.id}
                    onClick={() => toggleActive(ad.id, !ad.is_active)}
                  >
                    {ad.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <Link className="button ghost small" href={`/admin/ads/${ad.id}`}>Edit</Link>
                  <button className="button danger small" disabled={acting === ad.id} onClick={() => remove(ad.id)}>
                    Hapus
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}