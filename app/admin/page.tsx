import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";
import { ArrowRight, ClipboardList, Package, Users, WalletCards } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const db = createSupabaseAdminClient();
  const [{ data: orderCount }, { data: revenue }, { data: users }, { data: products }, { data: recentOrders }] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }),
    db.from("orders").select("total_amount").eq("status", "paid"),
    db.from("telegram_users").select("id", { count: "exact", head: true }),
    db.from("products").select("id", { count: "exact", head: true }),
    db.from("orders").select("id, order_number, status, payment_status, total_amount, currency, created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  const totalRevenue = (revenue || []).reduce((sum, order) => sum + order.total_amount, 0);
  return (
    <>
      <header className="admin-header"><div><h1>Ringkasan</h1><p>Pantau performa bot dan bisnis dalam satu tampilan.</p></div><Link className="button primary" href="/admin/products">Tambah Produk</Link></header>
      <section className="stats-grid">
        <article className="stat-card"><div className="stat-label">Total Pesanan</div><div className="stat-value">{Number(orderCount ?? 0)}</div><div className="stat-note"><ClipboardList size={13} /> Semua waktu</div></article>
        <article className="stat-card"><div className="stat-label">Pendapatan</div><div className="stat-value">{formatRupiah(totalRevenue)}</div><div className="stat-note">Sudah dibayar</div></article>
        <article className="stat-card"><div className="stat-label">User Telegram</div><div className="stat-value">{Number(users ?? 0)}</div><div className="stat-note"><Users size={13} /> Tersimpan di database</div></article>
        <article className="stat-card"><div className="stat-label">Produk Aktif</div><div className="stat-value">{Number(products ?? 0)}</div><div className="stat-note"><Package size={13} /> Katalog bot</div></article>
      </section>
      <section className="panel">
        <div className="panel-header"><h2>Pesanan terbaru</h2><Link className="button ghost small" href="/admin/orders">Lihat semua <ArrowRight size={14} /></Link></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Status</th><th>Pembayaran</th><th>Total</th><th>Waktu</th></tr></thead><tbody>{recentOrders?.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong></td><td><span className={`badge ${order.status === "paid" ? "success" : "warning"}`}>{order.status}</span></td><td className="muted">{order.payment_status}</td><td>{formatRupiah(order.total_amount)}</td><td className="muted">{new Date(order.created_at).toLocaleString("id-ID")}</td></tr>) || <tr><td colSpan={5} className="empty">Belum ada pesanan</td></tr>}</tbody></table></div>
      </section>
    </>
  );
}
