"use client";

import { useState } from "react";
import { Broadcast, BroadcastRecipient, BroadcastSendJob } from "@/lib/types";

export default function BroadcastDetailClient({
  broadcast,
  recipients,
  job,
  stats,
}: {
  broadcast: Broadcast;
  recipients: BroadcastRecipient[];
  job: BroadcastSendJob | null;
  stats: { sent: number; failed: number; pending: number; total: number };
}) {
  const [status, setStatus] = useState(broadcast.status);
  const [acting, setActing] = useState(false);

  async function runAction(endpoint: string, method: "POST" | "PATCH" | "DELETE" = "POST", body?: Record<string, unknown>) {
    setActing(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || "Gagal");
        return;
      }
      if (data.broadcast) setStatus(data.broadcast.status);
      if (data.done) alert("Selesai");
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setActing(false);
    }
  }

  const progress = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;

  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Progress Pengiriman</h2>
          <span className="badge info">{status}</span>
        </div>
        <div className="panel-body">
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 10, background: "#eef2f7", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "var(--primary)", transition: "width .3s" }} />
            </div>
          </div>
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <article className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{stats.total}</div></article>
            <article className="stat-card"><div className="stat-label">Terkirim</div><div className="stat-value">{stats.sent}</div></article>
            <article className="stat-card"><div className="stat-label">Gagal</div><div className="stat-value">{stats.failed}</div></article>
            <article className="stat-card"><div className="stat-label">Menunggu</div><div className="stat-value">{stats.pending}</div></article>
          </div>
          {job && (
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
              Job: {job.status} • Batch: {job.batch_size} • Throttle: {job.throttle_ms}ms
              {job.error && <div style={{ color: "var(--danger)" }}>Error: {job.error}</div>}
            </div>
          )}
          <div className="form-actions" style={{ marginTop: 16 }}>
            {status === "draft" && (
              <button className="button primary" disabled={acting} onClick={() => runAction(`/api/admin/broadcasts/${broadcast.id}/send`, "POST", { batch_size: 25 })}>
                Mulai Kirim Batch
              </button>
            )}
            {status === "running" && (
              <button className="button ghost" disabled={acting} onClick={() => runAction(`/api/admin/broadcasts/${broadcast.id}`, "PATCH", { status: "paused" })}>
                Pause
              </button>
            )}
            {(status === "paused" || status === "failed") && (
              <button className="button ghost" disabled={acting} onClick={() => runAction(`/api/admin/broadcasts/${broadcast.id}/retry`, "POST", { batch_size: 25 })}>
                Retry Kirim
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Detail Broadcast</h2>
        </div>
        <div className="panel-body">
          <div className="field full" style={{ marginBottom: 12 }}>
            <label>Pesan</label>
            <div className="code" style={{ whiteSpace: "pre-wrap" }}>{broadcast.message}</div>
          </div>
          {broadcast.cta_label && (
            <div className="field full" style={{ marginBottom: 12 }}>
              <label>CTA</label>
              <div className="muted" style={{ fontSize: 13 }}>{broadcast.cta_label} → {broadcast.cta_url}</div>
            </div>
          )}
          <div className="field full" style={{ marginBottom: 12 }}>
            <label>Dibuat</label>
            <div className="muted" style={{ fontSize: 13 }}>{new Date(broadcast.created_at).toLocaleString("id-ID")}</div>
          </div>
          {broadcast.completed_at && (
            <div className="field full">
              <label>Selesai</label>
              <div className="muted" style={{ fontSize: 13 }}>{new Date(broadcast.completed_at).toLocaleString("id-ID")}</div>
            </div>
          )}
        </div>
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="panel-header">
          <h2>Recipient ({recipients.length})</h2>
        </div>
        <div className="panel-body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Status</th>
                  <th>Waktu Kirim</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {recipients.length === 0 ? (
                  <tr><td colSpan={4} className="empty">Belum ada recipient</td></tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.id}>
                      <td><code>{r.telegram_user_id}</code></td>
                      <td>
                        <span className={`badge ${
                          r.status === "sent" ? "success" :
                          r.status === "failed" ? "danger" :
                          r.status === "retry" ? "warning" : "info"
                        }`}>{r.status}</span>
                      </td>
                      <td className="muted">{r.sent_at ? new Date(r.sent_at).toLocaleString("id-ID") : "-"}</td>
                      <td className="muted" style={{ fontSize: 12, maxWidth: 300, overflowWrap: "anywhere" }}>{r.error || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}