import Link from "next/link";

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
    <div className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key === tabs[0].key ? basePath : `${basePath}?tab=${t.key}`}
          className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium ${
            active === t.key
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
