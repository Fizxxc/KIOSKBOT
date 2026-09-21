export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  return session;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseAdminClient();
  const { data: broadcast, error } = await db
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: recipients }, { data: job }] = await Promise.all([
    db.from("broadcast_recipients").select("*").eq("broadcast_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("broadcast_send_jobs").select("*").eq("broadcast_id", id).order("created_at", { ascending: false }).limit(1),
  ]);

  const sent = (recipients || []).filter((r) => r.status === "sent").length;
  const failed = (recipients || []).filter((r) => r.status === "failed" || r.status === "retry").length;
  const pending = (recipients || []).filter((r) => r.status === "pending").length;

  return NextResponse.json({ broadcast, recipients: recipients || [], job: job?.[0] ?? null, stats: { sent, failed, pending, total: recipients?.length ?? 0 } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseAdminClient();
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = String(body.title || "").trim();
  if (body.message !== undefined) updates.message = String(body.message || "").trim();
  if (body.cta_label !== undefined) updates.cta_label = body.cta_label ? String(body.cta_label).trim() : null;
  if (body.cta_url !== undefined) updates.cta_url = body.cta_url ? String(body.cta_url).trim() : null;
  if (body.status !== undefined) updates.status = body.status;

  const { data, error } = await db.from("broadcasts").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ broadcast: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseAdminClient();
  const { error } = await db.from("broadcasts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}