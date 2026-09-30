"use client";

import { useState, type ComponentProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cx } from "@/lib/cx";
import { ToolChecklistDetailReport } from "@/components/ToolChecklistDetailReport";
import { ToolChecklistCreateForm } from "@/components/ToolChecklistCreateForm";

type ReportProps = Omit<ComponentProps<typeof ToolChecklistDetailReport>, "onEdit">;
type FormProps = Omit<ComponentProps<typeof ToolChecklistCreateForm>, "onSaved" | "onCancel" | "hasSource">;

// 저장된 공구명세서 팝업 — 보기(인쇄·엑셀)와 수정을 한 팝업에서(사용자 요청 "팝업에서 바로 수정").
// "수정"을 누르면 같은 팝업이 입력 화면으로 바뀌고, 저장하면 고친 내용으로 다시 보기 화면이 됨. 예전엔 팝업을 닫고
// 페이지 위 "공구명세서 수정" 칸으로 이동했음. 빈 양식(폼 인쇄)은 form 없이 보기만.
export function ToolChecklistPopup({
  report,
  form,
  startEditing = false,
}: {
  report: ReportProps;
  form?: FormProps;
  /** 이력 표의 "수정"(?edit=1)으로 열었을 때 — 처음부터 수정 화면으로. */
  startEditing?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(Boolean(form) && startEditing);

  // 수정을 마치거나 취소하면 보기 화면으로 — ?edit=1(또는 예전 ?editFrom=id)로 열었으면 주소에서 빼서, 새로고침해도
  // 다시 수정 화면이 뜨지 않게.
  function backToView() {
    setEditing(false);
    const legacyId = searchParams.get("editFrom");
    if (!searchParams.has("edit") && !legacyId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("editFrom");
    if (legacyId) params.set("checklist", legacyId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 print:static print:overflow-visible print:bg-transparent print:p-0">
      <div
        className={cx(
          "w-full rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none",
          // 수정 화면은 공구 칸이 많아서 넓게, 보기(인쇄 미리보기)는 A4 폭 그대로
          editing ? "max-w-5xl max-md:p-3" : "max-w-[210mm]"
        )}
      >
        {editing && form ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">공구명세서 수정</h2>
            <ToolChecklistCreateForm {...form} hasSource onSaved={backToView} onCancel={backToView} />
          </div>
        ) : (
          <ToolChecklistDetailReport {...report} onEdit={form ? () => setEditing(true) : undefined} />
        )}
      </div>
    </div>
  );
}
