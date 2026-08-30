-- 견적서: 프로젝트와 연결될 수도, 안 될 수도 있음(project_id nullable).
-- 품목별 라인이 필요해서 quote_items를 별도 테이블로 둠(계산서/거래 등록 폼의
-- 여러 줄 패턴과 동일). 기존 프로젝트의 매입 내역을 그대로 불러와 견적 초안으로
-- 쓸 수 있게 할 예정이라 quote_items 컬럼 구성을 transactions 품목 입력과 맞춤.
create table public.quotes (
    id                uuid primary key default gen_random_uuid(),
    quote_number      text,
    project_id        uuid references public.projects(id) on delete set null,
    client_id         uuid references public.clients(id) on delete set null,
    client_name_raw   text,
    title             text not null,
    status            text not null default 'draft',
    valid_until       date,
    memo              text,
    created_by        uuid references public.users(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create unique index idx_quotes_quote_number on public.quotes(quote_number);

-- projects.project_code와 동일한 "연도-순번" 자동 채번 (Q 접두어만 다름).
create or replace function public.set_quote_number()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.quote_number is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()), 'YYYY');
  select coalesce(max(substring(quote_number from '-(\d+)$')::int), 0) + 1
    into next_seq
    from public.quotes
    where quote_number like 'Q' || yr || '-%';
  new.quote_number := 'Q' || yr || '-' || lpad(next_seq::text, 3, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_quote_number on public.quotes;
create trigger trg_set_quote_number
  before insert on public.quotes
  for each row execute procedure public.set_quote_number();

create table public.quote_items (
    id          uuid primary key default gen_random_uuid(),
    quote_id    uuid not null references public.quotes(id) on delete cascade,
    item_name   text,
    spec        text,
    quantity    numeric,
    unit_price  numeric,
    amount      numeric not null default 0,
    sort_order  int not null default 0
);
create index idx_quote_items_quote on public.quote_items(quote_id);

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

-- 019_role_based_access.sql과 동일한 admin_staff 전체 권한 패턴 (세무사 계정은 접근 불가).
create policy "admin_staff all quotes" on public.quotes
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

create policy "admin_staff all quote_items" on public.quote_items
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
