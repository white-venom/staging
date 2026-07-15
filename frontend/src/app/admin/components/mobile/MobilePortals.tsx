"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Globe,
  X,
  ArrowLeft,
  Edit
} from "lucide-react";
import { api } from "@/app/utils/api";
import Link from "next/link";
import { useAdmin } from "../../context/AdminContext";
import BankAccountLedgerModal, { type LedgerTarget } from "../../../components/BankAccountLedgerModal";
import MobileBankAccountsPanel from "./MobileBankAccountsPanel";

interface MobilePortalsProps {
  portalDirectory: any[];
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function MobilePortals({
  portalDirectory,
  showToastNotification,
  fetchData
}: MobilePortalsProps) {
  const { retailerDirectory, userDirectory } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterOnline, setFilterOnline] = useState<"all" | "online">("all");

  const [ledgerTarget, setLedgerTarget] = useState<LedgerTarget | null>(null);

  // Portal form states
  const [pName, setPName] = useState("");
  const [pBalance, setPGroupBalance] = useState("");
  const [pOnline, setPGroupOnline] = useState(false);

  // Portal being managed (accounts panel)
  const [isAccountsPanelOpen, setIsAccountsPanelOpen] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<any | null>(null);

  useEffect(() => {
    if (selectedPortal && portalDirectory) {
      const fresh = portalDirectory.find(g => g.id === selectedPortal.id);
      if (fresh) {
        setSelectedPortal(fresh);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalDirectory]);

  const openGroupLedger = (group: any) => {
    setLedgerTarget({
      id: group.id,
      bank_account_name: group.name,
      bank_name: "Consolidated Group Wallet",
      bank_account_no: "All Connected Banks",
      ifsc_code: "",
      isGroupLedger: true
    });
  };

  const handleStartManageGroup = (group: any) => {
    setSelectedPortal(group);
    setIsAccountsPanelOpen(true);
  };

  const handleCreatePortal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const val = parseFloat(pBalance || "0");
    try {
      await api.createPortal({
        name: pName,
        opening_to_give: val < 0 ? Math.abs(val) : 0,
        opening_to_take: val > 0 ? val : 0,
        show_in_online_payment: pOnline
      });
      showToastNotification(`Portal "${pName}" registered`);
      setPName(""); setPGroupBalance("");
      setPGroupOnline(false);
      setShowAddForm(false);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = portalDirectory
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(p => filterOnline === "all" || p.show_in_online_payment === true);

  return (
    <div className="space-y-2">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm text-slate-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Portals</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{portalDirectory.length} Portals Active</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className={`w-8 h-8 rounded-sm flex items-center justify-center transition-colors ${showAddForm ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-indigo-600 text-white'}`}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Add Portal Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3 space-y-2">
          <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider border-l-2 border-indigo-500 pl-1.5">New Portal</p>
          <form onSubmit={handleCreatePortal} className="space-y-2">
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Portal Name</label>
              <input autoComplete="one-time-code"
                type="text"
                value={pName}
                onChange={e => setPName(e.target.value)}
                placeholder="e.g. Paytm, PhonePe, Bank Portal"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
                required
              />
            </div>
            <div>
               <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Opening Balance (₹)</label>
               <input autoComplete="one-time-code"
                 type="number"
                 inputMode="decimal"
                 step="any"
                 value={pBalance}
                 onChange={e => setPGroupBalance(e.target.value)}
                 placeholder="e.g. 5000 (negative for To Give)"
                 className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
               />
             </div>
             <div className="flex items-center gap-1.5 py-0.5">
                <input
                  type="checkbox"
                  id="pGroupOnlineMobile"
                  checked={pOnline}
                  onChange={(e) => setPGroupOnline(e.target.checked)}
                  className="w-3.5 h-3.5 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-200 dark:border-slate-800 dark:bg-slate-950 cursor-pointer"
                />
                <label htmlFor="pGroupOnlineMobile" className="text-[9px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                  Online
                </label>
              </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-indigo-600 text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Registering..." : "Register Portal"}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="px-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input autoComplete="one-time-code"
            type="text"
            placeholder="Search portals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm py-1.5 pl-9 pr-3 text-xs font-medium focus:border-slate-500 dark:focus:border-slate-400"
          />
        </div>
      </div>
      {/* Category Tabs */}
      <div className="px-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full shrink-0">
        <button
          type="button"
          onClick={() => setFilterOnline("all")}
          className={`px-3 py-1 rounded-sm text-[9px] font-black uppercase tracking-wider shrink-0 transition-colors ${
            filterOnline === "all"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-black"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 cursor-pointer"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterOnline("online")}
          className={`px-3 py-1 rounded-sm text-[9px] font-black uppercase tracking-wider shrink-0 transition-colors border ${
            filterOnline === "online"
              ? "bg-indigo-600 border-indigo-600 text-white font-black"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 cursor-pointer"
          }`}
        >
          Online Only
        </button>
      </div>

      {/* Portal Cards */}
      <div className="divide-y divide-slate-100 dark:divide-slate-850 pb-20">
        {filtered.length === 0 ? (
          <div className="py-8 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-sm flex items-center justify-center mx-auto mb-2 opacity-50">
              <Globe className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No portals found</p>
          </div>
        ) : (
          filtered.map((group) => {
            return (
              <div
                key={group.id}
                onClick={() => openGroupLedger(group)}
                className="bg-white dark:bg-slate-900 py-3 px-3 border-b border-slate-50 dark:border-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Globe className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate uppercase tracking-tight">{group.name}</span>
                      {group.show_in_online_payment && (
                        <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-sm text-[8px] font-bold uppercase tracking-wider scale-90 origin-left">Online</span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">{(group.bankAccounts || []).length} Accounts</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className={`font-black text-xs font-mono tabular-nums ${group.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                      {group.balance < 0 ? '-' : ''}₹{Math.round(Math.abs(group.balance || 0)).toLocaleString()}
                    </span>
                    <span className="text-[7px] font-bold text-slate-400 uppercase block tracking-tighter mt-0.5">Net Balance</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartManageGroup(group);
                    }}
                    className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border border-slate-100 dark:border-slate-800 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isAccountsPanelOpen && selectedPortal && (
        <MobileBankAccountsPanel
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
        onClose={() => setLedgerTarget(null)}
        portalDirectory={portalDirectory}
        retailerDirectory={retailerDirectory}
        userDirectory={userDirectory}
        showToastNotification={showToastNotification}
        fetchData={fetchData}
      />
    </div>
  );
}
