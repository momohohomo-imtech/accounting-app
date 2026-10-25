-- 한 결제로 묶기 — 카드 결제 한 번(영수증·계산서 1건)을 프로젝트별로 나눠 저장한 거래들에 같은 묶음 번호를 붙여
-- 매입장에서 한 줄로 보여 준다. 금액·프로젝트는 지금처럼 거래마다 따로 저장(프로젝트 손익·보고서 계산 그대로).
-- 저장된 데이터는 바꾸지 않음 — 빈 칸만 하나 생김. 두 번 실행해도 문제없음.
alter table public.transactions add column if not exists payment_group_id uuid;

create index if not exists transactions_payment_group_id_idx
  on public.transactions (payment_group_id)
  where payment_group_id is not null;

-- PostgREST(Supabase API 레이어)가 새 칸을 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
