import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock3, CreditCard } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const { data: order } = await createSupabaseAdminClient()
    .from("orders")
    .select("id, order_number, status, payment_status, payment_url, snap_redirect_url, total_amount, currency, expires_at")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    redirect("/payment/unknown");
  }

  if (order.status === "paid" || order.payment_status === "settlement" || order.payment_status === "capture") {
    redirect(`/payment/done?order=${encodeURIComponent(order.order_number)}`);
  }

  if (order.snap_redirect_url) {
    redirect(order.snap_redirect_url);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark" style={{ marginBottom: 16 }}><CreditCard size={19} /></div>
        <h1>Pembayaran belum tersedia</h1>
        <p>Link Snap untuk pesanan {order.order_number} belum tersedia. Silakan buat pesanan ulang melalui bot Telegram.</p>
        <div className="key-value"><span>Status</span><span>{order.payment_status}</span></div>
        <div className="key-value"><span>Total</span><span>Rp {order.total_amount.toLocaleString("id-ID")}</span></div>
        <div className="form-actions"><Link className="button primary" href="/"><ArrowLeft size={16} /> Kembali</Link></div>
      </section>
    </main>
  );
}
