"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { usePrintFitToPage } from "@/lib/usePrintFitToPage";

// 원청(기아 오토랜드 화성공장)이 준 엑셀 양식("공사 출입자 명부" 시트, 인쇄 영역 A1:AV30)을 칸 너비·줄 높이·글꼴·
// 테두리·로고 위치·문구까지 그대로 재현한 팝업(사용자 요청 "작성지 동일하게, 색상·규격 전부"). 출입명단의 인원 정보로
// 자동 기입하되 화면에서 항목을 자유롭게 추가·수정한 뒤 인쇄 — 개인정보 동의·보안서약은 실제 서명 전에 자동으로 체크되면
// 안 되므로 항상 빈 상태(□)로 시작함.
// 인쇄는 엑셀 페이지 설정 그대로: A4 세로, 여백 좌우 12mm·위아래 6mm, 가로·세로 가운데, 81%(엑셀 "1페이지에 맞추기"가
// 저장해 둔 배율 — 행을 늘려 한 장을 넘으면 그만큼 더 줄임), 아래 왼쪽에 원본 바닥글.

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

// 엑셀 열 너비를 인쇄 크기(pt)로 — 너비 2 = 12.375pt, 2.625 = 16.125pt, 1.375 = 8.625pt(열 너비 × 8px + 0.5px, 96dpi).
// 이 크기라야 엑셀이 저장해 둔 인쇄 배율 81%(A4 폭 186mm ÷ 표 폭)가 나옴. A~AV 48칸.
const N = 12.375;
const W = 16.125;
const COLS: number[] = [...Array<number>(28).fill(N), ...Array<number>(14).fill(W), ...Array<number>(4).fill(N), W, 8.625];
const SHEET_WIDTH = COLS.reduce((sum, w) => sum + w, 0); // 646.5pt
// 줄 높이(pt) — 엑셀 1~30행.
const ROW = { title: 30.75, gap: 4.5, info: 29.25, consent: 101.25, security: 63.75, cell: 25.5, notice: 42.75, gap2: 3.75, logo: 18 };
const PRINT_SCALE = 0.81;

// 글꼴 — 원본은 기아 전용 글꼴(기아 Light·Medium·Bold, 굵게). 그 글꼴이 깔린 PC면 그대로, 없으면 맑은 고딕.
const KIA_LIGHT = "'기아 Light', 'KIA Light', '맑은 고딕', 'Malgun Gothic', sans-serif";
const KIA_MEDIUM = "'기아 Medium', 'KIA Medium', '맑은 고딕', 'Malgun Gothic', sans-serif";
const KIA_BOLD = "'기아 Bold', 'KIA Bold', '맑은 고딕', 'Malgun Gothic', sans-serif";
const GULIM = "'굴림', Gulim, '맑은 고딕', 'Malgun Gothic', sans-serif";

// 원본 문구 그대로(띄어쓰기·"개이정보"·따옴표 모양 포함).
const CONSENT_TEXT = ` ■ 개인정보 수집 및 이용 동의서

 1. 개인정보 수집,이용 목적: (주)기아(이하 “회사“)방문 예약 및 회사 정보보호를 위한 기록 보존
 2. 개이정보 수집항목 : 소속(업체명),성명,생년월일, 전화번호
 3. 개인정보 보유 및 이용기간 : 마지막 방문일로 부터 3년 경과 후 폐기
 4. 귀하는 개인정보의 수집,이용에 대한 동의를 거부할 권리가 있으나, 동의거부 시 회사 내 출입이 제한될 수 있습니다.
  (주)기아가 위와같이 개인정보 수집 이용함에 동의 합니다`;
const SECURITY_TEXT = ` ■ 사진 및 동영상 미촬영 보안 서약서 / 불법체류자 미 입문 확인 서
 1. 본인은 ㈜기아 오토랜드 화성공장에 출입하여 사진 및 동영상 촬영을 하지 않을것을 서약합니다.
 2. 추후 사내 촬영으로 인한 사진 및 동영상 유출 시 해당업체 및 서약자 본인이 민형사상 책임을 질것을 확인합니다.
 3. 본 업체는 하기 출입인원에 대해 불법체류자가 없음을 확인 하였습니다.`;
const NOTICE_TEXT = `인원수에 맞게 신분증 제출 (명단제출 -> 선출입 후 명단으로 출입보안 승인)
 - 출입보안 미등록 시 공사진행 불가합니다.`;
