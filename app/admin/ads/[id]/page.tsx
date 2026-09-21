"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Ad } from "@/lib/types";
import AdForm from "../_components/ad-form";

export default function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void params.then(async ({ id: resolved }) => {
      setId(resolved);
      try {
        const response = await fetch(`/api/admin/ads/${resolved}`);
        const data = await response.json();
        if (!response.ok || !data.ad) throw new Error(data.error || "Iklan tidak ditemukan.");
        setAd(data.ad);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  if (loading) return <p className="empty">Memuat iklan...</p>;
  if (error) return <p className="notice error">{error}</p>;
  if (!ad) return null;

  return (
    <section className="panel">
      <div className="panel-header"><h2>Edit Iklan: {ad.title}</h2><button className="button ghost small" onClick={() => router.replace("/admin/ads")}>Kembali</button></div>
      <div className="panel-body"><AdForm initial={ad} adId={ad.id} /></div>
    </section>
  );
}
