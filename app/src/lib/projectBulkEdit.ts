// 프로젝트 일괄 변경(11/27 사용자 요청 "프로젝트 일괄 적용할 수 있게 체크해 수정 — 체크 시 상태·진행율도") — 프로젝트 목록·보고서
// "발주서 발급 현황"에서 체크한 프로젝트의 발주서 발급(110 SQL)·상태·진행률을 한 번에. 고르지 않은 칸("그대로")은 안 바뀜, 발주액·이름·
// 날짜 등 다른 칸은 여기서 안 바꿈. "타 프로젝트 귀속" 상태는 귀속할 프로젝트를 같이 골라야 해서 일괄 변경에선 뺌(수정 화면에서).
// 검사: projectBulkEdit.test.ts
import { PROJECT_STATUS_MERGED, PROJECT_STATUS_OPTIONS, projectStatusLabel } from "@/lib/projectStatus";
import { poIssuedLabel } from "@/lib/projectPo";

export const PROJECT_BULK_KEEP = "__keep__";
export const PROJECT_BULK_STATUS_OPTIONS = PROJECT_STATUS_OPTIONS.filter((o) => o.value !== PROJECT_STATUS_MERGED);

export type ProjectBulkPatch = { po_issued?: boolean; status?: string; progress_pct?: number };

/** 폼 값 → 바꿀 칸. 빈칸·"그대로"는 건너뜀, 이상한 값은 아무것도 안 바꾸고 이유를 돌려줌. */
export function projectBulkPatchFromForm(get: (key: string) => string | null): { patch: ProjectBulkPatch; error?: string } {
  const patch: ProjectBulkPatch = {};
  const po = get("po_issued");
  if (po === "1") patch.po_issued = true;
  else if (po === "0") patch.po_issued = false;
  else if (po && po !== PROJECT_BULK_KEEP) return { patch: {}, error: "발주서 발급 값이 올바르지 않습니다." };

  const status = get("status");
  if (status && status !== PROJECT_BULK_KEEP) {
    if (!PROJECT_BULK_STATUS_OPTIONS.some((o) => o.value === status)) {
      return { patch: {}, error: "일괄 변경으로 고를 수 없는 상태입니다(타 프로젝트 귀속은 프로젝트 수정 화면에서)." };
    }
    patch.status = status;
  }

  const progressRaw = (get("progress_pct") ?? "").replace(/[%\s]/g, "");
  if (progressRaw && progressRaw !== PROJECT_BULK_KEEP) {
    const n = Number(progressRaw);
    if (!Number.isInteger(n) || n < 0 || n > 100) return { patch: {}, error: "진행률은 0~100 사이 정수로 적어 주세요." };
    patch.progress_pct = n;
  }
  return { patch };
}

export function projectBulkFieldCount(patch: ProjectBulkPatch) {
  return Object.keys(patch).length;
}

/** 바꾸기 전 확인창 글 — 바꿀 칸을 한 줄씩 */
export function projectBulkConfirmText(count: number, patch: ProjectBulkPatch): string {
  const lines = [`선택한 ${count}개 프로젝트를 이렇게 바꿀까요?`];
  if (patch.po_issued !== undefined) lines.push(`· 발주서 → ${poIssuedLabel(patch.po_issued)}`);
  if (patch.status !== undefined) lines.push(`· 상태 → ${projectStatusLabel(patch.status)}`);
  if (patch.progress_pct !== undefined) lines.push(`· 진행률 → ${patch.progress_pct}%`);
  lines.push("발주액·이름·날짜 등 다른 칸은 그대로예요.");
  return lines.join("\n");
}
