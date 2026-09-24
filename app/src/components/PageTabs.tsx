import Link from "next/link";
import { cx } from "@/lib/cx";

// 탭이 많아 화면보다 넓으면 줄바꿈 대신 옆으로 넘김. 아래 구분선은 inset 그림자로 그려서
// 가로 스크롤 영역 안에서도 선택된 탭 밑줄이 선 위에 겹쳐 보이게 한다.
export function PageTabs({
  basePath,
  tabs,
  active,
}: {
  basePath: string;
  tabs: { key: string; label: string }[];
  active: string;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-slate-200)] [scrollbar-width:none]">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key === tabs[0].key ? basePath : `${basePath}?tab=${t.key}`}
          aria-current={active === t.key ? "page" : undefined}
          className={cx(
            "shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
            active === t.key
              ? "border-brand-navy text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
