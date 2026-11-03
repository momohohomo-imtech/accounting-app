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
  `TripOverviewReport`, `ProjectTripDetailTable`, `YearEndCheckTable`, `DuplicateCandidatesTable`,
  `UncategorizedPurchasesTable`, `TransactionHistoryTable`, `ProjectReceiptsTable`, 통합 보고서의 `ProjectsCombinedTable`·
  `CombinedCategorySection`·`CombinedAgencyTable`, `BankBalanceCheckPopup`(통장 잔액 확인 기록), `YearLockPanel`(잠긴 해),
  `ReceivableAgingTable`(오래된 외상매출금), `HometaxReconcilePanel`(홈택스 대조 결과), `ConstructionMemoList`(공사 메모),
  `WorkSequenceList`(공사 작업 순서표), `FixedExpensePanel`(고정지출 지정 거래처·카테고리·후보))에
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

- **팝업은 ESC로 닫히고, 닫을 때 뒤로가기 기록을 쌓지 말 것**(사용자 요청 11/1 "모든 팝업창은 esc누르면 닫게", "뒤로가기로 이전 팝업
  창으로 갈 수 없게"). 새 팝업도 예외 없이:
  - 화면을 덮는 팝업·확인창은 `lib/useEscapeKey.ts`의 `useEscapeKey(열림, 닫기)` — 겹친 팝업은 맨 위 하나만 닫힘(`lib/escapeStack.ts`),
    한글 조합 중 ESC·저장 중("처리 중...")에는 안 닫힘. `keydown` 리스너를 따로 붙이지 말 것(순서가 꼬여 아래 팝업까지 닫힘).
  - 주소(?…)로 연 팝업을 닫을 땐 `router.push(닫은 주소)`·`<Link href={closeHref}>` 대신 `lib/popupNavigation.ts`의
    `closePopup(router, href)`·`PopupCloseLink`·`EscapeCloseLink` — 같은 화면의 팝업 없는 지난 기록으로 뒤로 가고, 없으면 replace.
    예전엔 닫을 때마다 기록이 쌓여 뒤로가기로 닫은 팝업이 다시 열렸음. 저장 후 닫기도 이것으로 — 저장 서버 액션은 `revalidatePath`를
    부를 것(그래야 뒤로 가도 Next.js가 캐시를 비워 새 자료로 그림).
  - 팝업을 여는 링크는 push(휴대폰 뒤로가기로 팝업이 닫히게). 팝업 위에 팝업을 겹쳐 여는 링크(보고서 팝업 → 거래 수정)도 push — 위
    팝업의 닫은 주소 = 아래 팝업 주소. 팝업 안에서 다른 팝업·화면으로 "바꿔" 가는 링크는 `replace`(작업일지 날짜 팝업 → 출장일지).
- **서버 액션은 실패를 `{ error }`로 돌려주고 화면에 보여 줄 것**(오류를 버리지 말 것 — 예전엔 직원·급여·메모 등에서 저장이
  실패해도 된 것처럼 보였음). 폼은 실패하면 닫지 말고 입력한 내용을 그대로 둘 것(`form action`은 끝나면 입력칸을 비우므로
  `onSubmit` + `preventDefault`, `MemoCreateForm` 예시). 체크칸처럼 바로 저장하는 칸은 실패하면 원래 값으로 되돌릴 것.
- **지우면 다른 자료가 같이 지워지거나 연결이 끊기는 항목은 `lib/deleteGuard.ts`로 삭제를 막고 무엇이 몇 건인지 안내할 것**
  (프로젝트·거래처·직원·일용직·계좌·현장·카테고리·결제수단·사무소). DB 규칙(on delete cascade·set null)을 새로 걸면 그 항목의
  `*_LINKS`에도 넣을 것. 확인 조회가 실패하면 지우지 않음.

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
    한 줄 말줄임. 휴대폰은 title 풍선이 안 떠서, 잘린 이름을 꼭 봐야 하는 칸은 `tap-full` 클래스 + `tabIndex={0}`(누르면 그 칸만
    줄바꿈해서 전체 글자 — globals.css, 장부 점검 표 예시).
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

- **출입신청서(`AccessApplicationPopup`)는 원청이 준 엑셀 양식("공사 출입자 명부")을 pt 단위로 그대로 재현**(사용자 요청 10/30
  "색상·규격 전부"): 칸 너비(엑셀 열 너비 × 8px + 0.5px, 96dpi)·줄 높이·글꼴(기아 전용 글꼴, 없으면 맑은 고딕)·문구(원본 띄어쓰기·
  오타 그대로)·로고(엑셀 안 그림을 엑셀처럼 잘라 쓴 `kia-logo-form.png`)·인쇄 설정(A4 세로, 여백 좌우 12mm·위아래 6mm, 가운데,
  81% — 넘치면 더 줄임, 아래 왼쪽 바닥글)을 엑셀과 같게 둘 것. 원청 양식이 바뀌면 새 엑셀 파일의 칸·줄·그림 위치로 다시 계산.

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
  `.maybeSingle()`처럼 결과가 정해진 조회는 그냥 조회해도 됨(직접 입력 거래처명 자동완성 `fetchAllRawClientNames`는 최근 3년만 —
  해마다 읽는 양이 끝없이 늘지 않게). 해마다 늘어나는 선택 목록(거래처·연도 무관 프로젝트·현장·메모)은
  `fetchAllData`(기존 `{ data }` 모양 그대로) — 이름순처럼 겹칠 수 있는 정렬이면 끝에 `.order("id")`를 붙일 것.
  `.in("칸", 목록)`에 그 해 프로젝트 전부·외상 거래 전부처럼 수백 개가 될 수 있는 목록을 넣을 때는 `fetchAllRowsIn`(100개씩 나눠
  조회해 합침) — 목록이 요청 주소에 그대로 들어가 너무 길면 요청이 거절돼 화면이 안 열림.
  백업(`lib/backup.ts`)도 표마다 고유 칸 순으로 끝까지 읽음 — 예전엔 한 번에 `select`해서 백업 파일이 표마다 1,000줄에서
  잘렸음(복원은 다 지우고 파일 내용만 넣어서 나머지가 영구히 사라짐). 백업에 새 표를 넣으면 고유 칸(`id`, 없으면 `ORDER_KEY`)을
  확인하고, 복원은 `restoreBlockReason`(잘린·손상 파일 막기)을 거치게 둘 것.
- **새 표를 만들면 백업·복원 목록에 같이 넣을 것**: `lib/backup.ts`의 `BACKUP_TABLES` + `supabase/096_atomic_restore.sql`의
  `restore_allowed_tables()`(새 SQL에서 함수를 다시 만들어 목록 추가 — `restore.test.ts`가 앱 목록과 비교). 예전엔 공사 메모·일용직
  사용내역 등이 빠져 있어 백업으로 못 되살렸고, 복원 때 프로젝트·일용직을 지우면서 같이 지워졌음. 복원은 DB 함수
  (`restore_stage`로 나눠 올리고 `restore_commit`으로 한 번에 — 하나라도 실패하면 전부 취소)로만 — 앱에서 표마다 지우고 넣지 말 것.
  백업에 없는 표 중 바꾸는 표를 참조하는 표는 함수가 지금 자료를 보관했다 되돌림(예전 백업 복원 대비). 백업에만 담고 복원하지
  않는 표는 `lib/restore.ts`의 `BACKUP_ONLY_TABLES`(견적서 공급자·신고 끝난 해 잠금 — 잠그기 전 백업으로 복원해도 잠금이 안 풀리게).
  백업 파일은 압축(.json.gz — `encodeBackupFile`/`decodeBackupFile`, 예전 .json 백업도 복원됨), 자동 백업은 크론이 성공한 뒤에만
  `pruneAutoBackups`로 정리(사용자 결정 10/31: 최근 8주 전부 + 그 전 1년은 달마다 첫 백업 1개, 직접 만든 백업·복원 직전 백업은 안
  지움, 최근 자동 백업 8개는 늘 남김 — `lib/backupRetention.ts`).
- **파일은 서버(Vercel)로 4.5MB 넘게 보내지 말 것**(10/31): 서버 액션·API 요청 본문이 4.5MB를 넘으면 앱 코드에 닿기 전에 거절됨
  (next.config의 bodySizeLimit과 상관없음 — 휴대폰 사진 첨부·영수증 인식이 "오류"로만 실패했던 원인). 첨부파일은 서명된 올리기
  주소로 브라우저에서 저장소로 바로(`actions/attachments.ts`의 `prepareAttachmentUpload` → `lib/supabase/signedUpload.ts` →
  `saveUploadedAttachment`), 인식용 파일(영수증·급여대장·엑셀)은 `lib/postFileToApi.ts`(큰 사진은 줄여서, 한도 넘는 PDF·엑셀은
  보내기 전에 안내, 413 등도 문구로). 파일을 받는 화면을 새로 만들 때도 이 둘 중 하나로.

- **금액 입력칸은 `@/components/ui/MoneyInput`을 쓸 것**(`type="number"` 대신). 입력하는 동안 천 단위
  쉼표("1,234,567")가 보이고, 폼으로 제출되는 값(`name`)은 숨은 칸에 쉼표 없는 숫자로 들어감.
  제어 모드는 `value` + `onValueChange`, 폼 제출용은 `name` + `defaultValue`. 음수는 `allowNegative`,
  소수는 `allowDecimal`. 수량·%·연도·일수 같은 금액 아닌 숫자는 그대로 `type="number"`.

- **금액 계산을 바꾸면 `npm test`(app 폴더)로 자동 검사를 돌릴 것.** 부가세 분리(`vatBasis`),
  외상 잔액(`credit`), 종합소득세(`tax`), 견적 금액·한글 금액(`quoteCalc`·`numberToKorean`),
  예상 미수액·프로젝트 받은 돈(`expectedReceivable`), 이익 예상(`projectProfit` — 대시보드·보고서 공통), 프로젝트 목록 하단 합계·통합
  보고서(`projectListTotals`), 엑셀 거래 읽기(`transactionExcel`), 작업일지 집계(`workLogSummary`), 출장일지 합계·보고서 작업일수 나눔·출장 투입 인원(`tripLog`), 보고서 출장 현황(`tripOverview`), 매입장 한 결제 묶기(`paymentGroup`), 장부 점검(`ledgerCheck`), 거래 수정 이력 표시·일괄 변경 접기(`transactionHistory`), 백업
  끝까지 담기(`backup`), 복원 막기·표 목록·나눠 올리기(`restore`), 백업 상태(`backupStatus`), 삭제 막기(`deleteGuard`), 급여 중복
  확인(`payrollDuplicates`), 긴 ID 목록 나눠 조회·자동완성 기간(`supabaseFetchAll`), 파일 올리기 규칙(`fileUpload`), 백업 자동
  정리(`backupRetention`), 제미나이 호출·오류 안내(`gemini`), 대표자 보험료 요율(`ownerSocialInsurance`), 통장 잔액 맞추기(`bankReconcile`),
  해 잠금 불러오기(`yearLock`), 오래된 외상매출금(`receivableAging`), 이번 달 신고·납부 일정(`annualTasks`), 홈택스 세금계산서
  대조(`hometaxReconcile`), 프로젝트 번호 순서(`projectCode`), 프로젝트 목록 상태 체크 저장(`projectStatusFilter`), 팝업 ESC 순서(`escapeStack`), 팝업 닫기 기록(`popupNavigation`), 메모 한 장 엑셀(`memoExport`), 공사 작업 순서
  일정·예상(`workSequence`)·모아 보기(`workSequenceOverview`), 고정지출 달 평균(`fixedExpense`)의 검사가 `app/src/lib/__tests__/`에 있음. 별도 라이브러리 없이
  Node 내장 `node:test`로 .ts를 바로 실행(`app/scripts/test-hooks.mjs`가 `@/` 경로 연결).
  계산 함수를 새로 만들거나 화면 안에 있던 계산을 `lib/`로 옮기면 검사도 같이 추가할 것.
  (vitest는 npm 설치 오류로 못 씀 — 새 테스트 라이브러리를 넣지 말 것)

- **미수 금액(받을 금액·남은 금액)은 `lib/expectedReceivable.ts`의 `receivableOf` 하나로만 계산할 것**(사용자 요청 10/29).
  대시보드 수금 예정액(`expectedReceivableByStatus`)과 같은 단위·상태 — 수주예상액(발주액 − 대행구매액) − 받은 매출(즉시결제·정산 끝난
  외상, `receivedSalesByProject`), 0 아래로 안 내려감, 진행중·공사 완료·완료 수금대기(`RECEIVABLE_STATUSES`)만(아니면 "-"). 쓰는 곳:
  프로젝트 목록 "미수 금액" 칸(줄은 자기 것, 접힌 묶음 요약 줄은 합산 보고서와 같은 묶음)·하단 합계·"공사완료 예상 미수액", 프로젝트
  보고서 "남은 금액", 보고서 메뉴 "프로젝트별 손익" 남은 금액 칸·합계 줄·"프로젝트 요약" 카드(미수금 표시 포함). 필터가 없으면 목록
  하단 합계·보고서 합계 줄 = 대시보드 수금 예정액. (예전엔 "공사완료 예상 미수액"·요약 카드 "미수금"이 받은 돈을 빼지 않은 수주예상액이었음.)
- `EntityTable`의 열 표시·폭 저장 키는 전체 칸 이름 목록이라, 칸을 새로 넣으면 지금 키에 저장값이 없을 때 칸 1~2개만 다른 예전 키에서
  가져옴(`readStoredTableSetting`) — 칸을 넣을 때마다 사용자가 맞춰 둔 열 설정이 초기화되지 않게. 칸 이름(`name`)을 바꾸면 이 연결이
  끊기니 꼭 필요할 때만.

- **이익 예상(대시보드 예상 세전이익·연간 예상·프로젝트 기준, 보고서 예상 순이익율)과 1월 부가세 미발행 예상분은
  `lib/projectProfit.ts`로만 계산할 것.**
  기준(사용자 결정): 세금계산서(거래일) 기준이라 외상 미정산도 포함 · 검토중 프로젝트의 발주액은 어떤 합계에도 안 넣음(이미 쓴
  매입은 비용) · 연도는 프로젝트 귀속 연도(연말까지 계산서를 못 끊은 프로젝트는 사용자가 귀속 연도를 다음 해로 바꿈) · 발주액
  0원은 빈칸과 같게 · 어미 + 귀속 하위는 한 묶음(`projectGroups`, "타 프로젝트 귀속" 하위는 어미 상태 — `effectiveStatus`) —
  하위에 붙인 발주액·매출·매입도 어미 묶음으로 합침 · "미발행" 묶음(하반기 예상 이익·1월 부가세 예상분 대상)과 대시보드 수금
  예정액(`lib/expectedReceivable.ts`의 `expectedReceivableByStatus`)·연말 점검은 `activeGroups` 하나로 판단 — 계산 단위는 어미 +
  "타 프로젝트 귀속" 하위, 자기 상태가 있는 하위는 따로 한 단위(프로젝트 목록 상태와 같게 — 진행중 어미 아래 "완료 수금대기" 하위가
  진행중 칸에 들어간 적이 있음) · 하반기 미발행 예상은 하반기
  전에 끊은 매출(작년 것 포함)을 발주액에서 뺌 · 묶음 매출 = 발주액 − 대행구매액, 실제로 끊은 매출이 더 크면 그 금액, 발주액이
  없으면 실제 매출(`groupRevenue` — 대행구매는 비용으로 또 빼지 않음), 하반기 미발행 예상도 하반기에 실제로 끊은 매출이 더 크면 그
  금액(`unbilledH2Profit`) · 프로젝트 없이 등록한 매출도 프로젝트 기준 이익에 더함 · 대시보드 "예상 매출액" = 그 매출 합계
  (`projectBasedProfit`의 `revenue` — 프로젝트 목록 수주예상액 합계와는 그만큼 다를 수 있음, 10/29 사용자 "전부 고쳐줘요").
  화면마다 따로 계산하다가 대시보드와 보고서 숫자가 어긋난 적이 있고, 프로젝트마다 따로 세다가 하위 매출이 두 번 잡힌 적이 있음.

- **"한 결제로 묶기"(`transactions.payment_group_id`, 092 SQL)는 매입장 표시용.** 카드 결제 한 번을 프로젝트별로 나눈 거래들은
  같은 묶음 번호를 가짐 — 저장·계산(프로젝트 손익·보고서·부가세·외상)은 거래(줄)마다 그대로, 매입장 표·엑셀만 `lib/paymentGroup.ts`의
  `groupLedgerRows`로 한 줄. 묶음 수정은 `saveTransactionGroup` 하나로(줄 수정·추가·삭제). 거래 1건에 프로젝트 배분표를 다는 방식은
  프로젝트 금액을 쓰는 곳을 전부 고쳐야 해서 쓰지 않기로 사용자와 정함. 외상을 한 번에 정산할 때도 같은 묶음 번호(정산 등록의
  "한 결제로 묶기") — 매입장 날짜는 계산서 날짜 그대로(묶음 줄은 날짜 범위 + 정산일 표시, 사용자 결정), 정산일로 옮기지 말 것.

- **프로젝트 목록의 귀속 묶음(어미+하위)은 `EntityTable`의 `groupSummaries`로 접힌 요약 한 줄**(사용자 요청). 줄마다 자기 값,
  요약 줄은 합계(이익금·이익율은 손익보고서와 같은 `groupProjectProfit` 묶음 기준), 하단 합계·엑셀에서 이익금이 두 번 세지지
  않게(`inGroup`). 보고서는 요약 줄 = 합산, 펼친 어미 줄 = 자기 것만(`own=1`), 하위 줄 = 자기 것만. 하단 합계는 그 해 프로젝트만
  (다른 해 하위는 묶음에 보이기만 — 그 해 목록에서 셈).
- **프로젝트 목록 "통합 보고서"**(`report=combined`, `ProjectsCombinedReport`)는 지금 필터의 그 해 프로젝트 전부(묶음 때문에 함께
  보이는 하위 포함, 다른 해 하위 제외 — 하단 합계와 같은 대상)를 합친 읽기 전용 보고서. 요약·프로젝트별 표와 목록 하단 합계는
  `lib/projectListTotals.ts`(`listUnits`·`unitAmounts`·`listTotals`)로만 계산(귀속 묶음은 한 단위, 발주액 없는 단위는 이익금에서 빠지고
  따로 표시). 거기서 연 프로젝트 보고서는 `back=combined`라 닫으면 통합 보고서로 돌아감.
- **귀속은 한 단계(어미 ← 하위)만.** 귀속 대상 선택은 다른 프로젝트에 귀속 안 된 것만, 서버(`actions/projects.ts`의
  `parentError`)에서도 새로 고르는 귀속을 확인(하위가 있는 프로젝트·이미 귀속된 프로젝트는 안 됨). 예전에 3단으로 저장된 자료는
  프로젝트 목록·이익 예상(`lib/projectProfit.ts`의 `topProjectOf`)·보고서 요약 카드·합산 보고서 모두 맨 위 어미 묶음으로 봄(예전엔
  화면마다 묶는 단계가 달라 숫자가 어긋났음). 귀속 선택 목록의 가운데 프로젝트는 지금 값일 때만 보임(`onlyIfCurrent`).

- **장부 점검·수정 이력·연말 점검·예정고지액**(10/28 사용자 요청 "전부"):
  - 매입매출 "장부 점검" 탭(`LedgerCheckSection`)은 찾기만 함 — 중복 의심(같은 날·구분·거래처·품목·금액, 한 결제 묶음끼리는 제외)과
    카테고리 빈 매입(세금·보험·금융으로 보이는 글자 표시 — 칸마다·단어마다, 두 글자 낱말은 단어 앞·끝에서만. 칸을 붙여 찾다가
    "○○자재"가 금융으로 잡힌 적이 있음)은 `lib/ledgerCheck.ts`로. 고치는 건 기존 수정·삭제·`bulkUpdateCategoryId`.
    중복 "아님" 표시는 DB 변경이 필요해서 안 만듦(사용자에게 "DB 변경 없음"으로 안내함).
  - 거래 수정 이력은 DB 트리거(094 SQL `transaction_history`)가 남김 — 앱 코드에서 이력을 쓰지 말 것(트리거만, 이력 표에는 쓰기
    정책 없음, 095 SQL부터 영수증 인식 원문은 빼고 남김). 표시는 `lib/transactionHistoryLoad.ts`(이름표 조회) +
    `lib/transactionHistory.ts`(칸별 "전 → 후"). 한 요청으로 20건 이상 바뀐 것(백업 복원·일괄 변경)은 한 줄로 접음
    (`collapseBulkChanges`). 표가 없을 때만(SQL 실행 전) 이력 칸을 숨기고, 다른 조회 오류는 오류로 보여 줌(`HistoryLoad`).
  - 부가세 예정고지서 금액(093 SQL `vat_prepayment_notices`)을 넣으면 대시보드 1월 부가세에서 추정 대신 그 금액을 차감.
  - 연말 점검(프로젝트 목록, 10월부터)은 `unbilledRemainingByGroup`(1월 부가세 미발행 예상분과 같은 기준)으로 고르고, 귀속 연도
    옮기기는 `moveProjectsToNextYear` 하나로(지금 그 해인 프로젝트만 — 두 번 눌러도 두 해 뒤로 안 감). 어미 줄은 같은 묶음의 검토중
    하위도 같이 옮김(자기 상태로 따로 보이는 하위는 따로 고름).
- **대표자 보험료 요율은 `lib/ownerSocialInsurance.ts`의 연도별 표**(`insuranceRatesFor(year)`): 국민연금 보험료율은 법정 일정(2033년
  13%)으로 계산, 건강보험·장기요양·국민연금 상·하한은 해마다 정해지면 표에 한 줄씩(건강보험 8~9월, 장기요양 10~11월, 상·하한 3월
  고시·7월 적용). 표에 없는 해는 가장 최근 값으로 추정하고 대시보드에 "미확정 — ○○년 요율 적용"으로 표시. 종합소득세율이
  바뀌면 `lib/tax.ts`의 표와 `INCOME_TAX_BRACKETS_SINCE`를 같이.
- **097 SQL**(10/31 사용자 결정 "셋 다 진행"): ① 프로젝트·견적·발주 번호는 한국 시각 연도, 1,000번째부터 4자리, 동시 생성 안전
  ② 통장 잔액 확인 기록(`bank_balance_checks` — 앱 계산 잔액 = 시작 잔액 + 그 날까지 입금 − 출금, `lib/bankReconcile.ts`, 은행 화면
  계좌 잔액과 같은 계산) ③ 신고 끝난 해 잠금(`locked_years` + 거래 트리거 — 잠근 해는 거래 추가·삭제와 신고 칸(날짜·구분·거래처·
  카테고리·금액·부가세·세금계산서·외상 여부) 수정을 DB가 막음, 프로젝트·결제수단·품목·메모·묶음·외상 정산은 그대로, 복원 함수·SQL
  편집기는 막지 않음). 거래 표에 신고에 들어가는 칸을 새로 만들면 트리거의 비교 칸에도 넣을 것. 잠그기·풀기는 관리자만(장부 점검
  탭 `YearLockPanel`, 매입매출장에 잠김 안내). 표가 없으면(실행 전) 잔액 맞추기·잠금 칸은 숨김.
- 대시보드 접힘 목록의 "이번 달 신고·납부 일정"은 `lib/annualTasks.ts`(세법·일정이 바뀌면 여기만), 오래된 외상매출금 경과 기간은
  `lib/receivableAging.ts`(잔액은 `remainingBalance` — 외상매출금 합계와 같은 기준), 1~5월엔 전년도 신고 자료 바로가기.
- **홈택스 세금계산서 대조**(장부 점검 탭)는 파일을 브라우저에서 읽고(exceljs, .xls는 .xlsx로 다시 저장 안내) 날짜·거래처·금액만
  앱 서버 액션으로 보내 대조(`lib/hometaxReconcile.ts`) — 외부 서비스로 보내지 않음, 찾기만 하고 바꾸지 않음.
- **11/1 사용자 요청**: 매입매출장 "메모" 칸은 메모1·메모2를 이어 앞 6글자만(누르면 전체, PC는 마우스를 올려도 전체 — 다른 칸처럼
  체크로 숨김, 주소 `showMemo=0`). 거래 등록·견적서의 완료 프로젝트 선택 목록은 프로젝트 번호 순·최근이 위(`compareProjectCodeDesc` —
  번호를 글자로 비교하면 "2026-1000"이 "2026-999"보다 앞에 옴). 프로젝트 목록 상태 체크(검토중~기타)는 바꿀 때 이 기기 쿠키에
  저장되고, 주소에 상태가 없으면 서버가 저장된 상태만 조회(`lib/projectStatusFilter.ts`, 전부 끄면 "all" = 전체, 주소의 상태가 먼저).
- **11/2 사용자 요청**: 공사 메모는 메모 하나 = 한 줄 표(`ConstructionMemoList` — 내용은 한 줄 말줄임, 누르면 그 줄만 전체, 날짜는
  한국 시각). 공사 메모·품질관리 노하우·공구 메모는 항목마다 "엑셀"로 그 메모 하나만(`downloadMemoXlsx` + `lib/memoExport.ts` 항목 —
  "항목 | 내용" 두 칸, 긴 내용은 행을 나눠 다 보이게).
- **공사 작업 순서**(공사 관리 탭, 098 SQL `work_sequences`·`work_sequence_steps`, 11/2 사용자 결정): 순서표 = 프로젝트·제목·단위(순서표마다
  일 또는 시간)·시작일(시간이면 시작 시각), 단계 = 순번(숫자를 고치면 그 줄이 내용째 이동 — 공용 `SeqInput`)·작업 내용·세부 설명·
  주의사항·기간·앞 작업과 겹침·완료·완료일. 단계 날짜는 저장하지 않고 `lib/workSequence.ts`로만 계산(시작 = 앞 단계 끝 − 겹침, 겹침은 앞
  단계 기간까지만, 토·일 포함 달력 그대로 — 사용자 결정 "기간+겹침 → 날짜 자동"). 흐름 차트(`WorkSequenceChart`)에서 겹침 −/+.
  저장은 `saveWorkSequence` 하나로(화면에서 만든 id로 순서표·단계를 upsert한 뒤 지운 단계 정리 — 다시 눌러도 두 번 안 들어감),
  엑셀(`downloadWorkSequenceXlsx` — 2장 흐름 차트)·인쇄(팝업만 가로 A4). 프로젝트를 지우면 같이 지워지는 표라 `PROJECT_LINKS`에 있음.
  11/2 추가(사용자 "1-4번 진행"): ① 복사(`?seq=new&copyFrom=` — 단계·기간·겹침·앞 작업 그대로, 완료·시작일·프로젝트는 비움, id는
  새로) ② 오늘 기준 진행 상태(`stepStatus`·`summarizeSequence` — 계획 끝이 지났는데 미완료면 "N일 지남", 차트 오늘 선·빨간 막대,
  목록 "지연 N단계") ③ 완료 체크·완료일은 저장된 단계면 바로 저장(`setWorkSequenceStepDone`, 바뀐 줄이 없으면 오류, 실패하면 되돌림)
  ④ 앞 작업(099 SQL `after_step_id`·`after_start` — 기본 바로 앞 단계, "처음부터", 앞 순번 단계 하나. 뒤 순번을 가리키면 바로 앞
  기준 + 알림이라 서로 물려 도는 일 없음, 099 실행 전엔 칸을 숨기고 저장하지 않음).
  11/2 팀(분업) 색(사용자 결정 "순서표마다" + 같은 팀 일정 겹침 알림, 100 SQL `work_sequences.teams` jsonb [{id,name,color}]·
  `work_sequence_steps.team_id`): 흐름 차트는 **색 = 팀, 모양 = 상태** — 막대 색은 팀(정해진 순서 파랑→주황→청록→노랑→분홍→초록→보라,
  `lib/workSequence.ts`의 `TEAM_COLORS` — 색 구분 검사를 통과한 순서라 바꾸지 말 것, 빨강은 "계획보다 늦음" 전용이라 팀 색에 넣지 말 것,
  팀 미정은 예전 남색), 완료 = 옅은 막대 + ✓, 늦음 = 빨간 테두리 + !, 앞 작업과 겹침 = 빗금(상태를 색으로 칠하지 말 것 — 팀 색과 헷갈림).
  색만으로는 3~4팀 넘으면 헷갈려서 막대·왼쪽 칸에 팀 이름도 늘 같이. 팀 목록은 순서표마다(복사하면 같이, 다른 순서표에서 쓴 이름은
  골라 쓰기·그때 색), 이름이 비거나 같으면 저장 막음(`teamNameProblem`, 서버도). 팀별 보기 = 그 팀만 진하게(인쇄·엑셀은 그 팀 단계만,
  순번은 원래대로). 같은 팀 일정 겹침(`teamConflicts`)은 완료 단계·팀 미정 빼고 알림만(저장은 막지 않음). 100 실행 전엔 팀 칸을 숨기고
  저장하지 않음(조회는 `select("*")`라 칸이 없어도 됨).
  11/3 추가(사용자 "1-3번", DB 변경 없음): ① 예상 일정(`forecastSchedule`·`forecastSummary` — 계획은 그대로 두고, 늦게 끝난 단계(완료일)와
  안 끝난 늦은 단계(오늘 끝나는 것으로 봄)만큼 뒤 단계를 밀어 예상 완료일. 앞 작업이 일찍 끝나도 당겨 시작하지 않음(팀 일정은 계획대로
  잡혀 있으므로). 순서표 머리 "예상 완료 …(N일 늦음)"·일정 칸 "예상 …"·차트 점선 막대·목록 "예상 완료" 칸·엑셀) ② 팀별 일정
  (`lib/workSequenceOverview.ts`의 `teamSchedule` — 앞으로 2주, 팀 이름이 같으면 순서표가 달라도 한 팀·한 색, 같은 날 다른 순서표 작업과
  겹치면 알림 — 한 순서표 안 겹침은 순서표 화면 몫) ③ 오늘·이번 주 할 일(`buildAgenda` — 늦은 작업은 목록 "지연"과 같은 계획 기준,
  오늘·이번 주는 예상 일정 기준). 모아 보기는 탭 위 카드, 완료한 단계·시작일 없는 순서표는 빠짐.
- **고정지출**(보고서 메뉴 "거래처·카테고리 집계" 안, 11/3 사용자 결정 "지정한 거래처의 총매입액 ÷ 12" + "카테고리에서도 지정 — 급여·
  차량·숙박비·식비 등"): 지정한 거래처·카테고리의 최근 12개월(지난달까지, 한국 시각) 매입 합계(공급가액 + 부가세, 거래일 기준 — 외상
  미정산 포함, 프로젝트에 걸린 매입도 포함) ÷ 나온 달(12달 중 매입이 있던 달 수) = 달 평균("낸 달 평균" — 11/3 사용자 결정 "낸 달 평균이
  맞다", 처음엔 ÷ 12였음. 합계 ÷ 12는 참고 칸 "÷12 평균" — 1년에 한 번 내는 것은 그 금액이 그대로 달 평균이 되므로), 지정 줄 달 평균의 합 =
  "매달 기본으로 나가는 돈", "1년 환산" = 그 × 12 — `lib/fixedExpense.ts`로만 계산. **한 거래는 한 줄에만**: 지정 거래처에서 산 건
  그 거래처 줄, 아니면 지정 카테고리 줄(사용자 결정 "거래처 줄 우선" — 합계가 겹치지 않게, 후보·고르기 목록도 다른 줄에 들어간 매입은 빼고 셈). 지정은 101 SQL `clients.is_fixed_expense`·102 SQL
  `expense_categories.is_fixed_expense`(`setClientFixedExpense`·`setCategoryFixedExpense`, 관리자·직원만 — 바뀐 줄이 없으면 오류). 은행
  거래는 넣지 않음(사용자: 자동이체도 매입매출장에 직접 등록 — 넣으면 두 번 셈). 급여는 매입매출장 급여 카테고리로만(직원·급여 메뉴
  기록은 안 셈). 직접 입력한 거래처명은 거래처로는 지정 불가(카테고리로는 잡힘, 거래처로 등록하면 가능). 나온 달·÷12 평균, 들쭉날쭉한
  곳은 "가장 적은 달 ~ 가장 많은 달"을 같이, 지정 안 한 곳 중 10달 이상 나온 곳은 후보(기본 접힘 — 11/3 사용자 요청), 고르기 목록은 달 평균
  큰 순. 101·102 실행 전엔 그쪽 지정 없이 후보만.
- **백업 상태**(10/29 사용자 요청 "A"): 대시보드 접힘 목록 맨 아래 "백업" 줄 + 마지막 자동 백업 후 8일이 넘을 때만 맨 위 카드에
  경고 한 줄(`lib/backupStatus.ts`, 관리자·직원만 — 백업 기록은 그 두 역할만 읽음). 자동 백업 주기(vercel.json 크론)를 바꾸면
  `AUTO_BACKUP_STALE_DAYS`도 같이.

- **세무사(tax_agent) 계정은 매입매출장(매입매출 목록)만**(사용자 요청 10/28): 미들웨어(`lib/supabase/middleware.ts`)가
  `/transactions` 목록 외 경로·다른 탭·`editTx`를 목록으로 돌려보내고, 화면은 `getCurrentRole()`(`lib/currentRole.ts`)로 탭·
  "+ 거래 등록"·메모·엑셀 일괄 등록·수정 팝업을 숨기고 표는 `TransactionTable`의 `readOnly`(체크칸·관리 칸 없음). 메뉴도 "매입매출"
  하나(`AppNav`). 새 화면·탭을 세무사에게 열려면 미들웨어부터 고칠 것.

- **작업일지의 "내용 이어받기"는 `lib/workLogSummary.ts`의 `resolveWorkLogTitles` 하나로만 정할 것.** 내용을 비운 줄은 같은
  현장·같은 프로젝트의 앞 내용 → 없으면 프로젝트 이름 → 프로젝트도 없으면 그 현장의 앞 내용. 작업일지를 날짜·내용별로 세는
  곳을 새로 만들 때도 이 함수를 쓰고, 그 해 1월 1일부터 넘겨서 정한 뒤 기간 안의 줄만 셀 것 — 곳마다 따로 이어받다가 다른
  프로젝트 날짜까지 한 작업으로 합산되고 팝업·표 숫자가 서로 달랐던 적이 있음.

- **앱에서 본 실제 데이터(거래처·금액·작업일지 내용·직원 정보 등)는 외부로 내보내지 말 것**(사용자 요청: 외부 반출 절대
  불가). 커밋 메시지·코드 주석·PR 설명·`HANDOFF.md`·외부 서비스에 실제 값을 적지 말고, 점검·테스트·예시는 가짜 데이터로.

- **외부 AI(제미나이)는 영수증·급여대장 인식에만 쓸 것**(`/api/ocr`·`/api/payroll-ocr`). 호출은 `lib/gemini.ts` 하나로(@google/genai —
  예전 @google/generative-ai는 지원 종료). 모델은 Vercel 환경변수 `GEMINI_MODEL`(없으면 `DEFAULT_GEMINI_MODEL`) — 구글이 모델을
  종료하면 화면에 환경변수를 바꾸라는 안내가 뜸(`geminiErrorMessage`). 사용자 요청으로 보고서 AI 질문은
  없앴고, 엑셀 거래 일괄 등록은 머리글 이름으로 직접 읽음(`lib/transactionExcel.ts`). 거래처·금액 같은 회사 자료를 외부 AI로
  보내는 기능을 새로 붙이거나 되살리려면 먼저 사용자에게 물어볼 것.

- **PR 만들기·main 머지는 매번 사용자에게 먼저 물어볼 것**(사용자 요청). 작업이 끝나면 작업 브랜치에 커밋·푸시하고
  "PR 만들고 머지할까요?"라고 물은 뒤 답을 받고 나서 PR·머지. 작업 도중 "머지도 해 달라"고 했어도 그 작업에만 해당하고,
  다음 작업부터는 다시 물어볼 것(main 머지 = 실제 앱 배포).

프로젝트 진행 상황·이력은 저장소 루트의 `HANDOFF.md`를 참고할 것.
