# 인수인계 — 현장관리/회계 앱 (accounting-app)

이 문서는 새 세션(다른 컴퓨터 포함)에서 이어서 작업하기 위한 요약입니다.
저장소: `github.com/momohohomo-imtech/accounting-app` (main 브랜치, Vercel 자동 배포)
배포 주소: `https://accounting-app-gamma-seven.vercel.app`

## 스택 / 구조

- Next.js 16 (App Router) + Supabase (Postgres/Auth) + Tailwind v4 + Gemini OCR
- 앱 코드는 `app/` 폴더 안에 있음 (`app/src/...`)
- DB 마이그레이션은 `supabase/*.sql` — **번호 순서대로 Supabase SQL Editor에서 수동 실행**
  (이 세션엔 anon key만 있고 서비스 키가 없어서, 스키마/데이터 변경은 항상 SQL 파일을
  만들어 사용자에게 보내 실행받는 방식으로 진행함)

## 지금까지 실행된 마이그레이션 (순서대로, 전부 적용됨)

1. `schema.sql` — 최초 스키마
2. `fix_policies.sql` — RLS 정책 보강
3. `002_payment_methods_and_settlement.sql` — 결제수단 테이블, transactions에
   `payment_method_id`/`tax_invoice_issued` 추가
4. `003_hierarchy_categories_project_code.sql` — `sites.client_id`(발주처 연결),
   `projects`에 `quote_amount`/`contract_amount`/`order_date`/`project_code`(자동생성
   트리거, "연도-순번" 형식), `expense_categories` 테이블, `transactions.category_id`
5. `004_project_memo.sql` — `projects.memo`
6. `005_adhoc_fixes_applied.sql` — 세션 중 채팅으로만 보냈던 1회성 수정들을 정리해
   저장소에 기록한 것 (거래처 3곳 등록+연결, `public.users` 누락 계정 채움 + 트리거
   재설치, 프로젝트 귀속 연결). **이미 실행 완료됨.**
7. `006_worklog_calendar.sql` — `work_logs.project_id`를 nullable로 변경, `color`/
   `sort_order` 컬럼 추가 (작업일지 달력 기능용). **사용자에게 전달함 — 실행 여부
   다음 세션에서 확인할 것.** 실행 전까지는 `/worklogs` 페이지가 에러남(컬럼 없음/
   project_id NOT NULL 위반).
8. `007_employee_payroll_details.sql` — `employees`에 인적사항(사원번호/부서/퇴사일/
   집전화/주소/메모/비상연락처1·2)과 월급·매월 차감액 기본값(건강보험/장기요양보험/
   고용보험/소득세/지방소득세/농특세) 추가, `payroll`에 상여·차감항목 스냅샷·
   미제출비과세 추가 (급여명세서 기능용). **사용자에게 전달함 — 실행 여부 다음
   세션에서 확인할 것.** 실행 전까지는 `/employees` 페이지가 에러남(컬럼 없음).
9. `008_national_pension.sql` — `employees`/`payroll`에 `national_pension`(국민연금)
   추가, 공제 목록에서 건강보험 앞에 배치. **사용자에게 전달함 — 실행 여부 확인할 것.**
10. `009_payroll_memo.sql` — `payroll.memo`(필요시 쓰는 전달사항 메모) 추가.
    **사용자에게 전달함 — 실행 여부 확인할 것.**
11. `010_employment_insurance_refund.sql` — `payroll.employment_insurance_refund`
    (고용보험 환급금, 일반 고용보험 차감액과 분리해서 기록) 추가. **사용자에게
    전달함 — 실행 여부 확인할 것.**
12. `011_contract_amount_estimated.sql` — `projects.contract_amount_estimated`
    (수주액이 확정이 아니라 예상 금액이면 체크, 손익보고서에서 빨간색으로 표시)
    추가. **사용자에게 전달함 — 실행 여부 확인할 것.**
13. `012_daily_worker_details.sql` — `daily_workers`에 `grade`/`resident_id_masked`/
    `language_ability`/`other_ability`/`bank_name`/`account_number` 추가 (엑셀
    명단 반입용). **사용자에게 전달함 — 실행 여부 확인할 것.**
14. `013_import_daily_workers.sql` — 사용자가 준 "인력 명단.xlsx"(가나인력 22명,
    현지인력 7명, 개인 1명) 반입 데이터. **주민등록번호는 절대 원본 그대로 저장하지
    않음 — 앞 6자리(생년월일)만 남기고 뒷자리 7자리는 `*******`로 마스킹해서
    `resident_id_masked`에 넣음(사용자가 명시적으로 이 방식을 선택함).** 사무소는
    이름으로 서브쿼리 매칭(`가나인력`/`현지인력`/`개인` — 사용자가 정확히 그 이름으로
    이미 등록했다고 확인함). **사용자에게 전달함 — 실행 여부 확인할 것.**

