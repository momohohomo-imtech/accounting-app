"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runBackup } from "@/lib/backup";

export async function createManualBackup() {
  const supabase = await createClient();
  await runBackup(supabase, "manual");
  revalidatePath("/backups");
}
