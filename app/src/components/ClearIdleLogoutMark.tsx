"use client";

import { useEffect } from "react";

// 로그인 화면에 왔다는 건 새로 인증할 참이라는 뜻이므로, 이전 세션의 유휴시간
// 기록을 지워서 로그인 직후 바로 다시 로그아웃되는 걸 방지한다.
// (주의: 이 화면으로 오는 이동이 소프트 네비게이션이면 <script> 태그는 실행되지
// 않으므로 useEffect로 처리해야 한다.)
export function ClearIdleLogoutMark() {
  useEffect(() => {
    try {
      localStorage.removeItem("idle-logout:last-activity");
    } catch {
      // 사생활 보호 모드 등으로 localStorage를 못 쓰면 그냥 무시.
    }
  }, []);

  return null;
}
