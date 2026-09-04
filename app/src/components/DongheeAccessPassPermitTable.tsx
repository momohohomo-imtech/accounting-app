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
// 크게 남았음 — 스캔 원본처럼 여백 없이 꽉 차 보이도록 폰트·여백을 SCALE배 키움
// (표 구성·문구는 그대로, 크기만 조정 — 필요하면 이 값만 다시 조절하면 됨).
const SCALE = 2;
const px = (n: number) => `${n * SCALE}px`;
const pad = (v: number, h: number) => `${v * SCALE}px ${h * SCALE}px`;

const THIN = "1px solid #000";
const MEDIUM = "1.5px solid #000";
export const ROW_COUNT = 5;

export type DongheePermitItem = { tool_name: string; quantity: string };

const cell: CSSProperties = { border: THIN, padding: pad(2, 4) };
const labelCell: CSSProperties = { ...cell, textAlign: "center", fontWeight: 600, background: "#f8f8f8" };

export function DongheeAccessPassPermitTable({ items }: { items: DongheePermitItem[] }) {
  const rows = Array.from({ length: ROW_COUNT }, (_, i) => items[i]);

  return (
    <div style={{ fontFamily: "'맑은 고딕', 'Malgun Gothic', sans-serif", fontSize: px(11), color: "#000" }}>
      <p style={{ textAlign: "right", fontSize: px(9), margin: `0 0 ${px(2)}` }}>대외비(협력사)</p>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "35%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "35%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={4} style={{ border: MEDIUM, textAlign: "center", fontSize: px(17), fontWeight: 700, padding: `${px(4)} 0` }}>
              물 품 반 입 증
            </td>
          </tr>
          <tr>
            <td style={labelCell}>업체(부서)</td>
            <td style={cell} />
            <td style={labelCell}>반입자</td>
            <td style={cell} />
          </tr>
          <tr>
            <td style={labelCell}>반입차량</td>
            <td style={cell} />
            <td style={labelCell}>연락처</td>
            <td style={cell} />
          </tr>
          <tr>
            <td style={labelCell}>반입목적</td>
            <td colSpan={3} style={cell} />
          </tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginTop: px(4) }}>
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "37%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "29%" }} />
        </colgroup>
        <tbody>
          <tr style={{ textAlign: "center" }}>
            <td style={labelCell}>NO</td>
            <td style={labelCell}>품명</td>
            <td style={labelCell}>단위</td>
            <td style={labelCell}>수량</td>
            <td style={labelCell}>비고(부번/SER.NO)</td>
          </tr>
          {rows.map((item, i) => (
            <tr key={i}>
              <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
              <td style={cell}>{item?.tool_name ?? ""}</td>
              <td style={{ ...cell, textAlign: "center" }}>{item ? "EA" : ""}</td>
              <td style={{ ...cell, textAlign: "center", fontFamily: "monospace" }}>
                {item ? formatPermitQuantity(item.quantity) : ""}
              </td>
              <td style={cell} />
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ textAlign: "center", margin: `${px(6)} 0 ${px(2)}` }}>상기 물품의 반출을 확인함</p>
      <p style={{ textAlign: "center", margin: `${px(2)} 0 ${px(6)}` }}>
        물품반입일 : 20&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;일
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "87%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ ...labelCell, fontSize: px(9.5) }}>
              주의
              <br />
              사항
            </td>
            <td style={{ ...cell, fontSize: px(9), lineHeight: 1.4 }}>
              1. 방문자께서 개인물품류, 검사구, 공구류 등 소지하여 출입하실 경우 &quot;반입증&quot; 작성바랍니다.
              <br />
              2. 입문시 정문 보안대원으로부터 &quot;반입증&quot;에 정문 보안대원의 확인 및 날인
              <br />
              3. 이 반입증은 담당부서(팀) 확인자 서명 후 출문 가능함.
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", marginTop: px(-1) }}>
        <colgroup>
          <col style={{ width: "22%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "30%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={labelCell}>반입확인</td>
            <td style={{ ...cell, textAlign: "center" }}>보안실</td>
            <td style={labelCell}>성명(보안대원)</td>
            <td style={{ ...cell, textAlign: "center" }}>(인)</td>
          </tr>
          <tr>
            <td style={labelCell}>출문승인(해당부서)</td>
            <td style={cell} />
            <td style={labelCell}>성명(담당자)</td>
            <td style={{ ...cell, textAlign: "center" }}>(인)</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: px(8), margin: `${px(2)} 0 0` }}>DAC-GA501-25-F01</p>
    </div>
  );
}
