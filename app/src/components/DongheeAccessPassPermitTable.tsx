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
// (표 구성·문구는 그대로, 크기만 조정). 일부러 페이지보다 넉넉하게(더 큼직하게)
// 키워두고, 실제로 페이지 밖으로 넘치는 만큼은 ToolChecklistDetailReport의
// usePrintFitPagesToHeight가 인쇄 직전 실측해서 자동으로 딱 맞게 줄인다 — 그래서
// 이 값은 "최소 이 정도는 크게" 기준일 뿐, 너무 작지만 않으면 실제 출력 크기에는
// 영향 없음(줄어드는 배율만 달라질 뿐). 표(HTML table)가 페이지보다 커도 인쇄 시
// 뒤늦게 잘려서 다음 줄로 밀리며 깨지는 걸 막으려면 반드시 이 축소 훅과 같이 써야
// 함 — SCALE만 올리고 축소 훅 없이 쓰면 표가 페이지 중간에서 잘려 깨짐(줄 순서가
// 엉키고 헤더 없이 다음 부분이 이어지는 등).
// 이 훅은 "넘칠 때만" 줄이고 절대 키우지는 않으므로, SCALE은 실측 없이 대충
// 계산해서 맞추려 하지 말고 확실히 넘칠 만큼 넉넉하게 잡는 게 안전함(2 → 2.4로
// 올렸는데도 실제로는 페이지를 다 못 채워서 아래 여백이 남았던 걸 보면 원래
// 추정치가 낮았던 것 — 큰 쪽으로 틀려도 훅이 알아서 정확히 맞춰주지만, 작은 쪽으로
// 틀리면 여백이 남는 걸 막을 방법이 없기 때문에 여유 있게 크게 잡음).
const SCALE = 4;
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
        <thead>
          <tr style={{ textAlign: "center" }}>
            <td style={labelCell}>NO</td>
            <td style={labelCell}>품명</td>
            <td style={labelCell}>단위</td>
            <td style={labelCell}>수량</td>
            <td style={labelCell}>비고(부번/SER.NO)</td>
          </tr>
        </thead>
        <tbody>
          {/* 품명은 줄바꿈되면 그 행만 키가 커져서, 왼쪽·오른쪽 두 장의 높이가
              품명 길이 차이만큼 어긋나 보임 — 항상 한 줄로 고정하고 넘치면 말줄임표로
              잘라서 두 장의 행 높이(따라서 전체 높이)가 항상 정확히 같게 함. */}
          {rows.map((item, i) => (
            <tr key={i}>
              <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
              <td style={{ ...cell, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item?.tool_name ?? ""}</td>
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
