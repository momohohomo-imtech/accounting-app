"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { inlineFieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

// 매입매출장 글자 검색칸(사용자 요청 11/7) — 적고 Enter(휴대폰 키보드 "검색")나 "찾기"를 누르면 주소 ?q=로 거름. 다른 필터(연·월·구분·
// 결제수단·칸 표시)는 그대로 두고, 상단 합계·목록·엑셀·인쇄가 모두 검색된 거래로(lib/ledgerSearch.ts). 주소가 바뀌면 칸도 새로
// 그려지게 부르는 쪽에서 key={q}.
export function LedgerSearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [text, setText] = useState(initial);

  function go(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const v = value.trim();
    if (v) params.set("q", v);
    else params.delete("q");
    params.delete("editTx");
    router.push(`/transactions?${params.toString()}`, { scroll: false });
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(text);
      }}
      className="flex max-w-full items-center gap-1 print:hidden"
    >
      <input
        type="search"
        enterKeyHint="search"
        aria-label="매입매출 검색"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="거래처·품목·메모·금액"
        className={`${inlineFieldClass} w-48 min-w-0`}
      />
      <Button type="submit" variant="secondary" size="sm">
        찾기
      </Button>
      {initial && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setText("");
            go("");
          }}
        >
          검색 지우기
        </Button>
      )}
    </form>
  );
}
