export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Store } from "lucide-react";
import AdsListClient from "./AdsListClient";

export default async function AdsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const db = createSupabaseAdminClient();
  const { data: ads } = await db.from("ads").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Iklan Bot</h1>
          <p>Kelola iklan yang ditampilkan di menu utama Telegram.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link className="button ghost" href="/admin"><ArrowLeft size={15} /> Kembali</Link>
          <Link className="button primary" href="/admin/ads/new"><Plus size={16} /> Tambah Iklan</Link>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Daftar Iklan</h2>
          <span className="muted" style={{ fontSize: 13 }}>{ads?.length ?? 0} iklan</span>
        </div>
        <div className="panel-body">
          <AdsListClient ads={ads || []} />
        </div>
      </section>
    </>
  );
}