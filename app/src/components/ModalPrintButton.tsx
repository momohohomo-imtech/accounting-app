"use client";

import { Button } from "@/components/ui/Button";

export function ModalPrintButton() {
  function handlePrint() {
    document.documentElement.classList.add("modal-print");
    const cleanup = () => {
      document.documentElement.classList.remove("modal-print");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  return (
    <Button type="button" variant="secondary" size="xs" onClick={handlePrint}>
      인쇄
    </Button>
  );
}
