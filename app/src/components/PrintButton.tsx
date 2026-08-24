"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" className="print:hidden" onClick={() => window.print()}>
      인쇄
    </Button>
  );
}
