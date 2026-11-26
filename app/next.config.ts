import type { NextConfig } from "next";

// 보안 헤더(11/26 보안 점검) — 다른 사이트가 이 앱을 iframe에 넣어 단추를 몰래 누르게 하는 것(클릭재킹) 막기, 파일 형식 추측 끄기,
// 다른 사이트로 나갈 때 주소(?vendor=거래처 이름 등)를 넘기지 않기, 쓰지 않는 브라우저 기능(마이크·위치 등) 끄기.
// 앱은 iframe·외부 스크립트·플러그인을 쓰지 않음(첨부 보기는 새 탭 링크). 카메라는 영수증 사진 찍기 때문에 막지 않음.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // 응답에 "X-Powered-By: Next.js"를 붙이지 않음(어떤 프로그램으로 만든 앱인지 알리지 않게).
  poweredByHeader: false,
  // 서버 액션 기본 한도(1MB)로는 엑셀 일괄 등록처럼 큰 저장 요청이 막혀서 넉넉하게 올림. 단, 배포 서버(Vercel)는
  // 이 설정과 상관없이 4.5MB 넘는 요청을 거절함 — 그래서 첨부파일은 브라우저에서 저장소로 바로 올리고
  // (actions/attachments.ts), 인식용 사진은 줄여서 보냄(lib/fileUpload.ts).
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
