-- 102: 지출카테고리 "고정지출" 표시(11/3 사용자 결정 — 카테고리로도 지정: 급여·차량·숙박비·식비 등). 101 다음에 실행할 것.
-- 칸 1개만 추가 — 기존 자료는 그대로(모든 카테고리가 "지정 안 함"으로 시작). 두 번 실행해도 문제없음.
--
-- expense_categories.is_fixed_expense: 보고서 메뉴 "고정지출" 칸에서 지정·해제. 계산(lib/fixedExpense.ts)은 매입 거래만, 한 거래는 한 줄에만
-- (지정 거래처에서 산 건 거래처 줄, 아니면 지정 카테고리 줄). 카테고리를 지우는 규칙·권한(관리자·직원만 바꿈)은 지출카테고리 표 그대로.
-- 백업은 칸을 자동으로 담고, 이 칸이 없던 예전 백업을 복원하면 기본값(지정 안 함).

alter table public.expense_categories
  add column if not exists is_fixed_expense boolean not null default false;

-- PostgREST(Supabase API 레이어)가 새 칸을 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
