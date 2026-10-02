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
  `AccessListWorkerPicker`, `SiteAggregateTable`,
  `CategoryAggregateTable`, `CategoryDetailReport`, `ToolChecklistHistoryTable`,
  `QuotesTable`, `PurchaseOrdersTable`, `UnassignedWorkLogTable`,
  `ClassificationPendingTable`, `RevenueVerificationTable`, `SiteProfitTable`,
  `SiteProfitReport`, `PurchaseItemSearchTable`, `VatQuarterTable`, `TripLogList`,
  `TripOverviewReport`, `ProjectTripDetailTable`)에
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
  `app/src/components/crud/CreatePanel.tsx`가 정석 예시. 서버 렌더링 폼(`<form action={서버액션}>`)이라 `run()`을
  못 쓰면 제출 버튼에서 `useFormStatus()`의 `pending`일 때 `PendingOverlay`를 띄울 것(`AccessListSubmitButton`).

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
  - 표 칸 안에 `absolute` 요소(`sr-only` 화면 낭독용 글자 포함)를 넣으면 칸 안의 감싸는 요소에
    `relative`를 줄 것. 없으면 가로 스크롤 상자를 빠져나가 페이지 폭을 넓혀서, 휴대폰 크롬이
    페이지 전체를 축소해 오른쪽이 텅 빈 화면이 됨(프로젝트 목록 진행률 동그라미에서 실제로 발생 —
    `EntityTable`의 `ProgressCell`). 레이아웃 본문의 `relative overflow-x-clip`이 최후 방어로
    잘라 주지만, 칸 안에서 막는 게 원칙.
  - 표가 아닌 목록 줄(고정 폭 `grid-cols-[…]`·`shrink-0` 칸이 많은 flex 줄)도 휴대폰에선 넘쳐서 금액·버튼이
    잘림 — 휴대폰에서만 두 줄로 나눌 것(`CreditSettlementGroup`·`CreditHistoryToggle` 예시).
    글자 옆 버튼 묶음도 `max-md:flex-wrap`/`max-md:flex-col`(`AccessListCard`).
  - 선택칸 여러 개를 한 줄에 둘 땐 `inlineFieldClass`(폭 없음, 감싼 상자 폭은 안 넘게 `max-w-full`). `fieldClass`에 `w-auto`·`w-20` 등을
    덧붙이면 빌드 CSS에서 `w-full`이 이겨서 안 먹고, 한 줄의 칸들이 폭을 똑같이 나눠 "2026년"·긴 현장 이름이 잘림(휴대폰에선
    `max-md:flex-col`로 쌓아도 됨). 폭을 정하려면 `${inlineFieldClass} w-40`처럼(입력칸은 placeholder가 안 잘리는 폭으로).
  - 입력칸을 `flex-1`로 늘릴 땐 `min-w-0`도(그리드 칸 안이면 `w-full min-w-0`) — 입력칸 기본 폭(약 180px) 때문에 줄이 넘쳐
    옆 버튼("삭제")이 잘리거나 카드 밖으로 나감(계산기·발주서 품목 줄에서 실제로 발생). 그리드 칸은 `minmax(0,1fr)`.
  - PC(가로 1280 노트북)에서도 표가 상자보다 넓을 수 있음: `EntityTable`은 관리 칸이 `sticky-actions`(PC에서만 오른쪽 고정)라
    수정·삭제가 항상 보임. 맨 오른쪽 근처에 금액처럼 중요한 칸이 있으면 고정하면 그 칸을 가리므로 `xl:min-w-0`으로 1280부터
    상자 폭에 맞춤(`TransactionTable`). `EntityTable`의 칸 폭(%)은 PC에서 실제 표 폭에 맞춰 관리 칸을 뺀 나머지를 비율대로 나눔
    (켜 둔 칸의 %합이 100이 안 돼도 됨 — 전엔 남는 폭이 관리 칸으로 몰려 칸마다 "2026…"처럼 잘렸음).
  - 입력칸(`input`·`select`·`textarea`)의 배경색·글자색은 `globals.css`의 레이어 밖 규칙(흰 배경·검정 글자)이 이겨서
    `bg-*`·`text-*` 색 클래스가 안 먹음 — 입력칸 색을 바꿀 땐 `style`로 줄 것(`ToolChecklistCreateForm`의 이름·수량칸).
  - 큰 금액은 `whitespace-nowrap`("원"만 떨어지지 않게). 큰 숫자 여러 개를 나란히 둘 때는
    휴대폰에서 한 줄에 하나(`grid-cols-1 min-[480px]:grid-cols-2`), 4칸 배치는 `xl:`부터.
    (예외: 대시보드는 스크롤을 줄여 달라는 요청으로 숫자를 `text-sm sm:text-base`로 줄이고 휴대폰에서도
    2칸 — 설명은 칸 안이 아니라 칸 아래 작은 글씨로. 대시보드는 "정보는 다 두되 간결하게" 요청으로 맨 위 메모칸(제목 없이
    입력칸만, `dashboard_page_memo`)과 핵심 숫자 5칸(예상 매출액·예상 세전이익·예상 종합소득세·수금 예정액·지급 예정액)만
    늘 보이고 나머지는 한 카드 안의 접힘 목록(`FoldRow`, 기본 접힘, 접힌 줄에 핵심 숫자 한 줄 요약) — 새 정보는 핵심 칸을
    늘리지 말고(사용자가 따로 요청할 때만) 접힘 목록 안에 넣을 것. 여러 칸 배치는 `lg:`부터 — 768~1023 폭은 사이드바 때문에 본문이 좁아 `md:`에서 4~5칸이면 큰
    숫자가 칸 밖으로 넘침. 대시보드 문구는 포멀 톤(사용자 요청) — 회계·세무 용어("받을 돈"→수금 예정액, "뺀 금액"→차감,
    "부가세 제외"→공급가액 기준), 칸 이름·요약·주석은 명사형으로 끝내고, 한 문장짜리 안내만 "~됩니다/~습니다".)
  - 버튼은 줄바꿈되지 않음(`Button` 기본값). 한글은 띄어쓰기 단위로만 줄바꿈됨(`keep-all`).
  - **인쇄 주의:** A4 인쇄 폭(약 718px)도 `md`(768px) 미만이라 `max-md:` 등 휴대폰용
    클래스가 인쇄에도 적용됨 — 인쇄되는 칸에는 `print:max-w-none print:whitespace-normal
    print:overflow-visible`처럼 되돌리고, CSS로 쓸 때는 `@media screen and (...)`로 한정할 것.
    이름 붙인 페이지(`@page 이름` + `page:`)는 크기·여백이 같아도 크롬이 장을 끊어 빈 장이 생기므로 쓰지 말 것(동희
    반입반출증·견적서 쪽 번호에서 실제로 발생) — 한 화면에만 필요한 `@page` 규칙은 그 컴포넌트 안 `<style>`로(`QuotePrintView`).
    `usePrintFitToPage`(한 장에 맞춰 자동 축소)는 그 양식만 270mm에 맞추므로, 감싼 팝업 카드는 인쇄 때 안쪽 여백을 뺄 것
    (`print:p-0`) — 안 빼면 여백만큼 넘쳐 둘째 장이 생김(출입신청서에서 실제로 발생).

