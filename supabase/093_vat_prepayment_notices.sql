-- 부가가치세 예정고지액(고지서 금액) — 4월·10월에 받은 예정고지서 금액을 입력하면 대시보드의 확정신고(7월·1월) 부가세
-- 추정에서 장부로 계산한 추정치(직전 반기 납부세액의 1/2) 대신 이 금액을 차감한다(지금 화면은 10월분만 사용).
-- 저장된 거래 데이터는 바꾸지 않음 — 새 표만 생김. 두 번 실행해도 문제없음.
create table if not exists public.vat_prepayment_notices (
    year        int not null,
    month       smallint not null check (month in (4, 10)),
    amount      numeric not null check (amount >= 0),
    updated_at  timestamptz not null default now(),
    primary key (year, month)
);

alter table public.vat_prepayment_notices enable row level security;

-- 역할 구분은 상반기 확정 이익(066 half_year_settlements)과 같음: admin/staff는 입력·수정, 세무사·조회 전용은 읽기만.
drop policy if exists "admin_staff all vat_prepayment_notices" on public.vat_prepayment_notices;
create policy "admin_staff all vat_prepayment_notices" on public.vat_prepayment_notices
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "readonly read vat_prepayment_notices" on public.vat_prepayment_notices;
create policy "readonly read vat_prepayment_notices" on public.vat_prepayment_notices
  for select using (public.current_user_role() in ('tax_agent', 'viewer'));

-- PostgREST(Supabase API 레이어)가 새 표를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
