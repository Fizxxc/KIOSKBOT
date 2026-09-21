export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getWebhookInfo, setWebhook } from "@/lib/telegram";
import { getPublicBaseUrl, requireEnv } from "@/lib/utils";
import { requireAdminApi, withHeaders } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { response, headers } = await requireAdminApi(request as any);
  if (response) return withHeaders(response, headers);

  const body = await request.json().catch(() => ({}));
  const url = String(body.url || `${getPublicBaseUrl()}/api/telegram/webhook`);
  const secretToken = String(body.secretToken || requireEnv("TELEGRAM_WEBHOOK_SECRET_TOKEN"));
  try {
    const result = await setWebhook(url, secretToken);
    return withHeaders(NextResponse.json({ ok: true, result }), headers);
  } catch (error) {
    return withHeaders(NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to set webhook" }, { status: 500 }), headers);
  }
}

export async function GET(request: Request) {
  const { response, headers } = await requireAdminApi(request as any);
  if (response) return withHeaders(response, headers);

  try {
    return withHeaders(NextResponse.json({ ok: true, result: await getWebhookInfo() }), headers);
  } catch (error) {
    return withHeaders(NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to get webhook info" }, { status: 500 }), headers);
  }
}
