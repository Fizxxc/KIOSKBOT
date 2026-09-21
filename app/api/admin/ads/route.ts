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
  const limit = Number(searchParams.get("limit") || "100");
  const activeOnly = searchParams.get("active") === "true";

  let query = db.from("ads").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query.limit(Math.min(limit, 200));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ads: data || [] });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseAdminClient();
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  if (!title || !message) return NextResponse.json({ error: "Title and message are required" }, { status: 400 });

  const { data, error } = await db.from("ads").insert({
    title,
    message,
    image_url: body.image_url ? String(body.image_url).trim() : null,
    cta_label: body.cta_label ? String(body.cta_label).trim() : null,
    cta_url: body.cta_url ? String(body.cta_url).trim() : null,
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
    starts_at: body.starts_at ? String(body.starts_at) : null,
    ends_at: body.ends_at ? String(body.ends_at) : null,
    sort_order: Number(body.sort_order) || 0,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ad: data }, { status: 201 });
}