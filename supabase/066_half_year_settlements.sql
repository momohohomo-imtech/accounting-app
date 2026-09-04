-- 세무사 사무실에서 확정한 반기 결산 이익금을 기록 (현재 UI는 상반기(half=1)만 사용).
-- 대시보드에서 이 값을 반영해 하반기 집계 이익금과 연간 예상 세액을 더 정확히 계산하는 데 씀.
create table if not exists public.half_year_settlements (
    id              uuid primary key default gen_random_uuid(),
    year            int not null,
    half            smallint not null check (half in (1, 2)),
    profit_amount   numeric not null,
    updated_at      timestamptz not null default now(),
    unique (year, half)
);

alter table public.half_year_settlements enable row level security;

-- 019_role_based_access.sql과 동일한 역할 구분: admin/staff는 입력/수정 가능,
-- tax_agent(세무사)는 대시보드에서 보이기만 하면 되므로 읽기 전용.
create policy "admin_staff all half_year_settlements" on public.half_year_settlements
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

create policy "tax_agent read half_year_settlements" on public.half_year_settlements
  for select using (public.current_user_role() = 'tax_agent');