const FOOTER_TEXT = "본 문서는 현대자동차·기아의 정보자산으로 관련 법령에 의해 보호받습니다.";

// 테두리 — 바깥(왼쪽·오른쪽·맨 위 줄)은 중간 굵기, 안쪽과 맨 아래는 가는 선(엑셀 thin·medium).
const THIN = "0.75pt solid #000";
const MEDIUM = "1.5pt solid #000";
function cellStyle(edge: { top?: boolean; left?: boolean; right?: boolean } = {}): CSSProperties {
  return {
    borderTop: edge.top ? MEDIUM : THIN,
    borderLeft: edge.left ? MEDIUM : THIN,
    borderRight: edge.right ? MEDIUM : THIN,
    borderBottom: THIN,
    padding: 0,
    textAlign: "center",
    verticalAlign: "middle",
    overflow: "hidden",
    whiteSpace: "nowrap",
  };
}
const LABEL: CSSProperties = { fontFamily: KIA_LIGHT, fontWeight: 700, fontSize: "11pt" };
const SMALL: CSSProperties = { fontFamily: KIA_LIGHT, fontWeight: 700, fontSize: "10pt" };
const EDGE_CELL: CSSProperties = { border: "none", padding: 0 };
// 입력칸은 칸 글꼴 그대로·검정 글자·테두리 없음(입력칸 색은 globals.css 규칙이 이겨서 style로 줌).
const INPUT: CSSProperties = {
  font: "inherit",
  color: "#000",
  background: "transparent",
  border: 0,
  padding: 0,
  margin: 0,
  width: "100%",
  textAlign: "center",
  outline: "none",
};

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

// 원본 칸 글자 "□동의 □ 미동의" 그대로 — 네모를 누르면 ■(체크), 다시 누르면 □.
function ConsentMarks({ value, onChange }: { value: Consent; onChange: (v: Consent) => void }) {
  const mark = (v: Exclude<Consent, "">) => (
    <button
      type="button"
      onClick={() => onChange(value === v ? "" : v)}
      aria-pressed={value === v}
      aria-label={v}
      className="cursor-pointer hover:opacity-60"
    >
      {value === v ? "■" : "□"}
    </button>
  );
  return (
    <>
      {mark("동의")}동의 {mark("미동의")} 미동의
    </>
  );
}

function TextCell({ value, onChange, colSpan, style }: { value: string; onChange: (v: string) => void; colSpan: number; style: CSSProperties }) {
  return (
    <td colSpan={colSpan} style={style}>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={INPUT} />
    </td>
  );
}

