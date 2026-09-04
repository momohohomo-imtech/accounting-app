import type { CSSProperties } from "react";
import { formatPermitQuantity } from "@/lib/koreanNumber";

// 동희오토(대외비/협력사)가 요구하는 "물품 반입증"(DAC-GA501-25-F01) 양식을 셀 단위로
// 재현한 표. 사용자가 제공한 스캔 원본의 칸 구성·문구를 그대로 옮기되, 서명·인장이
// 필요한 칸(반입자, 연락처, 경비실 확인자 등)은 원본과 마찬가지로 빈칸으로 둔다.
// 품목 줄 수는 원본 PDF와 동일하게 이 컴포넌트 한 장당 ROW_COUNT(5)개 고정 — 그래서
// 품목이 더 많으면 ToolChecklistDetailReport가 이 컴포넌트를 여러 장으로 나눠 호출한다
// (장마다 서로 다른 품목을 담음, 내용을 복제하지 않음). 이 양식은 원래 A5 규격이고
// 인쇄 시 A4를 가로(landscape)로 돌려 왼쪽/오른쪽에 장을 나란히 배치하는데, 각 절반이
// 실제로는 A5보다 넉넉해서(약 135×190mm) 원본 폰트 크기 그대로 두면 아래쪽에 여백이
// 크게 남았음.
//
// (예전엔 여기 전체에 px 배율(SCALE)을 곱하고, 인쇄 직전 실측해서 자동으로 줄이는
// zoom 훅(usePrintFitPagesToHeight)에 맞춤을 맡겼었는데, 실제로는 아무리 배율을
// 올려도 페이지가 안 채워지는 문제가 있었음 — 그래서 zoom 트릭을 완전히 버리고,
// 셀 높이(height, mm)·글씨 크기(mm)를 표 하나하나 직접 지정하는 방식으로 바꿈. 각
// 행의 mm 높이를 다 더하면 랜드스케이프 반쪽 페이지 실사용 높이(190mm)에 여유 있게
// 들어가도록 계산해서 박아둔 값들이라, 이 컴포넌트만 보고 페이지를 얼마나 채울지
// 그대로 알 수 있음 — 늘리거나 줄이려면 아래 각 행의 mm 값을 직접 조정할 것.)
const THIN = "1px solid #000";
const MEDIUM = "1.5px solid #000";
export const ROW_COUNT = 5;

export type DongheePermitItem = { tool_name: string; quantity: string };

function cellStyle(heightMm: number, fontMm: number): CSSProperties {
  return { border: THIN, height: `${heightMm}mm`, padding: "0 3mm", fontSize: `${fontMm}mm` };
}
function labelStyle(heightMm: number, fontMm: number): CSSProperties {
  return { ...cellStyle(heightMm, fontMm), textAlign: "center", fontWeight: 600, background: "#f8f8f8" };
}

export function DongheeAccessPassPermitTable({ items }: { items: DongheePermitItem[] }) {
  const rows = Array.from({ length: ROW_COUNT }, (_, i) => items[i]);

  return (
    <div style={{ fontFamily: "'맑은 고딕', 'Malgun Gothic', sans-serif", fontSize: "5mm", color: "#000" }}>
      <p style={{ textAlign: "right", fontSize: "3mm", margin: "0 0 1mm" }}>대외비(협력사)</p>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "35%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "35%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={4} style={{ border: MEDIUM, height: "12mm", textAlign: "center", fontSize: "8mm", fontWeight: 700 }}>
              물 품 반 입 증
            </td>
          </tr>
          <tr>
            <td style={labelStyle(10, 5)}>업체(부서)</td>
            <td style={cellStyle(10, 5)} />
            <td style={labelStyle(10, 5)}>반입자</td>
            <td style={cellStyle(10, 5)} />
          </tr>
          <tr>
            <td style={labelStyle(10, 5)}>반입차량</td>
            <td style={cellStyle(10, 5)} />
            <td style={labelStyle(10, 5)}>연락처</td>
            <td style={cellStyle(10, 5)} />
          </tr>
          <tr>
            <td style={labelStyle(10, 5)}>반입목적</td>
            <td colSpan={3} style={cellStyle(10, 5)} />
          </tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginTop: "2mm" }}>
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "37%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "29%" }} />
        </colgroup>
        <thead>
          <tr style={{ textAlign: "center" }}>
            <td style={labelStyle(8, 4.5)}>NO</td>
            <td style={labelStyle(8, 4.5)}>품명</td>
            <td style={labelStyle(8, 4.5)}>단위</td>
            <td style={labelStyle(8, 4.5)}>수량</td>
            <td style={labelStyle(8, 4.5)}>비고(부번/SER.NO)</td>
          </tr>
        </thead>
        <tbody>
          {/* 품명은 줄바꿈되면 그 행만 키가 커져서, 왼쪽·오른쪽 두 장의 높이가
              품명 길이 차이만큼 어긋나 보임 — 항상 한 줄로 고정하고 넘치면 말줄임표로
              잘라서 두 장의 행 높이(따라서 전체 높이)가 항상 정확히 같게 함. */}
          {rows.map((item, i) => (
            <tr key={i}>
              <td style={{ ...cellStyle(11, 5.5), textAlign: "center" }}>{i + 1}</td>
              <td style={{ ...cellStyle(11, 5.5), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item?.tool_name ?? ""}
              </td>
              <td style={{ ...cellStyle(11, 5.5), textAlign: "center" }}>{item ? "EA" : ""}</td>
              <td style={{ ...cellStyle(11, 5.5), textAlign: "center", fontFamily: "monospace" }}>
                {item ? formatPermitQuantity(item.quantity) : ""}
              </td>
              <td style={cellStyle(11, 5.5)} />
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ textAlign: "center", fontSize: "4mm", margin: "3mm 0 1mm" }}>상기 물품의 반출을 확인함</p>
      <p style={{ textAlign: "center", fontSize: "4mm", margin: "1mm 0 3mm" }}>
        물품반입일 : 20&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;일
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "87%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ ...labelStyle(22, 4) }}>
              주의
              <br />
              사항
            </td>
            <td style={{ border: THIN, padding: "1mm 3mm", fontSize: "3.8mm", lineHeight: 1.35 }}>
              1. 방문자께서 개인물품류, 검사구, 공구류 등 소지하여 출입하실 경우 &quot;반입증&quot; 작성바랍니다.
              <br />
              2. 입문시 정문 보안대원으로부터 &quot;반입증&quot;에 정문 보안대원의 확인 및 날인
              <br />
              3. 이 반입증은 담당부서(팀) 확인자 서명 후 출문 가능함.
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginTop: "-1px" }}>
        <colgroup>
          <col style={{ width: "22%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "30%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={labelStyle(10, 5)}>반입확인</td>
            <td style={{ ...cellStyle(10, 5), textAlign: "center" }}>보안실</td>
            <td style={labelStyle(10, 5)}>성명(보안대원)</td>
            <td style={{ ...cellStyle(10, 5), textAlign: "center" }}>(인)</td>
          </tr>
          <tr>
            <td style={labelStyle(10, 5)}>출문승인(해당부서)</td>
            <td style={cellStyle(10, 5)} />
            <td style={labelStyle(10, 5)}>성명(담당자)</td>
            <td style={{ ...cellStyle(10, 5), textAlign: "center" }}>(인)</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: "2.8mm", margin: "2mm 0 0" }}>DAC-GA501-25-F01</p>
    </div>
  );
}
