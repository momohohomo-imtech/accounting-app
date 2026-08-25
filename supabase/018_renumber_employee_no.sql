-- 사원번호를 기존 순서(숫자로 보이는 값은 숫자 크기순, 나머지는 뒤로)를 유지한 채
-- 0부터 시작하는 연속된 번호로 재부여.
with ordered as (
  select id,
         row_number() over (
           order by
             case when employee_no ~ '^[0-9]+$' then employee_no::int end nulls last,
             employee_no nulls last
         ) - 1 as new_no
  from public.employees
)
update public.employees e
set employee_no = ordered.new_no::text
from ordered
where e.id = ordered.id;
