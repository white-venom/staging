"use client";

import React, { useState, useEffect } from "react";
import { X, Globe, CreditCard, Edit, Trash2, Plus } from "lucide-react";
import { api } from "../../../utils/api";
import type { LedgerTarget } from "../../../components/BankAccountLedgerModal";

interface BankAccountsPanelProps {
  group: any;
  onClose: () => void;
  showToastNotification: (msg: string) => void;
  fetchData?: () => void;
  onOpenLedger: (target: LedgerTarget) => void;
  onGroupDeleted: () => void;
}

export default function BankAccountsPanel({
  group,
  onClose,
  showToastNotification,
  fetchData,
  onOpenLedger,
  onGroupDeleted
}: BankAccountsPanelProps) {
  const [accounts, setAccounts] = useState<any[]>([]);

  const [editingPortalName, setEditingPortalName] = useState(group.name);
  const [editingPortalBalanceAdjustment, setEditingPortalBalanceAdjustment] = useState<string>("");
  const [editPortalOnline, setEditPortalOnline] = useState(!!group.show_in_online_payment);

  const [newAccName, setNewAccName] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [newAccNo, setNewAccNo] = useState("");
  const [newAccIfsc, setNewAccIfsc] = useState("");
  const [newAccOnline, setNewAccOnline] = useState(false);
  const [isCreatingAcc, setIsCreatingAcc] = useState(false);

  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState("");
  const [editAccBank, setEditAccBank] = useState("");
  const [editAccNo, setEditAccNo] = useState("");
  const [editAccIfsc, setEditAccIfsc] = useState("");
  const [editAccOnline, setEditAccOnline] = useState(false);

  useEffect(() => {
    fetchAccounts(group.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const fetchAccounts = async (groupId: string) => {
    try {
      const data = await api.getPortalAccounts(groupId);
      setAccounts(data);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    }
  };

  const handleCreateAccountModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !newAccName) return;

    setIsCreatingAcc(true);
    try {
      await api.createBankAccount({
        portal_id: group.id,
        bank_account_name: newAccName,
        bank_name: newAccBank,
        bank_account_no: newAccNo,
        ifsc_code: newAccIfsc,
        show_in_online_payment: newAccOnline
      });
      showToastNotification(`Account "${newAccName}" added to ${group.name}`);
      setNewAccName("");
      setNewAccBank("");
      setNewAccNo("");
      setNewAccIfsc("");
      setNewAccOnline(false);
      fetchAccounts(group.id);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to add account: " + err.message);
    } finally {
      setIsCreatingAcc(false);
    }
  };

  const handleDeletePortal = async () => {
    if (!confirm(`Are you sure you want to delete "${group.name}"? This will remove all associated bank accounts.`)) return;
    try {
      await api.deletePortal(group.id);
      showToastNotification(`Portal "${group.name}" deleted.`);
      onGroupDeleted();
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to delete portal: " + err.message);
    }
  };

  const handleUpdatePortal = async () => {
    if (!group.id || !editingPortalName) return;
    const adjustVal = parseFloat(editingPortalBalanceAdjustment || "0");

    try {
      const payload: any = {
        name: editingPortalName,
        show_in_online_payment: editPortalOnline
      };
      if (adjustVal > 0) {
        payload.opening_to_take = adjustVal;
      } else if (adjustVal < 0) {
        payload.opening_to_give = Math.abs(adjustVal);
      }
      await api.updatePortal(group.id, payload);
      showToastNotification(`Portal "${editingPortalName}" updated.`);
      onClose();
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update portal: " + err.message);
    }
  };

  const handleDeleteAccount = async (accId: string, name: string) => {
    if (!confirm(`Delete bank account "${name}"?`)) return;
    try {
      await api.deleteBankAccount(accId);
      showToastNotification(`Account "${name}" removed.`);
      fetchAccounts(group.id);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to delete account: " + err.message);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccId || !group) return;
    try {
      await api.updateBankAccount(editingAccId, {
        bank_account_name: editAccName,
        bank_name: editAccBank,
        bank_account_no: editAccNo,
        ifsc_code: editAccIfsc,
        portal_id: group.id,
        show_in_online_payment: editAccOnline
      });
      showToastNotification(`Account "${editAccName}" updated.`);
      setEditingAccId(null);
      setEditAccOnline(false);
      fetchAccounts(group.id);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update account: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-md p-6 space-y-6 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:border-slate-100">
              Bank Accounts
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
              Portal: {group.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Portal Settings Section */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-black text-indigo-500 tracking-wide flex items-center gap-2">
              <Globe className="w-3 h-3" /> Portal Settings
            </span>
            <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-sm space-y-4">
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-black mb-1">Portal Name</label>
                <input autoComplete="one-time-code"
                  type="text"
                  value={editingPortalName}
                  onChange={e => setEditingPortalName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold focus:outline-none"
                />
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-sm border border-slate-100 dark:border-slate-800 text-[11px] mb-2 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block mb-0.5">Current Balance</span>
                  <span className={`font-black font-mono tabular-nums ${group.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
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
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[9px] font-bold rounded cursor-pointer"
                >
                  Ledger
                </button>
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-500 uppercase font-black mb-1">Adjust Balance (₹)</label>
                <input autoComplete="one-time-code"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. +1000 to add, -1000 to subtract"
                  value={editingPortalBalanceAdjustment}
                  onChange={e => setEditingPortalBalanceAdjustment(e.target.value)}
                  onFocus={e => {
                    if (Number(e.target.value) === 0) setEditingPortalBalanceAdjustment("");
                    e.target.select();
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
                />
              </div>
              <div className="flex items-center gap-2 px-1 py-1">
                <input
                  type="checkbox"
                  id="editPortalOnline"
                  checked={editPortalOnline}
                  onChange={(e) => setEditPortalOnline(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-200 dark:border-slate-800 dark:bg-slate-950 cursor-pointer"
                />
                <label htmlFor="editPortalOnline" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                  Online
                </label>
              </div>
              <button
                onClick={handleUpdatePortal}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-sm text-[10px] font-black uppercase tracking-wider cursor-pointer"
              >
                Save Portal Settings
              </button>
              <button
                type="button"
                onClick={handleDeletePortal}
                className="w-full mt-2 py-2 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/10 text-red-600 rounded-sm text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
              >
                Delete Portal
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide flex items-center gap-2">
              <CreditCard className="w-3 h-3" /> Active Bank Accounts
            </span>
            {accounts.length > 0 ? (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div key={acc.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm group">
                    <div className="flex items-center justify-between mb-2">
                      {editingAccId === acc.id ? (
                        <input autoComplete="one-time-code"
                          value={editAccName}
                          onChange={(e) => setEditAccName(e.target.value)}
                          className="text-xs font-black bg-white dark:bg-slate-800 border rounded px-2 py-0.5 outline-none"
                        />
                      ) : (
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          {acc.bank_account_name}
                        </p>
                      )}
                      <div className="flex items-center gap-1">
                        {editingAccId === acc.id ? (
                          <button onClick={handleUpdateAccount} className="text-[9px] text-blue-600 font-bold mr-2">SAVE</button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingAccId(acc.id);
                              setEditAccName(acc.bank_account_name);
                              setEditAccBank(acc.bank_name || "");
                              setEditAccNo(acc.bank_account_no || "");
                              setEditAccIfsc(acc.ifsc_code || "");
                              setEditAccOnline(!!acc.show_in_online_payment);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAccount(acc.id, acc.bank_account_name)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {editingAccId === acc.id ? (
                      <div className="space-y-2 mt-2">
                        <input autoComplete="one-time-code"
                          placeholder="Bank"
                          value={editAccBank}
                          onChange={(e) => setEditAccBank(e.target.value)}
                          className="w-full text-[10px] bg-white dark:bg-slate-800 border rounded px-2 py-1 outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input autoComplete="one-time-code"
                            placeholder="A/C No"
                            value={editAccNo}
                            onChange={(e) => setEditAccNo(e.target.value)}
                            className="w-full text-[10px] bg-white dark:bg-slate-800 border rounded px-2 py-1 outline-none"
                          />
                          <input autoComplete="one-time-code"
                            placeholder="IFSC"
                            value={editAccIfsc}
                            onChange={(e) => setEditAccIfsc(e.target.value)}
                            className="w-full text-[10px] bg-white dark:bg-slate-800 border rounded px-2 py-1 outline-none"
                          />
                        </div>
                        <button onClick={() => setEditingAccId(null)} className="text-[9px] text-slate-400 font-bold block w-full text-center">Cancel</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-1.5 text-[10px]">
                        <div className="text-slate-400">Bank</div>
                        <div className="text-slate-700 dark:text-slate-300 font-bold">{acc.bank_name || "N/A"}</div>
                        <div className="text-slate-400">A/C No</div>
                        <div className="text-slate-700 dark:text-slate-300 font-bold">{acc.bank_account_no || "N/A"}</div>
                        <div className="text-slate-400">IFSC</div>
                        <div className="text-slate-700 dark:text-slate-300 font-bold">{acc.ifsc_code || "N/A"}</div>
                        <div className="text-slate-400 font-bold text-indigo-600 dark:text-indigo-400">Balance</div>
                        <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-black">
                           <span className="font-mono tabular-nums">₹{Number(acc.balance || 0).toLocaleString()}</span>
                           <button
                             type="button"
                             onClick={() => {
                               onClose();
                               onOpenLedger({
                                 id: acc.id,
                                 bank_account_name: acc.bank_account_name,
                                 bank_name: acc.bank_name,
                                 bank_account_no: acc.bank_account_no,
                                 ifsc_code: acc.ifsc_code,
                                 isGroupLedger: false
                               });
                             }}
                             className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-bold rounded cursor-pointer"
                           >
                             Ledger
                           </button>
                         </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-sm">
                <p className="text-[10px] text-slate-400 font-bold">No accounts registered for this portal</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide block mb-3">Add New Bank Account</span>
            <form onSubmit={handleCreateAccountModal} className="space-y-3">
              <input autoComplete="one-time-code"
                type="text"
                placeholder="Account Label (e.g. Primary, ICICI Main)"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input autoComplete="one-time-code"
                  type="text"
                  placeholder="Bank Name"
                  value={newAccBank}
                  onChange={(e) => setNewAccBank(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none"
                />
                <input autoComplete="one-time-code"
                  type="text"
                  placeholder="Account No"
                  value={newAccNo}
                  onChange={(e) => setNewAccNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none"
                />
              </div>
              <input autoComplete="one-time-code"
                type="text"
                placeholder="IFSC Code"
                value={newAccIfsc}
                onChange={(e) => setNewAccIfsc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none"
              />
              <button
                type="submit"
                disabled={isCreatingAcc}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> {isCreatingAcc ? "Adding..." : "Register Bank Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
