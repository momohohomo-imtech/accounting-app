import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 프로젝트 첨부파일(사양서 PDF/PPT, 현장 사진 등) 업로드가 서버 액션을 통하는데,
  // 기본 1MB 제한으로는 사진 한 장도 못 넘겨서 넉넉하게 올림.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
