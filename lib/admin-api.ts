import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabaseClient } from "./supabase/request";
import { createSupabaseAdminClient } from "./supabase/server";

export async function requireAdminApi(request: NextRequest) {
  const response = new NextResponse();
  const supabase = await createRequestSupabaseClient(request, response);
  await supabase.auth.getClaims();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), headers: new Headers() };

  const { data: profile } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), headers: new Headers() };
  }

  return { response: null, user, profile, admin: createSupabaseAdminClient(), headers: new Headers() };
}

export function withHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value: string, key: string) => response.headers.set(key, value));
  return response;
}