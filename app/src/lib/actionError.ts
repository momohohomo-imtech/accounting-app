// 서버 액션을 부르는 것 자체가 실패했을 때(연결 끊김·새 버전 배포 직후·서버 오류) 화면에 보여 줄 문구 — GlobalPendingProvider의
// run()이 예외를 { error } 결과로 바꿀 때 씀. 11/4 사용자 "공구명세서 수정 시 수정 저장 버튼이 비활성화돼요": 예전엔 예외가 그대로
// 튀어 나가서, 저장 버튼을 "처리 중"(비활성)으로 바꿔 둔 화면이 그 상태에 갇히고 아무 안내도 없었음. 특히 새 버전이 배포되면 그 전에
// 열어 둔 화면의 저장은 Next.js가 "Server Action … was not found on the server"로 실패시킴. 검사: actionError.test.ts.

export type ActionFailure = { error: string };

// 브라우저마다 연결 실패 문구가 다름: 크롬 "Failed to fetch", 사파리(아이폰) "Load failed", 파이어폭스 "NetworkError when attempting…"
const NETWORK = /failed to fetch|load failed|networkerror|network request failed|fetch failed|err_internet_disconnected|err_network/i;
// 새 버전 배포 뒤 예전 화면의 서버 액션(Next.js UnrecognizedActionError)
const NEW_VERSION = /server action\b.*\bnot found|failed-to-find-server-action|unrecognizedaction/i;
// 서버가 앱 응답 대신 오류 화면을 돌려준 경우(시간 초과·서버 오류)
const BAD_RESPONSE = /unexpected response was received from the server/i;

export function actionFailureMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const text = `${name} ${message}`;
  if (NEW_VERSION.test(text)) {
    return "앱이 새 버전으로 바뀌어 처리되지 않았습니다. 적은 내용을 따로 적어 두고, 화면을 새로 고친 뒤 다시 해 주세요.";
  }
  if (NETWORK.test(text)) {
    return "인터넷 연결이 끊겨 처리되지 않았습니다. 연결을 확인하고 다시 눌러 주세요.";
  }
  if (BAD_RESPONSE.test(text)) {
    return "서버가 응답하지 않아 처리되지 않았습니다. 잠시 뒤 다시 눌러 주세요.";
  }
  return `처리되지 않았습니다(오류${message ? `: ${message}` : ""}). 잠시 뒤 다시 눌러 주세요.`;
}
