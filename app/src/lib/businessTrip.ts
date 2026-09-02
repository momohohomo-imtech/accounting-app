import type { BusinessTripLog } from "@/lib/types";

export const WORK_TYPE_OPTIONS = ["제작", "설치", "긴급", "기타"];

// 직접 입력한 값이 있으면 그걸 쓰고, 없으면 프로젝트별 공사일 중 서로 다른 날짜 수로 계산.
export function tripDayCount(log: BusinessTripLog): number {
  if (log.day_count != null) return log.day_count;
  return new Set(log.projects.map((p) => p.work_date)).size;
}

// "폼인쇄" 빈 양식에 미리 그려둘 줄 수.
export const BLANK_WORKER_ROWS = 15;
export const BLANK_EQUIPMENT_ROWS = 5;
export const BLANK_EXPENSE_ROWS = 8;
