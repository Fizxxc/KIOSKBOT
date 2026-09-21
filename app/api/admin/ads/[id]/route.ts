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
  const { data, error } = await db.from("ads").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ad: data });
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
  if (body.image_url !== undefined) updates.image_url = body.image_url ? String(body.image_url).trim() : null;
  if (body.cta_label !== undefined) updates.cta_label = body.cta_label ? String(body.cta_label).trim() : null;
  if (body.cta_url !== undefined) updates.cta_url = body.cta_url ? String(body.cta_url).trim() : null;
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
  if (body.starts_at !== undefined) updates.starts_at = body.starts_at ? String(body.starts_at) : null;
  if (body.ends_at !== undefined) updates.ends_at = body.ends_at ? String(body.ends_at) : null;
  if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order) || 0;

  const { data, error } = await db.from("ads").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ad: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseAdminClient();
  const { error } = await db.from("ads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}