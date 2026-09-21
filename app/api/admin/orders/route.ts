export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, withHeaders } from "@/lib/admin-api";
import type { Order } from "@/lib/types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const VALID_STATUSES = ["pending", "paid", "cancelled", "failed"] as const;

function toNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const { response, admin, headers } = await requireAdminApi(request);
  if (response) return withHeaders(response, headers);

  const { searchParams } = new URL(request.url);
  const page = toNumber(searchParams.get("page"), 1);
  const limit = Math.min(MAX_LIMIT, toNumber(searchParams.get("limit"), DEFAULT_LIMIT));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from("orders")
    .select("*, order_items(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  const status = searchParams.get("status");
  if (VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    query = query.eq("status", status);
  }
  const q = searchParams.get("q");
  if (q) {
    query = query.ilike("order_number", `%${q}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    return withHeaders(NextResponse.json({ error: error.message }, { status: 400 }), headers);
  }

  return withHeaders(
    NextResponse.json({ data: data ?? [], count: count ?? (data?.length ?? 0), page, limit }),
    headers,
  );
}
