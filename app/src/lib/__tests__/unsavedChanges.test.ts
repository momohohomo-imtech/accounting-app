import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTraverseGuard,
  createUnsavedRegistry,
  leaveDialogLabels,
  leavingHref,
  RESTORE_WINDOW_MS,
  traverseDelta,
  type GuardState,
  type LinkClickInfo,
} from "@/lib/unsavedChanges";

const O = "http://localhost:3000";
const click = (href: string | null, extra: Partial<LinkClickInfo> = {}): LinkClickInfo => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  href,
  target: null,
  download: false,
  currentHref: `${O}/transactions?year=2026`,
  ...extra,
});

test("링크 클릭: 다른 화면·같은 화면의 다른 조건(팝업·탭)은 떠나는 이동", () => {
  assert.equal(leavingHref(click(`${O}/dashboard`)), `${O}/dashboard`);
  assert.equal(leavingHref(click(`${O}/transactions?year=2026&editTx=t1`)), `${O}/transactions?year=2026&editTx=t1`);
  assert.equal(leavingHref(click(`${O}/transactions?year=2025`)), `${O}/transactions?year=2025`);
  // 바깥 주소도(눌러서 화면을 떠나므로)
  assert.equal(leavingHref(click("https://example.com/a")), "https://example.com/a");
  // 상대 주소는 지금 주소 기준으로
  assert.equal(leavingHref(click("/memos")), `${O}/memos`);
});

test("링크 클릭: 새 탭·새 창·내려받기·같은 주소·메일은 묻지 않음", () => {
  assert.equal(leavingHref(click(`${O}/dashboard`, { ctrlKey: true })), null);
  assert.equal(leavingHref(click(`${O}/dashboard`, { metaKey: true })), null);
  assert.equal(leavingHref(click(`${O}/dashboard`, { shiftKey: true })), null);
  assert.equal(leavingHref(click(`${O}/dashboard`, { altKey: true })), null);
  assert.equal(leavingHref(click(`${O}/dashboard`, { button: 1 })), null);
  assert.equal(leavingHref(click(`${O}/dashboard`, { target: "_blank" })), null);
  assert.equal(leavingHref(click(`${O}/dashboard`, { target: "_self" })), `${O}/dashboard`);
  assert.equal(leavingHref(click(`${O}/api/export`, { download: true })), null);
  assert.equal(leavingHref(click(`${O}/dashboard`, { defaultPrevented: true })), null);
  assert.equal(leavingHref(click(`${O}/transactions?year=2026`)), null);
  assert.equal(leavingHref(click(`${O}/transactions?year=2026#memo`)), null);
  assert.equal(leavingHref(click("mailto:fake@example.com")), null);
  assert.equal(leavingHref(click("tel:010-0000-0000")), null);
  assert.equal(leavingHref(click("javascript:void(0)")), null);
  assert.equal(leavingHref(click(null)), null);
  assert.equal(leavingHref(click("")), null);
});

test("확인창 이름: 같은 이름은 한 번, 빈 이름 빼고, 많으면 외 N개", () => {
  assert.deepEqual(leaveDialogLabels(["대시보드 메모", "대시보드 메모", " ", "새 메모"]), ["대시보드 메모", "새 메모"]);
  assert.deepEqual(leaveDialogLabels(["a", "b", "c", "d"]), ["a", "b", "c", "d"]);
  assert.deepEqual(leaveDialogLabels(["a", "b", "c", "d", "e", "f"]), ["a", "b", "c", "외 3개"]);
});

test("등록부: 저장 안 한 칸만, 정한 내용은 다시 안 묻고 내용을 바꾸면 다시", () => {
  const reg = createUnsavedRegistry<GuardState>();
  const a: GuardState = { dirty: false, value: "", label: "메모 A" };
  const b: GuardState = { dirty: true, value: "가짜 글", label: "메모 B" };
  const ida = reg.add(() => a);
  const idb = reg.add(() => b);
  assert.deepEqual(reg.dirtyIds(), [idb]);
  a.dirty = true;
  a.value = "가짜 글 A";
  assert.deepEqual(reg.dirtyIds(), [ida, idb]);
  assert.deepEqual(reg.dirtyIds([idb]), [idb]);
  // "저장 안 함"으로 정함 — 같은 내용이면 다시 안 물음
  reg.decide([idb]);
  assert.deepEqual(reg.dirtyIds(), [ida]);
  b.value = "가짜 글 더";
  assert.deepEqual(reg.dirtyIds(), [ida, idb]);
  reg.remove(ida);
  assert.deepEqual(reg.dirtyIds(), [idb]);
  assert.equal(reg.get(ida), undefined);
  assert.equal(reg.get(idb)?.label, "메모 B");
  assert.equal(reg.size(), 1);
});

test("뒤로가기 칸 수: 기록 번호 차이, 모르면 뒤로 한 칸", () => {
  assert.equal(traverseDelta(5, 4), -1);
  assert.equal(traverseDelta(5, 2), -3);
  assert.equal(traverseDelta(2, 3), 1);
  assert.equal(traverseDelta(null, 3), -1);
  assert.equal(traverseDelta(3, undefined), -1);
  assert.equal(traverseDelta(-1, 2), -1);
  assert.equal(traverseDelta(3, 3), -1);
});

