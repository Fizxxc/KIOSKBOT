export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  return session;
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Number(searchParams.get("limit") || "50");
  const offset = Number(searchParams.get("offset") || "0");

  let query = db
    .from("broadcasts")
    .select("*, broadcast_recipients(status)", { count: "exact", head: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + Math.min(limit, 100) - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data || []).map((b: any) => {
    const recipients = b.broadcast_recipients || [];
    const sent = recipients.filter((r: any) => r.status === "sent").length;
    const failed = recipients.filter((r: any) => r.status === "failed" || r.status === "retry").length;
    const pending = recipients.filter((r: any) => r.status === "pending").length;
    return { ...b, sent_count: sent, failed_count: failed, pending_count: pending, total_recipients: recipients.length };
  });

  return NextResponse.json({ broadcasts: enriched, total: count ?? 0 });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseAdminClient();
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  if (!title || !message) return NextResponse.json({ error: "Title and message are required" }, { status: 400 });

  const { data, error } = await db
    .from("broadcasts")
    .insert({
      title,
      message,
      cta_label: body.cta_label ? String(body.cta_label).trim() : null,
      cta_url: body.cta_url ? String(body.cta_url).trim() : null,
      status: "draft",
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ broadcast: data }, { status: 201 });
}