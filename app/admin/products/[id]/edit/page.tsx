"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProductForm from "@/app/admin/products/_components/product-form";
import type { Product } from "@/lib/types";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    fetch(`/api/admin/products/${id}`)
      .then((r) => r.json())
      .then((json: { data?: Product; error?: string }) => {
        if (!json.data) throw new Error(json.error || "Produk tidak ditemukan.");
        setProduct(json.data);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="empty">Memuat produk...</p>;
  if (error) return <p className="notice error">{error}</p>;
  if (!product) return null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Edit Produk: {product.name}</h2>
      </div>
      <div className="panel-body">
        <ProductForm initial={product} productId={product.id} />
      </div>
    </section>
  );
}
