import { createClient } from "@/lib/supabase/server";
import { loadProjectTxAndAgency } from "@/lib/projectTxLoad";
import { projectGroups, unbilledRemainingByGroup, type OutlookProject } from "@/lib/projectProfit";
import { PROJECT_STATUS_REVIEW } from "@/lib/projectStatus";
import { formatWon } from "@/lib/format";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { YearEndCheckTable, type YearEndRow } from "@/components/YearEndCheckTable";

// 연말 점검(사용자 요청) — 그 해 귀속 프로젝트 중 세금계산서를 아직 다 발행하지 않은 묶음(어미 + 귀속 하위, 자기 상태가 있는
// 하위는 따로)과 남은 발행 예정액. 12월 31일까지 다 못 끊을 프로젝트는 여기서 골라 귀속 연도를 다음 해로 옮김. 계산은
// lib/projectProfit.ts의 unbilledRemainingByGroup(1월 부가세 미발행 예상분과 같은 기준, 조회도 대시보드와 같은
// loadProjectTxAndAgency). 남은 것이 없으면 아무것도 안 보임.
export async function YearEndCheckSection({ year }: { year: number }) {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, quote_amount, parent_project_id")
    .eq("year", year);
  const yearProjects = (projects ?? []) as OutlookProject[];
  if (yearProjects.length === 0) return null;
  const { projectTx, agencyByProject } = await loadProjectTxAndAgency(
    supabase,
    yearProjects.map((p) => p.id),
    { type: "매출" }
  );

  // 어미 단위를 옮기면 같은 묶음의 검토중 하위도 같이(아직 발행 전이라 묶음이 두 해로 갈라지지 않게 — 예전엔 "귀속 하위도 같이
  // 옮겨요"라면서 검토중 하위는 남았음). 자기 상태로 따로 보이는 하위는 따로 고르고, 다 발행했거나 수금 완료인 하위는 그 해에 남음.
  const reviewByRoot = new Map(
    projectGroups(yearProjects).map((g) => [g.root.id, g.members.filter((p) => p.id !== g.root.id && p.status === PROJECT_STATUS_REVIEW)])
  );
  const rows: YearEndRow[] = unbilledRemainingByGroup(yearProjects, projectTx, agencyByProject)
    .filter((g) => g.remaining > 0)
    .map((g) => {
      const withReview = g.members[0].id === g.rootId ? reviewByRoot.get(g.rootId) ?? [] : [];
      return {
        key: g.members[0].id,
        label: g.label,
        status: g.status,
        quote: g.quote,
        agency: g.agency,
        billed: g.billed,
        remaining: g.remaining,
        lastBilled: g.lastBilled,
        memberIds: [...g.members, ...withReview].map((p) => p.id),
        reviewChildCount: withReview.length,
      };
    });
  if (rows.length === 0) return null;
  const remainingTotal = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <CollapsibleSection
      title={
        <span>
          {year}년 연말 점검{" "}
          <span className="text-sm font-normal text-slate-500">
            — 세금계산서 미발행 {rows.length}건 · 남은 발행 예정액 {formatWon(remainingTotal)}
          </span>
        </span>
      }
      className="print:hidden"
    >
      <YearEndCheckTable year={year} rows={rows} />
    </CollapsibleSection>
  );
}
