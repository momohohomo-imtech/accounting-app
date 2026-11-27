"use client";

import type { ComponentProps } from "react";
import { EntityTable } from "@/components/crud/EntityTable";
import { ProjectBulkEditBar } from "@/components/ProjectBulkEditBar";

// 프로젝트 목록 표(11/27) — EntityTable에 체크칸 + 프로젝트 일괄 변경 칸(발주서·상태·진행률)을 붙임. 체크칸은 관리자·직원만(canEdit —
// 조회 전용은 표만). 서버 화면에서는 함수(일괄 변경 칸 그리기)를 넘길 수 없어서 이 작은 클라이언트 부품을 거침.
export function ProjectListTable({
  canEdit,
  poReady,
  ...tableProps
}: Omit<ComponentProps<typeof EntityTable>, "selectable"> & { canEdit: boolean; poReady: boolean }) {
  return (
    <EntityTable
      {...tableProps}
      selectable={
        canEdit
          ? {
              noun: "프로젝트",
              renderBar: (ids, clear) => <ProjectBulkEditBar ids={ids} poReady={poReady} onDone={clear} onClear={clear} />,
            }
          : undefined
      }
    />
  );
}