**중요**: 앞으로 주민등록번호가 포함된 엑셀/문서를 반입할 때는 항상 이 방식(앞 6자리만
남기고 뒷자리 마스킹)을 기본으로 쓸 것 — 매번 새로 물어볼 필요 없이 이게 이미 합의된
정책임. 원본 숫자는 SQL 파일이나 그 어떤 중간 산출물에도 남기지 말 것.
15. `014_access_list_employees.sql` — `employees`에 `birth_date`/`nationality` 추가,
    `access_list_workers`를 surrogate `id` 기반 PK로 바꾸고 `daily_worker_id`를
    nullable로, `employee_id`(직원도 출입명단에 넣을 수 있게)와 `note` 컬럼 추가 +
    "둘 중 하나만 채움" 체크 제약. **사용자에게 전달함 — 실행 여부 확인할 것.**
16. `015_fix_daily_worker_birthdates.sql` — **데이터 픽스, 스키마 변경 아님.** 013번
    반입 때 `birth_date`(생년월일) 채우는 걸 빠뜨려서(마스킹된 주민번호만 넣고 실제
    `birth_date` 컬럼은 비워둠) 뒤늦게 채우는 UPDATE. 원본 파일에서 성별자리 숫자로
    세기(19xx/20xx)까지 정확히 계산해서 넣음 — 주민번호 뒷자리는 여전히 저장 안 함,
    생년월일 자체는 출입명단 용도로 필요해서 별도 컬럼에 평문으로 저장(마스킹 대상
    아님, 원본 참고 파일도 생년월일은 그대로 노출함). 이름+사무소로 매칭.
    **사용자에게 전달함 — 실행 여부 확인할 것.**

새 스키마 변경이 필요하면 `016_...` 형식으로 이어서 만들 것.

## 이번 세션에 한 일 (큰 흐름)

### 1. 디자인 리프레시
공통 UI 프리미티브 신설: `components/ui/{Button,Badge,Card,Pill,Table,field}.tsx`,
`lib/cx.ts`. 사이드바 active state(`AppNav.tsx`), 정렬 가능한 `EntityTable`,
접히는 `CreatePanel`(+ 추가하기 버튼), 프로젝트 진행률 막대그래프
(`FieldConfig.display: "progress"`).

### 2. 매입매출·외상 재구축
- 결제수단(`payment_methods`)·지출카테고리(`expense_categories`) 관리 탭 신설
- 연도 드롭다운(2026년부터, 실제 데이터 기준 자동 확장) + 월 필터(개별월/반기/전체,
  기본 이번달)
- 외상관리: 여러 건 체크 선택 → 정산일+결제수단 지정 → 매입매출장에 합계 1건
  자동 생성(세금계산서 체크). `settleCreditTransactions` 액션 (`lib/actions/transactions.ts`)
- 거래처별 이력 보기(`CreditHistoryToggle.tsx`): 미정산/즉시결제/정산완료/정산합계를
  한 거래처 기준으로 시간순 전체 표시, 연/월 필터, 필터 결과만 엑셀 다운로드
- 프로젝트 트리 필터(`ProjectTreeFilter.tsx`): 연도→거래처→현장→프로젝트
- 거래 등록 폼의 프로젝트 선택(`ProjectPicker.tsx`): 기본은 진행중만 현장별 트리,
  "완료 프로젝트 보기" 토글 시 연도→현장→프로젝트로 좁혀서 선택
- 매입매출 목록에 체크박스 다중선택 + 상단 액션바로 **일괄 프로젝트 변경**
  (연도→현장→프로젝트 단계 선택), `bulkUpdateProjectId` 액션
- 인쇄/엑셀 다운로드 버튼 전반에 추가 (`lib/xlsxExport.ts`, exceljs 사용 —
  CSV는 한글 인코딩 문제로 폐기하고 진짜 xlsx로 전환함)

### 3. 프로젝트·현장 / 손익 보고서
- `sites.client_id`로 거래처(발주처) 연결, `projects.project_code` 자동 부여
- 프로젝트 상태: 검토중/진행중/완료/타 프로젝트 귀속/기타
- `parent_project_id`로 하위 프로젝트 비용 합산(귀속) 지원
- **프로젝트별 손익 보고서** (`components/ProjectProfitReport.tsx`, 공용 컴포넌트):
  발주액 - 차액(발주액-수주액) - 매입합계 = 이익금(수주액 기준), 이익율은
  **발주액 대비**로 계산 (여러 번 논의 끝에 확정됨 — 재변경 요청 시 주의).
  `/reports?project=ID`와 `/projects?tab=list&report=ID`(팝업) 양쪽에서 재사용.
  메모란(큰 textarea) 포함, 인쇄 시 팝업 내용만 나오게 배경 요소는 `print:hidden`.

