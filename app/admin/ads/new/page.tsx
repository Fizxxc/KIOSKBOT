export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { ArrowLeft, Store } from "lucide-react";
import AdForm from "../_components/ad-form";

export default async function NewAdPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <>
      <header className="admin-header">
        <div>
          <Link className="button ghost small" href="/admin/ads"><ArrowLeft size={15} /> Kembali</Link>
          <h1 style={{ marginTop: 12 }}>Nama Iklan Baru</h1>
          <p>Iklan akan muncul di menu utama Telegram sesuai jadwal.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-body">
          <AdForm />
        </div>
      </section>
    </>
  );
}