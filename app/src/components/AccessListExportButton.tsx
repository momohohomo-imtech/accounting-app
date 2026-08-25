"use client";

import { downloadAccessListXlsx } from "@/lib/xlsxExport";
import { Button } from "@/components/ui/Button";

type Member = { name: string; birthDate: string | null; phone: string | null; nationality: string | null };

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
    await downloadAccessListXlsx(
      `${companyName}_출입명단.xlsx`,
      { companyName, accessPeriod, supervisorName },
      members.map((m) => ({
        name: m.name,
        birthDate: toYymmdd(m.birthDate),
        phone: m.phone ?? "",
        nationality: m.nationality ?? "",
        note: "",
      }))
    );
  }

  return (
    <Button variant="secondary" size="xs" onClick={handleExport}>
      엑셀 다운로드
    </Button>
  );
}
