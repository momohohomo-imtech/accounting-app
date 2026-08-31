# 코딩 컨벤션

- **목록형 표(여러 행을 보여주는 table)는 항상 헤더 클릭으로 정렬되게 만들 것.**
  새로 표를 만들 때도 예외 없이 적용. `app/src/components/ProjectProfitTable.tsx`
  또는 `app/src/components/ProjectPurchaseTable.tsx`의 패턴을 그대로 따르면 됨:
  - `sortKey`/`sortDir`을 `useState`로 관리
  - 각 헤더를 `<button onClick={() => handleSort(key)}>`로 감싸기 — 같은 키를
    다시 누르면 asc/desc 토글, 다른 키를 누르면 그 키로 새로 정렬(기본 asc)
  - 정렬 중인 컬럼 헤더에 `▲`/`▼` 표시
  - `useMemo`로 정렬된 배열을 계산해서 렌더링(원본 배열은 그대로 두고 복사본만
    정렬)
  - 문자열/숫자 혼합이면 `typeof`로 분기해서 숫자는 뺄셈, 문자열은
    `localeCompare`로 비교

  이미 대부분의 표(`EntityTable`, `TransactionTable`, `BankTransactionTable`,
  `PayrollTable`, `WorkLogSummaryTable`, `VendorAggregateTable`,
  `VendorDetailReport`, `DailyWorkerUsageTable`, `BackupsTable`,
  `AccessListWorkerPicker`, `SiteAggregateTable`, `BusinessTripListClient`,
  `CategoryAggregateTable`, `CategoryDetailReport`, `ToolChecklistHistoryTable`)에
  이 패턴이 적용돼 있음 — 새 표를 추가할 때 이 목록도 같이 업데이트할 것.

프로젝트 진행 상황·이력은 저장소 루트의 `HANDOFF.md`를 참고할 것.
