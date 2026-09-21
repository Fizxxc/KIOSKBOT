import { createSupabaseAdminClient } from "./supabase/server";
import { requireEnv } from "./utils";

type Db = ReturnType<typeof createSupabaseAdminClient>;

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getOrCreateJob(db: Db, broadcastId: string, total: number, batchSize: number, throttleMs: number, createdBy: string) {
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

async function sendBatch(db: Db, broadcast: any, recipients: any[], maxRetries: number) {
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
            parse_mode: "HTML",
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

export async function processBroadcastSend(db: Db, broadcastId: string, body: Record<string, unknown>, createdBy: string) {
  const { data: broadcast, error: broadcastError } = await db.from("broadcasts").select("*").eq("id", broadcastId).maybeSingle();
  if (broadcastError) throw new Error(broadcastError.message);
  if (!broadcast) return { error: "Broadcast not found", status: 404 };
  if (broadcast.status === "completed") return { ok: true, done: true, broadcast };

  const batchSize = Math.max(1, Math.min(Number(body.batch_size) || 25, 50));
  const throttleMs = Math.max(0, Math.min(Number(body.throttle_ms) ?? 35, 1000));
  const maxRetries = Math.max(0, Math.min(Number(body.max_retries) ?? 2, 3));
  let total = 0;

  if (broadcast.status === "draft") {
    const { data: users, error: usersError } = await db
      .from("telegram_users")
      .select("telegram_user_id")
      .eq("is_blocked", false)
      .eq("is_bot", false);
    if (usersError) throw new Error(usersError.message);

    const recipients = (users || []).map((user) => ({
      broadcast_id: broadcastId,
      telegram_user_id: user.telegram_user_id,
      status: "pending" as const,
    }));
    if (recipients.length) {
      const { error: recipientError } = await db.from("broadcast_recipients").upsert(recipients, { onConflict: "broadcast_id,telegram_user_id" });
      if (recipientError) throw new Error(recipientError.message);
    }
    total = recipients.length;
    await getOrCreateJob(db, broadcastId, total, batchSize, throttleMs, createdBy);
    await db.from("broadcasts").update({ status: "running", sent_count: 0, failed_count: 0, updated_at: new Date().toISOString() }).eq("id", broadcastId);
  } else {
    const { count } = await db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcastId);
    total = count ?? 0;
    await getOrCreateJob(db, broadcastId, total, batchSize, throttleMs, createdBy);
    await db.from("broadcasts").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", broadcastId);
  }

  const retryable = broadcast.status === "failed" || broadcast.status === "paused";
  const { data: pending, error: pendingError } = await db
    .from("broadcast_recipients")
    .select("id, telegram_user_id")
    .eq("broadcast_id", broadcastId)
    .in("status", retryable ? ["pending", "retry", "failed"] : ["pending", "retry"])
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (pendingError) throw new Error(pendingError.message);

  if (!pending?.length) {
    const { count: remaining } = await db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcastId).in("status", ["pending", "retry", "failed"]);
    if ((remaining ?? 0) === 0) {
      await db.from("broadcasts").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", broadcastId);
      await db.from("broadcast_send_jobs").update({ status: "completed", remaining: 0, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("broadcast_id", broadcastId).eq("status", "running");
      const { data: completed } = await db.from("broadcasts").select("*").eq("id", broadcastId).single();
      return { ok: true, done: true, processed: 0, remaining: 0, broadcast: completed };
    }
    return { ok: true, done: true, processed: 0, remaining: remaining ?? 0, broadcast };
  }

  const refreshed = (await db.from("broadcasts").select("*").eq("id", broadcastId).single()).data;
  if (!refreshed) return { error: "Broadcast not found", status: 404 };
  const results = await sendBatch(db, refreshed, pending, maxRetries);
  const sentCount = results.filter((result) => result.status === "sent").length;
  const retryCount = results.length - sentCount;

  const [{ count: sentTotal }, { count: failedTotal }, { count: pendingTotal }] = await Promise.all([
    db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcastId).eq("status", "sent"),
    db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcastId).in("status", ["failed", "retry"]),
    db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcastId).in("status", ["pending", "retry", "failed"]),
  ]);

  const finished = (pendingTotal ?? 0) === 0;
  await db.from("broadcasts").update({
    sent_count: sentTotal ?? 0,
    failed_count: failedTotal ?? 0,
    status: finished ? "completed" : "running",
    completed_at: finished ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", broadcastId);

  const { data: job } = await db.from("broadcast_send_jobs").select("id").eq("broadcast_id", broadcastId).eq("status", "running").order("created_at", { ascending: false }).maybeSingle();
  if (job) {
    await db.from("broadcast_send_jobs").update({
      sent: sentTotal ?? 0,
      failed: failedTotal ?? 0,
      remaining: pendingTotal ?? 0,
      status: finished ? "completed" : "running",
      completed_at: finished ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
  }

  const { data: completedBroadcast } = await db.from("broadcasts").select("*").eq("id", broadcastId).single();
  return {
    ok: true,
    done: finished,
    processed: results.length,
    sent: sentCount,
    failed: retryCount,
    remaining: pendingTotal ?? 0,
    broadcast: completedBroadcast,
  };
}
