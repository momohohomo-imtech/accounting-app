// SQL 실행 상태(사용자 요청 11/7 "추가 1") — Supabase에서 실행하지 않은 SQL이 있으면 그 기능이 아무 안내 없이 숨겨져서(실행 전엔
// 칸을 숨기고 예전처럼 동작하게 만들어 둠), 백업 화면에서 기능마다 실행됐는지 한눈에 봄.
// 확인은 부작용 없는 조회만 — 그 SQL이 만든 표·칸을 1줄 읽어 보고 "없음" 오류가 나는지만 봄(함수 호출·쓰기는 하지 않음).
// 표·칸을 만들지 않는 SQL(084 조회 전용 계정 정책, 091 번호 규칙 — 097에 다시 들어 있음)은 여기서 확인할 수 없어 목록에 없음.
// 새 SQL을 만들면 여기에도 한 줄(만든 표나 칸 하나). 검사: sqlStatus.test.ts

export type SqlProbe =
  /** 이 표가 있으면 실행됨 — column은 읽어 볼 작은 칸(기본 키 등) */
  | { kind: "table"; table: string; column: string }
  /** 이 칸이 있으면 실행됨 */
  | { kind: "column"; table: string; column: string }
  /** 이 표가 없어졌으면 실행됨(표를 지우는 SQL) */
  | { kind: "tableGone"; table: string; column: string };

export type SqlItem = { file: string; feature: string; probes: SqlProbe[] };

export const SQL_ITEMS: SqlItem[] = [
  { file: "085", feature: "메모장 구분(회사·프로젝트·현장 등)", probes: [{ kind: "column", table: "memos", column: "category" }] },
  { file: "086", feature: "매입매출 메모장", probes: [{ kind: "table", table: "transactions_page_memo", column: "id" }] },
  { file: "087", feature: "대시보드 메모칸", probes: [{ kind: "table", table: "dashboard_page_memo", column: "id" }] },
  { file: "088", feature: "보고서 AI 답변 표 삭제", probes: [{ kind: "tableGone", table: "report_ai_insights", column: "id" }] },
  {
    file: "089",
    feature: "견적서 공급자 목록(동희 반입반출증 업체명)",
    probes: [{ kind: "table", table: "company_profiles", column: "id" }],
  },
  {
    file: "090",
    feature: "새 출장일지",
    probes: [
      { kind: "table", table: "trip_log_days", column: "id" },
      { kind: "table", table: "trip_logs", column: "project_id" },
    ],
  },
  { file: "092", feature: "한 결제로 묶기", probes: [{ kind: "column", table: "transactions", column: "payment_group_id" }] },
  { file: "093", feature: "부가세 예정고지액 입력칸", probes: [{ kind: "table", table: "vat_prepayment_notices", column: "year" }] },
  { file: "094", feature: "거래 수정 이력", probes: [{ kind: "table", table: "transaction_history", column: "id" }] },
  { file: "095", feature: "백업에 담긴 거래 수", probes: [{ kind: "column", table: "backups", column: "row_counts" }] },
  { file: "096", feature: "백업 복원(한 번에, 실패하면 그대로)", probes: [{ kind: "table", table: "restore_staging", column: "id" }] },
  {
    file: "097",
    feature: "번호 매기기·통장 잔액 확인·신고 끝난 해 잠금",
    probes: [
      { kind: "table", table: "bank_balance_checks", column: "id" },
      { kind: "table", table: "locked_years", column: "year" },
    ],
  },
  {
    file: "098",
    feature: "공사 작업 순서",
    probes: [
      { kind: "table", table: "work_sequences", column: "id" },
      { kind: "table", table: "work_sequence_steps", column: "id" },
    ],
  },
  { file: "099", feature: "작업 순서 앞 작업 지정", probes: [{ kind: "column", table: "work_sequence_steps", column: "after_step_id" }] },
  {
    file: "100",
    feature: "작업 순서 팀 색",
    probes: [
      { kind: "column", table: "work_sequences", column: "teams" },
      { kind: "column", table: "work_sequence_steps", column: "team_id" },
    ],
  },
  { file: "101", feature: "거래처 고정지출 지정", probes: [{ kind: "column", table: "clients", column: "is_fixed_expense" }] },
  { file: "102", feature: "카테고리 고정지출 지정", probes: [{ kind: "column", table: "expense_categories", column: "is_fixed_expense" }] },
  { file: "103", feature: "작업 순서표 메모", probes: [{ kind: "column", table: "work_sequences", column: "memo" }] },
  { file: "104", feature: "메모장 구분 추가·수정", probes: [{ kind: "table", table: "memo_categories", column: "id" }] },
  { file: "105", feature: "매입매출 챙길 거래 창", probes: [{ kind: "table", table: "transaction_watch", column: "id" }] },
];

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

export type ProbeOutcome = "found" | "missing" | "unknown";

/** 조회 결과(오류) → 그 표·칸이 있는지. 없음 오류가 아닌 다른 오류(연결 끊김·권한 등)는 "unknown". */
export function probeOutcome(error: { code?: string | null } | null | undefined): ProbeOutcome {
  if (!error) return "found";
  return MISSING_TABLE.has(error.code ?? "") || MISSING_COLUMN.has(error.code ?? "") ? "missing" : "unknown";
}

export type SqlState = "done" | "needed" | "unknown";

/** 한 SQL의 상태 — 확인할 것이 모두 맞으면 실행됨, 하나라도 빠졌으면 실행 필요, 확인을 못 한 게 있으면 확인 못 함. */
export function sqlState(item: SqlItem, outcomes: ProbeOutcome[]): SqlState {
  const results = item.probes.map((p, i) => {
    const o = outcomes[i] ?? "unknown";
    if (o === "unknown") return "unknown";
    const present = o === "found";
    return (p.kind === "tableGone" ? !present : present) ? "done" : "needed";
  });
  if (results.includes("needed")) return "needed";
  if (results.includes("unknown")) return "unknown";
  return "done";
}

export const SQL_STATE_LABEL: Record<SqlState, string> = { done: "실행됨", needed: "실행 필요", unknown: "확인 못 함" };

type ProbeClient = {
  from: (table: string) => {
    select: (columns: string) => { limit: (n: number) => PromiseLike<{ error: { code?: string | null } | null }> };
  };
};

/** SQL_ITEMS를 모두 확인(서버에서, 한꺼번에) — 읽기 1줄씩만. */
export async function checkSqlStatus(supabase: ProbeClient): Promise<{ file: string; feature: string; state: SqlState }[]> {
  return Promise.all(
    SQL_ITEMS.map(async (item) => {
      const outcomes = await Promise.all(
        item.probes.map(async (p) => {
          try {
            const { error } = await supabase.from(p.table).select(p.column).limit(1);
            return probeOutcome(error);
          } catch {
            return "unknown" as const;
          }
        })
      );
      return { file: item.file, feature: item.feature, state: sqlState(item, outcomes) };
    })
  );
}
