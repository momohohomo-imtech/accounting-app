import { createClient } from "@/lib/supabase/server";
import { loadTransactionHistory } from "@/lib/transactionHistoryLoad";
import { formatWon } from "@/lib/format";
import { CollapsibleSection } from "@/components/CollapsibleSection";

// 거래 수정 화면 아래 "수정 이력"(094 SQL) — 그 거래(묶음이면 묶음의 모든 줄)를 누가 언제 무엇을 바꿨는지. 이력이 없거나
// SQL 실행 전이면 아무것도 안 보임.
export async function TransactionHistoryList({ transactionIds }: { transactionIds: string[] }) {
  const supabase = await createClient();
  const history = await loadTransactionHistory(supabase, { transactionIds, limit: 50 });
  if (!history || history.length === 0) return null;
  const many = transactionIds.length > 1;

  return (
    <CollapsibleSection
      className="mt-4 print:hidden"
      title={
        <span>
          수정 이력 <span className="text-sm font-normal text-slate-500">{history.length}건</span>
        </span>
      }
    >
      <ul className="space-y-2 text-sm">
        {history.map((h) => (
          <li key={h.id} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">
              {h.time} · {h.who} · <span className={h.action === "delete" ? "font-medium text-red-600" : ""}>{h.action === "delete" ? "삭제" : "수정"}</span>
              {many && ` · ${h.item || "-"} ${formatWon(h.total)}`}
            </p>
            {h.changes.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-slate-700">
                {h.changes.map((c) => (
                  <li key={c.label}>
                    <span className="text-slate-500">{c.label}</span> {c.before} → <span className="font-medium">{c.after}</span>
                  </li>
                ))}
              </ul>
            ) : (
              h.action === "update" && <p className="mt-1 text-xs text-slate-400">화면에 보이는 칸은 바뀌지 않음</p>
            )}
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}
