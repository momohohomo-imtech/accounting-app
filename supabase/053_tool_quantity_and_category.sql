-- 공구명세서: 체크(포함 여부)만 있던 걸 수량 기입 방식으로 바꾸고, 공구
-- 마스터 목록에 분류(소공구/대공구·장비/아시바/안전·기타 등)를 추가해서
-- 엑셀 명세서처럼 그룹으로 볼 수 있게 함.
alter table public.tools add column if not exists category text;
alter table public.tool_checklist_items add column if not exists quantity integer not null default 1;
