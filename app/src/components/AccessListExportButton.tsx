"use client";

import { downloadAccessListXlsx } from "@/lib/xlsxExport";
import { Button } from "@/components/ui/Button";

type Member = { name: string; birthDate: string | null; phone: string | null; nationality: string | null; note?: string };

function toYymmdd(date: string | null) {
  if (!date) return "";
  return date.replace(/-/g, "").slice(2);
}

export function AccessListExportButton({
  companyName,
  accessPeriod,
  supervisorName,
  members,
}: {
  companyName: string;
  accessPeriod: string;
  supervisorName: string;
  members: Member[];
}) {
  async function handleExport() {
    // 파일명에 못 쓰는 문자(/ 등)가 출입기간에 섞여 있을 수 있어 "-"로 바꿔줌.
    const safePeriod = accessPeriod.trim().replace(/[/\\]/g, "-");
    const filename = safePeriod ? `${companyName}_출입명단_${safePeriod}.xlsx` : `${companyName}_출입명단.xlsx`;
    await downloadAccessListXlsx(
      filename,
      { companyName, accessPeriod, supervisorName },
      members.map((m) => ({
        name: m.name,
        birthDate: toYymmdd(m.birthDate),
        phone: m.phone ?? "",
        nationality: m.nationality ?? "",
        note: m.note ?? "",
      }))
    );
  }

  return (
    <Button variant="secondary" size="xs" onClick={handleExport}>
      엑셀 다운로드
    </Button>
  );
}
