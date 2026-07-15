"use client";

import React, { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { api } from "@/app/utils/api";
import type { LedgerTarget } from "../../../components/BankAccountLedgerModal";

interface MobileBankAccountsPanelProps {
  group: any;
  onClose: () => void;
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
  onOpenLedger: (target: LedgerTarget) => void;
  onGroupDeleted: () => void;
}

export default function MobileBankAccountsPanel({
  group,
  onClose,
  showToastNotification,
  fetchData,
  onOpenLedger,
  onGroupDeleted
}: MobileBankAccountsPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [editBankAccountName, setEditBankAccountName] = useState(group.name);
  const [editPortalBalanceAdjustment, setEditPortalBalanceAdjustment] = useState<string>("");
  const [editPortalOnline, setEditPortalOnline] = useState(!!group.show_in_online_payment);

  const [bAccLabel, setBAccLabel] = useState("");
  const [bBankName, setBBankName] = useState("");
  const [bAccNo, setBAccNo] = useState("");
  const [bIfsc, setBIfsc] = useState("");
  const [newAccOnline, setNewAccOnline] = useState(false);
  const [addingBank, setAddingBank] = useState(false);

  const handleSaveBankAccountEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const adjustVal = parseFloat(editPortalBalanceAdjustment || "0");
    setSubmitting(true);
    try {
      const payload: any = {
        name: editBankAccountName,
        show_in_online_payment: editPortalOnline
      };
      if (adjustVal > 0) {
        payload.opening_to_take = adjustVal;
      } else if (adjustVal < 0) {
        payload.opening_to_give = Math.abs(adjustVal);
      }

      await api.updatePortal(group.id, payload);
      showToastNotification(`Portal "${editBankAccountName}" updated`);
      onClose();
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePortal = async () => {
    if (!confirm(`Delete portal "${group.name}"? This will delete all associated bank accounts.`)) return;
    try {
      await api.deletePortal(group.id);
      showToastNotification(`Portal "${group.name}" deleted`);
      onGroupDeleted();
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    }
  };

  const handleAddBankAccount = async () => {
    if (!bAccLabel) {
      showToastNotification("Account label is required");
      return;
    }
    setAddingBank(true);
    try {
      await api.createBankAccount({
        portal_id: group.id,
        bank_account_name: bAccLabel,
        bank_name: bBankName,
        bank_account_no: bAccNo,
        ifsc_code: bIfsc,
        show_in_online_payment: newAccOnline
      });
      showToastNotification(`Account "${bAccLabel}" registered`);
      setBAccLabel(""); setBBankName(""); setBAccNo(""); setBIfsc("");
      setNewAccOnline(false);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setAddingBank(false);
    }
  };

  const handleDeleteBankAccount = async (id: string, name: string) => {
    if (!confirm(`Delete bank account "${name}"?`)) return;
    try {
      await api.deleteBankAccount(id);
      showToastNotification(`Account "${name}" removed`);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[140] flex items-center justify-center p-2">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Manage Portal</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Balance & Ledger Button */}
        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-sm border border-slate-200 dark:border-slate-800 text-[10px] flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Current Balance</span>
            <span className={`font-black text-xs font-mono tabular-nums ${group.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
              {group.balance < 0 ? '-' : ''}₹{Math.abs(group.balance || 0).toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLedger({
                id: group.id,
                bank_account_name: group.name,
                bank_name: "Consolidated Group Wallet",
                bank_account_no: "All Connected Banks",
                ifsc_code: "",
                isGroupLedger: true
              });
            }}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-bold rounded-sm cursor-pointer"
          >
            Ledger
          </button>
        </div>

        <form onSubmit={handleSaveBankAccountEdit} className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="space-y-2">
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Portal Name</label>
              <input autoComplete="one-time-code"
                type="text"
                value={editBankAccountName}
                onChange={(e) => setEditBankAccountName(e.target.value)}
                placeholder="Portal Name"
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">Adjust Balance (₹)</label>
              <input autoComplete="one-time-code"
                type="number"
                inputMode="decimal"
                placeholder="e.g. +1000 to add, -1000 to subtract"
                value={editPortalBalanceAdjustment}
                onChange={(e) => setEditPortalBalanceAdjustment(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
              />
            </div>
            <div className="flex items-center gap-1.5 py-0.5">
              <input
                type="checkbox"
                id="editGroupOnlineMobile"
                checked={editPortalOnline}
                onChange={(e) => setEditPortalOnline(e.target.checked)}
                className="w-3.5 h-3.5 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-200 dark:border-slate-800 dark:bg-slate-950 cursor-pointer"
              />
              <label htmlFor="editGroupOnlineMobile" className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                Online
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
            >
              {submitting ? "Saving..." : "Save Settings"}
            </button>
            <button
              type="button"
              onClick={handleDeletePortal}
              className="px-3 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-sm text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Delete Group
            </button>
          </div>
        </form>

        {/* Active Bank Accounts section */}
        <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Registered Banks ({(group.bankAccounts || []).length})</h4>
          {group.bankAccounts && group.bankAccounts.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {group.bankAccounts.map((p: any) => (
                <div key={p.id} className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2 rounded-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{p.bank_account_name}</span>
                    <span className="text-[7px] text-slate-400 truncate">{p.bank_name || 'N/A'} • {p.bank_account_no || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-black text-slate-700 dark:text-slate-300 font-mono tabular-nums">₹{Number(p.balance || 0).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLedger({
                          id: p.id,
                          bank_account_name: p.bank_account_name,
                          bank_name: p.bank_name,
                          bank_account_no: p.bank_account_no,
                          ifsc_code: p.ifsc_code,
                          isGroupLedger: false
                        });
                      }}
                      className="px-1 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-bold rounded-sm cursor-pointer"
                    >
                      Ledger
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete bank account "${p.bank_account_name}"?`)) {
                          await handleDeleteBankAccount(p.id, p.bank_account_name);
                        }
                      }}
                      className="p-0.5 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-slate-400 hover:text-red-500 cursor-pointer" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[8px] font-bold text-slate-400 text-center py-2">No bank accounts registered</p>
          )}
        </div>

        {/* Add New Bank Account section */}
        <div className="space-y-2">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Add Bank Account</h4>
          <div className="bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-200 dark:border-slate-800 rounded-sm space-y-2">
            <input autoComplete="one-time-code"
              type="text"
              placeholder="Account Label (e.g. Primary, ICICI)"
              value={bAccLabel}
              onChange={e => setBAccLabel(e.target.value)}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
            />
            <input autoComplete="one-time-code"
              type="text"
              placeholder="Bank Name (e.g. ICICI Bank)"
              value={bBankName}
              onChange={e => setBBankName(e.target.value)}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input autoComplete="one-time-code"
                type="text"
                placeholder="Account Number"
                value={bAccNo}
                onChange={e => setBAccNo(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
              />
              <input autoComplete="one-time-code"
                type="text"
                placeholder="IFSC Code"
                value={bIfsc}
                onChange={e => setBIfsc(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
              />
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!bAccLabel) {
                  alert("Please enter an Account Label");
                  return;
                }
                await handleAddBankAccount();
              }}
              disabled={addingBank}
              className="w-full py-1.5 bg-indigo-600 text-white rounded-sm text-[9px] font-bold uppercase tracking-wider cursor-pointer"
            >
              {addingBank ? "Adding..." : "Register Bank Account"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
