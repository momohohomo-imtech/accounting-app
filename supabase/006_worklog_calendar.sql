-- 작업일지를 달력 형태(하루 최대 5줄, 줄마다 색상)로 바꾸기 위한 마이그레이션.
-- 달력에서 만드는 항목은 프로젝트 연결 없이 날짜+내용+색상만 가지므로 project_id를 선택 항목으로 변경.
alter table public.work_logs alter column project_id drop not null;
alter table public.work_logs add column if not exists color text;
alter table public.work_logs add column if not exists sort_order integer not null default 0;
