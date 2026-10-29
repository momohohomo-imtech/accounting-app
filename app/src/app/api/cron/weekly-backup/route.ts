import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runBackup } from "@/lib/backup";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel Cron은 Vercel 환경변수 CRON_SECRET이 있으면 "Authorization: Bearer <CRON_SECRET>"를 붙여서 부름. 설정이 없거나
  // 다르면 거부 — 예전엔 설정이 없을 때 그냥 실행해서 주소만 알면 누구나 백업을 돌릴 수 있었음(백업 파일이 쌓임).
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
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
        // 한국 날짜로 — 서버는 UTC라 일요일 오전 6시(한국) 백업이 토요일 날짜로 나왔음
        subject: `[IM테크 회계 관리 시스템] ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 자동 백업 완료`,
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
