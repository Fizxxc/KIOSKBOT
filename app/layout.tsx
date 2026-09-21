import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bot Pesan | Dashboard",
  description: "Dashboard pemesanan Telegram dengan Supabase dan Midtrans Snap",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
