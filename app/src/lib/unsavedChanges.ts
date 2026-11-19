// 작성 중인 메모를 저장하지 않고 떠날 때 물어보기(사용자 요청 11/19 "모든 메모장에 작성 중에 나가거나 뒤로가기·닫기 할 경우 저장할지
// 물어보기", 검사: unsavedChanges.test.ts). 화면 쪽(확인창·링크·뒤로가기·탭 닫기 감지)은 components/UnsavedChangesProvider.tsx,
// 메모칸은 useUnsavedGuard로 등록. 여기는 브라우저 없이 검사할 수 있는 판단만:
//  - 어떤 링크 클릭이 지금 화면을 떠나는지(leavingHref)
//  - 저장 안 한 칸 목록(createUnsavedRegistry) — "저장"·"저장 안 함"으로 정한 내용은 다시 묻지 않음(내용을 또 바꾸면 다시)
//  - 뒤로가기·앞으로가기 가로채기(createTraverseGuard) — Next.js가 화면을 바꾸기 전에 원래 기록으로 되돌리고 물어본 뒤, 떠나기로
//    하면 같은 칸만큼 다시 감

/** 이 속성을 단 폼(로그아웃)은 제출 전에 물어봄 — 서버 컴포넌트(레이아웃)에서도 쓰게 여기(lib)에 둠 */
export const LEAVE_GUARD_FORM_ATTR = "data-leave-guard";

export type LinkClickInfo = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  /** 링크 주소(a.href — 절대 주소) */
  href: string | null;
  /** a의 target 속성 */
  target: string | null;
  /** download 속성이 있으면 파일 내려받기 — 화면을 안 떠남 */
  download: boolean;
  /** 지금 주소(location.href) */
  currentHref: string;
};

/**
 * 이 링크 클릭이 지금 화면을 떠나는 이동이면 갈 주소, 아니면 null — 새 탭·새 창(가운데 단추·Ctrl·Shift·target)·내려받기·
 * 메일/전화·같은 주소(#만 다름)는 화면이 그대로라 묻지 않음.
 */
export function leavingHref(c: LinkClickInfo): string | null {
  if (c.defaultPrevented || c.button !== 0) return null;
  if (c.metaKey || c.ctrlKey || c.shiftKey || c.altKey) return null;
  if (c.target && c.target !== "_self") return null;
  if (c.download || !c.href) return null;
  let from: URL;
  let to: URL;
  try {
    from = new URL(c.currentHref);
    to = new URL(c.href, from);
  } catch {
    return null;
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") return null;
  const withoutHash = (u: URL) => `${u.origin}${u.pathname}${u.search}`;
  if (withoutHash(to) === withoutHash(from)) return null;
  return to.href;
}

/** 확인창에 보일 칸 이름 — 같은 이름은 한 번, 많으면 앞의 몇 개 + "외 N개" */
export function leaveDialogLabels(labels: string[], max = 4): string[] {
  const unique = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  if (unique.length <= max) return unique;
  return [...unique.slice(0, max - 1), `외 ${unique.length - (max - 1)}개`];
}

export type GuardState = {
  /** 저장 안 한 내용이 있는지 */
  dirty: boolean;
  /** 지금 내용(글자) — "저장 안 함"으로 정한 뒤 내용을 또 바꾸면 다시 물어봄 */
  value: string;
  /** 확인창에 보일 이름(예: "대시보드 메모") */
  label: string;
};

/** 메모칸 등록부 — 칸마다 지금 상태를 읽는 함수(get)를 등록해 두고, 떠날 때 저장 안 한 칸을 찾음. */
export function createUnsavedRegistry<T extends GuardState>() {
  type Entry = { get: () => T; decided: string | null };
  const entries = new Map<number, Entry>();
  let seq = 0;
  const isDirty = (e: Entry) => {
    const s = e.get();
    return s.dirty && s.value !== e.decided;
  };
  return {
    add(get: () => T): number {
      const id = ++seq;
      entries.set(id, { get, decided: null });
      return id;
    },
    remove(id: number) {
      entries.delete(id);
    },
    /** 저장 안 한 칸(등록 순서) — ids를 주면 그 안에서만 */
    dirtyIds(ids?: number[]): number[] {
      return (ids ?? [...entries.keys()]).filter((id) => {
        const e = entries.get(id);
        return Boolean(e && isDirty(e));
      });
    },
    get(id: number): T | undefined {
      return entries.get(id)?.get();
    },
    /** 저장했거나 "저장 안 함"으로 정함 — 지금 내용으로는 다시 묻지 않음(내용을 바꾸면 다시) */
    decide(ids: number[]) {
      for (const id of ids) {
        const e = entries.get(id);
        if (e) e.decided = e.get().value;
      }
    },
    size: () => entries.size,
  };
}

/** 뒤로가기·앞으로가기가 몇 칸이었는지(Navigation API 기록 번호) — 모르면 뒤로 한 칸(휴대폰 뒤로가기)으로 봄. */
export function traverseDelta(fromIndex: number | null | undefined, toIndex: number | null | undefined): number {
  if (fromIndex == null || toIndex == null || fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return -1;
  return toIndex - fromIndex;
}

/** 우리가 되돌린 이동(history.go)의 popstate를 이 시간 안에만 삼킴 — 되돌리기가 안 먹었을 때 다음 뒤로가기까지 막지 않게. */
export const RESTORE_WINDOW_MS = 1500;

export type TraverseGuardDeps = {
  /** history.go */
  go: (delta: number) => void;
  now: () => number;
  /** 지금 주소(location.href) */
  href: () => string;
  /** 저장 안 한 칸이 있는지 */
  hasDirty: () => boolean;
  /** 물어봄 — 저장했거나 "저장 안 함"이면 true(떠남), "계속 작성"이면 false */
  confirmLeave: () => Promise<boolean>;
};

/**
 * 뒤로가기·앞으로가기 가로채기. popstate는 이미 기록이 옮겨진 뒤에 오므로: 저장 안 한 칸이 있으면 Next.js가 화면을 바꾸지
 * 못하게 막고(onPopState가 true → 부르는 쪽이 stopImmediatePropagation) 같은 칸만큼 되돌린 뒤(그 popstate도 막음) 물어봄.
 * 떠나기로 하면 다시 같은 칸만큼 가고 그 popstate는 그대로 Next.js로. 칸 수는 Navigation API의 navigate 이벤트(이동 전)에서
 * beforeTraverse로 받음 — 없는 예전 브라우저는 뒤로 한 칸으로 봄.
 */
export function createTraverseGuard(deps: TraverseGuardDeps) {
  let restoring: { href: string | null; until: number } | null = null;
  let passNext = false;
  let pending: { delta: number; from: string | null } | null = null;

  return {
    /** Navigation API navigate 이벤트(기록을 옮기기 전) — 몇 칸, 지금 주소 */
    beforeTraverse(delta: number, from: string | null) {
      pending = { delta, from };
    },
    /** popstate — true면 Next.js까지 가지 않게 막을 것 */
    onPopState(): boolean {
      const { delta, from } = pending ?? { delta: -1, from: null };
      pending = null;
      if (restoring) {
        const r = restoring;
        restoring = null;
        if (deps.now() <= r.until && (r.href === null || r.href === deps.href())) return true;
      }
      if (passNext) {
        passNext = false;
        return false;
      }
      if (!deps.hasDirty()) return false;
      restoring = { href: from, until: deps.now() + RESTORE_WINDOW_MS };
      deps.go(-delta);
      void deps.confirmLeave().then((leave) => {
        if (!leave) return;
        passNext = true;
        deps.go(delta);
      });
      return true;
    },
  };
}
