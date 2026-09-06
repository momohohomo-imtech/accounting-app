"use client";

import { useEffect, useRef } from "react";
import { signOut } from "@/lib/actions/auth";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30분
const CHECK_INTERVAL_MS = 30 * 1000;
const WRITE_THROTTLE_MS = 5 * 1000;
const STORAGE_KEY = "idle-logout:last-activity";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

function readLastActivity(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeLastActivity(ts: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    // 사생활 보호 모드 등으로 localStorage를 못 쓰면 그냥 무시(이 세션 안에서만 동작).
  }
}

export function IdleLogout() {
  const formRef = useRef<HTMLFormElement>(null);
  const lastWriteRef = useRef(0);

  useEffect(() => {
    const signOutNow = () => formRef.current?.requestSubmit();

    // localStorage에 저장해두면 창을 닫았다 새로 열거나(=새로고침), 휴대폰에서
    // 화면이 꺼져 있던 동안(setInterval이 멈춰 있어도) 지난 실제 시간을 알 수 있다.
    const checkIdle = () => {
      const last = readLastActivity();
      if (last !== null && Date.now() - last >= IDLE_LIMIT_MS) {
        signOutNow();
        return true;
      }
      return false;
    };

    // 창을 닫았다 새로 연 시점(=마운트) 기준으로 이미 유휴 시간이 지났으면 바로 로그아웃.
    if (checkIdle()) return;

    const markActive = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < WRITE_THROTTLE_MS) return;
      lastWriteRef.current = now;
      writeLastActivity(now);
    };
    markActive();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    // 모바일에서 화면이 꺼지거나 다른 앱으로 전환되면 setInterval이 멈추거나 크게
    // 느려질 수 있어서, 다시 화면으로 돌아오는 시점(visibilitychange)에도 바로 확인한다.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkIdle();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Native <form action> submission so the signOut server action's redirect() works correctly
  // (calling the action directly from client code breaks its redirect — see HANDOFF.md).
  return <form ref={formRef} action={signOut} className="hidden" aria-hidden="true" />;
}
