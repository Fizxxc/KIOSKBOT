export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { ArrowLeft, Megaphone } from "lucide-react";
import BroadcastForm from "./BroadcastForm";

export default async function NewBroadcastPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const db = createSupabaseAdminClient();
  const { count: totalUsers } = await db.from("telegram_users").select("id", { count: "exact", head: true }).eq("is_blocked", false);

  return (
    <>
      <header className="admin-header">
        <div>
          <Link className="button ghost small" href="/admin/broadcasts"><ArrowLeft size={15} /> Kembali</Link>
          <h1 style={{ marginTop: 12 }}>Buat Broadcast Draft</h1>
          <p>{totalUsers ?? 0} user Telegram aktif siap menerima pesan.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-body">
          <BroadcastForm totalUsers={totalUsers ?? 0} />
        </div>
      </section>
    </>
  );
}