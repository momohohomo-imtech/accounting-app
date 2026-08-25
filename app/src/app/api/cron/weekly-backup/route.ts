import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runBackup } from "@/lib/backup";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const to = process.env.BACKUP_EMAIL_TO;
  if (!to) {
    return NextResponse.json({ error: "BACKUP_EMAIL_TO가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const supabase = createServiceClient();
    const { fileName, json, sizeMb } = await runBackup(supabase, "auto");

    await sendEmail({
      to,
      subject: `[현장관리] 주간 백업 - ${new Date().toISOString().slice(0, 10)}`,
      html: `<p>매주 자동 생성되는 시스템 백업 파일입니다.</p><p>파일명: ${fileName}</p><p>크기: ${sizeMb.toFixed(2)}MB</p><p>앱의 "백업" 메뉴에서도 다운로드할 수 있습니다.</p>`,
      attachments: [{ filename: fileName, content: json, contentType: "application/json" }],
    });

    return NextResponse.json({ ok: true, fileName });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "백업 실패" }, { status: 500 });
  }
}
