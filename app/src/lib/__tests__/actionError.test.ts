import { test } from "node:test";
import assert from "node:assert/strict";
import { actionFailureMessage } from "@/lib/actionError";

test("연결이 끊겼을 때(브라우저마다 다른 문구) → 연결 확인 안내", () => {
  for (const msg of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "fetch failed"]) {
    assert.match(actionFailureMessage(new TypeError(msg)), /인터넷 연결이 끊겨/, msg);
  }
});

test("새 버전 배포 뒤 예전 화면의 저장 → 새로 고침 안내(적은 내용 따로 적어 두기)", () => {
  const err = new Error(
    'Server Action "7f3a" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'
  );
  const msg = actionFailureMessage(err);
  assert.match(msg, /새 버전/);
  assert.match(msg, /새로 고친 뒤/);
});

test("서버가 오류 화면을 돌려줌(시간 초과 등) → 잠시 뒤 다시", () => {
  assert.match(actionFailureMessage(new Error("An unexpected response was received from the server.")), /서버가 응답하지 않아/);
});

test("그 밖의 오류는 원래 문구를 괄호에 같이, 모양이 이상한 값도 안내는 나옴", () => {
  assert.equal(actionFailureMessage(new Error("가짜 오류")), "처리되지 않았습니다(오류: 가짜 오류). 잠시 뒤 다시 눌러 주세요.");
  assert.equal(actionFailureMessage("가짜 글자"), "처리되지 않았습니다(오류: 가짜 글자). 잠시 뒤 다시 눌러 주세요.");
  assert.equal(actionFailureMessage(undefined), "처리되지 않았습니다(오류). 잠시 뒤 다시 눌러 주세요.");
  assert.equal(actionFailureMessage({ x: 1 }), "처리되지 않았습니다(오류). 잠시 뒤 다시 눌러 주세요.");
});
