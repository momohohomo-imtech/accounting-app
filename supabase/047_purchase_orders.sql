-- 발주서(내가 매입처에 보내는 발주서) — quotes/quote_items와 완전히 동일한 구조로 미러링.
-- client_id/client_name_raw는 여기서는 "매입처"(발주를 받는 쪽) 의미로 씀.
create table if not exists public.purchase_orders (
    id                uuid primary key default gen_random_uuid(),
    po_number         text,
    project_id        uuid references public.projects(id) on delete set null,
    client_id         uuid references public.clients(id) on delete set null,
    client_name_raw   text,
    title             text not null,
    status            text not null default 'draft',
    expected_date     date,
    memo              text,
    created_by        uuid references public.users(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create unique index if not exists idx_purchase_orders_po_number on public.purchase_orders(po_number);

-- quotes.set_quote_number()과 동일한 "연도-순번" 자동 채번 (PO 접두어만 다름).
create or replace function public.set_po_number()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.po_number is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()), 'YYYY');
  select coalesce(max(substring(po_number from '-(\d+)$')::int), 0) + 1
    into next_seq
    from public.purchase_orders
    where po_number like 'PO' || yr || '-%';
  new.po_number := 'PO' || yr || '-' || lpad(next_seq::text, 3, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_po_number on public.purchase_orders;
create trigger trg_set_po_number
  before insert on public.purchase_orders
  for each row execute procedure public.set_po_number();

create table if not exists public.purchase_order_items (
    id                uuid primary key default gen_random_uuid(),
    purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
    item_name         text,
    spec              text,
    quantity          numeric,
    unit_price        numeric,
    amount            numeric not null default 0,
    sort_order        int not null default 0
);
create index if not exists idx_purchase_order_items_po on public.purchase_order_items(purchase_order_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

-- 019_role_based_access.sql과 동일한 admin_staff 전체 권한 패턴 (세무사 계정은 접근 불가).
drop policy if exists "admin_staff all purchase_orders" on public.purchase_orders;
create policy "admin_staff all purchase_orders" on public.purchase_orders
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "admin_staff all purchase_order_items" on public.purchase_order_items;
create policy "admin_staff all purchase_order_items" on public.purchase_order_items
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
