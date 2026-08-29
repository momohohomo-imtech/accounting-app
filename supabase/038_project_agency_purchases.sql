-- 원청(예: 현대기계)이 발주액에서 대신 구매해서 공제하는 부속 등 — 프로젝트 하나에
-- 여러 품목이 있을 수 있어서 별도 테이블로 관리. 수주액은 이미 이런 공제를 다 뺀
-- 실수령액으로 입력해왔으므로 이익금 계산식은 그대로 두고, 손익보고서에서
-- "발주액-수주액" 차액을 대행구매액(이 테이블 합계) / 기타 공제(수수료 등)로
-- 나눠 보여주는 용도(참고용 breakdown, 매입장에는 안 들어감).
create table public.project_agency_purchases (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects(id) on delete cascade,
    item_name   text,
    amount      numeric not null default 0,
    created_by  uuid references public.users(id),
    created_at  timestamptz not null default now()
);
create index idx_project_agency_purchases_project on public.project_agency_purchases(project_id);

alter table public.project_agency_purchases enable row level security;

-- 019_role_based_access.sql과 동일한 admin_staff 전체 권한 패턴.
create policy "admin_staff all project_agency_purchases" on public.project_agency_purchases
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
