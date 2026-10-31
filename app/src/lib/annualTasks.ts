// 이번 달 할 일(10/31 사용자 "전부" — 추천 기능) — 개인사업자(일반과세자, 직원·일용직 있음)의 해마다 돌아오는 신고·납부 일정.
// 날짜가 주말·공휴일이면 다음 영업일. 법이 바뀌면 여기만 고칠 것(검사: annualTasks.test.ts). 세무사가 대신 하는 것도 일정 확인용으로 둠.
export type AnnualTask = {
  /** 마감일(그 달 며칠) — 말일이면 그 달 마지막 날 */
  day: number;
  title: string;
  /** 접힌 줄 요약에 쓰는 짧은 이름 */
  short: string;
  detail?: string;
  /** 앱 안 바로가기 — {prev}는 전년도, {year}는 올해로 바꿔 씀 */
  href?: string;
};

const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function monthly(year: number, month: number): AnnualTask[] {
  return [
    { day: 10, short: "원천세", title: "원천세 신고·납부(전월 급여분)", detail: "반기별 납부 승인 사업장은 1월·7월 10일" },
    { day: 10, short: "4대보험료", title: "4대보험료 납부(전월분)" },
    {
      day: lastDay(year, month),
      short: "일용근로 지급명세서",
      title: "일용근로소득 지급명세서 제출(전월분, 일용직 고용 시)",
      href: "/daily-workers",
    },
  ];
}

function byMonth(year: number, month: number): AnnualTask[] {
  switch (month) {
    case 1:
      return [{ day: 25, short: "부가세 2기 확정", title: "부가가치세 2기 확정 신고·납부(전년 7~12월)", href: "/dashboard?year={prev}" }];
    case 2:
      return [{ day: lastDay(year, 2), short: "연말정산", title: "근로소득 연말정산(2월분 급여 지급 시)" }];
    case 3:
      return [{ day: 10, short: "지급명세서", title: "근로소득 지급명세서 제출(연말정산분)" }];
    case 4:
      return [{ day: 25, short: "부가세 1기 예정고지", title: "부가가치세 1기 예정고지 납부(고지서 금액)" }];
    case 5:
      return [
        {
          day: 31,
          short: "종합소득세",
          title: "종합소득세·지방소득세 신고·납부(전년 귀속)",
          detail: "성실신고확인 대상이면 6월 30일",
          href: "/dashboard?year={prev}",
        },
      ];
    case 6:
      return [
        {
          day: 30,
          short: "전년도 잠금",
          title: "전년도 신고 완료 시 신고 끝난 해 잠금(매입매출 → 장부 점검)",
          href: "/transactions?tab=check&year={prev}",
        },
      ];
    case 7:
      return [
        { day: 25, short: "부가세 1기 확정", title: "부가가치세 1기 확정 신고·납부(1~6월)" },
        { day: 31, short: "종합소득세 분납", title: "종합소득세 분납분 납부(5월 분납 신청 시)" },
      ];
    case 10:
      return [{ day: 25, short: "부가세 2기 예정고지", title: "부가가치세 2기 예정고지 납부(고지서 금액)" }];
    case 11:
      return [{ day: 30, short: "중간예납", title: "종합소득세 중간예납 납부(고지서 금액)" }];
    case 12:
      return [
        {
          day: 31,
          short: "연말 점검",
          title: "연말 점검: 미발행 세금계산서·프로젝트 귀속 연도 확인(프로젝트 목록)",
          href: "/projects",
        },
      ];
    default:
      return [];
  }
}

/** 그 달 할 일(마감일 순). */
export function tasksForMonth(year: number, month: number): AnnualTask[] {
  return [...monthly(year, month), ...byMonth(year, month)]
    .map((t) => (t.href ? { ...t, href: t.href.replace("{prev}", String(year - 1)).replace("{year}", String(year)) } : t))
    .sort((a, b) => a.day - b.day);
}

/** 접힌 줄 요약 — "10일 원천세·4대보험료 · 25일 부가세 2기 예정고지 · 31일 일용근로 지급명세서" */
export function tasksSummary(tasks: AnnualTask[]) {
  const byDay = new Map<number, string[]>();
  for (const t of tasks) byDay.set(t.day, [...(byDay.get(t.day) ?? []), t.short]);
  return [...byDay.entries()].map(([day, names]) => `${day}일 ${names.join("·")}`).join(" · ");
}
