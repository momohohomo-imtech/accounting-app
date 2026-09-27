import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTransactionSheet, parseExcelDate, parseExcelNumber } from "@/lib/transactionExcel";

const HEADER = [
  "날짜",
  "구분(매입/매출)",
  "거래처명",
  "프로젝트명",
  "품목",
  "종류구분",
  "수량",
  "단가",
  "총금액",
  "결제수단",
  "결제시점(즉시/외상)",
  "세금계산서발행(Y/N)",
  "메모1",
  "메모2",
];

test("정해진 양식: 머리글 줄 아래 거래를 칸 이름대로 읽는다", () => {
  const rows = parseTransactionSheet(
    [
      HEADER,
      ["2026-09-10", "매입", "현대모비스", "2조립 도어 라인 보강", "운반비", "기타", "1", "407,385", "407,385원", "법인카드", "외상", "Y", "메모A", ""],
      ["2026.9.1", "매출", "동희오토", "", "앵커볼트", "", "", "", "13,579,500", "", "즉시", "N", "", "메모B"],
    ],
    2026
  );
  assert.deepEqual(rows, [
    {
      trans_date: "2026-09-10",
      type: "매입",
      client_name: "현대모비스",
      project_name: "2조립 도어 라인 보강",
      item_name: "운반비",
      category_name: "기타",
      quantity: 1,
      unit_price: 407385,
      amount: 407385,
      payment_method_name: "법인카드",
      payment_type: "credit",
      tax_invoice_issued: true,
      note1: "메모A",
      note2: "",
    },
    {
      trans_date: "2026-09-01",
      type: "매출",
      client_name: "동희오토",
      project_name: "",
      item_name: "앵커볼트",
      category_name: "",
      quantity: null,
      unit_price: null,
      amount: 13579500,
      payment_method_name: "",
      payment_type: "immediate",
      tax_invoice_issued: false,
      note1: "",
      note2: "메모B",
    },
  ]);
});

test("머리글 순서가 다르거나 다른 이름(일자·품명·합계)이어도 이름으로 찾는다", () => {
  const rows = parseTransactionSheet(
    [
      ["", "", ""],
      ["품명", "합계", "일자", "거래처", "금액"],
      ["장갑·마스크", "543,180", "2026/08/17", "케이티앤지물류", "493,800"],
    ],
    2026
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_name, "장갑·마스크");
  assert.equal(rows[0].trans_date, "2026-08-17");
  assert.equal(rows[0].client_name, "케이티앤지물류");
  assert.equal(rows[0].amount, 543180); // "금액"(공급가)보다 "합계"를 총금액으로
  assert.equal(rows[0].type, "매입");
});

test("머리글이 없으면 정해진 양식 순서로 읽는다", () => {
  const rows = parseTransactionSheet([["2026-06-22", "매입", "SJC", "1조립 컨베이어", "경유", "차량", "", "", "543,180"]], 2026);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].client_name, "SJC");
  assert.equal(rows[0].category_name, "차량");
  assert.equal(rows[0].amount, 543180);
});

test("빈 줄·예시 줄·합계 줄·금액 없는 줄은 건너뛰고, 금액이 없으면 수량×단가", () => {
  const rows = parseTransactionSheet(
    [
      HEADER,
      ["예) 2026-01-01", "매입", "거래처", "", "품목", "", "", "", "10,000"],
      [],
      ["2026-05-11", "매입", "기아", "", "페인트", "", "3", "1,500", ""],
      ["2026-05-12", "매입", "기아", "", "금액 빈 줄", "", "", "", ""],
      ["합계", "", "", "", "", "", "", "", "4,500"],
    ],
    2026
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_name, "페인트");
  assert.equal(rows[0].amount, 4500);
});

test("날짜 여러 형식", () => {
  assert.equal(parseExcelDate("2026-09-03", 2026), "2026-09-03");
  assert.equal(parseExcelDate("2026. 9. 3.", 2026), "2026-09-03");
  assert.equal(parseExcelDate("2026/09/03", 2026), "2026-09-03");
  assert.equal(parseExcelDate("2026년 9월 3일", 2026), "2026-09-03");
  assert.equal(parseExcelDate("20260903", 2026), "2026-09-03");
  assert.equal(parseExcelDate("26.9.3", 2026), "2026-09-03");
  assert.equal(parseExcelDate("9/3", 2026), "2026-09-03"); // 연도 없으면 올해
  assert.equal(parseExcelDate("46268", 2026), "2026-09-03"); // 날짜 서식 빠진 엑셀 날짜 숫자
  assert.equal(parseExcelDate("2026-13-01", 2026), null);
  assert.equal(parseExcelDate("현대모비스", 2026), null);
});

test("금액 글자 → 숫자", () => {
  assert.equal(parseExcelNumber("1,234,000원"), 1234000);
  assert.equal(parseExcelNumber("₩ 5,000"), 5000);
  assert.equal(parseExcelNumber("(1,000)"), -1000);
  assert.equal(parseExcelNumber("-300"), -300);
  assert.equal(parseExcelNumber(""), null);
  assert.equal(parseExcelNumber("없음"), null);
});
