export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, withHeaders } from "@/lib/admin-api";
import type { Product } from "@/lib/types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const VALID_CATEGORIES = ["food", "drink"] as const;

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
    .from("products")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  const category = searchParams.get("category");
  if (category === "food" || category === "drink") {
    query = query.eq("category", category);
  }
  const active = searchParams.get("active");
  if (active === "true" || active === "false") {
    query = query.eq("is_active", active === "true");
  }
  const q = searchParams.get("q");
  if (q) {
    query = query.ilike("name", `%${q}%`);
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

export async function POST(request: NextRequest) {
  const { response, admin, headers } = await requireAdminApi(request);
  if (response) return withHeaders(response, headers);

  const body = (await request.json().catch(() => ({}))) as Partial<Product>;
  const parsed = parseProductBody(body);
  if (!parsed.ok) {
    return withHeaders(NextResponse.json({ error: parsed.error }, { status: 400 }), headers);
  }

  const { data, error } = await admin.from("products").insert(parsed.value).select().single();
  if (error) {
    return withHeaders(NextResponse.json({ error: error.message }, { status: 400 }), headers);
  }

  return withHeaders(NextResponse.json({ ok: true, data }), headers);
}

type ProductInsert = {
  name: string;
  description: string | null;
  category: "food" | "drink";
  price_amount: number;
  currency: string;
  stock: number;
  sugar_levels: string[];
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

type ProductParseResult = { ok: true; value: ProductInsert } | { ok: false; error: string };

function parseProductBody(body: Partial<Product>): ProductParseResult {
  const name = String(body.name ?? "").trim();
  if (!name) return { ok: false, error: "Nama produk wajib diisi." };

  const category = body.category;
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return { ok: false, error: "Kategori tidak valid." };
  }

  const priceAmount = Number(body.price_amount);
  if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
    return { ok: false, error: "Harga harus lebih besar dari 0." };
  }

  const stock = Number(body.stock ?? 0);
  if (!Number.isFinite(stock) || stock < 0) {
    return { ok: false, error: "Stok tidak boleh negatif." };
  }

  const currency = (body.currency || "IDR").toUpperCase();
  if (currency.length !== 3) return { ok: false, error: "Mata uang tidak valid." };

  const sugarLevels = Array.isArray(body.sugar_levels) && body.sugar_levels.length > 0
    ? body.sugar_levels.map(String)
    : ["normal", "less"];

  const value: ProductInsert = {
    name,
    description: body.description ?? null,
    category: category as "food" | "drink",
    price_amount: priceAmount,
    currency,
    stock,
    sugar_levels: sugarLevels,
    image_url: body.image_url ?? null,
    is_active: body.is_active ?? true,
    sort_order: Number(body.sort_order ?? 0) || 0,
  };

  return { ok: true, value };
}
