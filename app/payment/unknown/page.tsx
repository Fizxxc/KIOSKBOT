import { ArrowLeft, CircleAlert } from "lucide-react";
import Link from "next/link";

export default function PaymentUnknownPage() {
  return (
    <main className="login-page">
      <section className="login-card" style={{ textAlign: "center" }}>
        <div className="brand-mark" style={{ margin: "0 auto 16px" }}><CircleAlert size={24} /></div>
        <h1>Pesanan tidak ditemukan</h1>
        <p>Link pembayaran tidak valid atau sudah tidak tersedia.</p>
        <div className="form-actions" style={{ justifyContent: "center" }}><Link className="button primary" href="/"><ArrowLeft size={16} /> Kembali ke beranda</Link></div>
      </section>
    </main>
  );
}
