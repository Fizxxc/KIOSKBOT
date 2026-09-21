export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { getWebhookInfo, setWebhook } from "@/lib/telegram";
import { getPublicBaseUrl, requireEnv } from "@/lib/utils";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseAdminClient();
  const keys = ["webhook_status", "webhook_config", "bot_info", "broadcast_defaults", "welcome", "menu", "payment_success"];
  const { data, error } = await db.from("bot_settings").select("key, value, updated_at").in("key", keys);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, any> = {};
  for (const row of data || []) settings[row.key] = row.value;

  let webhookInfo: any = null;
  try {
    webhookInfo = await getWebhookInfo();
  } catch {
    webhookInfo = null;
  }

  return NextResponse.json({ settings, webhook_info: webhookInfo });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createSupabaseAdminClient();
  const body = await request.json().catch(() => ({}));
  const updates: Array<{ key: string; value: any }> = [];

  if (body.webhook_status) updates.push({ key: "webhook_status", value: body.webhook_status });
  if (body.webhook_config) updates.push({ key: "webhook_config", value: body.webhook_config });
  if (body.bot_info) updates.push({ key: "bot_info", value: body.bot_info });
  if (body.broadcast_defaults) updates.push({ key: "broadcast_defaults", value: body.broadcast_defaults });
  if (body.welcome) updates.push({ key: "welcome", value: body.welcome });
  if (body.menu) updates.push({ key: "menu", value: body.menu });
  if (body.payment_success) updates.push({ key: "payment_success", value: body.payment_success });

  if (!updates.length) return NextResponse.json({ error: "No settings provided" }, { status: 400 });

  for (const { key, value } of updates) {
    const { error } = await db.from("bot_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: updates.map((u) => u.key) });
}