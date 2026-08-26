"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { AccessListExportButton } from "@/components/AccessListExportButton";

type Member = { name: string; phone: string | null; nationality: string | null; birthDate: string | null };

export function AccessListCard({
  id,
  companyName,
  siteName,
  supervisorName,
  accessPeriod,
  createdAt,
  members,
  deleteAction,
}: {
  id: string;
  companyName: string;
  siteName: string | null;
  supervisorName: string | null;
  accessPeriod: string | null;
  createdAt: string;
  members: Member[];
  deleteAction: (formData: FormData) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{companyName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {siteName ?? "현장 미지정"} · {supervisorName ?? "감독관 미지정"} · {accessPeriod ?? "기간 미지정"} · 생성일{" "}
            {formatDate(createdAt)}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            인원 {members.length}명: {members.map((m) => m.name).join(", ") || "-"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AccessListExportButton
            companyName={companyName}
            accessPeriod={accessPeriod ?? ""}
            supervisorName={supervisorName ?? ""}
            members={members}
          />
          {confirming ? (
            <form action={deleteAction} className="flex items-center gap-1">
              <input type="hidden" name="id" value={id} />
              <span className="text-xs font-medium text-red-600">정말 삭제?</span>
              <button
                type="submit"
                className="rounded-lg border border-red-300 bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700"
              >
                확인
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
