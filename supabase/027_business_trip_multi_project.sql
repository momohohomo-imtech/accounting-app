-- 출장 업무 내역서 하루에 여러 프로젝트가 진행될 수 있어서, 프로젝트마다
-- 별도의 인원/장비/지출 내역을 가질 수 있도록 project 단위 배열(jsonb)로 재구성.
alter table public.business_trip_logs drop column if exists project_name;
alter table public.business_trip_logs drop column if exists workers;
alter table public.business_trip_logs drop column if exists total_manpower;
alter table public.business_trip_logs drop column if exists equipment;
alter table public.business_trip_logs drop column if exists expenses;
alter table public.business_trip_logs add column if not exists projects jsonb not null default '[]';
