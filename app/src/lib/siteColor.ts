// 현장(site)마다 고유한 색을 자동으로 만들어주는 유틸.
// site id를 해시한 값에 골든 앵글(137.508°)만큼씩 회전시켜 색상환에 배치하므로,
// 현장이 몇 개든(지금 11개, 앞으로 늘어나도) DB에 색을 따로 저장하지 않고도
// 항상 같은 site면 항상 같은 색이 나오고, 이웃한 현장끼리도 색이 잘 구분된다.

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const GOLDEN_ANGLE = 137.508;

export function siteHue(siteId: string): number {
  return (hashString(siteId) * GOLDEN_ANGLE) % 360;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function toHex2(n: number): string {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

export function siteColorHex(siteId: string, saturation = 65, lightness = 55): string {
  const [r, g, b] = hslToRgb(siteHue(siteId), saturation, lightness);
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/** 엑셀 내보내기용 ARGB (알파 FF + RRGGBB). */
export function siteColorExcelArgb(siteId: string): string {
  return `FF${siteColorHex(siteId).slice(1)}`;
}

/** 달력 칸 등에 바로 쓸 수 있는 인라인 스타일. site가 없으면 빈 객체(기본 배경 유지). */
export function siteColorStyle(siteId: string | null | undefined): { backgroundColor: string; color: string } | Record<string, never> {
  if (!siteId) return {};
  return { backgroundColor: siteColorHex(siteId), color: "#ffffff" };
}