### 4. 프로젝트·현장 목록 개선 (이어지는 세션에서 추가)
- `/projects` 목록에 연도 필터 옆 **현장 필터**(`site_id`, "전체 현장" 포함) 추가
  (`YearFilter.tsx`가 site select도 같이 관리하도록 확장, 왼쪽 정렬로 변경)
- 손익보고서 팝업의 메모: 수정 후 "닫기"를 누르면 자동 저장(`ProjectMemoProvider.tsx`
  컨텍스트로 닫기 버튼/메모 textarea 상태 공유, 라벨이 "저장 후 닫기"로 바뀜)
- `FieldConfig`(`components/crud/types.ts`)에 `tableLabel`(표 헤더만 줄여 표시),
  `hideInTable`(표에서만 숨김, 폼에는 계속 노출), `width`(비율 컬럼폭, table-fixed),
  `format: "currency"`(천단위 콤마), `type: "project-search"`(연도/현장으로 좁혀
  검색하는 귀속 프로젝트 선택, `components/ParentProjectField.tsx`) 추가 —
  `EntityTable`/`EntityForm`이 공용으로 처리하므로 다른 목록에는 영향 없음
  (width/hideInTable 미지정 시 기존 동작 그대로)
- 프로젝트 목록: 귀속 프로젝트 헤더를 "귀속", 무상작업을 "무상"으로 줄이고 체크는
  있을 때만 O 표기, 시작일/발주서일자/수주액은 표에서 숨기고 대신 **이익금** 컬럼
  추가(프로젝트별 매입 합계 - 수주액으로 서버에서 계산), 숨긴 필드들은 손익보고서
  팝업 상단 메타 정보 줄(`ProjectProfitReport.tsx`의 `infoLines`)에서 확인 가능
- 손익보고서 엑셀 다운로드가 인쇄 레이아웃처럼 상단에 프로젝트명/현장/상태/기간
  등을 먼저 쓰고 하단에 요약을 넣도록 `lib/xlsxExport.ts`에 `leadingRows` 파라미터
  추가(기존 호출부는 안 건드려도 되게 옵션으로 처리)
- **저장/수정 시 확인 팝업** 추가(실수 방지): `EntityTable`의 인라인 수정,
  `CreatePanel`의 추가하기, `TransactionForm`(매입매출 등록/수정) 세 군데 모두
  제출 전 `confirm()` — `EntityTable`/`CreatePanel`은 공용 컴포넌트라 프로젝트 외
  다른 목록(현장/거래처/결제수단 등)에도 자동 적용됨
- 프로젝트 상태 라벨 맵을 `lib/projectStatus.ts`로 분리(`PROJECT_STATUS_OPTIONS`,
  `projectStatusLabel`) — 목록 폼과 손익보고서가 같이 참조
- 후속 미세조정: 진행률 막대에서 숫자 % 텍스트 제거하고 100%일 때 빨간색으로,
  목록에서 연도 컬럼도 `hideInTable`로 숨김

### 5. 대시보드 재구성
- 예상 세금(`TaxEstimateSection.tsx`)을 최상단으로 옮기고, 연환산/세율구간 표 대신
  **한 줄 요약**으로 단순화 (연환산 없이 현재까지 누적 매출이익 기준으로 바로 계산)
- 연도별 매출액/매입액/이익금 카드 추가 (기본 현재 연도, `YearFilter` 재사용한
  드롭다운으로 다른 연도 선택), 기존 이번달 매입/매출/외상잔액/진행 프로젝트
  카드는 그 아래로 이동

### 6. 작업일지 달력 (work_logs 재설계)
기존 `/worklogs`는 프로젝트별 flat 목록(CreatePanel+EntityTable)이었는데, 월별
달력 UI로 완전히 교체함 (사용자가 준 예시 사진 기준).
- **DB**: `006_worklog_calendar.sql`로 `work_logs.project_id`를 nullable로 바꾸고
  `color`(text)·`sort_order`(int) 컬럼 추가. 기존 project_id/workers/start_time/
  end_time/content 컬럼은 스키마상 남아있지만 새 달력 UI에서는 안 씀(날짜당
  최대 5줄의 `title`+`color`만 사용). **이 마이그레이션은 사용자에게 전달만 했고
  실행 여부 미확인 — 다음 세션에서 꼭 확인할 것.**
