"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginErrorCode } from "@/lib/loginError";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 주소에는 정해 둔 코드만(로그인 화면이 코드에 맞는 문구를 보여 줌 — lib/loginError.ts)
    redirect(`/login?error=${loginErrorCode(error)}`);
  }
  redirect("/dashboard");
}

export async function signOut(formData?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = formData?.get("reason");
  redirect(reason === "idle" ? "/login?reason=idle" : "/login");
}
