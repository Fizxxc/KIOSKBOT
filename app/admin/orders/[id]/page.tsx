"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import type { Order } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

const STATUSES: Order["status"][] = ["pending", "paid", "cancelled", "failed"];

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

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Order["status"]>("pending");

  async function fetchOrder() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${id}`);
      const json: { data?: Order; error?: string } = await response.json();
      if (!response.ok || !json.data) throw new Error(json.error || "Pesanan tidak ditemukan.");
      setOrder(json.data);
      setSelectedStatus(json.data.status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveStatus() {
    if (!order || !id) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      });
      const json: { data?: Order; error?: string } = await response.json();
      if (!response.ok || !json.data) throw new Error(json.error || "Gagal memperbarui status.");
      setOrder(json.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="empty">Memuat pesanan...</p>;
  if (error) return <p className="notice error">{error}</p>;
  if (!order) return null;

  const itemsTotal = (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Pesanan {order.order_number}</h1>
          <p>Status: <span className={`badge ${statusBadge(order.status)}`}>{order.status}</span> · Bayar: <span className={`badge ${order.paid_at ? "success" : "warning"}`}>{order.paid_at ? "Lunas" : order.payment_status}</span></p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="button ghost small" onClick={() => void fetchOrder()} disabled={loading}>
            <RefreshCw size={14} />
          </button>
          <Link className="button ghost small" href="/admin/orders">
            <ArrowLeft size={14} /> Kembali
          </Link>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Informasi Pesanan</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveStatus();
            }}
            style={{ display: "flex", gap: 9, alignItems: "center" }}
          >
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Status:</label>
            <select
              className="select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as Order["status"])}
              style={{ width: 150, fontSize: 13 }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="button small" type="submit" disabled={saving || selectedStatus === order.status}>
              <Save size={13} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </form>
        </div>
        <div className="panel-body">
          <div className="detail-grid">
            <div>
              <div className="key-value">
                <span>Nomor Order</span>
                <span>{order.order_number}</span>
              </div>
              <div className="key-value">
                <span>Order ID</span>
                <span className="code" style={{ fontSize: 12 }}>{order.id}</span>
              </div>
              <div className="key-value">
                <span>Telegram User ID</span>
                <span>{order.telegram_user_id}</span>
              </div>
              <div className="key-value">
                <span>Status</span>
                <span className={`badge ${statusBadge(order.status)}`}>{order.status}</span>
              </div>
              <div className="key-value">
                <span>Payment Status</span>
                <span className="muted">{order.payment_status}</span>
              </div>
            </div>
            <div>
              <div className="key-value">
                <span>Total</span>
                <span>{formatRupiah(order.total_amount)}</span>
              </div>
              <div className="key-value">
                <span>Mata Uang</span>
                <span>{order.currency}</span>
              </div>
              <div className="key-value">
                <span>Payment Type</span>
                <span className="muted">{order.payment_type ?? "-"}</span>
              </div>
              <div className="key-value">
                <span>Fraud Status</span>
                <span className="muted">{order.fraud_status ?? "-"}</span>
              </div>
              <div className="key-value">
                <span>Dibayar Pada</span>
                <span className="muted">{order.paid_at ? new Date(order.paid_at).toLocaleString("id-ID") : "-"}</span>
              </div>
              <div className="key-value">
                <span>Kadaluarsa</span>
                <span className="muted">{order.expires_at ? new Date(order.expires_at).toLocaleString("id-ID") : "-"}</span>
              </div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "18px 0" }} />

          <h3 style={{ margin: "12px 0 6px", fontSize: 15 }}>Item Pesanan ({itemsTotal})</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Qty</th>
                  <th>Gula</th>
                  <th>Harga Satuan</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.product_name}</strong>{item.note ? <small>{item.note}</small> : null}</td>
                    <td className="muted">{item.category === "food" ? "🍽 Makanan" : "🥤 Minuman"}</td>
                    <td>{item.quantity}</td>
                    <td className="muted">{item.sugar_level ?? "-"}</td>
                    <td>{formatRupiah(item.unit_price)}</td>
                    <td>{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: "right", fontWeight: 800 }}>
                    Total
                  </td>
                  <td>{formatRupiah(order.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
