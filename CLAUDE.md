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
  `QuotesTable`, `PurchaseOrdersTable`, `UnassignedWorkLogTable`,
  `ClassificationPendingTable`, `RevenueVerificationTable`, `SiteProfitTable`,
  `SiteProfitReport`, `PurchaseItemSearchTable`, `VatQuarterTable`)에
  이 패턴이 적용돼 있음 — 새 표를 추가할 때 이 목록도 같이 업데이트할 것.
  (예외: `DailyWorkerUsageStatementTable`은 세무사 제출용 사용내역서 문서라
  근로자별 연속일 소계 순서가 고정돼야 해서 임의 정렬을 지원하지 않음 —
  `AccessListPrintPopup`과 같은 인쇄 문서 취급.)

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

- **휴대폰에서도 표·숫자가 읽히게 만들 것.** 휴대폰으로 많이 쓰는 앱이라, 새 표나
  숫자 칸도 예외 없이 적용. 넓은 표가 칸을 우겨넣거나 박스를 넘어가서 "어느 행인지
  따라가기 힘들다"는 문제가 있었음.
  - 표는 반드시 가로 스크롤 상자 안에 둘 것: `@/components/ui/Table`의 `<Table>`을 쓰거나,
    `<div className="overflow-x-auto"><table>…`처럼 스크롤 상자 **바로 아래**에 `<table>`.
    이러면 `app/src/app/globals.css`의 휴대폰 전용 규칙이 자동 적용됨(칸 한 줄, 첫 칸
    왼쪽 고정). 레이아웃 본문이 `overflow-x-clip`이라, 스크롤 상자 없이 넓은 표는
    휴대폰에서 오른쪽이 잘려서 안 보임.
  - 첫 칸이 행을 알아보기 어려운 칸(날짜·체크박스·번호)이면 `<table>`에 `sticky-col-table`,
    고정할 칸(거래처·이름 등)의 `th`/`td`에 `sticky-col`을 달 것 — `TransactionTable`(거래처),
    `BankTransactionTable`(내용), `ProjectPurchaseTable`(거래처)이 예시. 입력칸으로 된 표는
    `sticky-col-table`만 달고 고정 칸 없이 둠(`TransactionBulkImport`).
  - 칸이 많은 표는 휴대폰에서 칸마다 읽을 수 있는 최소 폭을 줄 것(`EntityTable`은 칸 수 ×
    105px). 긴 글자 칸은 휴대폰에서만 `max-md:max-w-[10rem] max-md:truncate` + `title`로
    한 줄 말줄임.
  - 큰 금액은 `whitespace-nowrap`("원"만 떨어지지 않게). 큰 숫자 여러 개를 나란히 둘 때는
    휴대폰에서 한 줄에 하나(`grid-cols-1 min-[480px]:grid-cols-2`), 4칸 배치는 `xl:`부터.
  - 버튼은 줄바꿈되지 않음(`Button` 기본값). 한글은 띄어쓰기 단위로만 줄바꿈됨(`keep-all`).
  - **인쇄 주의:** A4 인쇄 폭(약 718px)도 `md`(768px) 미만이라 `max-md:` 등 휴대폰용
    클래스가 인쇄에도 적용됨 — 인쇄되는 칸에는 `print:max-w-none print:whitespace-normal
    print:overflow-visible`처럼 되돌리고, CSS로 쓸 때는 `@media screen and (...)`로 한정할 것.

- **1000행을 넘을 수 있는 조회는 `fetchAllRows`로 끝까지 가져올 것.** Supabase(PostgREST)는
  한 번에 최대 1000행만 돌려줘서, 그냥 `select`하면 1000행 넘는 부분이 조용히 빠짐 —
  2026년 거래가 1005건이 되면서 보고서 "매입 품목 검색"에서 실제로 거래가 누락됐던 원인.
  거래(`transactions`)·은행 거래·외상 정산 이력·작업일지처럼 계속 쌓이는 테이블을
  기간/조건으로 조회할 때는 `app/src/lib/supabaseFetchAll.ts`의 `fetchAllRows`를 쓸 것
  (외상 정산 이력 전체는 `fetchAllCreditPayments`):
  ```ts
  const rows = await fetchAllRows<Row>((from, to) =>
    supabase.from("transactions").select("...").gte("trans_date", start)
      .order("id", { ascending: true }) // 페이지가 안 겹치게 고유 키로 정렬 필수
      .range(from, to)
  );
  ```
  카테고리·결제수단·계좌처럼 몇십 행에서 늘지 않는 설정 목록이나, `.eq("id", …)`·
  `.maybeSingle()`처럼 결과가 정해진 조회는 그냥 조회해도 됨.

프로젝트 진행 상황·이력은 저장소 루트의 `HANDOFF.md`를 참고할 것.
