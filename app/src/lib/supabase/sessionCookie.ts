import type { CookieOptions } from "@supabase/ssr";

/**
 * Drops maxAge/expires from an auth cookie's options so it becomes a session
 * cookie (cleared when the browser is fully closed) instead of surviving restarts.
 * Cookie *removals* (maxAge: 0) are left untouched so sign-out still works.
 */
export function toSessionCookie(options?: CookieOptions): CookieOptions | undefined {
  if (!options?.maxAge) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
