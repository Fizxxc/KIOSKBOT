"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Package, RefreshCw, Search, Trash2, Edit } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

type ListResponse = { data: Product[]; count: number; page: number; limit: number };

const STATUS_FILTERS = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Non-aktif" },
] as const;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["value"]>("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  async function fetchProducts() {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/admin/products", window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      if (debouncedSearch) url.searchParams.set("q", debouncedSearch);
      if (filter === "active") {
        url.searchParams.set("active", "true");
      } else if (filter === "inactive") {
        url.searchParams.set("active", "false");
      }
      const response = await fetch(url.toString());
      const json: ListResponse | { error: string } = await response.json();
      if (!response.ok || "error" in json) {
        throw new Error((json as { error?: string }).error || "Gagal memuat produk.");
      }
      setProducts(json.data);
      setCount(json.count);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, filter]);

  const refresh = () => {
    void fetchProducts();
  };

  async function toggleActive(product: Product) {
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !product.is_active }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Gagal memperbarui status.");
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active, updated_at: new Date().toISOString() } : p)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    }
  }

  async function removeProduct(product: Product) {
    if (!confirm(`Hapus produk "${product.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Gagal menghapus produk.");
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setCount((c) => c - 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / limit));

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Produk</h1>
          <p>Kelola katalog menu Bot Pesan: makanan, minuman, harga, stok, dan status aktif.</p>
        </div>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <button className="button ghost small" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} /> {loading ? "Menyegarkan..." : "Refresh"}
          </button>
          <Link className="button primary" href="/admin/products/new">
            <Package size={15} /> Tambah Produk
          </Link>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      <section className="panel">
        <div className="panel-header" style={{ gridTemplateColumns: "1fr auto auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Search size={15} />
            <input
              className="input"
              placeholder="Cari nama produk..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ width: 220, maxWidth: "100%" }}
            />
          </div>
          <select
            className="select"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as (typeof STATUS_FILTERS)[number]["value"]);
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <div className="stat-note">
            {count} produk{filter !== "all" ? ` (${STATUS_FILTERS.find((f) => f.value === filter)?.label})` : ""}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Harga</th>
                <th>Stok</th>
                <th>Gula</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    {debouncedSearch || filter !== "all" ? "Tidak ada produk sesuai filter." : "Belum ada produk."}
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="product-thumb" src={product.image_url} alt={product.name} />
                        ) : (
                          <span className="brand-mark">
                            <Package size={16} />
                          </span>
                        )}
                        <div>
                          <strong>{product.name}</strong>
                          {product.description ? <small>{product.description}</small> : null}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{product.category === "food" ? "🍽 Makanan" : "🥤 Minuman"}</td>
                    <td>{formatRupiah(product.price_amount)}</td>
                    <td>{product.stock}</td>
                    <td className="muted">{product.sugar_levels.join(", ")}</td>
                    <td>
                      <button
                        className={`badge ${product.is_active ? "success" : "warning"}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleActive(product)}
                        title={product.is_active ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {product.is_active ? "Aktif" : "Non-aktif"}
                      </button>
                    </td>
                    <td className="row-actions">
                      <Link className="button ghost small" href={`/admin/products/${product.id}/edit`} title="Edit">
                        <Edit size={14} />
                      </Link>
                      <button className="button ghost small" onClick={() => removeProduct(product)} title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-header" style={{ justifyContent: "flex-end", gap: 10 }}>
          <span className="stat-note">
            Halaman {page} dari {totalPages}
          </span>
          <button className="button ghost small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
            <ChevronLeft size={14} />
          </button>
          <button className="button ghost small" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
            <ChevronRight size={14} />
          </button>
        </div>
      </section>
    </>
  );
}
