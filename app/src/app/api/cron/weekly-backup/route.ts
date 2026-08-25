import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runBackup } from "@/lib/backup";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const { fileName, sizeMb } = await runBackup(supabase, "auto");
    return NextResponse.json({ ok: true, fileName, sizeMb });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "백업 실패" }, { status: 500 });
  }
}
