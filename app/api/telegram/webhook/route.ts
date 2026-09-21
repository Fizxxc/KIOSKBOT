export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/bot";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/utils";

export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook endpoint is active. Use POST for updates." });
}

export async function POST(request: Request) {
  const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
  if (secretToken !== requireEnv("TELEGRAM_WEBHOOK_SECRET_TOKEN")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let update: any;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleTelegramUpdate(update);
    await createSupabaseAdminClient()
      .from("webhook_logs")
      .insert({ source: "telegram", event_type: "update", payload: update, signature_valid: true, processed: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await createSupabaseAdminClient()
      .from("webhook_logs")
      .insert({ source: "telegram", event_type: "update", payload: update, signature_valid: true, processed: false, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ ok: false, error: "Processing failed" }, { status: 500 });
  }
}
