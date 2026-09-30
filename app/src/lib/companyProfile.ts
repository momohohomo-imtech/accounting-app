// 견적서 공급자(우리 회사) 정보 — 공급자 목록(company_profiles, 089)의 한 줄과, 견적서마다 저장되는
// 값(quotes.company_info, 080)을 오가는 변환·비교. 견적서 인쇄화면(QuotePrintView)이 씀.

export type QuoteCompanyInfo = {
  companyName: string;
  representativeName: string;
  bizRegNo: string;
  address: string;
  bizType: string;
  bizItem: string;
  phone: string;
  fax: string;
};

export type CompanyProfileRow = {
  id: string;
  company_name: string;
  representative_name: string | null;
  biz_reg_no: string | null;
  address: string | null;
  biz_type: string | null;
  biz_item: string | null;
  phone: string | null;
  fax: string | null;
  is_default: boolean;
};

// 목록이 비어 있거나(089 실행 전 포함) 못 읽을 때 쓰는 예전 기본값.
export const FALLBACK_COMPANY_INFO: QuoteCompanyInfo = {
  companyName: "아이엠테크",
  representativeName: "",
  bizRegNo: "521-32-01642",
  address: "인천 남동구 호구포로 44번길 77",
  bizType: "제조업",
  bizItem: "컨베이어 장치 제조업",
  phone: "",
  fax: "032-232-0914",
};

const KEYS: (keyof QuoteCompanyInfo)[] = [
  "companyName",
  "representativeName",
  "bizRegNo",
  "address",
  "bizType",
  "bizItem",
  "phone",
  "fax",
];

export function profileToCompanyInfo(p: CompanyProfileRow): QuoteCompanyInfo {
  return {
    companyName: p.company_name ?? "",
    representativeName: p.representative_name ?? "",
    bizRegNo: p.biz_reg_no ?? "",
    address: p.address ?? "",
    bizType: p.biz_type ?? "",
    bizItem: p.biz_item ?? "",
    phone: p.phone ?? "",
    fax: p.fax ?? "",
  };
}

// 견적서에 저장된 company_info(JSON) → 빠진 칸은 빈 글자로. 저장된 값이 없으면 null.
export function toCompanyInfo(raw: unknown): QuoteCompanyInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const info = {} as QuoteCompanyInfo;
  for (const k of KEYS) info[k] = typeof obj[k] === "string" ? (obj[k] as string) : "";
  return info;
}

// 앞뒤 띄어쓰기만 다른 건 같은 정보로 봄.
export function sameCompanyInfo(a: QuoteCompanyInfo, b: QuoteCompanyInfo) {
  return KEYS.every((k) => (a[k] ?? "").trim() === (b[k] ?? "").trim());
}

// 지금 칸에 들어 있는 정보와 똑같은 목록 공급자(없으면 undefined = 직접 입력한 정보).
export function findMatchingProfile(profiles: CompanyProfileRow[], info: QuoteCompanyInfo) {
  return profiles.find((p) => sameCompanyInfo(profileToCompanyInfo(p), info));
}

// 공급자 정보를 저장한 적 없는 견적서(새 견적서 포함)가 보여줄 값: 기본 공급자 → 목록 첫 번째 → 예전 기본값.
export function defaultCompanyInfo(profiles: CompanyProfileRow[]): QuoteCompanyInfo {
  const p = profiles.find((x) => x.is_default) ?? profiles[0];
  return p ? profileToCompanyInfo(p) : FALLBACK_COMPANY_INFO;
}
