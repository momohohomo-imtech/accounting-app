// 원청(기아 화성공장)이 요구하는 "반입/반출 확인증" 양식을 셀 단위로 그대로 재현한
// 표. 사용자가 제공한 원본 엑셀(화성 공구 명세서.xlsx)의 셀 구성·병합·테두리·문구를
// 그대로 옮긴 것 — 서명/인장이 필요한 칸(반입자, 전화번호, 경비실 확인자 등)은
// 원본과 마찬가지로 빈칸으로 두고, 품명·수량 칸만 반입반출증용으로 표시된 품목으로
// 채운다.
const THIN = "1px solid #000";
const MEDIUM = "2px solid #000";
const ROW_COUNT = 31; // 원본 서식의 품목 기재란 줄 수(5~35행)

export type PermitItem = { tool_name: string; quantity: string };

export function AccessPassPermitTable({ items }: { items: PermitItem[] }) {
  const rowCount = Math.max(ROW_COUNT, items.length);
  const rows = Array.from({ length: rowCount }, (_, i) => items[i]);

  return (
    // 인쇄 시 공구가 몇 개든 항상 용지 한 장을 꽉 채우도록, 이 래퍼를 인쇄 페이지
    // 높이(100vh)로 고정하고 표 높이를 100%로 맞춤 — 그러면 높이를 지정하지 않은
    // 품목 기재란(아래 rows)들이 남는 공간만큼 자동으로 늘어나 빈칸도 페이지 끝까지
    // 이어짐. 제목·안내문구·서명란처럼 크기가 고정이어야 하는 행에는 높이를 명시함.
    <div className="print:h-screen">
    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        height: "100%",
        tableLayout: "fixed",
        fontFamily: "'맑은 고딕', 'Malgun Gothic', sans-serif",
        fontSize: 11,
        color: "#000",
      }}
    >
      <colgroup>
        <col style={{ width: "11%" }} />
        <col style={{ width: "22%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "22%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "11%" }} />
      </colgroup>
      <tbody>
        <tr style={{ height: 24 }}>
          <td rowSpan={2} style={{ textAlign: "center", verticalAlign: "middle" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kia-logo.png" alt="KIA" style={{ width: 44, height: "auto", margin: "0 auto" }} />
          </td>
          <td style={{ verticalAlign: "middle", fontSize: 10 }}>KIA MOTORS</td>
          <td
            colSpan={5}
            rowSpan={2}
            style={{ borderBottom: MEDIUM, textAlign: "center", verticalAlign: "middle", fontSize: 18, fontWeight: 700 }}
          >
            반입 /반출 확인증(부품,공구,기타)
          </td>
        </tr>
        <tr style={{ height: 24 }}>
          <td style={{ verticalAlign: "middle", fontSize: 10 }}>HAWSUNG PLANT</td>
        </tr>

        <tr style={{ height: 26 }}>
          <td colSpan={2} style={{ border: MEDIUM, paddingLeft: 6 }}>
            반입자 :{" "}
          </td>
          <td colSpan={3} style={{ border: MEDIUM, paddingLeft: 6 }}>
            {" "}
            전화번호 :{" "}
          </td>
          <td colSpan={2} style={{ border: MEDIUM, paddingLeft: 6 }}>
            반입 목적:{" "}
          </td>
        </tr>

        <tr style={{ height: 24, textAlign: "center", fontWeight: 500 }}>
          <td style={{ borderLeft: MEDIUM, borderRight: THIN, borderBottom: THIN }}>차종</td>
          <td style={{ borderRight: THIN, borderBottom: THIN }}>품명</td>
          <td colSpan={2} style={{ borderRight: THIN, borderBottom: THIN }}>
            수량
          </td>
          <td style={{ borderRight: THIN, borderBottom: THIN }}>단위</td>
          <td style={{ borderRight: THIN, borderBottom: THIN }}>부품상태</td>
          <td style={{ borderRight: MEDIUM, borderBottom: THIN }}>반출수량</td>
        </tr>

        {rows.map((item, i) => {
          const isLast = i === rowCount - 1;
          const bottom = isLast ? MEDIUM : THIN;
          return (
            <tr key={i} className="h-5 print:h-auto">
              <td style={{ borderLeft: MEDIUM, borderRight: THIN, borderTop: THIN, borderBottom: bottom }} />
              <td style={{ borderRight: THIN, borderTop: THIN, borderBottom: bottom, paddingLeft: 4 }}>
                {item?.tool_name ?? ""}
              </td>
              <td
                colSpan={2}
                style={{
                  borderRight: THIN,
                  borderTop: THIN,
                  borderBottom: bottom,
                  textAlign: "center",
                  fontFamily: "monospace",
                }}
              >
                {item?.quantity ?? ""}
              </td>
              <td style={{ borderRight: THIN, borderTop: THIN, borderBottom: bottom }} />
              <td style={{ borderRight: THIN, borderTop: THIN, borderBottom: bottom }} />
              <td style={{ borderRight: MEDIUM, borderTop: THIN, borderBottom: bottom }} />
            </tr>
          );
        })}

        <tr style={{ height: 28 }}>
          <td colSpan={7} style={{ textAlign: "center", fontWeight: 700, padding: "6px 0" }}>
            #이 반입증은 부서{"{"}팀{"}"} 확인자 서명및 출문승인 (통제부서) 통제틸후 출문 가능함.
          </td>
        </tr>

        {/* 아래 두 인증란(반입 확인 / 물품 미해당 확인)과 그 오른쪽의 반입확인(경비실)·
            출문승인(통제부서) 칸은 원본처럼 총 7행(37~43행에 해당)에 걸쳐 있음. */}
        <tr style={{ height: 26 }}>
          <td colSpan={4} style={{ borderTop: THIN, borderLeft: THIN, paddingLeft: 4 }}>
            상기물품이 화성공장으로 반입됨을 확인함
          </td>
          <td rowSpan={7} style={{ border: THIN, textAlign: "center", verticalAlign: "middle" }}>
            반입확인(경비실)
          </td>
          <td colSpan={2} style={{ borderTop: THIN, borderLeft: THIN, borderRight: THIN, textAlign: "center", verticalAlign: "middle" }}>
            출문승인(통제부서)
          </td>
        </tr>
        <tr style={{ height: 22 }}>
          <td style={{ borderLeft: THIN }} />
          <td />
          <td style={{ textAlign: "center" }}>월</td>
          <td style={{ borderRight: THIN, textAlign: "center" }}>일</td>
          <td colSpan={2} rowSpan={6} style={{ border: THIN }} />
        </tr>
        <tr style={{ height: 26 }}>
          <td colSpan={4} style={{ borderLeft: THIN, borderRight: THIN, borderBottom: THIN, textAlign: "center" }}>
            경비실 확인자: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (서명)
          </td>
        </tr>
        <tr style={{ height: 26 }}>
          <td colSpan={4} style={{ borderTop: THIN, borderLeft: THIN, paddingLeft: 4 }}>
            상기물품은 화성공장 물품이아님을 확인함
          </td>
        </tr>
        <tr style={{ height: 22 }}>
          <td style={{ borderLeft: THIN }} />
          <td />
          <td style={{ textAlign: "center" }}>월</td>
          <td style={{ borderRight: THIN, textAlign: "center" }}>일</td>
        </tr>
        <tr style={{ height: 26 }}>
          <td colSpan={4} style={{ borderLeft: THIN, borderRight: THIN, textAlign: "center" }}>
            부서(팀)명: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          </td>
        </tr>
        <tr style={{ height: 26 }}>
          <td colSpan={4} style={{ borderLeft: THIN, borderRight: THIN, borderBottom: THIN, textAlign: "center" }}>
            부서(팀) 확인자: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (인)
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  );
}
