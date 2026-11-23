import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTION_RETRY_DELAYS_MS, actionFailureMessage, callWithRetry, isRetryableActionError } from "@/lib/actionError";

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

test("응답을 받다가 끊김(크롬 network error, Next.js Connection closed.)도 연결 끊김 안내", () => {
  assert.match(actionFailureMessage(new TypeError("network error")), /인터넷 연결이 끊겨/);
  assert.match(actionFailureMessage(new Error("Connection closed.")), /인터넷 연결이 끊겨/);
});

test("다시 보내도 되는 저장(idempotent)은 '결과를 받지 못했다' + 두 번 안 들어감 안내, 새 버전·그 밖의 오류는 그대로", () => {
  const net = actionFailureMessage(new TypeError("Load failed"), { idempotent: true });
  assert.match(net, /^인터넷 연결이 끊겨 결과를 받지 못했습니다\(자동으로 3번 시도\)/);
  assert.match(net, /두 번 들어가지 않습니다/);
  const bad = actionFailureMessage(new Error("An unexpected response was received from the server."), { idempotent: true });
  assert.match(bad, /^서버가 응답하지 않아 결과를 받지 못했습니다\(자동으로 3번 시도\)/);
  assert.match(actionFailureMessage(new Error('Server Action "x" was not found on the server.'), { idempotent: true }), /새 버전/);
  assert.equal(actionFailureMessage(new Error("가짜 오류"), { idempotent: true }), "처리되지 않았습니다(오류: 가짜 오류). 잠시 뒤 다시 눌러 주세요.");
  // 예전 저장(다시 보내면 두 번 들어갈 수 있음)은 예전 문구 그대로
  assert.equal(actionFailureMessage(new TypeError("Load failed")), "인터넷 연결이 끊겨 처리되지 않았습니다. 연결을 확인하고 다시 눌러 주세요.");
});

test("자동으로 다시 시도할 오류: 연결 끊김·서버 오류 화면만(새 버전 배포·그 밖의 오류는 아님)", () => {
  assert.equal(isRetryableActionError(new TypeError("Failed to fetch")), true);
  assert.equal(isRetryableActionError(new TypeError("Load failed")), true);
  assert.equal(isRetryableActionError(new Error("An unexpected response was received from the server.")), true);
  assert.equal(isRetryableActionError(new Error('Server Action "x" was not found on the server.')), false);
  assert.equal(isRetryableActionError(new Error("가짜 오류")), false);
  assert.equal(isRetryableActionError(undefined), false);
});

test("callWithRetry: 연결 끊김이면 1초·2.5초 기다렸다 다시, 셋째에 되면 그 결과", async () => {
  const slept: number[] = [];
  const retried: number[] = [];
  let calls = 0;
  const result = await callWithRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("Load failed");
      return { ok: true };
    },
    { retry: true, sleep: async (ms) => void slept.push(ms), onRetry: (n) => retried.push(n) }
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3);
  assert.deepEqual(slept, [...ACTION_RETRY_DELAYS_MS]);
  assert.deepEqual(slept, [1000, 2500]);
  assert.deepEqual(retried, [1, 2]);
});

test("callWithRetry: 끝까지 끊기면 마지막 오류를 던짐(3번), 처음에 되면 기다리지 않음", async () => {
  let calls = 0;
  await assert.rejects(
    callWithRetry(
      async () => {
        calls += 1;
        throw new TypeError(`Failed to fetch ${calls}`);
      },
      { retry: true, sleep: async () => {} }
    ),
    /Failed to fetch 3/
  );
  assert.equal(calls, 3);

  const slept: number[] = [];
  assert.equal(await callWithRetry(async () => "가짜 결과", { retry: true, sleep: async (ms) => void slept.push(ms) }), "가짜 결과");
  assert.deepEqual(slept, []);
});

test("callWithRetry: retry가 꺼져 있거나(예전 저장) 다시 해도 안 되는 오류면 한 번만", async () => {
  for (const [retry, err] of [
    [false, new TypeError("Load failed")],
    [true, new Error('Server Action "x" was not found on the server.')],
    [true, new Error("가짜 오류")],
  ] as const) {
    let calls = 0;
    await assert.rejects(
      callWithRetry(
        async () => {
          calls += 1;
          throw err;
        },
        { retry, sleep: async () => {} }
      )
    );
    assert.equal(calls, 1, `${retry} ${err.message}`);
  }
});
