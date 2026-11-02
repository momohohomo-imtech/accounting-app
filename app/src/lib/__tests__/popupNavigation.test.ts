import { test } from "node:test";
import assert from "node:assert/strict";
import { isUnderlyingEntry, MAX_BACK_STEPS, popupBackSteps } from "@/lib/popupNavigation";

const O = "http://localhost:3000";
const u = (path: string) => `${O}${path}`;

test("팝업 닫기: 닫은 뒤 주소와 같은 기록(순서·빈 값 무관)", () => {
  assert.equal(isUnderlyingEntry(u("/reports?year=2026"), "/reports?year=2026", O), true);
  assert.equal(isUnderlyingEntry(u("/transactions?month=10&year=2026&type="), "/transactions?year=2026&month=10", O), true);
  assert.equal(isUnderlyingEntry(u("/reports?year=2026#top"), "/reports?year=2026", O), true);
  // 기록에 없는 조건은 닫은 뒤 주소가 기본값을 적어 넣은 것(맨 주소로 연 매입매출장 → 수정 팝업은 연·월을 적어서 엶)
  assert.equal(isUnderlyingEntry(u("/transactions"), "/transactions?year=2026&month=10", O), true);
});

test("팝업 닫기: 다른 화면·다른 팝업이 열린 기록은 아님", () => {
  assert.equal(isUnderlyingEntry(u("/dashboard"), "/reports?year=2026", O), false);
  assert.equal(isUnderlyingEntry(u("/reports?year=2026&siteReport=가짜현장"), "/reports?year=2026", O), false);
  assert.equal(isUnderlyingEntry(u("/reports?year=2025"), "/reports?year=2026", O), false);
  assert.equal(isUnderlyingEntry(u("/reports?category=a&category=b"), "/reports?category=a", O), false);
  assert.equal(isUnderlyingEntry(u("/reports?category=a"), "/reports?category=a&category=b", O), true);
});

test("팝업 닫기: 그 화면에서 연 팝업 → 한 칸 뒤로", () => {
  const history = [u("/dashboard"), u("/reports?year=2026"), u("/reports?year=2026&project=p1")];
  assert.equal(popupBackSteps("/reports?year=2026", history, 2), 1);
});

test("팝업 닫기: 팝업 위에 겹친 팝업(보고서 → 거래 수정)은 아래 팝업으로, 그다음 화면으로", () => {
  const history = [
    u("/reports?year=2026"),
    u("/reports?year=2026&vendor=%EA%B0%80%EC%A7%9C"),
    u("/reports?year=2026&vendor=%EA%B0%80%EC%A7%9C&editTx=t1"),
  ];
  const vendorHref = `/reports?year=2026&vendor=${encodeURIComponent("가짜")}`;
  assert.equal(popupBackSteps(vendorHref, history, 2), 1);
  assert.equal(popupBackSteps("/reports?year=2026", history, 1), 1);
});

test("팝업 닫기: 사이에 다른 팝업 기록이 끼어 있으면 그 너머 화면까지(그 팝업도 뒤로가기에 안 나오게)", () => {
  const history = [u("/reports?year=2026"), u("/reports?year=2026&siteReport=s1"), u("/reports?year=2026&project=p1")];
  assert.equal(popupBackSteps("/reports?year=2026", history, 2), 2);
});

test("팝업 닫기: 다른 화면에서 바로 열었거나 기록이 없으면 0(지금 기록을 바꿈)", () => {
  assert.equal(popupBackSteps("/reports?year=2026", [u("/dashboard"), u("/reports?year=2026&project=p1")], 1), 0);
  assert.equal(popupBackSteps("/reports?year=2026", [u("/reports?year=2026&project=p1")], 0), 0);
  // 다른 화면 기록을 만나면 그 너머의 같은 화면 기록은 안 봄(화면을 벗어나게 됨)
  assert.equal(
    popupBackSteps("/reports?year=2026", [u("/reports?year=2026"), u("/dashboard"), u("/reports?year=2026&project=p1")], 2),
    0
  );
  assert.equal(popupBackSteps("/reports?year=2026", [null, u("/reports?year=2026&project=p1")], 1), 0);
});

test("팝업 닫기: 같은 화면 기록이 너무 많이 쌓였으면 최대 칸 수까지만", () => {
  const popups = Array.from({ length: MAX_BACK_STEPS + 2 }, (_, i) => u(`/reports?year=2026&project=p${i}`));
  const history = [u("/reports?year=2026"), ...popups];
  assert.equal(popupBackSteps("/reports?year=2026", history, history.length - 1), 0);
  const short = [u("/reports?year=2026"), ...popups.slice(0, 3)];
  assert.equal(popupBackSteps("/reports?year=2026", short, short.length - 1), 3);
});
