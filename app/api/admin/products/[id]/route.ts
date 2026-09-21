export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, withHeaders } from "@/lib/admin-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, admin, headers } = await requireAdminApi(request);
  if (response) return withHeaders(response, headers);

  const { id } = await params;
  const { data, error } = await admin.from("products").select("*").eq("id", id).maybeSingle();
  if (error) {
    return withHeaders(NextResponse.json({ error: error.message }, { status: 400 }), headers);
  }
  if (!data) {
    return withHeaders(NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 }), headers);
  }

  return withHeaders(NextResponse.json({ data }), headers);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, admin, headers } = await requireAdminApi(request);
  if (response) return withHeaders(response, headers);

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<Record<string, unknown>>;

  const updates: Record<string, unknown> = {};
  if ("name" in body && String(body.name ?? "").trim() !== "") {
    updates.name = String(body.name).trim();
  }
  if ("description" in body) {
    const description = body.description;
    updates.description = description == null ? null : String(description);
  }
  if ("category" in body) {
    const category = String(body.category);
    if (category !== "food" && category !== "drink") {
      return withHeaders(NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 }), headers);
    }
    updates.category = category;
  }
  if ("price_amount" in body) {
    const priceAmount = Number(body.price_amount);
    if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
      return withHeaders(NextResponse.json({ error: "Harga harus lebih besar dari 0." }, { status: 400 }), headers);
    }
    updates.price_amount = priceAmount;
  }
  if ("currency" in body) {
    const currency = String(body.currency || "IDR").toUpperCase();
    if (currency.length !== 3) {
      return withHeaders(NextResponse.json({ error: "Mata uang tidak valid." }, { status: 400 }), headers);
    }
    updates.currency = currency;
  }
  if ("stock" in body) {
    const stock = Number(body.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      return withHeaders(NextResponse.json({ error: "Stok tidak boleh negatif." }, { status: 400 }), headers);
    }
    updates.stock = stock;
  }
  if ("sugar_levels" in body) {
    const sugarLevels = Array.isArray(body.sugar_levels)
      ? body.sugar_levels.map(String)
      : ["normal", "less"];
    updates.sugar_levels = sugarLevels;
  }
  if ("image_url" in body) {
    updates.image_url = body.image_url == null ? null : String(body.image_url);
  }
  if ("is_active" in body) {
    updates.is_active = body.is_active === true || body.is_active === "true";
  }
  if ("sort_order" in body) {
    updates.sort_order = Number(body.sort_order) || 0;
  }

  if (Object.keys(updates).length === 0) {
    return withHeaders(NextResponse.json({ error: "Tidak ada field yang diperbarui." }, { status: 400 }), headers);
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await admin.from("products").update(updates).eq("id", id).select().maybeSingle();
  if (error) {
    return withHeaders(NextResponse.json({ error: error.message }, { status: 400 }), headers);
  }
  if (!data) {
    return withHeaders(NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 }), headers);
  }

  return withHeaders(NextResponse.json({ data }), headers);
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return PATCH(request, props);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, admin, headers } = await requireAdminApi(request);
  if (response) return withHeaders(response, headers);

  const { id } = await params;
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) {
    return withHeaders(NextResponse.json({ error: error.message }, { status: 400 }), headers);
  }

  return withHeaders(NextResponse.json({ ok: true }), headers);
}
