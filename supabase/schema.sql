-- ============================================================
-- 현장관리 앱 DB 스키마 (Supabase / PostgreSQL)
-- Supabase SQL Editor에서 전체 실행하세요.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 사용자 (Supabase Auth 연동) ----------
create table public.users (
    id              uuid primary key references auth.users(id) on delete cascade,
    email           text unique not null,
    name            text not null,
    role            text not null default 'admin',   -- admin / staff
    created_at      timestamptz not null default now()
);

-- 신규 가입시 public.users 자동 생성
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 거래처 ----------
create table public.clients (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    type            text not null default 'both',    -- vendor / customer / both
    phone           text,
    memo            text,
    created_at      timestamptz not null default now()
);

-- ---------- 현장 ----------
create table public.sites (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    location        text,
    manager_name    text,
    created_at      timestamptz not null default now()
);

-- ---------- 프로젝트 ----------
create table public.projects (
    id                  uuid primary key default gen_random_uuid(),
    site_id             uuid not null references public.sites(id) on delete restrict,
    parent_project_id   uuid references public.projects(id) on delete set null,
    name                text not null,
    status              text not null default 'ongoing',
    is_service          boolean not null default false,
    start_date          date,
    end_date            date,
    progress_pct        smallint default 0,
    year                smallint not null,
    created_at          timestamptz not null default now()
);
create index idx_projects_site on public.projects(site_id);
create index idx_projects_parent on public.projects(parent_project_id);
create index idx_projects_year on public.projects(year);

-- ---------- 매입매출 거래 ----------
create table public.transactions (
    id                  uuid primary key default gen_random_uuid(),
    trans_date          date not null,
    type                text not null,                 -- 매입 / 매출
    client_id           uuid references public.clients(id) on delete set null,
    client_name_raw     text,
    project_id          uuid references public.projects(id) on delete set null,
    item_name           text,
    category            text,
    quantity            numeric,
    unit_price          numeric,
    card_company        text,
    vat_included        boolean not null default true,
    purchase_amount     numeric not null default 0,
    purchase_vat        numeric not null default 0,
    sales_amount        numeric not null default 0,
    sales_vat           numeric not null default 0,
    payment_type        text not null default 'immediate',
    is_verified_ai      boolean not null default true,
    receipt_image_url   text,
    ocr_extracted_raw   jsonb,
    note1               text,
    note2               text,
    created_by          uuid references public.users(id),
    created_at          timestamptz not null default now()
);
create index idx_transactions_date on public.transactions(trans_date);
create index idx_transactions_project on public.transactions(project_id);
create index idx_transactions_client on public.transactions(client_id);

-- ---------- 외상 결제 기록 ----------
create table public.credit_payments (
    id              uuid primary key default gen_random_uuid(),
    transaction_id  uuid not null references public.transactions(id) on delete cascade,
    paid_date       date not null,
    paid_amount     numeric not null,
    remaining_amount numeric not null,
    created_at      timestamptz not null default now()
);
create index idx_credit_payments_tx on public.credit_payments(transaction_id);

-- ---------- 작업일지 ----------
create table public.work_logs (
    id              uuid primary key default gen_random_uuid(),
    log_date        date not null,
    project_id      uuid not null references public.projects(id) on delete restrict,
    title           text not null,
    workers         text,
    start_time      time,
    end_time        time,
    content         text,
    created_at      timestamptz not null default now()
);
create index idx_worklogs_date on public.work_logs(log_date);
create index idx_worklogs_project on public.work_logs(project_id);

-- ---------- 정규직 직원 ----------
create table public.employees (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    role            text,
    employment_type text,
    hired_date      date,
    phone           text,
    created_at      timestamptz not null default now()
);

create table public.payroll (
    id              uuid primary key default gen_random_uuid(),
    employee_id     uuid not null references public.employees(id) on delete cascade,
    pay_month       date not null,
    work_days       smallint,
    amount          numeric not null,
    created_at      timestamptz not null default now()
);
create index idx_payroll_employee on public.payroll(employee_id);

