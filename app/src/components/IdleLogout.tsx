"use client";

import { useEffect, useRef } from "react";
import { signOut } from "@/lib/actions/auth";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30분
const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export function IdleLogout() {
  const lastActivity = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const markActive = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) {
        formRef.current?.requestSubmit();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      clearInterval(interval);
    };
  }, []);

  // Native <form action> submission so the signOut server action's redirect() works correctly
  // (calling the action directly from client code breaks its redirect — see HANDOFF.md).
  return <form ref={formRef} action={signOut} className="hidden" aria-hidden="true" />;
}
