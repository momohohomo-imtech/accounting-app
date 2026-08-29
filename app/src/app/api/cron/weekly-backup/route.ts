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

  try {
    const supabase = createServiceClient();
    const { fileName, sizeMb } = await runBackup(supabase, "auto");

    const emailTo = process.env.BACKUP_EMAIL_TO;
    let emailed = false;
    if (emailTo) {
      const { data: signed } = await supabase.storage.from("backups").createSignedUrl(fileName, 60 * 60 * 24);
      await sendEmail({
        to: emailTo,
        subject: `[현장관리 시스템] ${new Date().toLocaleDateString("ko-KR")} 자동 백업 완료`,
        html: `
          <p>오늘의 자동 백업이 완료되었습니다.</p>
          <p>파일명: ${fileName}<br/>크기: ${sizeMb.toFixed(2)}MB</p>
          ${signed?.signedUrl ? `<p><a href="${signed.signedUrl}">백업 파일 다운로드 (24시간 유효)</a></p>` : ""}
        `,
      });
      emailed = true;
    }

    return NextResponse.json({ ok: true, fileName, sizeMb, emailed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "백업 실패" }, { status: 500 });
  }
}
