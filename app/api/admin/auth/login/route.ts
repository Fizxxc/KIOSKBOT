export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestSupabaseClient } from "@/lib/supabase/request";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = await createRequestSupabaseClient(request, response);
  const body = await request.json().catch(() => ({}));
  const { error } = await supabase.auth.signInWithPassword({
    email: String(body.email || ""),
    password: String(body.password || ""),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  return response;
}
