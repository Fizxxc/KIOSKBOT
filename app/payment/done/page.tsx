import { CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PaymentDonePage() {
  return (
    <main className="login-page">
      <section className="login-card" style={{ textAlign: "center" }}>
        <div className="brand-mark" style={{ margin: "0 auto 16px" }}><CheckCircle2 size={24} /></div>
        <h1>Pembayaran selesai</h1>
        <p>Terima kasih. Status pesanan akan terus diperbarui oleh bot Telegram setelah verifikasi Midtrans diterima.</p>
        <div className="form-actions" style={{ justifyContent: "center" }}><Link className="button primary" href="/"><ArrowLeft size={16} /> Kembali ke beranda</Link></div>
      </section>
    </main>
  );
}
