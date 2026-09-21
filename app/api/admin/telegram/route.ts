export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWebhookInfo, setWebhook } from "@/lib/telegram";
import { getPublicBaseUrl, requireEnv } from "@/lib/utils";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const info = await getWebhookInfo();
    const baseUrl = getPublicBaseUrl();
    return NextResponse.json({ ok: true, info, base_url: baseUrl });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const url = String(body.url || `${getPublicBaseUrl()}/api/telegram/webhook`);
  const secretToken = String(body.secretToken || requireEnv("TELEGRAM_WEBHOOK_SECRET_TOKEN"));
  try {
    const result = await setWebhook(url, secretToken);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}