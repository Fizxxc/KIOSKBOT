export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, withHeaders } from "@/lib/admin-api";
import type { Order } from "@/lib/types";

const VALID_STATUSES = ["pending", "paid", "cancelled", "failed"] as const;
const VALID_PAYMENT_STATUSES = ["pending", "waiting", "settlement", "capture", "expire", "cancel", "deny", "failed"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, admin, headers } = await requireAdminApi(request);
  if (response) return withHeaders(response, headers);

  const { id } = await params;
  const { data, error } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return withHeaders(NextResponse.json({ error: error.message }, { status: 400 }), headers);
  }
  if (!data) {
    return withHeaders(NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 }), headers);
  }

  return withHeaders(NextResponse.json({ data: data as Order }), headers);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, admin, headers } = await requireAdminApi(request);
  if (response) return withHeaders(response, headers);

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<Order>;

  const updates: Record<string, unknown> = {};
  if ("status" in body) {
    const status = String(body.status);
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return withHeaders(NextResponse.json({ error: "Status pesanan tidak valid." }, { status: 400 }), headers);
    }
    updates.status = status;
    if (status === "paid" && body.paid_at == null) {
      updates.paid_at = new Date().toISOString();
    }
  }
  if ("payment_status" in body) {
    const paymentStatus = String(body.payment_status);
    if (!VALID_PAYMENT_STATUSES.includes(paymentStatus as (typeof VALID_PAYMENT_STATUSES)[number])) {
      return withHeaders(NextResponse.json({ error: "Payment status tidak valid." }, { status: 400 }), headers);
    }
    updates.payment_status = paymentStatus;
  }
  if ("midtrans_transaction_id" in body) {
    updates.midtrans_transaction_id = body.midtrans_transaction_id ?? null;
  }
  if ("payment_type" in body) {
    updates.payment_type = body.payment_type ?? null;
  }
  if ("fraud_status" in body) {
    updates.fraud_status = body.fraud_status ?? null;
  }
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length <= 1) {
    return withHeaders(NextResponse.json({ error: "Tidak ada field yang diperbarui." }, { status: 400 }), headers);
  }

  const { data, error } = await admin
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select("*, order_items(*)")
    .maybeSingle();
  if (error) {
    return withHeaders(NextResponse.json({ error: error.message }, { status: 400 }), headers);
  }
  if (!data) {
    return withHeaders(NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 }), headers);
  }

  return withHeaders(NextResponse.json({ data: data as Order }), headers);
}