function Label({ colSpan, style, children }: { colSpan: number; style: CSSProperties; children: ReactNode }) {
  return (
    <td colSpan={colSpan} style={{ ...style, ...LABEL }}>
      {children}
    </td>
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
  // 인쇄 칸 높이 285mm(A4 297 − 위아래 여백 6mm) — 반올림으로 둘째 장이 생기지 않게 1mm 덜.
  const printRef = usePrintFitToPage<HTMLDivElement>(284, false, PRINT_SCALE);

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
      {/* 이 양식을 인쇄할 때만 쓰는 용지 설정(엑셀 페이지 설정과 같게) — 팝업이 열려 있을 때만 있음(이름 없는 @page). */}
      <style>{"@page { size: A4 portrait; margin: 6mm 12mm; }"}</style>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
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

          {/* 화면: 양식 크기 그대로(휴대폰은 옆으로 넘김, 오른쪽 여백은 줄 삭제 버튼 자리). 인쇄: 인쇄 칸(186 × 284mm) 가운데.
              표를 스크롤 상자 바로 아래에 두지 않음 — 목록 표용 휴대폰 규칙(첫 칸 고정·폭 제한)이 양식 칸 너비를 바꿈. */}
          <div className="overflow-x-auto pb-1 print:relative print:flex print:h-[284mm] print:items-center print:justify-center print:overflow-visible print:pb-0">
            <div className="pr-12 print:pr-0">
              <div
                ref={printRef}
                style={{ width: `${SHEET_WIDTH}pt`, color: "#000", background: "#fff", fontFamily: KIA_LIGHT }}
              >
                <table style={{ width: `${SHEET_WIDTH}pt`, tableLayout: "fixed", borderCollapse: "collapse" }}>
                  <colgroup>
                    {COLS.map((w, i) => (
                      <col key={i} style={{ width: `${w}pt` }} />
                    ))}
                  </colgroup>
                  <tbody>
                    {/* 1행: 왼쪽 위 KIA 로고, 제목(기아 Bold 22pt) — 엑셀 그림·글상자 위치 그대로 */}
                    <tr style={{ height: `${ROW.title}pt` }}>
                      <td colSpan={48} style={{ ...EDGE_CELL, position: "relative" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/kia-logo-form.png"
                          alt="KIA"
                          style={{ position: "absolute", left: "14.14pt", top: "4.41pt", width: "107.99pt", height: "24.7pt" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "129.04pt",
                            top: "1.37pt",
                            width: "384.88pt",
                            height: "28.63pt",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: KIA_BOLD,
                            fontWeight: 700,
                            fontSize: "22pt",
                            whiteSpace: "nowrap",
                          }}
                        >
                          공사 출입자 출입 신청서
                        </div>
                      </td>
                    </tr>
                    <tr style={{ height: `${ROW.gap}pt` }}>
                      <td colSpan={48} style={EDGE_CELL} />
                    </tr>

                    <tr style={{ height: `${ROW.info}pt` }}>
                      <td style={EDGE_CELL} />
                      <Label colSpan={4} style={cellStyle({ top: true, left: true })}>
                        업체명
                      </Label>
                      <TextCell colSpan={14} value={companyField} onChange={setCompanyField} style={{ ...cellStyle({ top: true }), ...LABEL }} />
                      <Label colSpan={8} style={cellStyle({ top: true })}>
                        작업허가번호
                      </Label>
                      <TextCell
                        colSpan={20}
                        value={permitNumber}
                        onChange={setPermitNumber}
                        style={{ ...cellStyle({ top: true, right: true }), ...LABEL }}
                      />
                      <td style={EDGE_CELL} />
                    </tr>
                    <tr style={{ height: `${ROW.info}pt` }}>
                      <td style={EDGE_CELL} />
                      <Label colSpan={4} style={cellStyle({ left: true })}>
                        감독자명
                      </Label>
                      <TextCell colSpan={14} value={supervisorField} onChange={setSupervisorField} style={{ ...cellStyle(), ...LABEL }} />
                      <Label colSpan={3} style={cellStyle()}>
                        연락처
                      </Label>
                      <TextCell colSpan={11} value={contactField} onChange={setContactField} style={{ ...cellStyle(), ...LABEL }} />
                      <Label colSpan={3} style={cellStyle()}>
                        인원수
                      </Label>
                      <TextCell
                        colSpan={11}
                        value={headcountField}
                        onChange={setHeadcountField}
                        style={{ ...cellStyle({ right: true }), ...LABEL }}
                      />
                      <td style={EDGE_CELL} />
                    </tr>

                    {/* 5·6행: 동의서·서약서 문구(기아 Light 10pt 굵게, 왼쪽·세로 가운데, 줄바꿈·앞 띄어쓰기 그대로) */}
                    {[
                      { text: CONSENT_TEXT, height: ROW.consent },
                      { text: SECURITY_TEXT, height: ROW.security },
                    ].map(({ text, height }) => (
                      <tr key={height} style={{ height: `${height}pt` }}>
                        <td style={EDGE_CELL} />
                        <td
                          colSpan={46}
                          style={{
                            ...cellStyle({ left: true, right: true }),
                            ...SMALL,
                            textAlign: "left",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.35,
                            padding: "0 1.5pt",
                          }}
                        >
                          {text}
                        </td>
                        <td style={EDGE_CELL} />
                      </tr>
                    ))}

                    <tr style={{ height: `${ROW.cell}pt` }}>
                      <td style={EDGE_CELL} />
                      {[
                        { label: "구분", span: 4 },
                        { label: "서약자 성명", span: 7 },
                        { label: "생년월일", span: 7 },
                        { label: "연락처", span: 9 },
                        { label: "개인정보수집", span: 7 },
                        { label: "보안 서약", span: 7 },
                        { label: "비고", span: 5 },
                      ].map(({ label, span }, i, all) => (
                        <th
                          key={label}
                          colSpan={span}
                          scope="col"
                          style={{ ...cellStyle({ left: i === 0, right: i === all.length - 1 }), ...LABEL, background: "#fff" }}
                        >
                          {label}
                        </th>
                      ))}
                      <td style={EDGE_CELL} />
                    </tr>

                    {rows.map((r, i) => (
                      <tr key={r.key} style={{ height: `${ROW.cell}pt` }}>
                        <td style={EDGE_CELL} />
                        {/* 구분 — 원본처럼 1~20 번호(빈칸이면 번호가 그대로 인쇄됨), 조공·직원 등으로 바꿔 적을 수 있음 */}
                        <td colSpan={4} style={{ ...cellStyle({ left: true }), ...LABEL }}>
                          <input
                            value={r.category}
                            onChange={(e) => updateRow(r.key, { category: e.target.value })}
                            placeholder={String(i + 1)}
                            className="placeholder:text-black placeholder:opacity-100"
                            style={INPUT}
                          />
                        </td>
                        <TextCell colSpan={7} value={r.name} onChange={(v) => updateRow(r.key, { name: v })} style={{ ...cellStyle(), ...LABEL }} />
                        <TextCell
                          colSpan={7}
                          value={r.birthDate}
                          onChange={(v) => updateRow(r.key, { birthDate: v })}
                          style={{ ...cellStyle(), ...LABEL }}
                        />
                        <TextCell colSpan={9} value={r.phone} onChange={(v) => updateRow(r.key, { phone: v })} style={{ ...cellStyle(), ...LABEL }} />
                        <td colSpan={7} style={{ ...cellStyle(), ...SMALL }}>
                          <ConsentMarks value={r.personalInfoConsent} onChange={(v) => updateRow(r.key, { personalInfoConsent: v })} />
                        </td>
                        <td colSpan={7} style={{ ...cellStyle(), ...SMALL }}>
                          <ConsentMarks value={r.securityConsent} onChange={(v) => updateRow(r.key, { securityConsent: v })} />
                        </td>
                        <TextCell
                          colSpan={5}
                          value={r.note}
                          onChange={(v) => updateRow(r.key, { note: v })}
                          style={{ ...cellStyle({ right: true }), ...LABEL }}
                        />
                        <td style={{ ...EDGE_CELL, position: "relative" }}>
                          <button
                            type="button"
                            onClick={() => removeRow(r.key)}
                            className="absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap text-[10px] text-red-500 hover:text-red-700 print:hidden"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* 28행: 안내 문구(기아 Medium 13pt 굵게, 가운데) */}
                    <tr style={{ height: `${ROW.notice}pt` }}>
                      <td style={EDGE_CELL} />
                      <td
                        colSpan={46}
                        style={{
                          ...EDGE_CELL,
                          fontFamily: KIA_MEDIUM,
                          fontWeight: 700,
                          fontSize: "13pt",
                          textAlign: "center",
                          verticalAlign: "middle",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.3,
                        }}
                      >
                        {NOTICE_TEXT}
                      </td>
                      <td style={EDGE_CELL} />
                    </tr>
                    <tr style={{ height: `${ROW.gap2}pt` }}>
                      <td colSpan={48} style={EDGE_CELL} />
                    </tr>
                    {/* 30행: 작은 KIA 로고 + "AutoLand화성"(굴림 12pt 굵게) — 엑셀 그림 위치·W열 그대로 */}
                    <tr style={{ height: `${ROW.logo}pt` }}>
                      <td colSpan={48} style={{ ...EDGE_CELL, position: "relative" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/kia-logo-form.png"
                          alt="KIA"
                          style={{ position: "absolute", left: "201.82pt", top: "2.55pt", width: "64.05pt", height: "14.65pt" }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            left: "273.75pt",
                            top: 0,
                            height: `${ROW.logo}pt`,
                            display: "flex",
                            alignItems: "center",
                            fontFamily: GULIM,
                            fontWeight: 700,
                            fontSize: "12pt",
                            whiteSpace: "nowrap",
                          }}
                        >
                          AutoLand화성
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* 원본 바닥글(아래 왼쪽, 10pt) — 인쇄에만 */}
            <p
              className="hidden print:absolute print:bottom-0 print:left-0 print:block"
              style={{ fontFamily: "Calibri, '맑은 고딕', 'Malgun Gothic', sans-serif", fontSize: "10pt", color: "#000", margin: 0 }}
            >
              {FOOTER_TEXT}
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
