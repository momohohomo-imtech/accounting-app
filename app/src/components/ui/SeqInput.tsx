"use client";

import { useRef, useState } from "react";

// 순번 칸 — 숫자를 고치고 Enter(또는 칸 밖을 누름)하면 그 줄이 그 자리로 옮겨감(사용자 요청 — 견적서 품목·공사 작업 순서 단계).
// 입력하는 동안에는 안 움직임("12"를 치다가 1번 자리로 갔다가 12번으로 가지 않게). Esc는 취소(팝업은 안 닫힘).
export function SeqInput({
  index,
  count,
  onMove,
  itemLabel = "품목",
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  /** 화면 낭독용 이름("3번 품목 순번") */
  itemLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelRef = useRef(false);

  function commit() {
    const value = draft;
    setDraft(null);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const n = Math.floor(Number(value));
    if (!value || !Number.isFinite(n)) return;
    const to = Math.min(Math.max(n, 1), count) - 1;
    if (to !== index) onMove(index, to);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`${index + 1}번 ${itemLabel} 순번`}
      title="순번 — 숫자를 바꾸고 Enter를 누르면 그 자리로 옮겨요"
      value={draft ?? String(index + 1)}
      onFocus={(e) => {
        setDraft(String(index + 1));
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          // 폼 제출(저장)로 가지 않게 — 옮기기는 칸을 벗어날 때(onBlur) 한 번만
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          // 순번 고치기만 취소 — 팝업 안이어도 팝업은 닫지 않음(useEscapeKey는 preventDefault된 ESC를 건너뜀)
          e.preventDefault();
          cancelRef.current = true;
          e.currentTarget.blur();
        }
      }}
      className="w-[4ch] shrink-0 rounded border border-slate-200 px-0.5 py-1 text-center text-xs tabular-nums text-slate-600 focus:border-slate-500 focus:outline-none"
    />
  );
}
