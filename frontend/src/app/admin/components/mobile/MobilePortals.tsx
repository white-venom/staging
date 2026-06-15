"use client";

import React, { useState } from "react";
import { 
  Search, 
  Plus, 
  Globe, 
  Trash2,
  X,
  ArrowLeft,
  CreditCard,
  Edit,
  ChevronDown
} from "lucide-react";
import { api } from "@/app/utils/api";
import Link from "next/link";
import LedgerReportView from "../../../components/LedgerReportView";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Ledger Report View State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerPortal, setLedgerPortal] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerOutstanding, setLedgerOutstanding] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const handleOpenLedger = async (portal: any) => {
    console.log("handleOpenLedger called for portal in MobilePortals:", portal);
    setLedgerPortal(portal);
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    try {
      const res = await api.getPortalLedger(portal.id);
      console.log("getPortalLedger response in MobilePortals:", res);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      console.error("getPortalLedger failed in MobilePortals:", err);
      showToastNotification("Failed to load ledger: " + err.message);
      setIsLedgerModalOpen(false);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Portal form states
  const [pName, setPName] = useState("");
  const [pGroupBalance, setPGroupBalance] = useState("");

  // Add Bank Account states
  const [selectedGroupIdForNewBank, setSelectedGroupIdForNewBank] = useState<string | null>(null);
  const [bAccLabel, setBAccLabel] = useState("");
  const [bBankName, setBBankName] = useState("");
  const [bAccNo, setBAccNo] = useState("");
  const [bIfsc, setBIfsc] = useState("");
  const [addingBank, setAddingBank] = useState(false);

  // Portal Group Edit state
  const [isEditPortalModalOpen, setIsEditPortalModalOpen] = useState(false);
  const [editingPortalGroup, setEditingPortalGroup] = useState<any | null>(null);
  const [editPortalName, setEditPortalName] = useState("");
  const [editPortalBalanceAdjustment, setEditPortalBalanceAdjustment] = useState<string>("");
  const [pGroupOnline, setPGroupOnline] = useState(false);
  const [editGroupOnline, setEditGroupOnline] = useState(false);
  const [newAccOnline, setNewAccOnline] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleStartEditPortal = (group: any) => {
    setEditingPortalGroup(group);
    setEditPortalName(group.name);
    setEditPortalBalanceAdjustment("");
    setEditGroupOnline(!!group.show_in_online_payment);
    setIsEditPortalModalOpen(true);
  };

  const handleSavePortalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPortalGroup) return;
    const adjustVal = parseFloat(editPortalBalanceAdjustment || "0");
    setSubmitting(true);
    try {
      const payload: any = { 
        name: editPortalName,
        show_in_online_payment: editGroupOnline
      };
      if (adjustVal > 0) {
        payload.opening_to_take = adjustVal;
      } else if (adjustVal < 0) {
        payload.opening_to_give = Math.abs(adjustVal);
      }

      await api.updatePortalGroup(editingPortalGroup.id, payload);
      showToastNotification(`✓ Portal "${editPortalName}" updated`);
      setIsEditPortalModalOpen(false);
      setEditGroupOnline(false);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePortal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const val = parseFloat(pGroupBalance || "0");
    try {
      await api.createPortalGroup({
        name: pName,
        opening_to_give: val < 0 ? Math.abs(val) : 0,
        opening_to_take: val > 0 ? val : 0,
        show_in_online_payment: pGroupOnline
      });
      showToastNotification(`✓ Portal "${pName}" registered`);
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

  const handleDeletePortalGroup = async (id: string, name: string) => {
    if (!confirm(`Delete portal group "${name}"? This will delete all associated bank accounts.`)) return;
    try {
      await api.deletePortalGroup(id);
      showToastNotification(`Portal "${name}" deleted`);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    }
  };

  const handleAddBankAccount = async (groupId: string) => {
    if (!bAccLabel) {
      showToastNotification("Account label is required");
      return;
    }
    setAddingBank(true);
    try {
      await api.createPortal({
        group_id: groupId,
        portal_name: bAccLabel,
        bank_name: bBankName,
        bank_account_no: bAccNo,
        ifsc_code: bIfsc,
        show_in_online_payment: newAccOnline
      });
      showToastNotification(`✓ Account "${bAccLabel}" registered`);
      setBAccLabel(""); setBBankName(""); setBAccNo(""); setBIfsc("");
      setNewAccOnline(false);
      setSelectedGroupIdForNewBank(null);
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
      await api.deletePortal(id);
      showToastNotification(`✓ Account "${name}" removed`);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    }
  };

  const filtered = portalDirectory.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md text-slate-500 active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Portals</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{portalDirectory.length} Groups Active</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(v => !v)}
          className={`w-8 h-8 rounded-lg shadow flex items-center justify-center active:scale-90 transition-transform ${showAddForm ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-none' : 'bg-indigo-600 text-white shadow-indigo-500/30'}`}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Add Portal Group Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg p-3 space-y-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider border-l-2 border-indigo-500 pl-1.5">New Portal Group</p>
          <form onSubmit={handleCreatePortal} className="space-y-2">
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Portal Group Name</label>
              <input autoComplete="one-time-code"
                type="text"
                value={pName}
                onChange={e => setPName(e.target.value)}
                placeholder="e.g. Paytm, PhonePe, Bank Portal"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                required
              />
            </div>
            <div>
               <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Opening Balance (₹)</label>
               <input autoComplete="one-time-code"
                 type="number"
                 step="any"
                 value={pGroupBalance}
                 onChange={e => setPGroupBalance(e.target.value)}
                 placeholder="e.g. 5000 (negative for To Give)"
                 className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
               />
             </div>
             <div className="flex items-center gap-1.5 py-0.5">
                <input 
                  type="checkbox" 
                  id="pGroupOnlineMobile"
                  checked={pGroupOnline} 
                  onChange={(e) => setPGroupOnline(e.target.checked)} 
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-200 dark:border-slate-800 dark:bg-slate-955 cursor-pointer"
                />
                <label htmlFor="pGroupOnlineMobile" className="text-[9px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                  Online
                </label>
              </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-indigo-600 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
            placeholder="Search portal groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium shadow-sm focus:ring-1 focus:ring-purple-500/20"
          />
        </div>
      </div>

      {/* Portal Group Cards */}
      <div className="divide-y divide-slate-100 dark:divide-slate-850 pb-20">
        {filtered.length === 0 ? (
          <div className="py-8 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2 opacity-50">
              <Globe className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No portals found</p>
          </div>
        ) : (
          filtered.map((group) => {
            return (
              <div 
                key={group.id}
                className="bg-white dark:bg-slate-900 py-2 px-2 border-b border-slate-50 dark:border-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-955/20 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-650 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate uppercase tracking-tight flex items-center gap-1.5">
                        {group.name}
                        {group.show_in_online_payment && (
                          <span className="px-1 py-0.2 bg-emerald-500/10 text-emerald-650 dark:text-emerald-500 text-[6px] font-black rounded uppercase shrink-0">Online</span>
                        )}
                      </h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{(group.portals || []).length} Accounts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => handleStartEditPortal(group)}
                      className="p-1 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => handleDeletePortalGroup(group.id, group.name)}
                      className="p-1 bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 rounded hover:bg-red-100 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        console.log("Mobile Ledger clicked for group:", group);
                        if (group.portals && group.portals.length > 0) {
                          handleOpenLedger(group.portals[0]);
                        } else {
                          console.warn("No bank accounts found in group.portals:", group.portals);
                          showToastNotification("No bank account registered for this portal!");
                        }
                      }}
                      className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[9px] font-bold rounded cursor-pointer"
                      title="View Ledger"
                    >
                      Ledger
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Portal Balance</span>
                  <span className={`font-black ${group.balance < 0 ? 'text-red-650 dark:text-red-400' : 'text-emerald-650 dark:text-emerald-500'}`}>
                    {group.balance < 0 ? '-' : ''}₹{Math.abs(group.balance || 0).toLocaleString()}
                  </span>
                </div>

                {/* Sub-portals List */}
                {group.portals && group.portals.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => toggleGroupExpand(group.id)}
                      className="w-full flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 hover:text-indigo-650 transition-colors"
                    >
                      <span>Registered Banks ({group.portals.length})</span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedGroups[group.id] ? "rotate-180 text-indigo-600" : ""}`} />
                    </button>
                    
                    {expandedGroups[group.id] && (
                      <div className="space-y-1 mt-1">
                        {group.portals.map((p: any) => (
                          <div key={p.id} className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center justify-between bg-slate-50 dark:bg-slate-955 p-1 px-1.5 rounded border border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                                {p.portal_name}
                              </span>
                              <span className="text-[7px] text-slate-400 truncate">{p.bank_name || 'N/A'} • {p.bank_account_no || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-black text-slate-700 dark:text-slate-300">₹{Number(p.balance || 0).toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => handleOpenLedger(p)}
                                className="px-1 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-bold rounded cursor-pointer"
                              >
                                Ledger
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBankAccount(p.id, p.portal_name)}
                                className="p-0.5 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-2.5 h-2.5 text-slate-400 hover:text-red-500 cursor-pointer" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Form to Add Bank Account */}
                <div className="mt-1">
                  {selectedGroupIdForNewBank === group.id ? (
                    <div className="bg-slate-50 dark:bg-slate-950 p-2 border border-slate-100 dark:border-slate-850 rounded-lg space-y-2 animate-in fade-in duration-200">
                      <p className="text-[8px] font-bold text-indigo-650 uppercase tracking-wider">New Bank Account</p>
                      <div className="space-y-1">
                        <input autoComplete="one-time-code"
                          type="text"
                          placeholder="Account Label (e.g. Primary, ICICI)"
                          value={bAccLabel}
                          onChange={e => setBAccLabel(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                        />
                        <input autoComplete="one-time-code"
                          type="text"
                          placeholder="Bank Name (e.g. ICICI Bank)"
                          value={bBankName}
                          onChange={e => setBBankName(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input autoComplete="one-time-code"
                            type="text"
                            placeholder="Account Number"
                            value={bAccNo}
                            onChange={e => setBAccNo(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded text-xs font-semibold focus:outline-none"
                          />
                          <input autoComplete="one-time-code"
                            type="text"
                            placeholder="IFSC Code"
                            value={bIfsc}
                            onChange={e => setBIfsc(e.target.value)}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded text-xs font-semibold focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupIdForNewBank(null)}
                          className="flex-1 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddBankAccount(group.id)}
                          disabled={addingBank}
                          className="flex-1 py-1 bg-indigo-600 text-white rounded text-[9px] font-bold uppercase tracking-wider shadow-sm cursor-pointer"
                        >
                          {addingBank ? "Adding..." : "Add Bank"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedGroupIdForNewBank(group.id);
                        setBAccLabel("");
                        setBBankName("");
                        setBAccNo("");
                        setBIfsc("");
                      }}
                      className="w-full py-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add Bank Account
                    </button>
                  )}
                </div>
              </div>
            );})
        )}
      </div>

      {/* PORTAL EDIT MODAL */}
      {isEditPortalModalOpen && editingPortalGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-xs p-3 space-y-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Edit Portal Group</h3>
              <button 
                onClick={() => setIsEditPortalModalOpen(false)} 
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleSavePortalEdit} className="space-y-2.5">
              <div className="space-y-2">
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Portal Name</label>
                  <input autoComplete="one-time-code" 
                    type="text" 
                    value={editPortalName} 
                    onChange={(e) => setEditPortalName(e.target.value)} 
                    placeholder="Portal Name" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500/20" 
                    required 
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-md border border-slate-100 dark:border-slate-800 text-[9px]">
                   <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Current Balance</span>
                   <span className={`font-black ${editingPortalGroup.balance < 0 ? 'text-red-650 dark:text-red-400' : 'text-emerald-650 dark:text-emerald-555'}`}>
                     {editingPortalGroup.balance < 0 ? '-' : ''}₹{Math.abs(editingPortalGroup.balance || 0).toLocaleString()}
                   </span>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">Adjust Balance (₹)</label>
                    <input autoComplete="one-time-code" 
                      type="number" 
                      placeholder="e.g. +1000 to add, -1000 to subtract"
                      value={editPortalBalanceAdjustment} 
                      onChange={(e) => setEditPortalBalanceAdjustment(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none" 
                    />
                 </div>
                 <div className="flex items-center gap-1.5 py-0.5">
                     <input 
                       type="checkbox" 
                       id="editGroupOnlineMobile"
                       checked={editGroupOnline} 
                       onChange={(e) => setEditGroupOnline(e.target.checked)} 
                       className="w-3.5 h-3.5 rounded text-indigo-650 focus:ring-indigo-500 border-slate-200 dark:border-slate-800 dark:bg-slate-955 cursor-pointer"
                     />
                     <label htmlFor="editGroupOnlineMobile" className="text-[9px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                       Online
                     </label>
                  </div>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98]"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {isLedgerModalOpen && ledgerPortal && (
        <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto select-none">
          {loadingLedger ? (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <LedgerReportView 
              title={ledgerPortal.portal_name || ledgerPortal.name}
              subtitle={`Bank: ${ledgerPortal.bank_name || 'N/A'} • A/C: ${ledgerPortal.bank_account_no || 'N/A'}`}
              data={ledgerData}
              outstandingBalance={ledgerOutstanding}
              isPublic={false}
              onBack={() => {
                setIsLedgerModalOpen(false);
                setLedgerPortal(null);
                setLedgerData([]);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