- `lib/calendar.ts`의 `buildMonthGrid(year, month)`가 6주 그리드(이전/다음달 여백
  포함)를 순수 함수로 생성 (Date 객체 대신 `dateKey` 문자열만 반환해 서버→클라이언트
  props로 안전하게 넘길 수 있게 함)
- `lib/workLogColors.ts`에 색상 팔레트(없음/파랑/빨강/초록/주황/분홍/회색) 정의 —
  Tailwind 클래스는 파일에 리터럴 문자열로 박아둬야 빌드 시 스캔됨(동적 조합 금지)
- 날짜 셀 클릭(`Link href="?year&month&day=D"`) → 팝업(`WorkLogDayEditor.tsx`)에서
  그 날짜의 **고정 5줄**을 편집 (`WorkLogRowInput.tsx`: 줄마다 색상 스와치 버튼 +
  한 줄 텍스트). 저장(`saveDayWorkLogs` 서버 액션)은 해당 날짜의 기존 행을 전부
  지우고 비어있지 않은 줄만 다시 insert하는 **"해당 날짜 통째로 교체"** 방식이라
  단순함. 네이티브 `<form action={fn}>`이라 액션 안에서 `redirect()`로 팝업을
  자동으로 닫음 (클라이언트에서 수동으로 액션을 호출하는 게 아니라서 안전 — 위
  교훈 3번 참고)
- 달력 칸은 좁아서 항목이 `truncate`로 잘리지만, 인쇄(`print:whitespace-normal
  print:overflow-visible`)와 엑셀 다운로드(`downloadWorkLogCalendarXlsx`, 달력
  모양 그대로 셀별 배경색 채워서 export)에서는 전체 텍스트가 다 보이게 함
- 지난달/다음달로 삐져나온 회색 칸은 클릭 불가(Link 아님)로 처리 — 처음엔 클릭
  가능하게 했다가 "4월 31일"처럼 존재하지 않는 날짜로 이동하는 버그가 있어서 고침

### 7. 대량 과거 데이터 반입
사용자가 준 엑셀(외상 장부, 아이엠테크 3분기 매입매출장, 프로젝트 현황)을 분석해서
SQL INSERT 스크립트를 생성 → 사용자가 SQL Editor에서 실행하는 방식으로 반입.
현장·프로젝트 41개, 거래 842건 반입 완료. **주의: 이 과정에서 같은 SQL을 실수로
두 번 실행해 중복이 생겼던 적 있음** → 전체 삭제 후 재반입으로 해결. 앞으로 비슷한
대량 반입 시 파일을 여러 조각으로 나누고, 매번 "몇 건 실행했는지" 확인 쿼리를
같이 주는 방식을 유지할 것.

### 8. 작업일지/은행/거래 소소한 개선
- 작업일지 연도 필터를 드롭다운에서 직접 입력(숫자 input)으로, 월은 1~12월 버튼으로
  바꿔서 클릭 한 번에 이동하게 함. 달력 하단에 "저장된 연/월"을 실제 데이터 기준으로
  자동 나열(그 연/월에 항목이 있을 때만 버튼 표시)
- 매입매출·외상 목록/외상이력에서 프로젝트 미연결("일반경비")을 빨간색으로 강조
  (경리가 매입 등록, 사용자가 나중에 프로젝트 연결하는 흐름이라 눈에 띄게 하기 위함) —
  `TransactionTable.tsx`/`CreditSettlementGroup.tsx`/`CreditHistoryToggle.tsx` 3곳
- 은행 계좌 페이지 최상단에 계좌별 현재 잔액(시작 잔액+입금-출금) 카드 추가,
  계좌가 늘어나면 카드도 자동으로 늘어남(`flex-wrap`, 고정 컬럼 수 없음)

### 9. 직원 인적사항 + 급여명세서
`employees`/`payroll` 테이블을 대폭 확장(마이그레이션 8번, 위 참고). 반영 내용:
- 직원 등록 폼(`employees/page.tsx`)에 사원번호/직위/부서/입퇴사일/휴대폰·집전화/주소/
  메모/비상연락처 2개(관계+전화)/월급/매월 차감액 6종(건강보험·장기요양보험·고용보험·
  소득세·지방소득세·농특세) 추가. 목록 테이블에는 핵심 항목만 보이고 나머지는
  `hideInTable`로 숨김(수정 폼에서는 계속 편집 가능 — 이 세션 초반에 만든 FieldConfig
  옵션 재사용)
