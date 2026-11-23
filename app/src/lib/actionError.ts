// 서버 액션을 부르는 것 자체가 실패했을 때(연결 끊김·새 버전 배포 직후·서버 오류) 화면에 보여 줄 문구 — GlobalPendingProvider의
// run()이 예외를 { error } 결과로 바꿀 때 씀. 11/4 사용자 "공구명세서 수정 시 수정 저장 버튼이 비활성화돼요": 예전엔 예외가 그대로
// 튀어 나가서, 저장 버튼을 "처리 중"(비활성)으로 바꿔 둔 화면이 그 상태에 갇히고 아무 안내도 없었음. 특히 새 버전이 배포되면 그 전에
// 열어 둔 화면의 저장은 Next.js가 "Server Action … was not found on the server"로 실패시킴. 검사: actionError.test.ts.

export type ActionFailure = { error: string };

// 브라우저마다 연결 실패 문구가 다름: 크롬 "Failed to fetch", 사파리(아이폰) "Load failed", 파이어폭스 "NetworkError when attempting…".
// 응답을 받다가 끊기면 크롬 "network error", Next.js(React) "Connection closed."
const NETWORK =
  /failed to fetch|load failed|networkerror|network error|network request failed|fetch failed|connection closed|err_internet_disconnected|err_network/i;
// 새 버전 배포 뒤 예전 화면의 서버 액션(Next.js UnrecognizedActionError)
const NEW_VERSION = /server action\b.*\bnot found|failed-to-find-server-action|unrecognizedaction/i;
// 서버가 앱 응답 대신 오류 화면을 돌려준 경우(시간 초과·서버 오류)
const BAD_RESPONSE = /unexpected response was received from the server/i;

/** 자동으로 다시 시도하기 전 기다리는 시간(ms) — 처음 시도 + 이 개수만큼 더(callWithRetry, 아래 설명). */
export const ACTION_RETRY_DELAYS_MS: readonly number[] = [1000, 2500];

function errorText(err: unknown) {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return { message, text: `${name} ${message}` };
}

/**
 * idempotent: 같은 요청을 다시 보내도 되는 저장(run(fn, { retry: true }) — lib/idempotentSave.ts)이라 이미 자동으로 다시 시도했고,
 * 연결이 끊긴 쪽이 응답이었으면 서버에는 저장됐을 수도 있음 → "처리되지 않았다" 대신 "결과를 받지 못했다" + 다시 눌러도 두 번 안 들어감.
 */
export function actionFailureMessage(err: unknown, options: { idempotent?: boolean } = {}): string {
  const { message, text } = errorText(err);
  if (NEW_VERSION.test(text)) {
    return "앱이 새 버전으로 바뀌어 처리되지 않았습니다. 적은 내용을 따로 적어 두고, 화면을 새로 고친 뒤 다시 해 주세요.";
  }
  const retried = `자동으로 ${ACTION_RETRY_DELAYS_MS.length + 1}번 시도`;
  const once = "같은 내용으로 다시 누르면 이미 처리됐어도 두 번 들어가지 않습니다.";
  if (NETWORK.test(text)) {
    return options.idempotent
      ? `인터넷 연결이 끊겨 결과를 받지 못했습니다(${retried}). 연결을 확인하고 다시 눌러 주세요 — ${once}`
      : "인터넷 연결이 끊겨 처리되지 않았습니다. 연결을 확인하고 다시 눌러 주세요.";
  }
  if (BAD_RESPONSE.test(text)) {
    return options.idempotent
      ? `서버가 응답하지 않아 결과를 받지 못했습니다(${retried}). 잠시 뒤 다시 눌러 주세요 — ${once}`
      : "서버가 응답하지 않아 처리되지 않았습니다. 잠시 뒤 다시 눌러 주세요.";
  }
  return `처리되지 않았습니다(오류${message ? `: ${message}` : ""}). 잠시 뒤 다시 눌러 주세요.`;
}

// ── 자동으로 다시 시도(같은 요청을 다시 보내도 되는 저장만) ──────────────────────────────
// 11/23 사용자 "저장을 두 번 누르거나 인터넷 연결이 끊겼다는 안내": 휴대폰에서 입력을 오래 한 뒤 저장하면 끊긴 연결로 요청이 나가
// 바로 실패하는 일이 있음(다시 누르면 새 연결이라 됨). 화면에서 정한 새 id로 넣는 등록(lib/idempotentSave.ts)처럼 이미 저장됐으면
// 다시 넣지 않는 저장만 자동으로 다시 보냄 — 그 밖의 저장은 다시 보내면 두 번 들어갈 수 있어 예전처럼 안내만.

/** 연결 끊김·서버가 앱 응답 대신 오류 화면을 돌려준 경우만 다시 시도(새 버전 배포는 다시 해도 같음, 그 밖의 오류는 원인이 따로). */
export function isRetryableActionError(err: unknown): boolean {
  const { text } = errorText(err);
  if (NEW_VERSION.test(text)) return false;
  return NETWORK.test(text) || BAD_RESPONSE.test(text);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * fn을 부르고, retry일 때 다시 시도할 오류면 delays만큼 기다렸다 다시(onRetry: 기다리기 전에 몇 번째 다시 시도인지 — 화면 "다시
 * 보내는 중" 표시).
 * 끝까지 실패하면 마지막 오류를 그대로 던짐(GlobalPendingProvider가 { error }로 바꿈).
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    retry: boolean;
    delays?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  const delays = options.delays ?? ACTION_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!options.retry || attempt >= delays.length || !isRetryableActionError(err)) throw err;
      options.onRetry?.(attempt + 1);
      await sleep(delays[attempt]);
    }
  }
}
