import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase/server";

export async function getAdminSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id, role, created_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;
  return { user, profile };
}