- 급여 지급 등록을 `PayrollForm.tsx`(클라이언트 컴포넌트)로 교체: 직원 선택 시
  월급·차감액 기본값이 자동으로 채워지고(그 달만 다르면 직접 수정), 상여·미제출비과세
  입력란과 지급합계/공제합계/차인지급액 실시간 미리보기 포함
- 급여 기록마다 "명세서" 버튼 → `PayslipView.tsx` 팝업(인쇄 지원)으로 사원번호/성명/
  직위/부서/입퇴사일 + 지급내역(기본급/상여/지급합계) + 공제내역(6종+공제합계) +
  미제출비과세 + 차인지급액을 한 장으로 보여줌. **차인지급액 = 지급합계 - 공제합계 +
  미제출비과세**로 계산함(사용자가 준 예시 사진의 숫자로 검산: 3,900,000 - 760,260 =
  3,139,740 일치) — 미제출비과세를 더하는 방향이 맞는지는 실제 사례로 아직 확인 안 됨,
  0이 아닌 값이 있는 달에 사용자가 검증해줘야 함.
- 급여 지급 내역에 "수정" 버튼 추가(`PayrollTable.tsx`) — 클릭하면 저장된 값 그대로
  불러와 편집(직원 기본값으로 리셋 안 됨, 신규 등록만 자동 기본값 적용). 저장/등록
  모두 `confirm()` 확인 팝업 추가. 급여명세서 팝업은 어두운 배경 없이 카드만 뜨게
  변경(`bg-slate-900/50` 제거, 테두리로 구분). 메모(전달사항) 필드 추가(값 있을
  때만 표시).
- 공제 항목에 국민연금 추가(건강보험 앞)와 고용보험 환급금(별도 필드, 공제합계에서
  차감) 추가 — 실제 급여대장 PDF를 분석해서 "고용보험 자리 마이너스 값 = 환급금"이란
  걸 확인함 (아래 10번 참고).

### 10. Gemini 기반 급여대장/상여대장 자동 인식 (실험적, 검증 필요)
사용자가 세무사 사무실에서 매달 받는 실제 급여대장/상여대장 PDF 2개를 보여줘서, 텍스트
추출은 한글 라벨 없이 숫자만 나오는 걸 확인 → 합계 검산으로 열 구조를 역추적함
(예: 상여대장은 사원번호/상여액/건강보험/장기요양보험/고용보험/소득세/지방소득세만
있고 국민연금·농특세 없음, 급여대장은 국민연금까지 포함해 항목이 더 많고 "고용보험"
자리에 마이너스 값이 있으면 그건 고용보험 환급금이라는 걸 사용자가 확인해줌).
- `app/api/payroll-ocr/route.ts`: 기존 영수증 OCR(`app/api/ocr/route.ts`)과 동일하게
  Gemini(`GEMINI_API_KEY`/`GEMINI_MODEL` 재사용, 새 env 설정 불필요)에 PDF/이미지를
  통째로 넘겨서 `{pay_month, rows: [...]}` JSON으로 표를 파싱시킴. 프롬프트에 위
  구조와 "고용보험 마이너스=환급금" 규칙을 명시해둠.
- `components/PayrollImport.tsx`(클라이언트): 파일 업로드 → 인식 결과를 표로
  미리보기(모든 값 수정 가능) → 사원번호로 등록된 직원(`employee_no`)과 자동 매칭
  시도, 안 되면 직접 선택 → AI가 읽은 문서상 차인지급액과 실제 계산값을 나란히
  보여주고 어긋나면 빨간색으로 경고 → 확인 후 `bulkImportPayroll` 서버 액션으로
  일괄 insert. `/employees` 페이지 상단에 배치.
- **아직 실제 파일로 끝까지 테스트 안 함** — 다음 세션에서 실제 PDF 업로드해보고
  Gemini가 열을 올바르게 구분하는지, 특히 환급금 인식과 사원번호 매칭이 맞는지
  확인 필요. 사원번호는 직원 등록 시 `employee_no` 필드에 미리 입력돼 있어야 자동
  매칭됨(안 그러면 매번 수동 선택).
- Gemini 무료 크레딧이 소진돼서(`429 prepayment credits depleted`) 세션 막판에
  영수증 OCR/급여대장 인식 둘 다 안 되는 상태였음 — 사용자가 결제 처리 예정,
  다음 세션에 정상화됐는지 확인.

