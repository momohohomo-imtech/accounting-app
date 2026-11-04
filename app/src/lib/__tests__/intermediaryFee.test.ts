import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INTERMEDIARY_FEE,
  feeItemLabel,
  feeRowCheck,
  feeRowPct,
  intermediaryFeeAmount,
  intermediaryFeeRows,
  parseFeeSettings,
  validFeePct,
} from "@/lib/intermediaryFee";

// 가짜 자료만
test("중간 업체 수수료: 발주액 × 비율(원 단위 반올림), 발주액이 없으면 0", () => {
  assert.equal(intermediaryFeeAmount(7_000_000), 1_400_000);
  assert.equal(intermediaryFeeAmount(1_234_567), 246_913);
  assert.equal(intermediaryFeeAmount(null), 0);
  assert.equal(intermediaryFeeAmount(0), 0);
  assert.equal(intermediaryFeeAmount(1_000_000, 15), 150_000);
  assert.equal(intermediaryFeeAmount(1_000_000, 12.5), 125_000);
  assert.equal(DEFAULT_INTERMEDIARY_FEE.pct, 20);
});

test("버튼 설정: 품목 이름 = 이름 + 비율%, 비율은 0 초과 100 이하만", () => {
  assert.equal(feeItemLabel(DEFAULT_INTERMEDIARY_FEE), "현대 수수료 20%");
  assert.equal(feeItemLabel({ ...DEFAULT_INTERMEDIARY_FEE, itemName: "가짜 중개 수수료", pct: 12.5 }), "가짜 중개 수수료 12.5%");
  assert.equal(validFeePct(20), true);
  assert.equal(validFeePct(100), true);
  assert.equal(validFeePct(0), false);
  assert.equal(validFeePct(-5), false);
  assert.equal(validFeePct(101), false);
  assert.equal(validFeePct(Number.NaN), false);
});

test("저장된 설정 읽기: 없거나 깨졌으면 기본값, 빈 칸·잘못된 비율은 그 칸만 기본값", () => {
  assert.deepEqual(parseFeeSettings(null), DEFAULT_INTERMEDIARY_FEE);
  assert.deepEqual(parseFeeSettings("{깨짐"), DEFAULT_INTERMEDIARY_FEE);
  assert.deepEqual(parseFeeSettings('"글자"'), DEFAULT_INTERMEDIARY_FEE);
  assert.deepEqual(
    parseFeeSettings(JSON.stringify({ itemName: " 가짜 중개 수수료 ", clientName: "가짜 중개", categoryName: "가짜 분류", pct: 15 })),
    { itemName: "가짜 중개 수수료", clientName: "가짜 중개", categoryName: "가짜 분류", pct: 15 }
  );
  assert.deepEqual(parseFeeSettings(JSON.stringify({ itemName: "", clientName: "가짜 중개", pct: 0 })), {
    ...DEFAULT_INTERMEDIARY_FEE,
    clientName: "가짜 중개",
  });
  // 카테고리를 "미분류"(빈 글자)로 저장했으면 다시 읽어도 미분류 — 기본값으로 돌아가지 않음
  assert.equal(parseFeeSettings(JSON.stringify({ ...DEFAULT_INTERMEDIARY_FEE, categoryName: "" })).categoryName, "");
  // 비율은 소수 둘째 자리로(버튼 이름과 계산이 같은 비율)
  assert.equal(parseFeeSettings(JSON.stringify({ ...DEFAULT_INTERMEDIARY_FEE, pct: 12.345 })).pct, 12.35);
  assert.equal(parseFeeSettings(JSON.stringify({ ...DEFAULT_INTERMEDIARY_FEE, pct: "15" })).pct, 15);
});

test("이미 있는 수수료 줄: 설정의 거래처 + (설정의 품목 이름으로 시작하거나 '수수료') — 같은 거래처의 자재 줄은 아님", () => {
  const rows = [
    { client_name: "현대기계", item_name: "현대 수수료 20%" },
    { client_name: "현대기계", item_name: "가짜 자재" }, // 구매대행 자재
    { client_name: "가짜 상사", item_name: "가짜 수수료" },
    { client_name: null, item_name: null },
  ];
  assert.deepEqual(intermediaryFeeRows(rows), [rows[0]]);
  // 이름을 바꾼 설정 — 그 거래처·품목 이름으로 찾음
  const renamed = { itemName: "가짜 중개비", clientName: "가짜 중개", categoryName: "가짜 분류", pct: 15 };
  const other = [
    { client_name: "가짜 중개", item_name: "가짜 중개비 15%" },
    { client_name: "가짜 중개", item_name: "가짜 자재" },
  ];
  assert.deepEqual(intermediaryFeeRows(other, renamed), [other[0]]);
});

test("수수료 줄 확인: 줄 이름에 적힌 비율로 — 비율 설정을 바꿔도 예전 비율로 넣은 줄은 그 비율로 맞는지 봄", () => {
  assert.equal(feeRowPct("현대 수수료 20%"), 20);
  assert.equal(feeRowPct("가짜 중개비 12.5 %"), 12.5);
  assert.equal(feeRowPct("가짜 수수료(15%) 정산"), 15);
  assert.equal(feeRowPct("가짜 수수료"), null);
  assert.equal(feeRowPct("가짜 수수료 0%"), null);
  assert.equal(feeRowPct(null), null);
  // 줄 이름의 20%로 확인 — 설정이 15%여도 발주액 그대로면 맞음
  assert.deepEqual(feeRowCheck({ item_name: "현대 수수료 20%", amount: 1_400_000 }, 7_000_000, 15), {
    pct: 20,
    expected: 1_400_000,
    matches: true,
  });
  // 발주액이 바뀌면 안 맞음
  assert.equal(feeRowCheck({ item_name: "현대 수수료 20%", amount: 1_400_000 }, 8_000_000, 20)?.matches, false);
  // 이름에 비율이 없으면 설정 비율로
  assert.deepEqual(feeRowCheck({ item_name: "가짜 수수료", amount: 1_050_000 }, 7_000_000, 15), {
    pct: 15,
    expected: 1_050_000,
    matches: true,
  });
  // 발주액이 없으면 확인하지 않음
  assert.equal(feeRowCheck({ item_name: "현대 수수료 20%", amount: 1_400_000 }, null, 20), null);
});
