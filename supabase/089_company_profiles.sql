-- 견적서 공급자 목록 — 견적서 인쇄화면에서 골라 쓰는 우리 회사(사업자) 정보. 지금은 두 회사 정보를 번갈아 쓰고
-- 더 늘 수 있음(사용자 요청). 견적서에 실제로 찍힌 공급자는 예전처럼 견적서마다 quotes.company_info(080)에
-- 따로 저장돼서, 목록을 고치거나 지워도 이미 저장한 견적서는 바뀌지 않음.
-- 기존 데이터는 바꾸지 않음 — 새 표를 만들고, 비어 있을 때 한 번만 첫 값을 채움:
--   1) 지금까지 견적서에 저장해 둔 공급자 정보(사업자등록번호가 같으면 가장 최근에 고친 견적서 것 하나)
--   2) 앱에 박혀 있던 기본값(아이엠테크) — 1)에 같은 사업자등록번호가 없을 때만
--   아이엠테크를 기본 공급자(새 견적서가 처음 보여주는 값)로 지정.

create table if not exists public.company_profiles (
    id                  uuid primary key default gen_random_uuid(),
    company_name        text not null,
    representative_name text,
    biz_reg_no          text,
    address             text,
    biz_type            text,
    biz_item            text,
    phone               text,
    fax                 text,
    is_default          boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- 기본 공급자는 하나만.
create unique index if not exists idx_company_profiles_one_default
  on public.company_profiles ((true)) where is_default;

alter table public.company_profiles enable row level security;

-- 견적서(041)와 같은 권한: 관리자·직원은 전체, 조회 전용(viewer)은 읽기만(084와 같은 방식), 세무사는 접근 없음.
drop policy if exists "admin_staff all company_profiles" on public.company_profiles;
create policy "admin_staff all company_profiles" on public.company_profiles
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

drop policy if exists "viewer read company_profiles" on public.company_profiles;
create policy "viewer read company_profiles" on public.company_profiles
  for select using (public.current_user_role() = 'viewer');

do $$
begin
  if exists (select 1 from public.company_profiles) then
    return;
  end if;

  insert into public.company_profiles
    (company_name, representative_name, biz_reg_no, address, biz_type, biz_item, phone, fax)
  select
    trim(ci->>'companyName'),
    nullif(trim(coalesce(ci->>'representativeName', '')), ''),
    nullif(trim(coalesce(ci->>'bizRegNo', '')), ''),
    nullif(trim(coalesce(ci->>'address', '')), ''),
    nullif(trim(coalesce(ci->>'bizType', '')), ''),
    nullif(trim(coalesce(ci->>'bizItem', '')), ''),
    nullif(trim(coalesce(ci->>'phone', '')), ''),
    nullif(trim(coalesce(ci->>'fax', '')), '')
  from (
    select distinct on (supplier_key) company_info as ci
    from (
      select
        company_info,
        updated_at,
        coalesce(
          nullif(regexp_replace(coalesce(company_info->>'bizRegNo', ''), '[^0-9]', '', 'g'), ''),
          trim(company_info->>'companyName')
        ) as supplier_key
      from public.quotes
      where company_info is not null
        and trim(coalesce(company_info->>'companyName', '')) <> ''
    ) saved
    order by supplier_key, updated_at desc
  ) latest;

  insert into public.company_profiles (company_name, biz_reg_no, address, biz_type, biz_item, fax)
  select '아이엠테크', '521-32-01642', '인천 남동구 호구포로 44번길 77', '제조업', '컨베이어 장치 제조업', '032-232-0914'
  where not exists (
    select 1 from public.company_profiles
    where regexp_replace(coalesce(biz_reg_no, ''), '[^0-9]', '', 'g') = '5213201642'
  );

  update public.company_profiles
  set is_default = true
  where id = (
    select id from public.company_profiles
    where regexp_replace(coalesce(biz_reg_no, ''), '[^0-9]', '', 'g') = '5213201642'
    order by created_at
    limit 1
  );
end $$;
