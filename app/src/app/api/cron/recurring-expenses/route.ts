import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postDueRecurring } from "@/lib/recurringExpensePost";
import { nowKstParts } from "@/lib/kstDate";
import { sendEmail } from "@/lib/email";

// 고정지출 자동 등록(108 SQL) — 매일 아침 6시(한국 시각, vercel.json 크론 "0 21 * * *" = UTC 21시)에 결제일이 된 항목을 매입장에
// "분류 대기"로 올림. 같은 달 두 번 안 올라감(DB 함수), 서버가 며칠 못 돌아도 다음 실행 때 그 달 결제일 날짜로 올림(지난달 몫까지).
export const maxDuration = 60;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: NextRequest) {
  // 자동 백업 크론과 같은 확인 — Vercel 환경변수 CRON_SECRET이 없거나 다르면 거부(주소만 알면 누구나 부르지 못하게).
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const today = nowKstParts().date;
  try {
    const supabase = createServiceClient();
    const result = await postDueRecurring(supabase, today);
    if (result.missing) return NextResponse.json({ ok: true, today, skipped: "108 SQL 실행 전" });
    if (result.failed.length && process.env.BACKUP_EMAIL_TO) {
      // 실패 알림 메일(설정이 있을 때만) — 탭에는 "올릴 차례"로 남아 "지금 올리기"로 다시 올릴 수 있음
      try {
        await sendEmail({
          to: process.env.BACKUP_EMAIL_TO,
          subject: `[IM테크 회계 관리 시스템] ${today} 고정지출 자동 등록 실패 ${result.failed.length}건`,
          html: `<p>고정지출 자동 등록 중 일부를 올리지 못했습니다.</p><ul>${result.failed
            .map((f) => `<li>${escapeHtml(f.name)} (${f.date}): ${escapeHtml(f.error)}</li>`)
            .join("")}</ul><p>매입매출 → 고정지출 탭에서 "지금 올리기"로 다시 올릴 수 있습니다.</p>`,
        });
      } catch {
        // 메일을 못 보내도 결과는 그대로
      }
    }
    return NextResponse.json(
      { ok: result.failed.length === 0, today, posted: result.posted.length, failed: result.failed.length },
      { status: result.failed.length ? 500 : 200 }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, today, error: err instanceof Error ? err.message : "고정지출 자동 등록 실패" }, { status: 500 });
  }
}
