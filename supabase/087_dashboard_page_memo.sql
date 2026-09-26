-- 대시보드 맨 위 자유 메모장 — 프로젝트 목록(074)·매입매출(086) 메모장과 같은 구조.
-- 페이지 전체에서 공유하는 메모 한 장이라 행을 하나만 두고(고정 id) 계속 upsert함.
create table public.dashboard_page_memo (
    id         uuid primary key default gen_random_uuid(),
    content    text,
    updated_by uuid references public.users(id),
    updated_at timestamptz not null default now()
);

alter table public.dashboard_page_memo enable row level security;
create policy "admin_staff all dashboard_page_memo" on public.dashboard_page_memo
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- 조회 전용(viewer) 계정은 읽기만 (084와 같은 방식).
create policy "viewer read dashboard_page_memo" on public.dashboard_page_memo
  for select using (public.current_user_role() = 'viewer');
