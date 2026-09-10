"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { BankTransactionForm } from "@/components/BankTransactionForm";
import { BankTransferForm } from "@/components/BankTransferForm";
import { cx } from "@/lib/cx";

export function BankEntryPopup({
  accounts,
  clients,
  nameSuggestions,
}: {
  accounts: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  nameSuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"entry" | "transfer">("entry");
  useEscapeKey(open, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
      >
        + 거래 등록
      </button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10"
            onClick={() => setOpen(false)}
          >
            <div className="w-full max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 rounded-lg border border-slate-300 p-0.5 text-sm">
                  <button
                    type="button"
                    onClick={() => setTab("entry")}
                    className={cx("rounded px-3 py-1.5", tab === "entry" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
                  >
                    거래내역 등록
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("transfer")}
                    className={cx("rounded px-3 py-1.5", tab === "transfer" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
                  >
                    계좌 간 이체
                  </button>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
                  닫기
                </button>
              </div>

              {tab === "entry" ? (
                <BankTransactionForm accounts={accounts} clients={clients} nameSuggestions={nameSuggestions} />
              ) : (
                <BankTransferForm accounts={accounts} />
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
