import { createSupabaseAdminClient } from "./supabase/server";
import { requireEnv } from "./utils";
import type { Order } from "./types";

type SnapOrder = Order & {
  order_items?: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
};

type SnapTransaction = {
  token: string;
  redirect_url: string;
};

export type MidtransStatus = {
  order_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  payment_type?: string;
  transaction_id?: string;
  fraud_status?: string;
  signature_key: string;
};

function midtransBase() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

function midtransApiBase() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
}

function authHeader() {
  return `Basic ${Buffer.from(`${requireEnv("MIDTRANS_SERVER_KEY")}:`).toString("base64")}`;
}

export async function createSnapTransaction(order: Order, customer: { firstName?: string | null; username?: string | null }) {
  const response = await fetch(`${midtransBase()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      Accept: "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: order.order_number,
        gross_amount: order.total_amount,
      },
      item_details: [
        {
          id: order.order_items?.[0]?.product_id ?? order.id,
          price: order.order_items?.[0]?.unit_price ?? order.total_amount,
          quantity: order.order_items?.[0]?.quantity ?? 1,
          name: order.order_items?.[0]?.product_name ?? `Pesanan ${order.order_number}`,
        },
      ],
      customer_details: {
        first_name: customer.firstName || customer.username || "Telegram Customer",
        email: undefined,
      },
      callbacks: {
        finish: `${process.env.PUBLIC_BASE_URL || "http://localhost:3000"}/payment/done`,
      },
    }),
  });

  const data = (await response.json()) as SnapTransaction & { error_messages?: string[] };
  if (!response.ok || !data.token) {
    throw new Error(data.error_messages?.join(", ") || "Midtrans Snap transaction failed");
  }
  return data;
}

export async function getMidtransStatus(orderId: string) {
  const response = await fetch(`${midtransApiBase()}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Midtrans status failed: ${response.status}`);
  return (await response.json()) as MidtransStatus;
}

export function verifyMidtransSignature(payload: MidtransStatus) {
  const signature = requireEnv("MIDTRANS_SERVER_KEY");
  const hash = require("crypto")
    .createHash("sha256")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${signature}`)
    .digest("hex");
  const expected = Buffer.from(payload.signature_key);
  const actual = Buffer.from(hash);
  return expected.length === actual.length && require("crypto").timingSafeEqual(expected, actual);
}

export function normalizedPaymentStatus(status: MidtransStatus) {
  if ((status.transaction_status === "settlement" || status.transaction_status === "capture") && status.fraud_status === "accept") {
    return { orderStatus: "paid" as const, paymentStatus: status.transaction_status };
  }
  if (status.transaction_status === "pending") {
    return { orderStatus: "pending" as const, paymentStatus: "waiting" as const };
  }
  if (["expire", "cancel", "deny"].includes(status.transaction_status)) {
    return { orderStatus: "failed" as const, paymentStatus: status.transaction_status };
  }
  return { orderStatus: "pending" as const, paymentStatus: status.transaction_status };
}

export async function syncPaymentFromMidtrans(orderId: string) {
  const status = await getMidtransStatus(orderId);
  const normalized = normalizedPaymentStatus(status);
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("orders")
    .select("id, status, payment_status, telegram_user_id, order_number, paid_at")
    .eq("midtrans_order_id", orderId)
    .single();
  if (!existing) return null;

  // If already paid, don't downgrade
  const alreadyPaid = existing.status === "paid" || existing.payment_status === "settlement" || existing.payment_status === "capture";
  if (alreadyPaid && normalized.orderStatus !== "paid") {
    return { ...existing, ...normalized, shouldNotify: false, midtrans: status };
  }

  // If transitioning to failed from pending/waiting, restore stock
  const pendingOrWaiting = existing.status === "pending" && (existing.payment_status === "pending" || existing.payment_status === "waiting");
  if (normalized.orderStatus === "failed" && pendingOrWaiting) {
    const { error: restoreError } = await supabase.rpc("restore_order_stock", { p_order_id: existing.id });
    if (restoreError) throw restoreError;
  }

  const shouldNotify = normalized.orderStatus === "paid" && !alreadyPaid;

  const updateData: any = {
    status: normalized.orderStatus,
    payment_status: normalized.paymentStatus,
    midtrans_transaction_id: status.transaction_id ?? null,
    payment_type: status.payment_type ?? null,
    fraud_status: status.fraud_status ?? null,
    updated_at: new Date().toISOString(),
  };

  // Preserve paid_at if already paid
  if (normalized.orderStatus === "paid") {
    updateData.paid_at = existing.paid_at || new Date().toISOString();
  } else {
    updateData.paid_at = existing.paid_at || null;
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("midtrans_order_id", orderId);
  if (error) throw error;

  return { ...existing, ...normalized, shouldNotify, midtrans: status };
}

export async function syncPaymentByOrderUuid(orderUuid: string) {
  const db = createSupabaseAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id, midtrans_order_id, order_number, status, payment_status, telegram_user_id")
    .eq("id", orderUuid)
    .single();
  if (error || !order?.midtrans_order_id) return null;
  const result = await syncPaymentFromMidtrans(order.midtrans_order_id);
  return result ? { ...result, order_number: order.order_number } : null;
}
