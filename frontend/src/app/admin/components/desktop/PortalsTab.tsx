"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, Globe, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAdmin } from "../../context/AdminContext";
import BankAccountsPanel from "./BankAccountsPanel";
import BankAccountLedgerModal, { type LedgerTarget } from "../../../components/BankAccountLedgerModal";

interface PortalsTabProps {
  portalDirectory: any[]; // Portals, each carrying its own bank_accounts
  showToastNotification: (msg: string) => void;
  setShowPortalDrawer: (val: boolean) => void;
  fetchData?: () => void;
  // Set when this tab is rendered from /admin/bankAccounts/[id]/ledger so a
  // page refresh re-opens the same portal ledger instead of the bare list.
  initialPortalLedgerId?: string;
}

export default function PortalsTab({
  portalDirectory,
  showToastNotification,
  setShowPortalDrawer,
  fetchData,
  initialPortalLedgerId
}: PortalsTabProps) {
  const router = useRouter();
  const { retailerDirectory, userDirectory } = useAdmin();
  const [portalSearch, setPortalSearch] = useState("");
  const [selectedPortal, setSelectedPortal] = useState<any | null>(null);
  const [isAccountsPanelOpen, setIsAccountsPanelOpen] = useState(false);
  const [filterOnline, setFilterOnline] = useState<"all" | "online">("all");
  const [ledgerTarget, setLedgerTarget] = useState<LedgerTarget | null>(null);

  const openGroupLedger = (group: any, opts?: { skipNav?: boolean }) => {
    setLedgerTarget({
      id: group.id,
      bank_account_name: group.name,
      bank_name: "Consolidated Group Wallet",
      bank_account_no: "All Connected Banks",
      ifsc_code: "",
      isGroupLedger: true
    });
    if (!opts?.skipNav) {
      router.push(`/admin/bankAccounts/${group.id}/ledger`);
    }
  };

  // Re-open the right portal ledger when this tab is reached directly at
  // /admin/bankAccounts/[id]/ledger (a fresh load or a page refresh).
  useEffect(() => {
    if (!initialPortalLedgerId || ledgerTarget) return;
    const match = portalDirectory.find((p) => p.id === initialPortalLedgerId);
    if (match) {
      openGroupLedger(match, { skipNav: true });
    }
  }, [initialPortalLedgerId, portalDirectory]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input autoComplete="one-time-code"
            type="text"
            placeholder="Search Portals (e.g. RevaPay)..."
            value={portalSearch}
            onChange={(e) => setPortalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
          />
        </div>

        <button
          onClick={() => setShowPortalDrawer(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold rounded-sm flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" /> Register Portal
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
        <button
          type="button"
          onClick={() => setFilterOnline("all")}
          className={`px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-wider shrink-0 transition-colors ${
            filterOnline === "all"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 cursor-pointer"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterOnline("online")}
          className={`px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-wider shrink-0 transition-colors border ${
            filterOnline === "online"
              ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-950"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 cursor-pointer"
          }`}
        >
          Online Only
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {portalDirectory
          .filter(p => (p.name || "").toLowerCase().includes(portalSearch.toLowerCase()))
          .filter(group => filterOnline === "all" || group.show_in_online_payment === true)
          .map((group) => (
            <div
              key={group.id}
              onClick={() => openGroupLedger(group)}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-sm">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      {group.name}
                      {group.show_in_online_payment && (
                        <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[7px] font-black rounded-sm uppercase">Online</span>
                      )}
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{(group.bankAccounts || []).length} Accounts</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Portal Balance</span>
                    <span className={`text-xs font-black font-mono tabular-nums ${group.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                      {group.balance < 0 ? '-' : ''}₹{Math.abs(group.balance || 0).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPortal(group);
                      setIsAccountsPanelOpen(true);
                    }}
                    className="p-2 rounded-sm bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {portalDirectory.length === 0 && (
        <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-sm border border-slate-200 border-dashed dark:border-slate-800">
          <Globe className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">No Portals Found</p>
          <p className="text-[10px] text-slate-400 mt-1">Register a portal first.</p>
        </div>
      )}

      {isAccountsPanelOpen && selectedPortal && (
        <BankAccountsPanel
          group={selectedPortal}
          onClose={() => {
            setIsAccountsPanelOpen(false);
            setSelectedPortal(null);
          }}
          showToastNotification={showToastNotification}
          fetchData={fetchData}
          onOpenLedger={setLedgerTarget}
          onGroupDeleted={() => {
            setIsAccountsPanelOpen(false);
            setSelectedPortal(null);
          }}
        />
      )}

      <BankAccountLedgerModal
        target={ledgerTarget}
        onClose={() => {
          setLedgerTarget(null);
          if (initialPortalLedgerId) router.push("/admin/bankAccounts");
        }}
        portalDirectory={portalDirectory}
        retailerDirectory={retailerDirectory}
        userDirectory={userDirectory}
        showToastNotification={showToastNotification}
        fetchData={fetchData}
      />
    </div>
  );
}
