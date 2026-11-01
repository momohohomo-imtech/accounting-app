// 브라우저 전용 — 서버가 만들어 준 서명된 올리기 주소(토큰)로 저장소에 파일을 바로 올림(actions/attachments.ts 맨 위 설명).
// 토큰만으로 올리므로 로그인 정보를 읽거나 저장하지 않는 클라이언트를 씀 — 로그인 쿠키(창 닫으면 로그아웃)는 서버만 다룸.
// supabase-js는 올릴 때만 불러옴(첨부 화면을 열 때 내려받는 양을 늘리지 않게).
export async function uploadToSignedUrl(bucket: string, path: string, token: string, file: File) {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  return { error: error ? error.message : null };
}
