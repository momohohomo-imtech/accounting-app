import { test } from "node:test";
import assert from "node:assert/strict";
import { tasksForMonth, tasksSummary } from "@/lib/annualTasks";

test("이번 달 할 일: 매달 원천세·4대보험료(10일)·일용근로 지급명세서(말일) + 그 달 신고", () => {
  const oct = tasksForMonth(2026, 10);
  assert.deepEqual(oct.map((t) => [t.day, t.short]), [
    [10, "원천세"],
    [10, "4대보험료"],
    [25, "부가세 2기 예정고지"],
    [31, "일용근로 지급명세서"],
  ]);
  assert.equal(tasksSummary(oct), "10일 원천세·4대보험료 · 25일 부가세 2기 예정고지 · 31일 일용근로 지급명세서");
});

test("이번 달 할 일: 1월 부가세 확정·5월 종합소득세는 전년도 대시보드로, 6월은 전년도 잠금 안내, 2월 말일·윤년", () => {
  const jan = tasksForMonth(2027, 1);
  assert.equal(jan.find((t) => t.short === "부가세 2기 확정")?.href, "/dashboard?year=2026");
  const may = tasksForMonth(2027, 5);
  assert.equal(may.find((t) => t.short === "종합소득세")?.day, 31);
  assert.equal(may.find((t) => t.short === "종합소득세")?.href, "/dashboard?year=2026");
  assert.equal(tasksForMonth(2027, 6).find((t) => t.short === "전년도 잠금")?.href, "/transactions?tab=check&year=2026");
  assert.equal(tasksForMonth(2028, 2).find((t) => t.short === "연말정산")?.day, 29);
  assert.equal(tasksForMonth(2027, 2).find((t) => t.short === "일용근로 지급명세서")?.day, 28);
  // 7월은 확정 신고와 분납이 함께(같은 날은 매달 할 일 먼저)
  assert.deepEqual(tasksForMonth(2026, 7).filter((t) => t.day > 10).map((t) => t.short), ["부가세 1기 확정", "일용근로 지급명세서", "종합소득세 분납"]);
});