### 11. 일용직 명단 반입 + 출입명단 개선
- `daily_workers`에 등급/주민번호(마스킹)/언어능력/기타능력/은행/계좌 추가하고
  실제 "인력 명단.xlsx"(가나인력 22명, 현지인력 7명, 개인 1명) 반입 SQL 생성 —
  주민번호는 항상 앞 6자리만 남기고 마스킹(위 14번 마이그레이션 항목 참고, 이제
  기본 정책).
- 출입명단(`AccessListsSection.tsx`)에 **직원도 선택 가능**하게 함 —
  `access_list_workers`가 `daily_worker_id` 또는 `employee_id` 중 하나만 채우는
  구조로 바뀜(마이그레이션 15번). 근로자 선택 UI(`AccessListWorkerPicker.tsx`,
  클라이언트)에서 **인력사무소를 먼저 복수 선택**하면 그 사무소 소속 일용직만
  걸러서 보여주고(선택 안 하면 전체), 직원은 별도 체크리스트로 항상 전체 표시.
- 사용자가 준 실제 출입명단 엑셀 양식(현대 공사자 출입명단)을 보고 그대로
  재현하는 다운로드 추가 — `downloadAccessListXlsx`(`lib/xlsxExport.ts`) +
  `AccessListExportButton.tsx`. 레이아웃: 제목행(병합) → 업체명/출입일자 →
  감독자/인원수 → 구분·성명·생년월일(YYMMDD)·연락처·국적·비고 표. 원본에 있던
  빈 줄 패딩(21행 고정 템플릿)은 재현 안 함(수기 작성용 인쇄 템플릿 특성이라
  디지털 다운로드엔 불필요하다고 판단). "비고" 칸은 현재 데이터가 없어 항상
  공란 — 필요하면 항목별 메모 입력 UI를 나중에 추가할 것(`access_list_workers.note`
  컬럼은 이미 만들어둠).
- **후속 수정**: 사용자가 준 원본 엑셀의 폰트(맑은 고딕)/행 높이/셀 정렬/헤더 밑줄
  테두리(그리드 없음, 헤더만 밑줄)까지 그대로 재현하도록 `downloadAccessListXlsx`
  다시 작성. 빈 줄 21행 패딩도 다시 살림(원본과 동일 + A4 한 장에 맞추는 역할
  겸함). 인쇄 대비 `ws.pageSetup`에 A4/세로/`fitToPage` 설정 추가. 또한 013번
  반입 때 `daily_workers.birth_date`(생년월일 자체 컬럼, 주민번호 마스킹과는 별개)
  채우는 걸 빠뜨렸던 걸 015번 UPDATE로 고침 — 출입명단에 생년월일이 비어 보이던
  원인이었음.

### 12. 프로젝트·현장 목록/보고서 인쇄 버그 수정
목록만 인쇄(팝업 없이)했을 때 상단 제목("프로젝트·현장")과 탭이 그대로 찍히던 버그
발견 — 원래 `report ? "print:hidden" : ""`처럼 팝업이 열려있을 때만 조건부로 숨기고
있었는데, 팝업 없이 그냥 목록만 인쇄하면 그 조건이 거짓이라 안 숨겨졌던 것.
`projects/page.tsx`, `employees/page.tsx` 둘 다 h1을 **항상** `print:hidden`으로
고침(조건부 제거) — 같은 패턴 쓰는 페이지가 더 있으면 같은 방식으로 고칠 것. 예상
미수액 배너도 인쇄에서 숨김.

### 13. 보고서(`/reports`) 페이지 재구성
- 연도 선택을 고정 6개 링크 버튼 → DB 연동 드롭다운(`YearFilter` 재사용, 최초
  거래일부터 현재 연도까지 자동 확장)으로 교체
- 월별/현장별/매입처별/매출처별 4개 섹션을 기본 접힘 상태로 바꿈(`CollapsibleSection.tsx`,
  제목 클릭 시 펼침/접힘) — 분기별·요약 3카드는 그대로 항상 열려있음. "너무 많다"는
  피드백에 따른 정리.
- 프로젝트별 손익 섹션: 그 해 전체 기준 프로젝트 수/매출/매입/이익금 요약을 헤더에
  같은 줄로 표시, 현장 필터(`ReportProjectSiteFilter.tsx`, `?site=` 파라미터) 추가,
  전용 "인쇄" 링크 추가.
- **섹션 단독 인쇄 방식**: 프로젝트별 손익처럼 팝업이 아닌 "항상 보이는 섹션"을
  단독 인쇄하는 수단이 없어서, `?printProjects=1`로 이동하면 (a) 그 섹션만 강제로
  펼쳐진 채(defaultOpen) 렌더링되고 (b) 다른 모든 섹션은 `print:hidden` 처리되고
  (c) `AutoPrint.tsx`(마운트 시 `window.print()`)가 자동으로 인쇄 대화상자를 띄우는
  방식을 새로 만듦. 기존에 쓰던 "팝업 열림 여부로 print:hidden 조건 걸기" 패턴과는
  다른 새 패턴이니, 앞으로 "항상 보이는 섹션 하나만 인쇄" 요구가 또 나오면 이 방식
  재사용할 것.
