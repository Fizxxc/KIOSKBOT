"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import type { Order } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

type ListResponse = { data: Order[]; count: number; page: number; limit: number };

const STATUS_TABS = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "paid", label: "Lunas" },
  { value: "cancelled", label: "Dibatalkan" },
  { value: "failed", label: "Gagal" },
] as const;

function statusBadge(status: Order["status"]) {
  switch (status) {
    case "paid":
      return "success";
    case "cancelled":
    case "failed":
      return "danger";
    default:
      return "warning";
  }
}

function paymentBadge(paymentStatus: Order["payment_status"]) {
  const ps = String(paymentStatus).toLowerCase();
  if (ps === "settlement" || ps === "capture") return "success";
  if (ps === "pending" || ps === "waiting") return "warning";
  if (["expire", "cancel", "deny", "failed"].includes(ps)) return "danger";
  return "info";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  async function fetchOrders() {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/admin/orders", window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      if (status !== "all") url.searchParams.set("status", status);
      if (debouncedSearch) url.searchParams.set("q", debouncedSearch);
      const response = await fetch(url.toString());
      const json: ListResponse | { error: string } = await response.json();
      if (!response.ok || "error" in json) {
        throw new Error((json as { error?: string }).error || "Gagal memuat pesanan.");
      }
      setOrders(json.data);
      setCount(json.count);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status]);

  const totalPages = Math.max(1, Math.ceil(count / limit));

  const statTotals = orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<Order["status"], number>,
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Pesanan</h1>
          <p> pantau dan kelola semua pesanan pelanggan.</p>
        </div>
        <button className="button ghost small" onClick={() => void fetchOrders()} disabled={loading}>
          <RefreshCw size={14} /> {loading ? "Menyegarkan..." : "Refresh"}
        </button>
      </header>

      {error && <div className="notice error">{error}</div>}

      <section className="stats-grid">
        {STATUS_TABS.slice(1).map((tab) => (
          <article className="stat-card" key={tab.value}>
            <div className="stat-label">{tab.label}</div>
            <div className={`stat-value ${tab.value === "paid" ? "stat-note" : ""}`}>{statTotals[tab.value as Order["status"]] ?? 0}</div>
          </article>
        ))}
        <article className="stat-card">
          <div className="stat-label">Total Ditampilkan</div>
          <div className="stat-value">{count}</div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header" style={{ gridTemplateColumns: "repeat(5, 1fr) auto" }}>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={`button small ${status === tab.value ? "primary" : "ghost"}`}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: "1 / -1" }}>
            <Search size={14} />
            <input
              className="input"
              placeholder="Cari nomor order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, maxWidth: "100%", fontSize: 13 }}
            />
          </div>
          <span className="stat-note" style={{ gridColumn: "1 / -1" }}>
            {orders.length} dari {count} pesanan
          </span>
          <div />
          <div />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>User</th>
                <th>Status</th>
                <th>Pembayaran</th>
                <th>Total</th>
                <th>Dibuat</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    {debouncedSearch || status !== "all" ? "Tidak ada pesanan sesuai filter." : "Belum ada pesanan."}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.order_number}</strong>
                    </td>
                    <td className="muted">{order.telegram_user_id}</td>
                    <td>
                      <span className={`badge ${statusBadge(order.status)}`}>{order.status}</span>
                    </td>
                    <td>
                      <span className={`badge ${paymentBadge(order.payment_status)}`}>{order.payment_status}</span>
                    </td>
                    <td>{formatRupiah(order.total_amount)}</td>
                    <td className="muted">{new Date(order.created_at).toLocaleString("id-ID")}</td>
                    <td className="row-actions">
                      <Link className="button ghost small" href={`/admin/orders/${order.id}`} style={{ pointerEvents: loading ? "none" : "auto" }}>
                        Lihat
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-header" style={{ justifyContent: "flex-end", gap: 10 }}>
          <span className="stat-note">
            Halaman {page} dari {totalPages}
          </span>
          <button className="button ghost small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
            <ChevronLeft size={14} />
          </button>
          <button className="button ghost small" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
            <ChevronRight size={14} />
          </button>
        </div>
      </section>
    </>
  );
}
