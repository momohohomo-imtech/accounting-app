"use client";

import { useEffect, useState } from "react";
import { loadTransactionBulkOptions } from "@/lib/actions/transactionBulkOptions";
import { actionFailureMessage } from "@/lib/actionError";
import type { TransactionBulkOptions } from "@/lib/transactionBulkEdit";
import { TransactionBulkEditBar } from "@/components/TransactionBulkEditBar";

// 보고서 내역 표의 일괄 변경 칸(11/11) — 처음 체크했을 때 선택 목록(거래처·카테고리·결제방식·프로젝트)을 불러옴(보고서를 열 때마다
// 미리 읽지 않게). 바꾸기 전에 확인창. 저장이 끝나면 서버 액션이 보고서 화면을 새로 그려서 바뀐 내용이 바로 보임.
export function ReportBulkEditBar({
  selectedIds,
  onDone,
  onClear,
}: {
  selectedIds: string[];
  onDone: () => void;
  onClear: () => void;
}) {
  const [options, setOptions] = useState<TransactionBulkOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadTransactionBulkOptions()
      .then((result) => {
        if (!alive) return;
        if (result.options) setOptions(result.options);
        else setError(result.error ?? "알 수 없는 오류");
      })
      .catch((err: unknown) => {
        if (alive) setError(actionFailureMessage(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <TransactionBulkEditBar
      selectedIds={selectedIds}
      options={options}
      optionsError={error}
      confirmEachChange
      onDone={onDone}
      onClear={onClear}
    />
  );
}
