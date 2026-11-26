import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEET_NAME_MAX, safeSheetName } from "@/lib/sheetName";

test("엑셀이 안 받는 글자는 빈칸으로, 앞뒤 작은따옴표·빈칸 빼고, 비면 Sheet1", () => {
  assert.equal(safeSheetName("가짜 A/S센터 2026년"), "가짜 A S센터 2026년");
  assert.equal(safeSheetName("가짜[본사]:지점*?\\"), "가짜 본사 지점");
  assert.equal(safeSheetName("'가짜 상사'"), "가짜 상사");
  assert.equal(safeSheetName("  ///  "), "Sheet1");
  assert.equal(safeSheetName(""), "Sheet1");
  assert.equal(safeSheetName("History"), "History 1");
  assert.equal(safeSheetName("가짜 거래처 2026년"), "가짜 거래처 2026년", "문제없는 이름은 그대로");
});

test("31자까지 — 두 칸짜리 글자는 반으로 자르지 않음, 자른 끝의 작은따옴표도 뺌", () => {
  const long = "가".repeat(40);
  assert.equal(safeSheetName(long).length, SHEET_NAME_MAX);
  const emoji = "가".repeat(30) + "😀";
  assert.equal(safeSheetName(emoji), "가".repeat(30), "이모지는 2칸이라 31자를 넘어서 뺌");
  assert.equal(safeSheetName("가".repeat(30) + "'뒤"), "가".repeat(30));
});
