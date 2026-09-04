"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { usePrintFitToPage } from "@/lib/usePrintFitToPage";

// 원청(기아 오토랜드 화성공장)이 요구하는 "공사 출입자 출입 신청서" 양식을 그대로
// 재현한 팝업. 출입명단의 인원 정보로 자동 기입하되, 화면에서 항목을 자유롭게
// 추가·수정(조공/직원/임의 구분 등)한 뒤 인쇄할 수 있음 — 개인정보 동의·보안서약은
// 실제 서명 전에 자동으로 체크되면 안 되므로 항상 빈 상태로 시작함.

type Member = { name: string; phone: string | null; birthDate: string | null; note: string };

type Consent = "" | "동의" | "미동의";
type Row = {
  key: string;
  category: string;
  name: string;
  birthDate: string;
  phone: string;
  personalInfoConsent: Consent;
  securityConsent: Consent;
  note: string;
};

const MIN_ROWS = 20;

// "1979-01-01" -> "79 01 01"
function formatBirthDateShort(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(-6);
  if (digits.length !== 6) return raw;
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}`;
}

// "010-1234-1334" -> "1234 1334" (앞자리 통신사/지역 번호는 빼고 뒤 8자리만)
function formatPhoneShort(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(-8);
  if (digits.length !== 8) return raw;
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
}

function buildRow(partial: Partial<Row> = {}): Row {
  return {
    key: crypto.randomUUID(),
    category: "",
    name: "",
    birthDate: "",
    phone: "",
    personalInfoConsent: "",
    securityConsent: "",
    note: "",
    ...partial,
  };
}

function ConsentPair({
  value,
  onChange,
}: {
  value: Consent;
  onChange: (v: Consent) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 whitespace-nowrap">
      <label className="flex items-center gap-0.5">
        <input type="checkbox" checked={value === "동의"} onChange={() => onChange(value === "동의" ? "" : "동의")} className="h-3.5 w-3.5" />
        동의
      </label>
      <label className="flex items-center gap-0.5">
        <input
          type="checkbox"
          checked={value === "미동의"}
          onChange={() => onChange(value === "미동의" ? "" : "미동의")}
          className="h-3.5 w-3.5"
        />
        미동의
      </label>
    </div>
  );
}

export function AccessApplicationPopup({
  supervisorName,
  members,
  onClose,
}: {
  supervisorName: string | null;
  members: Member[];
  onClose: () => void;
}) {
  useEscapeKey(true, onClose);
  const printRef = usePrintFitToPage<HTMLDivElement>();

  const [companyField, setCompanyField] = useState("에스 제이 씨");
  const [permitNumber, setPermitNumber] = useState("");
  const [supervisorField, setSupervisorField] = useState(supervisorName ?? "");
  const [contactField, setContactField] = useState("");
  const [headcountField, setHeadcountField] = useState("");
  const [rows, setRows] = useState<Row[]>(() => {
    const fromMembers = members.map((m) =>
      buildRow({
        name: m.name,
        birthDate: m.birthDate ? formatBirthDateShort(m.birthDate) : "",
        phone: m.phone ? formatPhoneShort(m.phone) : "",
        // 비고는 출입명단 쪽 메모를 그대로 끌어오지 않고 항상 빈칸으로 시작함.
        note: "",
      })
    );
    const blanks = Array.from({ length: Math.max(0, MIN_ROWS - fromMembers.length) }, () => buildRow());
    return [...fromMembers, ...blanks];
  });

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, buildRow()]);
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
          <div className="mb-4 flex items-start justify-between gap-3 print:hidden">
            <h2 className="text-lg font-semibold text-slate-900">공사 출입자 출입 신청서</h2>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={addRow}
                className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                + 행 추가
              </button>
              <ModalPrintButton />
              <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
                닫기
              </button>
            </div>
          </div>

          {/* 사람이 적거나 없어도(20줄 고정) 항상 A4 한 장을 꽉 채우도록, 기본 크기를
              1페이지보다 살짝 넉넉하게 잡아둠 — usePrintFitToPage가 넘치는 만큼만
              정확히 축소해서 결과적으로 항상 정확히 1페이지 크기로 맞춰짐. */}
          <div ref={printRef} style={{ fontFamily: "'맑은 고딕', 'Malgun Gothic', sans-serif", fontSize: 13, color: "#000" }}>
            <div className="flex items-center gap-4 border-b-4 border-black pb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kia-wordmark.png" alt="KIA" style={{ width: 170, height: "auto" }} />
              <h1 style={{ fontSize: 26, fontWeight: 700, flex: 1, textAlign: "center" }}>공사 출입자 출입 신청서</h1>
            </div>

            <div style={{ border: "2px solid #000", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <colgroup>
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "23%" }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "7px 8px", fontWeight: 600 }}>업체명</td>
                    <td colSpan={3} style={{ border: "1px solid #000", padding: "5px 8px" }}>
                      <input
                        value={companyField}
                        onChange={(e) => setCompanyField(e.target.value)}
                        className="w-full border-none bg-transparent p-0 focus:outline-none"
                        style={{ fontSize: 18, fontWeight: 700 }}
                      />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "7px 8px", fontWeight: 600 }}>작업허가번호</td>
                    <td style={{ border: "1px solid #000", padding: "7px 8px" }}>
                      <input
                        value={permitNumber}
                        onChange={(e) => setPermitNumber(e.target.value)}
                        className="w-full border-none bg-transparent p-0 focus:outline-none"
                        style={{ fontSize: 12 }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "7px 8px", fontWeight: 600 }}>감독자명</td>
                    <td style={{ border: "1px solid #000", padding: "7px 8px" }}>
                      <input
                        value={supervisorField}
                        onChange={(e) => setSupervisorField(e.target.value)}
                        className="w-full border-none bg-transparent p-0 focus:outline-none"
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "7px 8px", fontWeight: 600 }}>연락처</td>
                    <td style={{ border: "1px solid #000", padding: "7px 8px" }}>
                      <input
                        value={contactField}
                        onChange={(e) => setContactField(e.target.value)}
                        className="w-full border-none bg-transparent p-0 focus:outline-none"
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "7px 8px", fontWeight: 600 }}>인원수</td>
                    <td style={{ border: "1px solid #000", padding: "7px 8px" }}>
                      <input
                        value={headcountField}
                        onChange={(e) => setHeadcountField(e.target.value)}
                        className="w-full border-none bg-transparent p-0 focus:outline-none"
                        style={{ fontSize: 12 }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p style={{ fontWeight: 700, marginTop: 10, marginBottom: 2 }}>■ 개인정보 수집 및 이용 동의서</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.75, margin: 0 }}>
              1. 개인정보 수집,이용 목적: (주)기아(이하 &quot;회사&quot;)방문 예약 및 회사 정보보호를 위한 기록 보존
              <br />
              2. 개인정보 수집항목 : 소속(업체명),성명,생년월일, 전화번호
              <br />
              3. 개인정보 보유 및 이용기간 : 마지막 방문일로 부터 3년 경과 후 폐기
              <br />
              4. 귀하는 개인정보의 수집,이용에 대한 동의를 거부할 권리가 있으나, 동의거부 시 회사 내 출입이 제한될 수 있습니다.
              <br />
              (주)기아가 위와같이 개인정보 수집 이용함에 동의 합니다
            </p>

            <p style={{ fontWeight: 700, marginTop: 10, marginBottom: 2 }}>■ 사진 및 동영상 미촬영 보안 서약서</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.75, margin: 0 }}>
              1. 본인은 ㈜기아 오토랜드 화성공장에 출입하여 사진 및 동영상 촬영을 하지 않을것을 서약합니다.
              <br />
              2. 추후 사내 촬영으로 인한 사진 및 동영상 유출 시 해당업체 및 서약자 본인이 민형사상 책임을 질것을 확인합니다.
            </p>

            <div style={{ border: "2px solid #000", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #000", padding: "7px", width: "7%" }}>구분</th>
                  <th style={{ border: "1px solid #000", padding: "7px", width: "13%" }}>서약자 성명</th>
                  <th style={{ border: "1px solid #000", padding: "7px", width: "11%" }}>생년월일</th>
                  <th style={{ border: "1px solid #000", padding: "7px", width: "13%" }}>연락처</th>
                  <th style={{ border: "1px solid #000", padding: "7px", width: "19%" }}>개인정보수집</th>
                  <th style={{ border: "1px solid #000", padding: "7px", width: "19%" }}>보안 서약</th>
                  <th style={{ border: "1px solid #000", padding: "7px", width: "13%" }}>비고</th>
                  <th className="print:hidden" style={{ border: "1px solid #000", padding: "7px", width: "5%" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td style={{ border: "1px solid #000", padding: "8px 4px", textAlign: "center" }}>
                      <input
                        value={r.category}
                        onChange={(e) => updateRow(r.key, { category: e.target.value })}
                        placeholder={String(i + 1)}
                        className="w-full border-none bg-transparent p-0 text-center focus:outline-none"
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    {/* 이름/생년월일/연락처만 글씨를 키움 — 대신 칸 안쪽 여백을 줄여서
                        줄 전체 높이(=인쇄 시 전체 페이지 크기)는 그대로 유지함. */}
                    <td style={{ border: "1px solid #000", padding: "6px 4px" }}>
                      <input
                        value={r.name}
                        onChange={(e) => updateRow(r.key, { name: e.target.value })}
                        className="w-full border-none bg-transparent p-0 text-center focus:outline-none"
                        style={{ fontSize: 15, fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px 4px" }}>
                      <input
                        value={r.birthDate}
                        onChange={(e) => updateRow(r.key, { birthDate: e.target.value })}
                        className="w-full border-none bg-transparent p-0 text-center focus:outline-none"
                        style={{ fontSize: 15, fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px 4px" }}>
                      <input
                        value={r.phone}
                        onChange={(e) => updateRow(r.key, { phone: e.target.value })}
                        className="w-full border-none bg-transparent p-0 text-center focus:outline-none"
                        style={{ fontSize: 15, fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "8px 4px" }}>
                      <ConsentPair value={r.personalInfoConsent} onChange={(v) => updateRow(r.key, { personalInfoConsent: v })} />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "8px 4px" }}>
                      <ConsentPair value={r.securityConsent} onChange={(v) => updateRow(r.key, { securityConsent: v })} />
                    </td>
                    <td style={{ border: "1px solid #000", padding: "8px 4px" }}>
                      <input
                        value={r.note}
                        onChange={(e) => updateRow(r.key, { note: e.target.value })}
                        className="w-full border-none bg-transparent p-0 text-center focus:outline-none"
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td className="print:hidden" style={{ border: "1px solid #000", padding: "8px 4px", textAlign: "center" }}>
                      <button type="button" onClick={() => removeRow(r.key)} className="text-[10px] text-red-500 hover:text-red-700">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <p style={{ textAlign: "center", fontWeight: 600, marginTop: 10, fontSize: 12 }}>
              인원수에 맞게 신분증 제출 (명단제출 -&gt; 선출입 후 명단으로 출입보안 승인)
              <br />- 출입보안 미등록 시 공사진행 불가합니다.
            </p>

            <div className="flex items-center justify-center gap-2" style={{ marginTop: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kia-wordmark.png" alt="KIA" style={{ width: 70, height: "auto" }} />
              <span style={{ fontSize: 11, color: "#334155" }}>AutoLand화성</span>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
