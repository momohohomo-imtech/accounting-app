import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 액션 기본 한도(1MB)로는 엑셀 일괄 등록처럼 큰 저장 요청이 막혀서 넉넉하게 올림. 단, 배포 서버(Vercel)는
  // 이 설정과 상관없이 4.5MB 넘는 요청을 거절함 — 그래서 첨부파일은 브라우저에서 저장소로 바로 올리고
  // (actions/attachments.ts), 인식용 사진은 줄여서 보냄(lib/fileUpload.ts).
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
