alter table public.projects
  add column if not exists contract_amount_minimum boolean not null default false;