- **추가 버튼·화면 이름은 한 가지 방식으로.** 새 화면도 예외 없이 적용(사용자 요청 "정돈"):
  - 추가 버튼은 오른쪽(화면 머리 줄 또는 그 칸의 머리 줄 오른쪽), 문구는 "+ 대상 동사" — 목록 항목은 "추가"(`CreatePanel`의
    "+ 프로젝트 추가", "+ 메모 추가"), 돈 기록은 "등록"("+ 거래 등록", "+ 급여 지급 등록"), 문서는 "작성"("+ 견적서 작성").
    `CreatePanel`은 닫혀 있을 때 버튼을 오른쪽으로 붙이고 펼치면 입력 카드가 한 줄을 다 씀.
  - 메뉴 이름(`AppNav`)과 화면 제목(h1)은 같게, 두 가지를 묶은 이름은 "·"로("매입매출·외상", "직원·급여").
  - 한 탭 안의 칸들은 같은 카드 모양으로(`CollapsibleSection` 기본 카드 — 카드 없는 `bare`와 섞지 말 것, 공구리스트 탭 참고).

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

- **금액 입력칸은 `@/components/ui/MoneyInput`을 쓸 것**(`type="number"` 대신). 입력하는 동안 천 단위
  쉼표("1,234,567")가 보이고, 폼으로 제출되는 값(`name`)은 숨은 칸에 쉼표 없는 숫자로 들어감.
  제어 모드는 `value` + `onValueChange`, 폼 제출용은 `name` + `defaultValue`. 음수는 `allowNegative`,
  소수는 `allowDecimal`. 수량·%·연도·일수 같은 금액 아닌 숫자는 그대로 `type="number"`.

