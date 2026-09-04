-- 출입명단 수정 시, 인력사무소/직원 DB에 없는 사람을 이름만으로 직접(임의) 추가할 수
-- 있게 함. daily_worker_id/employee_id 둘 다 비워두고 manual_name만 채운 행을 허용.
alter table public.access_list_workers add column if not exists manual_name text;
alter table public.access_list_workers add column if not exists manual_phone text;
alter table public.access_list_workers add column if not exists manual_birth_date date;
alter table public.access_list_workers add column if not exists manual_nationality text;

alter table public.access_list_workers drop constraint if exists access_list_workers_member_check;
alter table public.access_list_workers
  add constraint access_list_workers_member_check
  check (
    (case when daily_worker_id is not null then 1 else 0 end
     + case when employee_id is not null then 1 else 0 end
     + case when manual_name is not null then 1 else 0 end) = 1
  );