-- ---------- 일용직 사무소 ----------
create table public.daily_worker_offices (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    manager_name    text,
    phone           text,
    created_at      timestamptz not null default now()
);

-- ---------- 일용직 근로자 ----------
create table public.daily_workers (
    id              uuid primary key default gen_random_uuid(),
    office_id       uuid not null references public.daily_worker_offices(id) on delete restrict,
    name            text not null,
    birth_date      date,
    phone           text,
    nationality     text,
    current_location text,
    status          text not null default 'active',
    memo            text,
    registered_at   date not null default current_date
);
create index idx_daily_workers_office on public.daily_workers(office_id);
create index idx_daily_workers_location on public.daily_workers(current_location);

-- 출입명단
create table public.access_lists (
    id              uuid primary key default gen_random_uuid(),
    company_name    text not null,
    site_id         uuid references public.sites(id),
    supervisor_name text,
    access_period   text,
    created_at      timestamptz not null default now()
);

create table public.access_list_workers (
    access_list_id  uuid not null references public.access_lists(id) on delete cascade,
    daily_worker_id uuid not null references public.daily_workers(id) on delete cascade,
    primary key (access_list_id, daily_worker_id)
);

-- ---------- 은행 계좌 및 거래내역 ----------
create table public.bank_accounts (
    id              uuid primary key default gen_random_uuid(),
    bank_name       text not null,
    nickname        text,
    account_number  text,
    opening_balance numeric not null default 0,
    created_at      timestamptz not null default now()
);

create table public.bank_transactions (
    id              uuid primary key default gen_random_uuid(),
    bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
    trans_date      date not null,
    description     text,
    direction       text not null,
    amount          numeric not null,
    matched_client_id uuid references public.clients(id),
    matched_transaction_id uuid references public.transactions(id),
    created_at      timestamptz not null default now()
);
create index idx_bank_tx_account on public.bank_transactions(bank_account_id);
create index idx_bank_tx_date on public.bank_transactions(trans_date);

-- ---------- 백업 이력 ----------
create table public.backups (
    id              uuid primary key default gen_random_uuid(),
    file_name       text not null,
    file_size_mb    numeric,
    backup_type     text not null default 'auto',
    storage_url     text not null,
    created_at      timestamptz not null default now()
);

-- ============================================================
-- RLS: 로그인한 내부 직원은 전부 접근 가능 (사내 전용 툴)
-- ============================================================
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.sites enable row level security;
alter table public.projects enable row level security;
alter table public.transactions enable row level security;
alter table public.credit_payments enable row level security;
alter table public.work_logs enable row level security;
alter table public.employees enable row level security;
alter table public.payroll enable row level security;
alter table public.daily_worker_offices enable row level security;
alter table public.daily_workers enable row level security;
alter table public.access_lists enable row level security;
alter table public.access_list_workers enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.backups enable row level security;

create policy "authenticated read users" on public.users for select using (auth.role() = 'authenticated');
create policy "self update users" on public.users for update using (auth.uid() = id);

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clients','sites','projects','transactions','credit_payments','work_logs',
      'employees','payroll','daily_worker_offices','daily_workers',
      'access_lists','access_list_workers','bank_accounts','bank_transactions','backups'
    ])
  loop
    execute format('create policy "authenticated all %1$s" on public.%1$s for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');', t);
  end loop;
end $$;

-- ============================================================
-- Storage: 영수증 이미지, 백업 파일
-- ============================================================
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('backups', 'backups', false)
  on conflict (id) do nothing;

create policy "authenticated receipts access" on storage.objects
  for all using (bucket_id = 'receipts' and auth.role() = 'authenticated')
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "authenticated backups access" on storage.objects
  for all using (bucket_id = 'backups' and auth.role() = 'authenticated')
  with check (bucket_id = 'backups' and auth.role() = 'authenticated');
