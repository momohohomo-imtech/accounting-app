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
  `CategoryAggregateTable`, `CategoryDetailReport`, `ToolChecklistHistoryTable`,
  `QuotesTable`, `PurchaseOrdersTable`, `UnassignedWorkLogTable`)에
  이 패턴이 적용돼 있음 — 새 표를 추가할 때 이 목록도 같이 업데이트할 것.

- **저장/수정/삭제 등 서버 액션을 호출하는 폼·팝업은 항상 화면 전체를
  잠그는 처리 중 표시를 띄울 것.** 새로 만들거나 수정하는 폼/팝업도 예외
  없이 적용. 저장 중에 다른 곳을 눌러 페이지를 이동하거나 중복 요청을
  보내는 것 때문에 화면이 멈춘 것처럼 보이는 문제가 있었음 — 이를 막기
  위한 조치. `app/src/components/GlobalPendingProvider.tsx`의
  `useGlobalPending().run(...)`로 실제 create/update/delete 서버 액션
  호출부만 감싸면 됨(미리보기·조회·OCR·AI 생성처럼 자체 로딩 상태가 있는
  부수적인 호출은 감싸지 않음):
  ```ts
  const pending = useGlobalPending();
  await pending.run(() => someAsyncServerActionCall(...));
  ```
  `app/src/components/crud/EntityTable.tsx`와
  `app/src/components/crud/CreatePanel.tsx`가 정석 예시.

프로젝트 진행 상황·이력은 저장소 루트의 `HANDOFF.md`를 참고할 것.
