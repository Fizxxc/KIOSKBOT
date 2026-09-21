export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { ArrowLeft, RefreshCw, Play, Pause, Trash2 } from "lucide-react";
import BroadcastDetailClient from "./BroadcastDetailClient";

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const db = createSupabaseAdminClient();
  const { data: broadcast, error } = await db.from("broadcasts").select("*").eq("id", id).maybeSingle();
  if (error || !broadcast) notFound();

  const [{ data: recipients }, { data: job }] = await Promise.all([
    db.from("broadcast_recipients").select("*").eq("broadcast_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("broadcast_send_jobs").select("*").eq("broadcast_id", id).order("created_at", { ascending: false }).limit(1),
  ]);

  const sent = (recipients || []).filter((r) => r.status === "sent").length;
  const failed = (recipients || []).filter((r) => r.status === "failed" || r.status === "retry").length;
  const pending = (recipients || []).filter((r) => r.status === "pending").length;

  return (
    <>
      <header className="admin-header">
        <div>
          <Link className="button ghost small" href="/admin/broadcasts"><ArrowLeft size={15} /> Kembali</Link>
          <h1 style={{ marginTop: 12 }}>{broadcast.title}</h1>
          <p>Status: {broadcast.status} • Dikirim: {broadcast.sent_count} • Gagal: {broadcast.failed_count}</p>
        </div>
      </header>

      <BroadcastDetailClient
        broadcast={broadcast}
        recipients={recipients || []}
        job={job?.[0] ?? null}
        stats={{ sent, failed, pending, total: recipients?.length ?? 0 }}
      />
    </>
  );
}