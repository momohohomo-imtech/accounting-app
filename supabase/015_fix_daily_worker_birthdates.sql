-- daily_workers.birth_date 채우기 (013번 반입 때 누락됨).
-- 주민등록번호 뒷자리는 여전히 DB에 저장하지 않음 -- 생년월일만 계산해서 채움.

update public.daily_workers set birth_date = '1971-04-29' where name = '원진식' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1987-03-24' where name = '이종주' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1977-06-02' where name = '김철준' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1990-01-10' where name = '안드레이' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1966-02-01' where name = '김광오' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1987-02-09' where name = '모라트' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1977-10-06' where name = '오강' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1970-07-09' where name = '최성일' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1996-04-05' where name = '샘' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1980-11-12' where name = '김상옥' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1962-09-10' where name = '조장복' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1973-12-29' where name = '안디마' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1975-09-11' where name = '양영삼' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1985-03-08' where name = '에브게니' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1973-08-06' where name = '루슬란' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1989-09-20' where name = '조안드레이' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1962-11-18' where name = '윤권수' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1967-10-22' where name = '유동춘' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1983-01-04' where name = '김태겸' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1968-03-21' where name = '최병식' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1977-12-16' where name = '아지즈' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1963-02-28' where name = '배슬라와' and office_id = (select id from public.daily_worker_offices where name = '가나인력');
update public.daily_workers set birth_date = '1969-07-30' where name = '오세원' and office_id = (select id from public.daily_worker_offices where name = '현지인력');
update public.daily_workers set birth_date = '1959-11-07' where name = '문성수' and office_id = (select id from public.daily_worker_offices where name = '현지인력');
update public.daily_workers set birth_date = '1977-08-22' where name = '정연길' and office_id = (select id from public.daily_worker_offices where name = '현지인력');
update public.daily_workers set birth_date = '1963-05-05' where name = '이상훈' and office_id = (select id from public.daily_worker_offices where name = '현지인력');
update public.daily_workers set birth_date = '1983-08-01' where name = '이경열' and office_id = (select id from public.daily_worker_offices where name = '현지인력');
update public.daily_workers set birth_date = '1965-11-16' where name = '이철' and office_id = (select id from public.daily_worker_offices where name = '현지인력');
update public.daily_workers set birth_date = '1964-06-15' where name = '최영수' and office_id = (select id from public.daily_worker_offices where name = '현지인력');
update public.daily_workers set birth_date = '1950-06-28' where name = '서평석' and office_id = (select id from public.daily_worker_offices where name = '개인');

-- 총 30건 업데이트
-- 확인용: select name, birth_date from public.daily_workers order by name;
