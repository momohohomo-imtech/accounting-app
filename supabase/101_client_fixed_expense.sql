-- 101: 거래처 "고정지출" 표시(11/3 사용자 결정 — 지정한 거래처의 최근 12개월 매입 ÷ 12 = 달 평균, 지정은 DB에 저장).
-- 칸 1개만 추가 — 기존 자료는 그대로(모든 거래처가 "지정 안 함"으로 시작). 두 번 실행해도 문제없음.
--
-- clients.is_fixed_expense: 보고서 메뉴 "고정지출" 칸에서 지정·해제. 계산(lib/fixedExpense.ts)은 매입 거래만 씀 — 은행 거래는 안 씀
-- (사용자: 자동이체도 매입매출장에 직접 등록). 거래처를 지우는 규칙·권한(관리자·직원만 바꿈)은 거래처 표 그대로.
-- 백업은 칸을 자동으로 담고, 이 칸이 없던 예전 백업을 복원하면 기본값(지정 안 함).

alter table public.clients
  add column if not exists is_fixed_expense boolean not null default false;

-- PostgREST(Supabase API 레이어)가 새 칸을 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
