-- 보고서 "AI 질문" 기능을 없애면서(사용자 요청 — 제미나이는 영수증·급여대장 인식에만) 예전에 저장한 AI 답변도 지움.
-- 저장된 답변 전체와 표를 함께 삭제 — 되돌릴 수 없음(그 전에 만든 백업 파일에는 그때 내용이 남아 있음).
-- 앱의 백업·복구 목록에서도 이 표를 뺐으므로(lib/backup.ts·lib/restore.ts) 실행 순서는 상관없음.
drop table if exists public.report_ai_insights;
