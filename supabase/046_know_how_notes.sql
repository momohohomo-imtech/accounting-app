-- 품질관리·공사관리·공구리스트 3개 탭에 공용으로 쓰는 노하우 메모.
-- 프로젝트에 묶이지 않는 일반 지식(요령/주의사항)이라 category로만 구분(quality/construction/tools).
create table public.know_how_notes (
    id         uuid primary key default gen_random_uuid(),
    category   text not null,
    title      text not null,
    content    text,
    memo       text,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now()
);
create index idx_know_how_notes_category on public.know_how_notes(category);

alter table public.know_how_notes enable row level security;
create policy "admin_staff all know_how_notes" on public.know_how_notes
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
