-- 프로젝트 목록 페이지의 자유 메모장(항목 이름 없이 텍스트 하나만) — "공사완료
-- 예상 미수액" 박스 아래에 표시. 페이지 전체에서 공유하는 메모 한 장이라 행을
-- 하나만 두고(고정 id) 계속 upsert함.
create table public.projects_page_memo (
    id         uuid primary key default gen_random_uuid(),
    content    text,
    updated_by uuid references public.users(id),
    updated_at timestamptz not null default now()
);

alter table public.projects_page_memo enable row level security;
create policy "admin_staff all projects_page_memo" on public.projects_page_memo
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
