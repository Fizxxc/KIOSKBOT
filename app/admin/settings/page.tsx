"use client";

import { useEffect, useState } from "react";
import { Save, RefreshCw } from "lucide-react";

type SettingValue = { text?: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, { text?: string }>>({});
  const [webhook, setWebhook] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [settingsResponse, webhookResponse] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/telegram"),
      ]);
      const settingsData = await settingsResponse.json();
      const webhookData = await webhookResponse.json();
      if (!settingsResponse.ok) throw new Error(settingsData.error || "Gagal memuat pengaturan.");
      setSettings(settingsData.settings || {});
      setWebhook(webhookData.info || webhookData.result || null);
      if (webhookData.base_url) setBaseUrl(webhookData.base_url);
      if (!webhookResponse.ok) setNotice(webhookData.error || "Webhook Telegram belum dapat dibaca.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function updateText(key: string, text: string) {
    setSettings((current) => ({ ...current, [key]: { ...(current[key] || {}), text } }));
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ welcome: settings.welcome, menu: settings.menu, payment_success: settings.payment_success }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan pengaturan.");
      setNotice("Pengaturan bot berhasil disimpan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function syncWebhook() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `${baseUrl}/api/telegram/webhook` }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyinkronkan webhook.");
      setWebhook(data.result || data.info || null);
      setNotice("Webhook Telegram berhasil disinkronkan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="empty">Memuat pengaturan...</p>;

  return (
    <>
      <header className="admin-header"><div><h1>Pengaturan</h1><p>Konfigurasi webhook, pesan bot, dan integrasi eksternal.</p></div><button className="button primary" onClick={syncWebhook} disabled={saving}><RefreshCw size={15} /> Sinkronkan Webhook</button></header>
      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}
      <section className="panel-grid">
        <section className="panel"><div className="panel-header"><h2>Telegram Webhook</h2></div><div className="panel-body">
          <div className="key-value"><span>URL</span><span className="code" style={{ fontSize: 11 }}>{`${baseUrl}/api/telegram/webhook`}</span></div>
          <div className="key-value"><span>Status</span><span>{webhook?.url ? "Terdaftar" : "Belum terdaftar"}</span></div>
          <div className="key-value"><span>Last error</span><span className="muted">{webhook?.last_error_message || "-"}</span></div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>Endpoint webhook dilindungi secret token. Midtrans diarahkan ke <strong>/api/midtrans/webhook</strong> dan Telegram diarahkan ke endpoint di atas.</p>
        </div></section>
        <section className="panel"><div className="panel-header"><h2>Integrasi</h2></div><div className="panel-body">
          <div className="key-value"><span>Database</span><span>Supabase</span></div>
          <div className="key-value"><span>Pembayaran</span><span>Midtrans Snap</span></div>
          <div className="key-value"><span>Mode</span><span>Sesuai environment server</span></div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>Pastikan environment variable server sudah diisi sebelum deploy. Jangan pernah mengekspos service role key ke browser.</p>
        </div></section>
      </section>
      <section className="panel" style={{ marginTop: 20 }}><div className="panel-header"><h2>Pesan Bot</h2><button className="button small" onClick={saveSettings} disabled={saving}><Save size={13} /> {saving ? "Menyimpan..." : "Simpan"}</button></div><div className="panel-body">
        <form onSubmit={(e) => { e.preventDefault(); void saveSettings(); }} className="form-grid">
          <div className="field full"><label>Pesan Welcome</label><textarea className="textarea" rows={3} value={settings.welcome?.text || ""} onChange={(e) => updateText("welcome", e.target.value)} /></div>
          <div className="field full"><label>Pesan Menu</label><textarea className="textarea" rows={3} value={settings.menu?.text || ""} onChange={(e) => updateText("menu", e.target.value)} /></div>
          <div className="field full"><label>Pesan Pembayaran Berhasil</label><textarea className="textarea" rows={3} value={settings.payment_success?.text || ""} onChange={(e) => updateText("payment_success", e.target.value)} /></div>
        </form>
      </div></section>
    </>
  );
}