import Link from "next/link";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  BarChart3,
  ClipboardList,
  LogOut,
  Megaphone,
  Package,
  Settings,
  Store,
} from "lucide-react";

const navigation = [
  { href: "/admin", label: "Ringkasan", icon: BarChart3 },
  { href: "/admin/products", label: "Produk", icon: Package },
  { href: "/admin/orders", label: "Pesanan", icon: ClipboardList },
  { href: "/admin/broadcasts", label: "Broadcast", icon: Megaphone },
  { href: "/admin/ads", label: "Iklan Bot", icon: Store },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get("x-next-pathname") || "";
  const isLoginPage = pathname === "/admin/login";

  if (!isLoginPage) {
    const session = await getAdminSession();
    if (!session) redirect("/login");
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Store size={18} /></span> Bot Pesan</div>
        <nav className="nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href}><Icon size={17} /> {item.label}</Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <form action="/api/admin/auth/logout" method="post">
            <button type="submit"><LogOut size={17} /> Keluar</button>
          </form>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
