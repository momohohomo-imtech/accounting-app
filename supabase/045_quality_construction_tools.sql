-- 품질관리·공사관리·공구리스트 (사이드바 새 메뉴, "보고서" 아래).
-- 세 기능 모두 019_role_based_access.sql과 동일한 admin_staff 전체 권한 패턴을 씀.

-- 공사관리: 프로젝트별 설치 공정 단계 목록과 진행 상태(대기/진행중/완료).
create table public.construction_stages (
    id             uuid primary key default gen_random_uuid(),
    project_id     uuid not null references public.projects(id) on delete cascade,
    stage_name     text not null,
    status         text not null default '대기',
    planned_date   date,
    completed_date date,
    note           text,
    sort_order     integer not null default 0,
    created_by     uuid references public.users(id),
    created_at     timestamptz not null default now()
);
create index idx_construction_stages_project on public.construction_stages(project_id);

alter table public.construction_stages enable row level security;
create policy "admin_staff all construction_stages" on public.construction_stages
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- 품질관리: 프로젝트의 공정/공사별 점검 항목과 결과(합격/불합격/보류).
create table public.quality_checklist_items (
    id           uuid primary key default gen_random_uuid(),
    project_id   uuid not null references public.projects(id) on delete cascade,
    process_name text not null,
    item_name    text not null,
    result       text not null default '보류',
    check_date   date,
    note         text,
    created_by   uuid references public.users(id),
    created_at   timestamptz not null default now()
);
create index idx_quality_checklist_items_project on public.quality_checklist_items(project_id);

alter table public.quality_checklist_items enable row level security;
create policy "admin_staff all quality_checklist_items" on public.quality_checklist_items
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- 공구리스트: 회사가 보유한 공구 마스터 목록.
create table public.tools (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    note       text,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now()
);

alter table public.tools enable row level security;
create policy "admin_staff all tools" on public.tools
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- 공구리스트: 출장/현장 준비물로 체크해서 저장해둔 이력(다음에 복사해서 재사용).
create table public.tool_checklists (
    id         uuid primary key default gen_random_uuid(),
    title      text not null,
    project_id uuid references public.projects(id) on delete set null,
    trip_date  date,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now()
);
create index idx_tool_checklists_project on public.tool_checklists(project_id);

alter table public.tool_checklists enable row level security;
create policy "admin_staff all tool_checklists" on public.tool_checklists
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- tool_id는 원본 공구가 나중에 삭제돼도 이력이 남게 set null, 표시용 이름은 저장 시점
-- 스냅샷(tool_name)으로 별도 보관 — 마스터에서 이름이 바뀌거나 삭제돼도 이력은 안 변함.
create table public.tool_checklist_items (
    id           uuid primary key default gen_random_uuid(),
    checklist_id uuid not null references public.tool_checklists(id) on delete cascade,
    tool_id      uuid references public.tools(id) on delete set null,
    tool_name    text not null,
    checked      boolean not null default true
);
create index idx_tool_checklist_items_checklist on public.tool_checklist_items(checklist_id);

alter table public.tool_checklist_items enable row level security;
create policy "admin_staff all tool_checklist_items" on public.tool_checklist_items
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
