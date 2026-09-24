import { test } from "node:test";
import assert from "node:assert/strict";
import { formatThousands, parseNumericInput } from "@/lib/numberInput";

test("천 단위 쉼표 표시", () => {
  assert.equal(formatThousands(""), "");
  assert.equal(formatThousands("100"), "100");
  assert.equal(formatThousands("1000"), "1,000");
  assert.equal(formatThousands("1234567890"), "1,234,567,890");
  assert.equal(formatThousands("-1234567"), "-1,234,567");
  assert.equal(formatThousands("1234.5"), "1,234.5");
});

test("입력한 글자 → 쉼표 없는 숫자", () => {
  assert.equal(parseNumericInput("1,234,567"), "1234567");
  assert.equal(parseNumericInput("1,234.5.6"), "1234.56");
  assert.equal(parseNumericInput("12,000원"), "12000");
  assert.equal(parseNumericInput("-5,000"), "5000"); // 기본은 음수 불가
  assert.equal(parseNumericInput("-5,000", { allowNegative: true }), "-5000");
  assert.equal(parseNumericInput("1,234.5", { allowDecimal: false }), "12345");
});

test("표시 → 입력 되돌리기가 원래 값과 같다", () => {
  for (const raw of ["0", "7", "1000", "98765432", "-120000"]) {
    assert.equal(parseNumericInput(formatThousands(raw), { allowNegative: true }), raw);
  }
});
