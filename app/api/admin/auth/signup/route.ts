export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || password.length < 8) {
    return NextResponse.json({ error: "Email dan password minimal 8 karakter diperlukan." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });
  const user = data?.user;
  if (error || !user) {
    return NextResponse.json({ error: error?.message || "Gagal membuat akun." }, { status: 400 });
  }
  const { error: profileError } = await admin.from("profiles").insert({ id: user.id, role: "admin" });
  if (profileError) {
    await admin.auth.admin.deleteUser(user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
}
