import { test } from "node:test";
import assert from "node:assert/strict";
import { createEscapeStack } from "@/lib/escapeStack";

// 마이크로태스크 대신 손으로 묶음을 끝냄(한 번의 화면 갱신 = flush 한 번).
function manualStack() {
  const queued: (() => void)[] = [];
  const stack = createEscapeStack((fn) => queued.push(fn));
  return { stack, endCommit: () => queued.splice(0).forEach((fn) => fn()) };
}

test("ESC: 맨 위(나중에 열린) 팝업 하나만 닫힘 — 닫히면 그 아래 팝업 차례", () => {
  const { stack, endCommit } = manualStack();
  const log: string[] = [];
  const page = stack.nextRenderOrder();
  const confirm = stack.nextRenderOrder();
  const removePage = stack.add(page, () => log.push("팝업"));
  endCommit();
  const removeConfirm = stack.add(confirm, () => log.push("확인창"));
  endCommit();
  assert.equal(stack.pressTop(), true);
  assert.deepEqual(log, ["확인창"]);
  removeConfirm();
  stack.pressTop();
  assert.deepEqual(log, ["확인창", "팝업"]);
  removePage();
  assert.equal(stack.pressTop(), false);
  assert.equal(stack.size(), 0);
});

test("ESC: 같은 순간에 같이 열린 바깥·안쪽 팝업은 안쪽이 위(React가 안쪽 effect를 먼저 실행해도)", () => {
  const { stack, endCommit } = manualStack();
  const log: string[] = [];
  const outer = stack.nextRenderOrder(); // 바깥이 먼저 그려짐
  const inner = stack.nextRenderOrder();
  stack.add(inner, () => log.push("안쪽")); // effect는 안쪽 먼저
  stack.add(outer, () => log.push("바깥"));
  endCommit();
  stack.pressTop();
  assert.deepEqual(log, ["안쪽"]);
});

test("ESC: 일찍 그려진 확인창이라도 나중에 열리면 맨 위", () => {
  const { stack, endCommit } = manualStack();
  const log: string[] = [];
  const confirmOrder = stack.nextRenderOrder(); // 앱 바깥(레이아웃)에서 처음부터 그려져 있음
  const popupOrder = stack.nextRenderOrder();
  stack.add(popupOrder, () => log.push("팝업"));
  endCommit();
  stack.add(confirmOrder, () => log.push("확인창"));
  endCommit();
  stack.pressTop();
  assert.deepEqual(log, ["확인창"]);
});

test("ESC: 묶음이 끝나기 전에 닫힌 팝업(StrictMode의 붙였다 떼기)은 남지 않음", () => {
  const { stack, endCommit } = manualStack();
  const log: string[] = [];
  const order = stack.nextRenderOrder();
  const remove = stack.add(order, () => log.push("처음"));
  remove();
  stack.add(order, () => log.push("다시"));
  endCommit();
  assert.equal(stack.size(), 1);
  stack.pressTop();
  assert.deepEqual(log, ["다시"]);
});

test("ESC: 열린 팝업이 없으면 아무것도 안 함", () => {
  const { stack } = manualStack();
  assert.equal(stack.pressTop(), false);
});