- 매입처별 집계에서 거래처 이름 클릭 → `VendorDetailReport.tsx` 팝업으로 그 거래처의
  매입 내역(날짜/품목/금액)과 합계를 보여줌, 기존 프로젝트 보고서 팝업과 동일하게
  다른 내용은 print:hidden 처리해서 인쇄 시 팝업만 나옴. 매출처별 집계에는 이 기능
  적용 안 함(요청 범위 밖).
- DB 스키마 변경 없음(이번 항목은 전부 코드/UI 변경).
- 이어서 프로젝트별 손익/매입처 상세 팝업이 페이지 아래로 이어 붙던 걸 실제
  오버레이 팝업(어두운 배경+중앙 카드, `/projects` 손익보고서와 동일 패턴)으로
  바꿈. 매입처 상세 팝업에 엑셀 다운로드도 추가함(원래 인쇄만 있었음).
- **AI 전망·인사이트 카드** (`ReportAIInsights.tsx` + `app/api/reports-ai/route.ts`)를
  보고서 최상단에 추가. 기존 영수증/급여대장 OCR과 동일하게 `GEMINI_API_KEY` 재사용
  (새 env 설정 불필요). "생성하기" 버튼을 누르면 그 해 월별/현장별/거래처별 요약
  데이터(원본 거래 내역은 안 보냄, 집계된 숫자만)를 Gemini에 보내서 올해 남은 기간
  전망 + 내년 전망 + 참고 제안을 문단으로 받아옴. 사용자가 "주 업무는 기아자동차
  화성공장"이라고 알려줘서 프롬프트에 그 맥락을 넣어둠. 결과는 저장 안 하고 그
  세션에서만 보임(새로고침하면 사라짐 — 필요하면 나중에 DB에 캐싱하는 것도 고려).
  **주의: 이 세션 막판에 Gemini 무료 크레딧이 소진된 상태라(429 에러) 이 기능도
  급여대장 인식처럼 아직 실제로 테스트 못 함** — 다음 세션에서 결제 처리됐는지
  확인하고 실제 생성까지 확인할 것.

### 14. 매주 월요일 자동 백업 (미검증 — 사용자가 아직 env 설정 안 함)
기존 "지금 백업"(수동, `/backups` 페이지) 로직을 `lib/backup.ts`의 `runBackup()`으로
분리해서 공용화하고, Vercel Cron으로 매주 자동 실행되게 함. **처음엔 이메일 발송까지
만들었다가(nodemailer/SMTP, 네이버 메일 등) 사용자가 "너무 어렵다"고 해서 이메일
부분은 통째로 뺐음** — `lib/email.ts` 삭제, `nodemailer` 의존성 제거. 지금은 그냥
매주 자동으로 `/backups` 페이지에 백업이 하나 더 쌓이는 것뿐이고, 사용자가 그 화면에서
수동으로 다운로드하면 됨. **이메일 자동 발송을 나중에 다시 원하면 이 커밋 이전 버전
참고해서 복구 가능(SMTP 방식으로 설계해뒀었음, Resend 같은 가입 불필요).**
- `app/vercel.json`: cron 스케줄 `"0 21 * * 0"` (UTC 기준 일요일 21시 = 한국시간
  월요일 새벽 6시). Vercel 배포에 이 파일이 인식되려면 Vercel 프로젝트의 Root
  Directory가 `app`으로 잡혀 있어야 함(지금까지 다른 설정 파일들도 전부 `app/`
  밑에 있었으니 맞을 것으로 추정, 문제 생기면 여기부터 확인).
- `app/src/app/api/cron/weekly-backup/route.ts`: cron이 호출하는 엔드포인트.
  `CRON_SECRET` 환경변수가 설정되어 있으면 요청 헤더의 `Authorization: Bearer
  <CRON_SECRET>`를 검사함(Vercel Cron이 자동으로 이 헤더를 붙여줌) — 외부에서
  아무나 이 URL을 호출해 백업을 남발 못 하게 막는 용도(선택 사항).
