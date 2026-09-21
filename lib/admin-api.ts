import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabaseClient } from "./supabase/request";
import { createSupabaseAdminClient } from "./supabase/server";

export async function requireAdminApi(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = await createRequestSupabaseClient(request, response);
  await supabase.auth.getClaims();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), headers: response.headers };

  const { data: profile } = await createSupabaseAdminClient()
    .from("admin_profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), headers: response.headers };
  }

  return { response: null, user, profile, admin: createSupabaseAdminClient(), headers: response.headers };
}

export function withHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}
