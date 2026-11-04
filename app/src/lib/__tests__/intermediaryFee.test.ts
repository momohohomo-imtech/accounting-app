import { test } from "node:test";
import assert from "node:assert/strict";
import { INTERMEDIARY_FEE, intermediaryFeeAmount, intermediaryFeeRows } from "@/lib/intermediaryFee";

// 가짜 자료만
test("중간 업체 수수료: 발주액의 20%(원 단위 반올림), 발주액이 없으면 0", () => {
  assert.equal(intermediaryFeeAmount(3_000_000), 600_000);
  assert.equal(intermediaryFeeAmount(1_234_567), 246_913);
  assert.equal(intermediaryFeeAmount(null), 0);
  assert.equal(intermediaryFeeAmount(0), 0);
  assert.equal(intermediaryFeeAmount(1_000_000, 15), 150_000);
  assert.equal(INTERMEDIARY_FEE.pct, 20);
});

test("이미 있는 수수료 줄: 거래처에 '현대' + 품목에 '수수료' — 현대가 산 자재 줄은 아님", () => {
  const rows = [
    { client_name: "현대기계", item_name: "현대 수수료 20%" },
    { client_name: "현대기계", item_name: "가짜 자재" }, // 구매대행 자재
    { client_name: "가짜 상사", item_name: "가짜 수수료" },
    { client_name: null, item_name: null },
  ];
  assert.deepEqual(intermediaryFeeRows(rows), [rows[0]]);
});
