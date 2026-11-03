import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { pruneAutoBackups, runBackup } from "@/lib/backup";
import { sendEmail } from "@/lib/email";
import { AUTO_BACKUP_STATUS_PATH, type AutoBackupRun } from "@/lib/autoBackupStatus";

export const maxDuration = 60;

const kstDateLabel = () => new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 실행 기록(lib/autoBackupStatus.ts) — 백업 화면 "자동 백업 점검" 칸이 읽음. 기록을 못 남겨도 백업 결과에는 영향 없음.
async function saveRun(supabase: SupabaseClient, run: AutoBackupRun) {
  try {
    await supabase.storage
      .from("backups")
      .upload(AUTO_BACKUP_STATUS_PATH, Buffer.from(JSON.stringify(run), "utf8"), { contentType: "application/json", upsert: true });
  } catch {
    // 무시
  }
}

// 실패 알림 메일(BACKUP_EMAIL_TO·RESEND_API_KEY가 있을 때만) — 예전엔 실패해도 아무도 몰랐음.
async function notifyFailure(message: string) {
  const emailTo = process.env.BACKUP_EMAIL_TO;
  if (!emailTo) return;
  try {
    await sendEmail({
      to: emailTo,
      subject: `[IM테크 회계 관리 시스템] ${kstDateLabel()} 자동 백업 실패`,
      html: `
        <p>오늘의 자동 백업이 실패했습니다.</p>
        <p>이유: ${escapeHtml(message)}</p>
        <p>앱의 백업 화면에서 "지금 백업"으로 직접 백업해 두고, 같은 화면의 "자동 백업 점검" 칸을 확인해 주세요.</p>
      `,
    });
  } catch {
    // 메일도 못 보내면 백업 화면 기록으로만
  }
}

export async function GET(req: NextRequest) {
  // Vercel Cron은 Vercel 환경변수 CRON_SECRET이 있으면 "Authorization: Bearer <CRON_SECRET>"를 붙여서 부름. 설정이 없거나
  // 다르면 거부 — 예전엔 설정이 없을 때 그냥 실행해서 주소만 알면 누구나 백업을 돌릴 수 있었음(백업 파일이 쌓임).
  // 서버에 CRON_SECRET이 없으면 자동 백업이 늘 여기서 막힘 — 백업 화면 "자동 백업 점검"에 "없음"으로 보임.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 설정 오류";
    await notifyFailure(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  // 시작 기록 — 서버 시간 제한(60초)에 걸려 중간에 멈추면 끝 기록이 없어 "끝나지 않음"으로 보임
  await saveRun(supabase, { startedAt, finishedAt: null, ok: null });

  let fileName: string;
  let sizeMb: number;
  try {
    ({ fileName, sizeMb } = await runBackup(supabase, "auto"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "백업 실패";
    await saveRun(supabase, { startedAt, finishedAt: new Date().toISOString(), ok: false, error: message });
    await notifyFailure(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 백업이 성공한 뒤에만 오래된 자동 백업 정리(8주 + 1년 월 1개 — lib/backupRetention.ts). 정리가 실패해도 백업은 성공.
  let pruned = 0;
  let pruneError: string | null = null;
  try {
    ({ deleted: pruned } = await pruneAutoBackups(supabase, new Date().toISOString()));
  } catch (err) {
    pruneError = err instanceof Error ? err.message : "오래된 백업 정리 실패";
  }

  // 완료 메일 — 못 보내도 백업은 성공(예전엔 메일 오류가 백업 실패처럼 500으로 끝났음)
  const emailTo = process.env.BACKUP_EMAIL_TO;
  let emailed = false;
  let emailError: string | null = null;
  if (emailTo) {
    try {
      const { data: signed } = await supabase.storage.from("backups").createSignedUrl(fileName, 60 * 60 * 24);
      const sent = await sendEmail({
        to: emailTo,
        // 한국 날짜로 — 서버는 UTC라 일요일 오전 6시(한국) 백업이 토요일 날짜로 나왔음
        subject: `[IM테크 회계 관리 시스템] ${kstDateLabel()} 자동 백업 완료`,
        html: `
          <p>오늘의 자동 백업이 완료되었습니다.</p>
          <p>파일명: ${fileName}<br/>크기: ${sizeMb.toFixed(2)}MB(압축 파일)</p>
          ${pruned > 0 ? `<p>오래된 자동 백업 ${pruned}개를 정리했습니다(최근 8주는 전부, 그 전 1년은 달마다 1개 보관).</p>` : ""}
          ${pruneError ? `<p>오래된 자동 백업 정리 실패: ${escapeHtml(pruneError)}</p>` : ""}
          ${signed?.signedUrl ? `<p><a href="${signed.signedUrl}">백업 파일 다운로드 (24시간 유효)</a></p>` : ""}
        `,
      });
      emailed = !sent.skipped;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "메일 전송 실패";
    }
  }

  await saveRun(supabase, {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: true,
    fileName,
    sizeMb: Number(sizeMb.toFixed(3)),
    pruned,
    pruneError,
    emailError,
  });
  return NextResponse.json({ ok: true, fileName, sizeMb, emailed, emailError, pruned, pruneError });
}
