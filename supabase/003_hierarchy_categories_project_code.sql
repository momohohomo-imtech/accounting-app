-- ============================================================
-- 거래처-현장 연결 / 프로젝트 발주·수주 정보 / 프로젝트 고유번호 / 지출카테고리
-- Supabase SQL Editor에서 전체 실행하세요. (001, 002 이후 적용)
-- ============================================================

-- ---------- sites: 거래처(발주처) 연결 ----------
alter table public.sites
    add column if not exists client_id uuid references public.clients(id) on delete set null;

-- ---------- projects: 발주액/수주액/발주서일자 + 고유번호 ----------
alter table public.projects
    add column if not exists quote_amount numeric,
    add column if not exists contract_amount numeric,
    add column if not exists order_date date,
    add column if not exists project_code text;

create unique index if not exists idx_projects_project_code on public.projects(project_code);

create or replace function public.set_project_code()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.project_code is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()), 'YYYY');
  select coalesce(max(substring(project_code from '-(\d+)$')::int), 0) + 1
    into next_seq
    from public.projects
    where project_code like yr || '-%';
  new.project_code := yr || '-' || lpad(next_seq::text, 3, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_project_code on public.projects;
create trigger trg_set_project_code
  before insert on public.projects
  for each row execute procedure public.set_project_code();

-- 기존에 이미 있던 프로젝트들에도 번호 부여 (생성일 순으로)
do $$
declare
  rec record;
  yr text;
  seq int;
  cur_yr text := '';
begin
  for rec in
    select id, created_at from public.projects where project_code is null order by created_at asc
  loop
    yr := to_char(rec.created_at, 'YYYY');
    if yr <> cur_yr then
      cur_yr := yr;
      select coalesce(max(substring(project_code from '-(\d+)$')::int), 0) into seq
        from public.projects where project_code like yr || '-%';
    end if;
    seq := seq + 1;
    update public.projects set project_code = yr || '-' || lpad(seq::text, 3, '0') where id = rec.id;
  end loop;
end $$;

-- ---------- 지출 카테고리 ----------
create table if not exists public.expense_categories (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    sort_order  smallint not null default 0,
    created_at  timestamptz not null default now()
);

insert into public.expense_categories (name, sort_order) values
    ('차량', 1),
    ('출장', 2),
    ('회식', 3),
    ('접대', 4)
on conflict (name) do nothing;

alter table public.transactions
    add column if not exists category_id uuid references public.expense_categories(id);

-- 기존 category 자유텍스트 값을 매핑 시도 (일치하는 이름만)
update public.transactions t
set category_id = ec.id
from public.expense_categories ec
where t.category_id is null
  and t.category is not null
  and ec.name = trim(t.category);

-- ============================================================
-- RLS
-- ============================================================
alter table public.expense_categories enable row level security;
create policy "authenticated all expense_categories" on public.expense_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 실행 후 확인:
-- select project_code, name, year, created_at from public.projects order by created_at;
-- select * from public.expense_categories order by sort_order;
