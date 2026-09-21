"use client";

import { useState } from "react";
import Link from "next/link";
import { Broadcast } from "@/lib/types";
import { Play, Pause, RefreshCw, Trash2 } from "lucide-react";

export default function BroadcastListClient({ broadcasts }: { broadcasts: Broadcast[] }) {
  const [items, setItems] = useState<Broadcast[]>(broadcasts);
  const [acting, setActing] = useState<string | null>(null);

  async function action(id: string, endpoint: string, method: "POST" | "PATCH" | "DELETE" = "POST", body?: Record<string, unknown>) {
    setActing(id);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || "Gagal");
        return;
      }
      if (method === "DELETE") {
        setItems((prev) => prev.filter((b) => b.id !== id));
        return;
      }
      const data = await response.json();
      setItems((prev) => prev.map((b) => (b.id === id ? { ...b, ...data.broadcast } : b)));
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setActing(null);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "info",
      running: "warning",
      completed: "success",
      failed: "danger",
      paused: "info",
    };
    return <span className={`badge ${map[status] || "info"}`}>{status}</span>;
  };

  if (!items.length) {
    return <div className="empty">Belum ada broadcast. Klik "Buat Draft" untuk memulai.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Judul</th>
            <th>Status</th>
            <th>Dikirim</th>
            <th>Gagal</th>
            <th>Menunggu</th>
            <th>Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id}>
              <td>
                <strong>{b.title}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{b.message.slice(0, 60)}{b.message.length > 60 ? "..." : ""}</div>
              </td>
              <td>{statusBadge(b.status)}</td>
              <td>{b.sent_count ?? 0}</td>
              <td>{b.failed_count ?? 0}</td>
              <td>{(b as any).pending_count ?? 0}</td>
              <td className="muted">{new Date(b.created_at).toLocaleDateString("id-ID")}</td>
              <td>
                <div className="row-actions">
                  {b.status === "draft" && (
                    <button className="button primary small" disabled={acting === b.id} onClick={() => action(b.id, `/api/admin/broadcasts/${b.id}/send`, "POST", { batch_size: 25 })}>
                      <Play size={14} /> Kirim
                    </button>
                  )}
                  {b.status === "running" && (
                    <button className="button ghost small" disabled={acting === b.id} onClick={() => action(b.id, `/api/admin/broadcasts/${b.id}`, "PATCH", { status: "paused" })}>
                      <Pause size={14} /> Pause
                    </button>
                  )}
                  {(b.status === "paused" || b.status === "failed") && (
                    <button className="button ghost small" disabled={acting === b.id} onClick={() => action(b.id, `/api/admin/broadcasts/${b.id}/retry`, "POST", { batch_size: 25 })}>
                      <RefreshCw size={14} /> Retry
                    </button>
                  )}
                  <Link className="button ghost small" href={`/admin/broadcasts/${b.id}`}>Detail</Link>
                  <button className="button danger small" disabled={acting === b.id} onClick={() => action(b.id, `/api/admin/broadcasts/${b.id}`, "DELETE")}>
                    <Trash2 size={14} />
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