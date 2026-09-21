export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendPaymentNotification } from "@/lib/notifications";
import { syncPaymentFromMidtrans, verifyMidtransSignature, type MidtransStatus } from "@/lib/midtrans";

export async function POST(request: Request) {
  let payload: MidtransStatus;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const signatureValid = verifyMidtransSignature(payload);
  const db = createSupabaseAdminClient();

  const { data: log, error: logError } = await db.from("webhook_logs").insert({
    source: "midtrans",
    event_type: payload.transaction_status,
    payload,
    signature_valid: signatureValid,
    processed: false,
  }).select("id").single();

  if (logError) {
    return NextResponse.json({ received: false, error: "Log error" }, { status: 500 });
  }

  const logId = log.id;

  if (!signatureValid) {
    await db.from("webhook_logs").update({ error: "Invalid signature", processed: true }).eq("id", logId);
    return NextResponse.json({ received: false, error: "Invalid signature" }, { status: 401 });
  }

  try {
    const result = await syncPaymentFromMidtrans(payload.order_id);
    await db.from("webhook_logs").update({ processed: true, error: null }).eq("id", logId);

    if (result?.shouldNotify && result.id) {
      await sendPaymentNotification(result.id);
    }
    return NextResponse.json({ received: true, order_id: payload.order_id, status: payload.transaction_status });
  } catch (error) {
    await db.from("webhook_logs").update({ error: error instanceof Error ? error.message : "Unknown error", processed: true }).eq("id", logId);
    return NextResponse.json({ received: false, error: "Processing failed" }, { status: 500 });
  }
}
