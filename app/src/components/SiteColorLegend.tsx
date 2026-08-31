"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSiteColor, autoSiteColorHex } from "@/lib/siteColor";
import { updateSiteColor } from "@/lib/actions/sites";
import { Button } from "@/components/ui/Button";

type SiteWithColor = { id: string; name: string; color: string | null };

function SiteRow({ site }: { site: SiteWithColor }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(resolveSiteColor(site.id, site.color));
  const [pending, setPending] = useState(false);

  async function save(color: string | null) {
    setPending(true);
    const fd = new FormData();
    fd.append("id", site.id);
    fd.append("color", color ?? "");
    await updateSiteColor(fd);
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <span
        className="h-5 w-5 shrink-0 rounded-full border border-slate-200"
        style={{ backgroundColor: resolveSiteColor(site.id, site.color) }}
      />
      <span className="flex-1 truncate text-sm text-slate-700">{site.name}</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-slate-300 p-0.5"
          />
          <Button type="button" size="xs" disabled={pending} onClick={() => save(draft)}>
            저장
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            disabled={pending}
            onClick={() => {
              setDraft(autoSiteColorHex(site.id));
              save(null);
            }}
          >
            기본값으로
          </Button>
          <Button type="button" variant="secondary" size="xs" disabled={pending} onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(true)}>
          수정
        </Button>
      )}
    </div>
  );
}

export function SiteColorLegend({ sites }: { sites: SiteWithColor[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <h2 className="mb-1 font-semibold text-slate-900">현장별 색상</h2>
      <p className="mb-3 text-xs text-slate-400">
        현장마다 자동으로 고유색이 배정돼요. 특정 현장 색을 바꾸고 싶으면 &quot;수정&quot;을 눌러 직접 지정하세요.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((s) => (
          <SiteRow key={s.id} site={s} />
        ))}
        {sites.length === 0 && <p className="text-sm text-slate-400">등록된 현장이 없습니다.</p>}
      </div>
    </div>
  );
}
