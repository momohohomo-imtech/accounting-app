-- "공사관리" 탭이 "공사 메모"로 바뀌면서, 프로젝트별 공정 단계 관리 대신
-- 자유 형식 메모가 프로젝트별로 계속 쌓이는 구조로 바뀜(019_role_based_access.sql과
-- 동일한 admin_staff 전체 권한 패턴). 기존 construction_stages 테이블은 화면에서
-- 더 이상 쓰지 않지만 데이터 보존을 위해 그대로 둠.
create table public.construction_memos (
    id         uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    content    text not null,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index idx_construction_memos_project on public.construction_memos(project_id);

alter table public.construction_memos enable row level security;
create policy "admin_staff all construction_memos" on public.construction_memos
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
