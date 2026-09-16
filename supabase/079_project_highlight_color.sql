-- 프로젝트 목록에서 확인 필요/우선순위 프로젝트를 한눈에 보이게, 사용자가 직접 지정하는
-- 강조색. 지정되면 자동 상태색 대신 이 색(진한 배경)을 쓴다.
alter table public.projects add column if not exists highlight_color text;
