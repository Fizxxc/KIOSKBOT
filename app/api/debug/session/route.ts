export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { createRequestSupabaseClient } from "@/lib/supabase/request";

export async function GET(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = await createRequestSupabaseClient(request, response);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  let profile = null;
  let profilesError = null;
  let profilesData = null;
  
  if (user) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
    const admin = createSupabaseAdminClient();
    const { data: profileData, error: profilesError_ } = await admin.from("profiles").select("*").eq("id", user.id).single();
    profilesError = profilesError_;
    profilesData = profileData;
    profile = profileData;
  }

  // Get all cookies
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map(c => c.trim());

  return NextResponse.json({
    hasUser: !!user,
    user: user ? { id: user.id, email: user.email, aud: user.aud, role: user.role } : null,
    authError: authError?.message || null,
    profile,
    profilesError: profilesError?.message || null,
    profilesData,
    cookies: cookies.map(c => c.split("=")[0]),
    cookieCount: cookies.length,
    hasSupabaseAuthCookie: cookies.some(c => c.startsWith("sb-")),
  });
}