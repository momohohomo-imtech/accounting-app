-- 인력 명단.xlsx 반입 (가나인력/현지인력/개인). 주민등록번호는 앞자리만 남기고
-- 뒷자리 7자리는 마스킹(*******) 처리해서 저장함.
-- 실행 전: 아래 3개 사무소 이름이 daily_worker_offices에 정확히 존재하는지 먼저 확인하세요.
-- select name from public.daily_worker_offices where name in ('가나인력','현지인력','개인');

insert into public.daily_workers
  (office_id, name, grade, resident_id_masked, phone, nationality, language_ability, other_ability, bank_name, account_number)
values
  ((select id from public.daily_worker_offices where name = '가나인력'), '원진식', 'B', '710429-*******', '010 5933 6198', '한국', '화기가능', null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '이종주', '불량', '870324-*******', '010 9682 1242', '한국', '화기가능', null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '김철준', 'A', '770602-*******', '010 5765 5155', '중국', '화기가능', null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '안드레이', 'B', '900110-*******', '010 8331 1990', '러시아', '보류', '용접', null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '김광오', 'A', '660201-*******', '010 7680 8678', '중국', '화기가능', null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '모라트', null, '870209-*******', '010 8254 5511', '카자흐스탄', '보류', null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '오강', 'A', '771006-*******', '010 4245 1888', '중국', null, '용접', null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '최성일', 'B', '700709-*******', '010 8368 1169', '중국', '화기가능', null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '샘', null, '960405-*******', '010 7755 9660', '한국', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '김상옥', null, '801112-*******', '010 8117 9509', '우즈베키스탄', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '조장복', null, '620910-*******', '010 9187 9978', '중국', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '안디마', null, '731229-*******', '010 7502 2525', '우즈베키스탄', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '양영삼', null, '750911-*******', '010 2134 5559', '중국', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '에브게니', null, '850308-*******', '010 8187 4434', '우즈베키스탄', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '루슬란', null, '730806-*******', '010 8259 2705', '우즈베키스탄', null, '황금이', null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '조안드레이', null, '890920-*******', '010 6420 2444', '우즈베키스탄', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '윤권수', null, '621118-*******', '010 4939 4599', '중국', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '유동춘', null, '671022-*******', '010 5890 1088', '중국', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '김태겸', null, '830104-*******', '010 6708 3051', '한국', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '최병식', null, '680321-*******', '010 7600 6695', '한국', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '아지즈', null, '771216-*******', '010 8655 0977', '카자흐스탄', null, null, null, null),
  ((select id from public.daily_worker_offices where name = '가나인력'), '배슬라와', null, '630228-*******', '010 9896 6366', null, null, null, null, null),
  ((select id from public.daily_worker_offices where name = '현지인력'), '오세원', 'A', '690730-*******', '010 7937 5044', null, null, '막용접', null, null),
  ((select id from public.daily_worker_offices where name = '현지인력'), '문성수', 'A', '591107-*******', '010 6277 6509', null, null, '용접가능 / 제관?', null, null),
  ((select id from public.daily_worker_offices where name = '현지인력'), '정연길', null, '770822-*******', '010 7769 3742', null, null, null, null, null),
  ((select id from public.daily_worker_offices where name = '현지인력'), '이상훈', null, '630505-*******', '010 4795 1823', null, null, null, null, null),
  ((select id from public.daily_worker_offices where name = '현지인력'), '이경열', 'A', '830801-*******', '010 3421 3037', null, null, null, null, null),
  ((select id from public.daily_worker_offices where name = '현지인력'), '이철', null, '651116-*******', '010 4623 9543', null, null, null, null, null),
  ((select id from public.daily_worker_offices where name = '현지인력'), '최영수', null, '640615-*******', '010 7164 3313', null, null, null, null, null),
  ((select id from public.daily_worker_offices where name = '개인'), '서평석', null, '500628-*******', '010-7108-8023', null, null, null, '기업', '644-041222-01-014');

-- 총 30건 (가나인력 22건, 현지인력 7건, 개인 1건)
-- 확인용: select office_id, count(*) from public.daily_workers group by office_id;
