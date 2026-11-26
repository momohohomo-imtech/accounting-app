// 로그인 화면 안내 문구 — 주소(?error=)에 적힌 글자를 그대로 보여 주지 않고 정해 둔 문구만(11/26 보안 점검: 예전엔 주소 글자를
// 그대로 보여 줘서 누구나 "○○로 연락하세요" 같은 가짜 안내문이 뜨는 진짜 로그인 화면 링크를 만들 수 있었음, 그리고 Supabase의
// 영어 오류 문구가 그대로 보였음). 모르는 코드는 일반 문구. 검사: loginError.test.ts
export const LOGIN_ERROR_MESSAGES = {
  invalid: "이메일 또는 비밀번호가 올바르지 않습니다.",
  banned: "사용이 정지된 계정입니다. 관리자에게 문의해 주세요.",
  unconfirmed: "이메일 인증이 끝나지 않은 계정입니다. 관리자에게 문의해 주세요.",
  rate: "로그인 시도가 너무 많습니다. 잠시 뒤 다시 시도해 주세요.",
  timeout: "인증 서버 응답이 지연되어 로그인 화면으로 돌아왔습니다. 다시 로그인해 주세요.",
  norole: "권한이 지정되지 않은 계정입니다. 관리자에게 권한 지정을 요청해 주세요.",
  failed: "로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;

/** Supabase 로그인 오류 → 화면 코드(오류 코드가 먼저, 예전 서버처럼 코드가 없으면 문구·상태로). */
export function loginErrorCode(err: { code?: string | null; message?: string | null; status?: number | null }): LoginErrorCode {
  const code = err.code ?? "";
  const message = err.message ?? "";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) return "invalid";
  if (code === "user_banned" || /banned/i.test(message)) return "banned";
  if (code === "email_not_confirmed" || /not confirmed/i.test(message)) return "unconfirmed";
  if (err.status === 429 || /rate[ _]limit|too many/i.test(code + " " + message)) return "rate";
  return "failed";
}

/** 주소의 ?error= 값 → 보여 줄 문구(없으면 null, 모르는 값은 일반 문구 — 주소 글자는 절대 그대로 보이지 않음). */
export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return Object.hasOwn(LOGIN_ERROR_MESSAGES, code) ? LOGIN_ERROR_MESSAGES[code as LoginErrorCode] : LOGIN_ERROR_MESSAGES.failed;
}
