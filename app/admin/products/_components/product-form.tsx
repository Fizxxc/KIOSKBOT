"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";

export type ProductFormValue = {
  name: string;
  description: string;
  category: "food" | "drink";
  price_amount: string;
  currency: string;
  stock: string;
  sugar_levels: string;
  image_url: string;
  is_active: boolean;
  sort_order: string;
};

export default function ProductForm({
  initial,
  productId,
  onSuccess,
}: {
  initial?: Partial<Product>;
  productId?: string;
  onSuccess?: (product: Product) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormValue>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "food",
    price_amount: initial?.price_amount != null ? String(initial.price_amount) : "",
    currency: initial?.currency ?? "IDR",
    stock: initial?.stock != null ? String(initial.stock) : "0",
    sugar_levels: initial?.sugar_levels?.join(", ") ?? "normal, less",
    image_url: initial?.image_url ?? "",
    is_active: initial?.is_active ?? true,
    sort_order: initial?.sort_order != null ? String(initial.sort_order) : "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) {
      setForm((prev) => ({
        ...prev,
        name: initial.name ?? prev.name,
        description: initial.description ?? prev.description,
        category: initial.category ?? prev.category,
        price_amount: initial.price_amount != null ? String(initial.price_amount) : prev.price_amount,
        currency: initial.currency ?? prev.currency,
        stock: initial.stock != null ? String(initial.stock) : prev.stock,
        sugar_levels: initial.sugar_levels?.join(", ") ?? prev.sugar_levels,
        image_url: initial.image_url ?? prev.image_url,
        is_active: initial.is_active ?? prev.is_active,
        sort_order: initial.sort_order != null ? String(initial.sort_order) : prev.sort_order,
      }));
    }
  }, [initial]);

  function update(field: keyof ProductFormValue, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function sugarLevelsArray() {
    return form.sugar_levels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        price_amount: Number(form.price_amount),
        currency: form.currency.toUpperCase(),
        stock: Number(form.stock),
        sugar_levels: sugarLevelsArray(),
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };

      const method = productId ? "PATCH" : "POST";
      const path = productId ? `/api/admin/products/${productId}` : "/api/admin/products";
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Gagal menyimpan produk.");

      const saved: Product | undefined = json.data;
      onSuccess?.(saved ?? ({} as Product));
      router.replace("/admin/products");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field">
          <label>Nama Produk</label>
          <input className="input" required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div className="field">
          <label>Kategori</label>
          <select className="select" value={form.category} onChange={(e) => update("category", e.target.value as "food" | "drink")}>
            <option value="food">🍽 Makanan</option>
            <option value="drink">🥤 Minuman</option>
          </select>
        </div>
        <div className="field full">
          <label>Deskripsi</label>
          <textarea className="textarea" value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
        </div>
        <div className="field">
          <label>Harga</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="muted">Rp</span>
            <input
              className="input"
              type="number"
              min={1}
              required
              value={form.price_amount}
              onChange={(e) => update("price_amount", e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>Mata Uang</label>
          <input className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)} maxLength={3} />
        </div>
        <div className="field">
          <label>Stok</label>
          <input className="input" type="number" min={0} value={form.stock} onChange={(e) => update("stock", e.target.value)} />
        </div>
        <div className="field">
          <label>Pilihan Gula</label>
          <input className="input" placeholder="pisahkan dengan koma, mis. normal, less" value={form.sugar_levels} onChange={(e) => update("sugar_levels", e.target.value)} />
        </div>
        <div className="field full">
          <label>URL Gambar</label>
          <input className="input" placeholder="https://..." value={form.image_url} onChange={(e) => update("image_url", e.target.value)} />
        </div>
        <div className="field">
          <label>Urutan Tampilan</label>
          <input className="input" type="number" min={0} value={form.sort_order} onChange={(e) => update("sort_order", e.target.value)} />
        </div>
        <div className="field" style={{ alignItems: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} /> Aktif
          </label>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="form-actions">
        <button className="button ghost" type="button" onClick={() => router.replace("/admin/products")}>
          Batal
        </button>
        <button className="button primary" disabled={loading}>
          {loading ? "Menyimpan..." : productId ? "Perbarui" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
