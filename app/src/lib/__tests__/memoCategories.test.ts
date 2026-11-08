import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MEMO_CATEGORIES,
  MEMO_CATEGORY_COLORS,
  MEMO_UNCATEGORIZED,
  memoCategoryBadge,
  memoCategoryColor,
  memoCategoryNameProblem,
  memoCategoryTabs,
  nextMemoCategorySortOrder,
  normalizeMemoCategoryName,
  sortMemoCategories,
  type MemoCategory,
} from "@/lib/memoCategories";
import { readFileSync } from "node:fs";

// 가짜 자료만
const cat = (id: string, name: string, sort_order: number, color = "gray"): MemoCategory => ({ id, name, color, sort_order });

test("104 실행 전 기본 5개 = 085 SQL 제약과 같은 이름, 104 SQL이 넣는 순서·색과도 같음", () => {
  const sql085 = readFileSync(new URL("../../../../supabase/085_memo_category.sql", import.meta.url), "utf8");
  const sql104 = readFileSync(new URL("../../../../supabase/104_memo_categories.sql", import.meta.url), "utf8");
  for (const c of DEFAULT_MEMO_CATEGORIES) {
    assert.ok(sql085.includes(`'${c.name}'`), `085에 ${c.name}`);
    assert.ok(sql104.includes(`('${c.name}', '${c.color}', ${c.sort_order})`), `104에 ${c.name}/${c.color}/${c.sort_order}`);
    assert.ok(MEMO_CATEGORY_COLORS.some((x) => x.value === c.color));
  }
});

test("이름 다듬기·색 확인·순서", () => {
  assert.equal(normalizeMemoCategoryName("  가짜   본사 "), "가짜 본사");
  assert.equal(normalizeMemoCategoryName(null), "");
  assert.equal(memoCategoryColor("pink"), "pink");
  assert.equal(memoCategoryColor("없는색"), "gray");
  const sorted = sortMemoCategories([cat("a", "다", 1), cat("b", "가", 1), cat("c", "나", 0)]);
  assert.deepEqual(sorted.map((c) => c.name), ["나", "가", "다"]);
});

test("배지: 목록에 있는 구분은 그 색, 목록에 없거나 미분류는 옅은 회색", () => {
  const list = [cat("a", "가짜 본사", 0, "blue"), cat("b", "가짜 장비", 1, "pink")];
  assert.equal(memoCategoryBadge("가짜 본사", list), "bg-brand-soft text-brand-dark");
  assert.equal(memoCategoryBadge("가짜 장비", list), "bg-pink-50 text-pink-700");
  assert.equal(memoCategoryBadge("예전 이름", list), "bg-slate-50 text-slate-400");
  assert.equal(memoCategoryBadge(null, list), "bg-slate-50 text-slate-400");
});

test("탭: 목록 순서 → 목록에 없는데 메모에 남은 이름(가나다) → 미분류", () => {
  const list = [cat("a", "가짜 둘", 1), cat("b", "가짜 하나", 0)];
  assert.deepEqual(memoCategoryTabs(list, ["가짜 둘", null, "예전 나", "예전 가", "예전 가", ""]), [
    "가짜 하나",
    "가짜 둘",
    "예전 가",
    "예전 나",
    MEMO_UNCATEGORIZED,
  ]);
});

test("이름 문제: 빈칸·20자 넘음·탭 이름·이미 있음(자기 자신은 괜찮음)", () => {
  const list = [cat("a", "가짜 본사", 0), cat("b", "가짜 장비", 1)];
  assert.match(memoCategoryNameProblem("   ", list) ?? "", /입력/);
  assert.match(memoCategoryNameProblem("가".repeat(21), list) ?? "", /20자/);
  assert.equal(memoCategoryNameProblem("가".repeat(20), list), null);
  assert.match(memoCategoryNameProblem("미분류", list) ?? "", /쓸 수 없습니다/);
  assert.match(memoCategoryNameProblem("전체", list) ?? "", /쓸 수 없습니다/);
  assert.match(memoCategoryNameProblem(" 가짜  장비 ", list) ?? "", /이미 있습니다/);
  assert.equal(memoCategoryNameProblem("가짜 장비", list, "b"), null, "자기 이름 그대로 저장");
  assert.equal(memoCategoryNameProblem("가짜 새것", list), null);
});

test("새 구분 순서: 맨 뒤", () => {
  assert.equal(nextMemoCategorySortOrder([{ sort_order: 0 }, { sort_order: 7 }, { sort_order: 3 }]), 8);
  assert.equal(nextMemoCategorySortOrder([]), 0);
});
