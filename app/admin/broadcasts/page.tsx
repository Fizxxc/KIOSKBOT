export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Megaphone, Plus, RefreshCw, Play, Pause, Trash2, ArrowLeft } from "lucide-react";
import BroadcastListClient from "./BroadcastListClient";

export default async function BroadcastsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const db = createSupabaseAdminClient();
  const { data: broadcasts } = await db
    .from("broadcasts")
    .select("*, broadcast_recipients(status)")
    .order("created_at", { ascending: false })
    .limit(100);

  const enriched = (broadcasts || []).map((b: any) => {
    const recipients = b.broadcast_recipients || [];
    const sent = recipients.filter((r: any) => r.status === "sent").length;
    const failed = recipients.filter((r: any) => r.status === "failed" || r.status === "retry").length;
    const pending = recipients.filter((r: any) => r.status === "pending").length;
    return { ...b, sent_count: sent, failed_count: failed, pending_count: pending, total_recipients: recipients.length };
  });

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Broadcast</h1>
          <p>Kirim pesan massal ke semua user Telegram aktif.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link className="button ghost" href="/admin"><ArrowLeft size={15} /> Kembali</Link>
          <Link className="button primary" href="/admin/broadcasts/new"><Plus size={16} /> Buat Draft</Link>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Daftar Broadcast</h2>
          <span className="muted" style={{ fontSize: 13 }}>{enriched.length} broadcast</span>
        </div>
        <div className="panel-body">
          <BroadcastListClient broadcasts={enriched} />
        </div>
      </section>
    </>
  );
}