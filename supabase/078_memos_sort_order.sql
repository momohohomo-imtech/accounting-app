-- 메모장 카드 순서를 직접 바꿀 수 있게 정렬순서 컬럼 추가.
-- 기존 메모는 지금까지 보이던 순서(최신순) 그대로 유지되도록 순번을 매겨둔다.
alter table public.memos add column if not exists sort_order integer not null default 0;

with ordered as (
  select id, row_number() over (order by created_at desc) as rn
  from public.memos
)
update public.memos m set sort_order = ordered.rn
from ordered
where m.id = ordered.id;
