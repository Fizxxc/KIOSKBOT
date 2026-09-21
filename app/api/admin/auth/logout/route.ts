export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestSupabaseClient } from "@/lib/supabase/request";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = await createRequestSupabaseClient(request, response);
  await supabase.auth.signOut();
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  const supabase = await createRequestSupabaseClient(request, response);
  await supabase.auth.signOut();
  return response;
}