// 브라우저 흉내: 기록 목록 + 지금 위치, go는 나중에(popstate는 비동기) — 화면(Next.js)이 받은 popstate 수를 셈
function fakeBrowser(urls: string[], start = urls.length - 1) {
  let index = start;
  let time = 0;
  const queue: number[] = [];
  return {
    get url() {
      return urls[index];
    },
    get index() {
      return index;
    },
    go(delta: number) {
      queue.push(delta);
    },
    now: () => time,
    tick(ms: number) {
      time += ms;
    },
    /** 쌓인 go를 하나 실행 — 옮긴 칸 수(이동 전 navigate용)와 옮긴 뒤 주소 */
    flush(onTraverse: (delta: number, from: string) => void, onPop: () => void) {
      while (queue.length) {
        const d = queue.shift()!;
        const from = urls[index];
        onTraverse(d, from);
        index += d;
        onPop();
      }
    },
    /** 사용자가 누른 뒤로가기 */
    userGo(delta: number, onTraverse: (delta: number, from: string) => void, onPop: () => void) {
      const from = urls[index];
      onTraverse(delta, from);
      index += delta;
      onPop();
    },
  };
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function setup(answer: boolean | (() => boolean), urls = [`${O}/dashboard`, `${O}/memos`]) {
  const browser = fakeBrowser(urls);
  let dirty = true;
  let asked = 0;
  let nextSeen = 0;
  const guard = createTraverseGuard({
    go: (d) => browser.go(d),
    now: browser.now,
    href: () => browser.url,
    hasDirty: () => dirty,
    confirmLeave: async () => {
      asked += 1;
      return typeof answer === "function" ? answer() : answer;
    },
  });
  const onTraverse = (d: number, from: string) => guard.beforeTraverse(d, from);
  const onPop = () => {
    if (!guard.onPopState()) nextSeen += 1;
  };
  return {
    browser,
    guard,
    back: () => browser.userGo(-1, onTraverse, onPop),
    flush: () => browser.flush(onTraverse, onPop),
    setDirty: (v: boolean) => {
      dirty = v;
    },
    get asked() {
      return asked;
    },
    get nextSeen() {
      return nextSeen;
    },
  };
}

test("뒤로가기: 저장 안 한 칸이 없으면 그대로", () => {
  const s = setup(true);
  s.setDirty(false);
  s.back();
  assert.equal(s.nextSeen, 1);
  assert.equal(s.asked, 0);
  assert.equal(s.browser.url, `${O}/dashboard`);
});

test("뒤로가기: 계속 작성 → 원래 화면으로 되돌리고 화면은 그대로", async () => {
  const s = setup(false);
  s.back();
  assert.equal(s.nextSeen, 0, "Next.js는 이동을 모름");
  s.flush(); // 되돌리기(앞으로 한 칸)
  await settle();
  s.flush();
  assert.equal(s.asked, 1);
  assert.equal(s.nextSeen, 0);
  assert.equal(s.browser.url, `${O}/memos`);
});

test("뒤로가기: 저장/저장 안 함 → 되돌린 뒤 다시 뒤로, 그 이동만 Next.js로", async () => {
  const s = setup(true);
  s.back();
  s.flush();
  assert.equal(s.browser.url, `${O}/memos`);
  s.setDirty(false); // 저장했거나 정함
  await settle();
  s.flush();
  assert.equal(s.asked, 1);
  assert.equal(s.nextSeen, 1);
  assert.equal(s.browser.url, `${O}/dashboard`);
  // 그다음 뒤로가기는 다시 평소대로(저장 안 한 칸 없음)
});

test("뒤로가기: 여러 칸(기록 목록에서 고름)도 같은 칸만큼 되돌리고 다시 감", async () => {
  const urls = [`${O}/a`, `${O}/b`, `${O}/c`, `${O}/d`];
  const s = setup(true, urls);
  const onTraverse = (d: number, from: string) => s.guard.beforeTraverse(d, from);
  let seen = 0;
  const onPop = () => {
    if (!s.guard.onPopState()) seen += 1;
  };
  s.browser.userGo(-3, onTraverse, onPop);
  assert.equal(s.browser.url, `${O}/a`);
  s.browser.flush(onTraverse, onPop);
  assert.equal(s.browser.url, `${O}/d`);
  assert.equal(seen, 0);
  s.setDirty(false);
  await settle();
  s.browser.flush(onTraverse, onPop);
  assert.equal(s.browser.url, `${O}/a`);
  assert.equal(seen, 1);
});

test("뒤로가기: 되돌리기가 안 먹었으면(시간이 지남) 다음 뒤로가기는 막지 않고 다시 물음", async () => {
  const s = setup(false, [`${O}/start`, `${O}/dashboard`, `${O}/memos`]);
  s.back(); // 되돌리기 go는 쌓였지만 실행 안 됨(브라우저가 무시했다고 침)
  await settle();
  s.browser.tick(RESTORE_WINDOW_MS + 1);
  s.back();
  assert.equal(s.asked, 2, "두 번째 뒤로가기도 물어봄(삼키지 않음)");
});

test("뒤로가기: 되돌린 주소가 다르면(다른 이동) 삼키지 않음", async () => {
  const s = setup(false);
  s.back();
  // 되돌리기 전에 다른 이동이 끼어든 경우: 주소가 원래 주소가 아니면 되돌림 popstate로 보지 않음
  s.setDirty(false);
  const onTraverse = (d: number, from: string) => s.guard.beforeTraverse(d, from);
  let seen = 0;
  s.browser.userGo(0, onTraverse, () => {
    if (!s.guard.onPopState()) seen += 1;
  });
  assert.equal(seen, 1);
});
