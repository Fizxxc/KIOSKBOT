"use client";

import ProductForm from "@/app/admin/products/_components/product-form";

export default function NewProductPage() {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Tambah Produk Baru</h2>
      </div>
      <div className="panel-body">
        <ProductForm />
      </div>
    </section>
  );
}
