import Link from "next/link";
import { ArrowRight, Bot, ChartNoAxesCombined, MessageCircle, ShieldCheck, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <main className="home-page">
      <header className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><Zap size={16} /> Fullstack Telegram Commerce</div>
            <h1>Pesanan mengalir dari Telegram, kelola dari satu dashboard.</h1>
            <p>Bot Telegram dengan menu interaktif, katalog produk, catatan pesanan, pilihan sugar, pembayaran Midtrans Snap, broadcast, dan notifikasi realtime.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/admin/login">Buka Dashboard <ArrowRight size={17} /></Link>
              <a className="button secondary" href="https://core.telegram.org/bots/webhooks" target="_blank" rel="noreferrer">Pelajari Webhook</a>
            </div>
          </div>
          <div className="hero-card" aria-label="Preview alur bot">
            <div className="phone">
              <div className="phone-top"><span></span><span></span><span></span></div>
              <div className="chat-bubble bot">Halo! Mau pesan makanan atau minuman? 🍽</div>
              <div className="chat-actions"><span>🍽 Makanan</span><span>🥤 Minuman</span></div>
              <div className="chat-bubble user">Es Kopi Gula Aren</div>
              <div className="chat-bubble bot">Pilih jumlah dan tingkat gula, lalu lanjut ke pembayaran.</div>
              <div className="pay-card"><strong>Rp25.000</strong><span>💳 Lanjut ke Pembayaran</span></div>
            </div>
          </div>
        </div>
      </header>

      <section className="container feature-grid">
        <article className="feature-card"><Bot size={24} /><h3>Bot Telegram</h3><p>Webhook serverless-ready dengan state percakapan dan tombol inline.</p></article>
        <article className="feature-card"><MessageCircle size={24} /><h3>Menu Interaktif</h3><p>Makanan, minuman, detail produk, jumlah, catatan, dan pilihan sugar.</p></article>
        <article className="feature-card"><ShieldCheck size={24} /><h3>Supabase + Midtrans</h3><p>Data user dan pesanan aman di Supabase, pembayaran otomatis diverifikasi webhook.</p></article>
        <article className="feature-card"><ChartNoAxesCombined size={24} /><h3>Admin Dashboard</h3><p>Kelola produk, iklan, broadcast, order, dan konfigurasi bot.</p></article>
      </section>

      <footer className="footer container">Dibangun dengan Next.js, Supabase, Telegram Bot API, dan Midtrans Snap.</footer>
    </main>
  );
}
