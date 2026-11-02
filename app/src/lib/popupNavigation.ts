// 주소(?…)로 연 팝업 닫기 — 닫기 버튼·ESC·저장 후 닫기 공통(사용자 요청 11/1 "뒤로가기로 이전 팝업 창으로 갈 수 없게",
// 검사: popupNavigation.test.ts). 예전엔 닫을 때 닫은 주소를 새 기록으로 쌓아서(push) 뒤로가기를 누르면 방금 닫은 팝업이
// 다시 열렸음(열고 닫을 때마다 쌓여서 여러 번). 이제 닫을 때 기록을 쌓지 않음:
//  - 같은 화면의 지난 기록 중 팝업이 없는 기록(닫은 뒤 주소에 들어 있는 조건만 있는 기록)으로 뒤로 감 — 팝업 기록은 "앞으로"
//    쪽으로 빠져서 뒤로가기에 다시 안 나옴(휴대폰 뒤로가기로 팝업을 닫은 것과 같음). 보통 바로 앞 기록(그 화면에서 팝업을
//    열었으니까). 저장한 뒤라도 저장 동작이 revalidatePath를 부르면 Next.js가 뒤로가기 캐시를 비워서 새 자료로 그림.
//  - 그런 기록이 없으면(팝업 주소를 바로 열었거나 다른 화면에서 왔으면) 지금 기록을 닫은 주소로 바꿈(replace).
// 지난 기록은 브라우저의 Navigation API로 봄 — 없는 예전 브라우저는 바꾸기만(뒤로가기 한 번이 같은 화면일 뿐 팝업은 안 열림).
// 팝업 안에서 다른 팝업·화면으로 "바꿔" 가는 링크도 replace로(팝업 위에 겹쳐 여는 팝업만 push — 닫으면 아래 팝업으로 돌아옴).

type PopupRouter = {
  back(): void;
  replace(href: string, options?: { scroll?: boolean }): void;
};

/** 지난 기록을 거슬러 찾는 최대 칸 수 — 같은 화면 안에서만(다른 화면 기록을 만나면 그만). */
export const MAX_BACK_STEPS = 10;

const nonEmptyParams = (u: URL) => [...u.searchParams].filter(([, v]) => v !== "").map(([k, v]) => `${k}=${v}`);

/**
 * 지난 기록(entryUrl)이 닫은 뒤 화면(targetUrl)인지 — 같은 경로이고, 기록의 검색 조건이 모두 닫은 뒤 주소에 있음
 * (빈 값은 없는 것과 같게, 순서 무관, #은 무시). 닫은 뒤 주소에만 있는 조건은 기본값을 적어 넣은 것(연도·월 등)이라 괜찮음 —
 * 기록에만 있는 조건(다른 팝업 등)이 있으면 다른 화면.
 */
export function isUnderlyingEntry(entryUrl: string, targetUrl: string, base: string): boolean {
  let entry: URL;
  let target: URL;
  try {
    entry = new URL(entryUrl, base);
    target = new URL(targetUrl, base);
  } catch {
    return false;
  }
  if (entry.origin !== target.origin || entry.pathname !== target.pathname) return false;
  const remaining = nonEmptyParams(target);
  for (const p of nonEmptyParams(entry)) {
    const i = remaining.indexOf(p);
    if (i < 0) return false;
    remaining.splice(i, 1);
  }
  return true;
}

/**
 * 몇 칸 뒤로 가면 닫은 뒤 화면인지(0 = 못 찾음 → 바꾸기). history: 기록 주소들(Navigation API entries), currentIndex: 지금 기록.
 * 같은 경로의 기록만 거슬러 봄 — 다른 화면 기록을 만나면 그만(그 너머로 가면 화면을 벗어남).
 */
export function popupBackSteps(
  href: string,
  history: (string | null)[],
  currentIndex: number,
  maxSteps = MAX_BACK_STEPS
): number {
  const current = history[currentIndex];
  if (!current) return 0;
  let currentPath: string;
  try {
    currentPath = new URL(current).pathname;
  } catch {
    return 0;
  }
  for (let k = 1; k <= maxSteps && currentIndex - k >= 0; k++) {
    const entry = history[currentIndex - k];
    if (!entry) return 0;
    if (isUnderlyingEntry(entry, href, current)) return k;
    let path: string;
    try {
      path = new URL(entry).pathname;
    } catch {
      return 0;
    }
    if (path !== currentPath) return 0;
  }
  return 0;
}

type NavigationLike = {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
};

function backStepsInBrowser(href: string): number {
  try {
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
    const index = nav?.currentEntry?.index ?? -1;
    if (!nav || index < 1) return 0;
    return popupBackSteps(href, nav.entries().map((e) => e.url), index);
  } catch {
    return 0;
  }
}

// 뒤로 가기는 바로 끝나지 않아서(주소가 바뀌기 전까지 팝업이 그대로 보임) ESC·닫기를 두 번 누르면 두 번 뒤로 가서 화면을
// 벗어남 — 첫 뒤로 가기가 끝날 때까지(popstate) 다음 닫기는 무시.
let backInFlight = false;

/** 주소로 연 팝업을 닫고 href 화면으로 — 뒤로가기 기록을 새로 쌓지 않음(위 설명). */
export function closePopup(router: PopupRouter, href: string) {
  if (backInFlight) return;
  const steps = backStepsInBrowser(href);
  if (steps === 0) {
    router.replace(href, { scroll: false });
    return;
  }
  backInFlight = true;
  const done = () => {
    backInFlight = false;
    window.removeEventListener("popstate", done);
    window.clearTimeout(timer);
  };
  window.addEventListener("popstate", done);
  const timer = window.setTimeout(done, 2000);
  if (steps === 1) router.back();
  else window.history.go(-steps);
}
