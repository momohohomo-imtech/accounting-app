-- 프로젝트 첨부파일(사양서 PDF/PPT, 이미지 등)과 작업일지 날짜별 현장사진을
-- 같은 테이블로 관리. project_id/work_date 둘 다 선택(둘 다 채워도, 둘 다 비워도 됨).
-- work_log_id가 아니라 work_date로 연결하는 이유: 작업일지 날짜별 저장이 그 날짜의
-- 기존 행을 전부 지우고 다시 넣는 방식이라, 특정 work_log row id에 걸면 그 날짜를
-- 다시 저장할 때마다 파일 연결이 끊어짐(고아 데이터가 됨).
create table if not exists public.attachments (
    id            uuid primary key default gen_random_uuid(),
    project_id    uuid references public.projects(id) on delete cascade,
    work_date     date,
    file_name     text not null,
    storage_path  text not null,
    mime_type     text,
    file_size     bigint,
    memo          text,
    created_by    uuid references public.users(id),
    created_at    timestamptz not null default now()
);
create index if not exists idx_attachments_project on public.attachments(project_id);
create index if not exists idx_attachments_work_date on public.attachments(work_date);

alter table public.attachments enable row level security;

-- 019_role_based_access.sql과 동일한 admin_staff 전체 권한 패턴.
drop policy if exists "admin_staff all attachments" on public.attachments;
create policy "admin_staff all attachments" on public.attachments
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- 파일 저장용 storage 버킷 (비공개 — signed URL로만 접근).
insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false)
  on conflict (id) do nothing;

drop policy if exists "admin_staff project_files access" on storage.objects;
create policy "admin_staff project_files access" on storage.objects
  for all using (bucket_id = 'project-files' and public.current_user_role() in ('admin', 'staff'))
  with check (bucket_id = 'project-files' and public.current_user_role() in ('admin', 'staff'));
