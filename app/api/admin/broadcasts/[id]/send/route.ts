export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { requireEnv } from "@/lib/utils";

async function requireAdmin() {
  const session = await getAdminSession();
  return session;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function upsertJob(db: ReturnType<typeof createSupabaseAdminClient>, broadcastId: string, total: number, batchSize: number, throttleMs: number, createdBy: string) {
  const { data: existing } = await db
    .from("broadcast_send_jobs")
    .select("id")
    .eq("broadcast_id", broadcastId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db
    .from("broadcast_send_jobs")
    .insert({
      broadcast_id: broadcastId,
      status: "running",
      total,
      sent: 0,
      failed: 0,
      remaining: total,
      batch_size: batchSize,
      throttle_ms: throttleMs,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function sendBatch(db: ReturnType<typeof createSupabaseAdminClient>, broadcast: any, recipients: any[], maxRetries: number) {
  const token = requireEnv("BOT_TOKEN");
  const results: Array<{ id: string; status: "sent" | "retry"; error?: string }> = [];
  const throttleMs = Math.max(0, Math.min(Number(broadcast.throttle_ms ?? 35), 1000));

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    let lastError: string | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: recipient.telegram_user_id,
            text: broadcast.message,
            reply_markup: broadcast.cta_label && broadcast.cta_url
              ? { inline_keyboard: [[{ text: broadcast.cta_label, url: broadcast.cta_url }]] }
              : undefined,
            disable_web_page_preview: !broadcast.cta_url,
          }),
        });
        const data = await response.json();
        if (response.ok && data.ok) {
          lastError = null;
          break;
        }
        lastError = data.description || `HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
      }
    }

    results.push(lastError === null
      ? { id: recipient.id, status: "sent" }
      : { id: recipient.id, status: "retry", error: lastError?.slice(0, 500) ?? "Unknown error" });

    if (index < recipients.length - 1 && throttleMs > 0) await delay(throttleMs);
  }

  for (const result of results) {
    await db.from("broadcast_recipients").update({
      status: result.status,
      error: result.status === "retry" ? result.error : null,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
    }).eq("id", result.id);
  }

  return results;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseAdminClient();
  const body = await request.json().catch(() => ({}));
  const batchSize = Math.max(1, Math.min(Number(body.batch_size) || 25, 50));
  const throttleMs = Math.max(0, Math.min(Number(body.throttle_ms) || 35, 1000));
  const maxRetries = Math.max(0, Math.min(Number(body.max_retries) ?? 2, 3));

  const { data: broadcast, error: broadcastError } = await db.from("broadcasts").select("*").eq("id", id).maybeSingle();
  if (broadcastError) return NextResponse.json({ error: broadcastError.message }, { status: 500 });
  if (!broadcast) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
  if (broadcast.status === "completed") return NextResponse.json({ ok: true, done: true, broadcast });
  if (broadcast.status === "running") return NextResponse.json({ error: "Broadcast sedang berjalan", status: 400 });

  let total = 0;
  if (broadcast.status === "draft") {
    const { data: users, error: usersError } = await db
      .from("telegram_users")
      .select("telegram_user_id")
      .eq("is_blocked", false)
      .eq("is_bot", false);
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });

    const recipients = (users || []).map((user) => ({
      broadcast_id: id,
      telegram_user_id: user.telegram_user_id,
      status: "pending" as const,
    }));
    if (recipients.length) {
      const { error: recipientError } = await db.from("broadcast_recipients").upsert(recipients, {
        onConflict: "broadcast_id,telegram_user_id",
      });
      if (recipientError) return NextResponse.json({ error: recipientError.message }, { status: 500 });
    }
    total = recipients.length;

    await upsertJob(db, id, total, batchSize, throttleMs, session.user.id);
    await db.from("broadcasts").update({
      status: "running",
      sent_count: 0,
      failed_count: 0,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
  } else {
    const { count } = await db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", id);
    total = count ?? 0;
    await upsertJob(db, id, total, batchSize, throttleMs, session.user.id);
    await db.from("broadcasts").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", id);
  }

  const { data: pending, error: pendingError } = await db
    .from("broadcast_recipients")
    .select("id, telegram_user_id")
    .eq("broadcast_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });

  if (!pending?.length) {
    await db.from("broadcasts").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    await db.from("broadcast_send_jobs").update({ status: "completed", remaining: 0, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("broadcast_id", id).eq("status", "running");
    const { data: completed } = await db.from("broadcasts").select("*").eq("id", id).single();
    return NextResponse.json({ ok: true, done: true, processed: 0, remaining: 0, broadcast: completed });
  }

  const refreshed = (await db.from("broadcasts").select("*").eq("id", id).single()).data;
  if (!refreshed) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
  const results = await sendBatch(db, refreshed, pending, maxRetries);
  const sentCount = results.filter((result) => result.status === "sent").length;
  const retryCount = results.length - sentCount;

  const [{ count: sentTotal }, { count: failedTotal }, { count: pendingTotal }] = await Promise.all([
    db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", id).eq("status", "sent"),
    db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", id).in("status", ["failed", "retry"]),
    db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", id).eq("status", "pending"),
  ]);

  const finished = (pendingTotal ?? 0) === 0;
  await db.from("broadcasts").update({
    sent_count: sentTotal ?? 0,
    failed_count: failedTotal ?? 0,
    status: finished ? "completed" : "running",
    completed_at: finished ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  await db.from("broadcast_send_jobs").update({
    sent: sentTotal ?? 0,
    failed: failedTotal ?? 0,
    remaining: pendingTotal ?? 0,
    status: finished ? "completed" : "running",
    completed_at: finished ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("broadcast_id", id).eq("status", "running");

  const { data: completedBroadcast } = await db.from("broadcasts").select("*").eq("id", id).single();
  return NextResponse.json({
    ok: true,
    done: finished,
    processed: results.length,
    sent: sentCount,
    failed: retryCount,
    remaining: pendingTotal ?? 0,
    broadcast: completedBroadcast,
  });
}
