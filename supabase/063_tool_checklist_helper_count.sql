-- 공구명세서에 "조공 ##명" 인원수를 별도로 기입할 수 있게 함.
alter table public.tool_checklists add column if not exists helper_count integer;
