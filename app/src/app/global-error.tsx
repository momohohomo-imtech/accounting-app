"use client";

import { useEffect } from "react";

// 최상위 레이아웃까지 실패했을 때만 쓰임 — 앱 CSS가 적용되지 않으므로 스타일을 직접 넣는다.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          padding: 16,
        }}
      >
        <title>오류 - IM테크 회계 관리 시스템</title>
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 32,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 18 }}>화면을 불러오지 못했어요</h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
            일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              border: 0,
              borderRadius: 8,
              background: "#0e6eb8",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
          {error.digest && <p style={{ marginTop: 20, fontSize: 12, color: "#94a3b8" }}>오류 코드: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