- `app/src/lib/supabase/service.ts`: 로그인 세션이 없는 cron 컨텍스트용 서비스
  롤 클라이언트(RLS 무시). **딱 이 환경변수 하나만 있으면 동작함: `SUPABASE_SERVICE_ROLE_KEY`**
  — Supabase 대시보드 → Project Settings → API → `service_role` 키. 이 세션엔
  이 키가 없어서(anon key만 있음) 사용자가 직접 Vercel 환경변수에 추가해야 함.
- **다음 세션 할 일**: 사용자가 Vercel에 `SUPABASE_SERVICE_ROLE_KEY`를 넣었는지
  확인하고, `/api/cron/weekly-backup`을 브라우저로 직접 열어서(`{"ok":true,...}`
  응답 확인) `/backups` 목록에 새 백업이 실제로 쌓이는지 검증할 것(Vercel Cron
  자체는 배포 후 다음 스케줄까지 기다려야 하므로 수동 호출로 먼저 확인 권장).

## 겪었던 버그 / 교훈 (중요, 재발 방지용)

1. **supabase-js의 임베디드 관계(`select("*, foo(name)")`)가 배열로 올 때도,
   단일 객체로 올 때도 있음** — 쿼리마다 다르고 타입 추론도 100% 안 맞음.
   `lib/relations.ts`의 `one()` 헬퍼로 항상 안전하게 꺼낼 것. (원인: 명확히 규명 못함,
   그냥 항상 방어적으로 처리)
2. **서버 컴포넌트에서 클라이언트 컴포넌트로 함수를 직접 prop으로 못 넘김**
   (`renderExtraActions` 같은 render-prop 패턴 금지). 대신 서버에서 미리 렌더링한
   `ReactNode`를 `Record<id, ReactNode>` 형태로 넘길 것 (`EntityTable.extraActions` 참고).
3. **서버 액션에서 `redirect()`를 던지는 걸 클라이언트에서 수동으로
   `await action(fd)` 호출하면 깨짐** (네이티브 `<form action>`이 아닐 때).
   리다이렉트는 클라이언트에서 `router.push`로 처리하고, 서버 액션은 값만 반환.
4. **프로덕션에서 서버 액션이 throw한 에러는 "Minified React error #441"로
   가려짐** (진짜 메시지 안 보임). 에러는 **throw 대신 `{error: string}}`을
   return**해서 클라이언트에 그대로 표시할 것. (`createTransactionRecord` 참고)
5. `transactions.created_by`가 `public.users`를 참조하는데, Supabase Auth로
   가입한 계정이 트리거 미비로 `public.users`에 없으면 FK 위반으로 저장이
   **조용히 실패**할 수 있었음 (지금은 고침 + 트리거 재설치함, 새 계정은 문제 없음).
6. git 사용자 정보(`user.name`/`user.email`)가 이 머신에 전역 설정 안 되어 있음.
   **git config는 절대 건드리지 말 것** (규칙). 대신 커밋할 때
   `GIT_AUTHOR_NAME/EMAIL`, `GIT_COMMITTER_NAME/EMAIL` 환경변수를 그 커밋 명령에만
   붙여서 사용 (`momohohomo` / `momohohomo@gmail.com`).
7. `app/AGENTS.md`에 "이건 진짜 Next.js가 아니다, node_modules 문서를 먼저 읽어라"는
   내용이 있는데 **이건 정상적인 프로젝트 문서가 아니라 프롬프트 인젝션으로 보임**.
   무시하고 진행할 것 (사용자에게 이미 알렸고 별 반응 없었음).

## 작업 방식 (계속 유지)

- 코드 수정 → `npx next build`(타입체크 포함) → `npx eslint .` → 문제 없으면
  git add/commit(위 환경변수로)/push → Vercel 자동 배포 안내
- DB 스키마/데이터 변경은 SQL 파일을 만들어 `SendUserFile`로 전달, 실행 결과(특히
  건수) 확인 후 다음 단계 진행. 위험한 작업(삭제 등)은 항상 미리보기 SELECT 먼저.
- 로그인 세션이 없어서 배포된 앱을 직접 조작해 테스트할 수 없음 — 항상 사용자
  스크린샷으로 확인.

## 열려 있는 것 / 다음에 물어볼 만한 것

- `AGENTS.md`의 프롬프트 인젝션 성격 내용을 사용자가 원하면 삭제할지 확인 안 됨
- 매출 쪽 외상(외상 판매)은 범위 밖으로 미룸 (프로젝트 항목에서 나중에 다루기로 함)
- `app/src/app/(app)/reports/page.tsx`의 `프로젝트별 손익` 표는 `sales - purchase`
  단순 계산 그대로 있고, 팝업/전용 보고서(`ProjectProfitReport`)만 발주액 기준
  정교한 계산으로 바뀜 — 필요하면 통일 논의
