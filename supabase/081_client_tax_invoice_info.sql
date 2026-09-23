-- 거래처 등록 시 세금계산서 발행에 필요한 정보(사업자등록번호·대표자명·사업장주소·업태·종목·
-- 수신 이메일)도 같이 입력해둘 수 있게 컬럼 추가. 견적서 공급자 정보(company_info)와 같은
-- 항목 구성이되, 거래처는 여러 프로젝트에서 재사용되므로 거래처 레코드에 직접 저장.
alter table public.clients
  add column if not exists biz_reg_no text,
  add column if not exists representative_name text,
  add column if not exists biz_address text,
  add column if not exists biz_type text,
  add column if not exists biz_item text,
  add column if not exists tax_email text;