- **금액 계산을 바꾸면 `npm test`(app 폴더)로 자동 검사를 돌릴 것.** 부가세 분리(`vatBasis`),
  외상 잔액(`credit`), 종합소득세(`tax`), 견적 금액·한글 금액(`quoteCalc`·`numberToKorean`),
  예상 미수액(`expectedReceivable`), 엑셀 거래 읽기(`transactionExcel`), 작업일지 집계(`workLogSummary`), 출장일지 합계·보고서 작업일수 나눔·출장 투입 인원(`tripLog`), 보고서 출장 현황(`tripOverview`)의 검사가 `app/src/lib/__tests__/`에 있음. 별도 라이브러리 없이
  Node 내장 `node:test`로 .ts를 바로 실행(`app/scripts/test-hooks.mjs`가 `@/` 경로 연결).
  계산 함수를 새로 만들거나 화면 안에 있던 계산을 `lib/`로 옮기면 검사도 같이 추가할 것.
  (vitest는 npm 설치 오류로 못 씀 — 새 테스트 라이브러리를 넣지 말 것)

- **작업일지의 "내용 이어받기"는 `lib/workLogSummary.ts`의 `resolveWorkLogTitles` 하나로만 정할 것.** 내용을 비운 줄은 같은
  현장·같은 프로젝트의 앞 내용 → 없으면 프로젝트 이름 → 프로젝트도 없으면 그 현장의 앞 내용. 작업일지를 날짜·내용별로 세는
  곳을 새로 만들 때도 이 함수를 쓰고, 그 해 1월 1일부터 넘겨서 정한 뒤 기간 안의 줄만 셀 것 — 곳마다 따로 이어받다가 다른
  프로젝트 날짜까지 한 작업으로 합산되고 팝업·표 숫자가 서로 달랐던 적이 있음.

- **앱에서 본 실제 데이터(거래처·금액·작업일지 내용·직원 정보 등)는 외부로 내보내지 말 것**(사용자 요청: 외부 반출 절대
  불가). 커밋 메시지·코드 주석·PR 설명·`HANDOFF.md`·외부 서비스에 실제 값을 적지 말고, 점검·테스트·예시는 가짜 데이터로.

- **외부 AI(제미나이)는 영수증·급여대장 인식에만 쓸 것**(`/api/ocr`·`/api/payroll-ocr`). 사용자 요청으로 보고서 AI 질문은
  없앴고, 엑셀 거래 일괄 등록은 머리글 이름으로 직접 읽음(`lib/transactionExcel.ts`). 거래처·금액 같은 회사 자료를 외부 AI로
  보내는 기능을 새로 붙이거나 되살리려면 먼저 사용자에게 물어볼 것.

- **PR 만들기·main 머지는 매번 사용자에게 먼저 물어볼 것**(사용자 요청). 작업이 끝나면 작업 브랜치에 커밋·푸시하고
  "PR 만들고 머지할까요?"라고 물은 뒤 답을 받고 나서 PR·머지. 작업 도중 "머지도 해 달라"고 했어도 그 작업에만 해당하고,
  다음 작업부터는 다시 물어볼 것(main 머지 = 실제 앱 배포).

프로젝트 진행 상황·이력은 저장소 루트의 `HANDOFF.md`를 참고할 것.
