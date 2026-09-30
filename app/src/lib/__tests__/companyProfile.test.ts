import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_COMPANY_INFO,
  defaultCompanyInfo,
  findMatchingProfile,
  profileToCompanyInfo,
  sameCompanyInfo,
  toCompanyInfo,
  type CompanyProfileRow,
} from "@/lib/companyProfile";

const IM: CompanyProfileRow = {
  id: "a",
  company_name: "아이엠테크",
  representative_name: null,
  biz_reg_no: "521-32-01642",
  address: "인천 남동구 호구포로 44번길 77",
  biz_type: "제조업",
  biz_item: "컨베이어 장치 제조업",
  phone: null,
  fax: "032-232-0914",
  is_default: false,
};
const SECOND: CompanyProfileRow = {
  id: "b",
  company_name: "둘째상사",
  representative_name: "김둘",
  biz_reg_no: "123-45-67890",
  address: "경기 화성시",
  biz_type: "건설업",
  biz_item: "기계설비",
  phone: "031-000-0000",
  fax: null,
  is_default: true,
};

test("목록 한 줄 → 견적서 공급자 정보 (빈 칸은 빈 글자)", () => {
  assert.deepEqual(profileToCompanyInfo(IM), FALLBACK_COMPANY_INFO);
});

test("기본 공급자 → 없으면 목록 첫 번째 → 목록이 비면 예전 기본값", () => {
  assert.equal(defaultCompanyInfo([IM, SECOND]).companyName, "둘째상사");
  assert.equal(defaultCompanyInfo([{ ...SECOND, is_default: false }, IM]).companyName, "둘째상사");
  assert.deepEqual(defaultCompanyInfo([]), FALLBACK_COMPANY_INFO);
});

test("지금 칸의 정보와 똑같은 목록 공급자 찾기 — 앞뒤 띄어쓰기는 무시, 한 칸이라도 다르면 직접 입력", () => {
  const info = profileToCompanyInfo(SECOND);
  assert.equal(findMatchingProfile([IM, SECOND], info)?.id, "b");
  assert.equal(findMatchingProfile([IM, SECOND], { ...info, phone: " 031-000-0000 " })?.id, "b");
  assert.equal(findMatchingProfile([IM, SECOND], { ...info, phone: "031-111-1111" }), undefined);
  assert.ok(sameCompanyInfo(FALLBACK_COMPANY_INFO, profileToCompanyInfo(IM)));
});

test("견적서에 저장된 JSON → 빠진 칸은 빈 글자, 저장 안 했으면 null", () => {
  assert.equal(toCompanyInfo(null), null);
  assert.deepEqual(toCompanyInfo({ companyName: "둘째상사", bizRegNo: "123-45-67890", phone: 3 }), {
    companyName: "둘째상사",
    representativeName: "",
    bizRegNo: "123-45-67890",
    address: "",
    bizType: "",
    bizItem: "",
    phone: "",
    fax: "",
  });
});
