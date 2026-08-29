// Resend API를 fetch로 직접 호출 (별도 SDK 설치 없이). RESEND_API_KEY 미설정 시 조용히 건너뛴다.
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.BACKUP_EMAIL_FROM ?? "현장관리 시스템 <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`이메일 전송 실패 (${res.status}): ${text}`);
  }
  return { skipped: false as const };
}
