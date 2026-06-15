"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, Globe, Building, X, CreditCard, ChevronRight, ChevronDown, Edit, Trash2 } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import { useRouter } from "next/navigation";
import LedgerReportView from "../../../components/LedgerReportView";

interface PortalsTabProps {
  portalDirectory: any[]; // These will be Portal Groups now
  showToastNotification: (msg: string) => void;
  setShowPortalDrawer: (val: boolean) => void;
  fetchData?: () => void;
}

export default function PortalsTab({
  portalDirectory,
  showToastNotification,
  setShowPortalDrawer,
  fetchData
}: PortalsTabProps) {
  const router = useRouter();
  const { setLedgerSearchTerm } = useAdmin();
  const [portalSearch, setPortalSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  
  const [newAccName, setNewAccName] = useState("");
  const [newAccBank, setNewAccBank] = useState("");
  const [newAccNo, setNewAccNo] = useState("");
  const [newAccIfsc, setNewAccIfsc] = useState("");
  const [newAccGroupId, setNewAccGroupId] = useState("");
  const [isCreatingAcc, setIsCreatingAcc] = useState(false);

  // Ledger Report View State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerPortal, setLedgerPortal] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerOutstanding, setLedgerOutstanding] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const handleOpenLedger = async (portal: any) => {
    setLedgerPortal(portal);
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    try {
      const res = await api.getPortalLedger(portal.id);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      alert("Failed to load ledger: " + err.message);
      setIsLedgerModalOpen(false);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Edit states
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupBalanceAdjustment, setEditingGroupBalanceAdjustment] = useState<string>("");

  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState("");
  const [editAccBank, setEditAccBank] = useState("");
  const [editAccNo, setEditAccNo] = useState("");
  const [editAccIfsc, setEditAccIfsc] = useState("");
  const [editGroupOnline, setEditGroupOnline] = useState(false);
  const [newAccOnline, setNewAccOnline] = useState(false);
  const [editAccOnline, setEditAccOnline] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };



  useEffect(() => {
    if (selectedGroup) {
      fetchAccounts(selectedGroup.id);
    }
  }, [selectedGroup]);

  const fetchAccounts = async (groupId: string) => {
    try {
      const data = await api.getGroupAccounts(groupId);
      setAccounts(data);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    }
  };

  const handleCreateAccountInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccGroupId || !newAccName) {
      alert("Please select a Portal and enter an Account Name");
      return;
    }

    setIsCreatingAcc(true);
    try {
      await api.createPortal({
        group_id: newAccGroupId,
        portal_name: newAccName,
        bank_name: newAccBank,
        bank_account_no: newAccNo,
        ifsc_code: newAccIfsc,
        show_in_online_payment: false
      });
      showToastNotification(`Account "${newAccName}" registered successfully!`);
      setNewAccName("");
      setNewAccBank("");
      setNewAccNo("");
      setNewAccIfsc("");
      setNewAccGroupId("");
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to add account: " + err.message);
    } finally {
      setIsCreatingAcc(false);
    }
  };

  const handleCreateAccountModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newAccName) return;

    setIsCreatingAcc(true);
    try {
      await api.createPortal({
        group_id: selectedGroup.id,
        portal_name: newAccName,
        bank_name: newAccBank,
        bank_account_no: newAccNo,
        ifsc_code: newAccIfsc,
        show_in_online_payment: newAccOnline
      });
      showToastNotification(`Account "${newAccName}" added to ${selectedGroup.name}`);
      setNewAccName("");
      setNewAccBank("");
      setNewAccNo("");
      setNewAccIfsc("");
      setNewAccOnline(false);
      fetchAccounts(selectedGroup.id);
    } catch (err: any) {
      alert("Failed to add account: " + err.message);
    } finally {
      setIsCreatingAcc(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will remove all associated bank accounts.`)) return;
    try {
      await api.deletePortalGroup(groupId);
      showToastNotification(`Portal "${name}" deleted.`);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to delete portal: " + err.message);
    }
  };

  const handleUpdateGroup = async (groupId: string) => {
    if (!groupId || !editingGroupName) return;
    const adjustVal = parseFloat(editingGroupBalanceAdjustment || "0");
    
    try {
      const payload: any = { 
        name: editingGroupName,
        show_in_online_payment: editGroupOnline
      };
      if (adjustVal > 0) {
        payload.opening_to_take = adjustVal;
      } else if (adjustVal < 0) {
        payload.opening_to_give = Math.abs(adjustVal);
      }
      await api.updatePortalGroup(groupId, payload);
      showToastNotification(`Portal "${editingGroupName}" updated.`);
      setEditingGroupId(null);
      setEditGroupOnline(false);
      setIsAccountModalOpen(false);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update portal: " + err.message);
    }
  };

  const handleDeleteAccount = async (accId: string, name: string) => {
    if (!confirm(`Delete bank account "${name}"?`)) return;
    try {
      await api.deletePortal(accId);
      showToastNotification(`Account "${name}" removed.`);
      if (selectedGroup) fetchAccounts(selectedGroup.id);
    } catch (err: any) {
      alert("Failed to delete account: " + err.message);
    }
  };



  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccId || !selectedGroup) return;
    try {
      await api.updatePortal(editingAccId, {
        portal_name: editAccName,
        bank_name: editAccBank,
        bank_account_no: editAccNo,
        ifsc_code: editAccIfsc,
        group_id: selectedGroup.id,
        show_in_online_payment: editAccOnline
      });
      showToastNotification(`Account "${editAccName}" updated.`);
      setEditingAccId(null);
      setEditAccOnline(false);
      fetchAccounts(selectedGroup.id);
    } catch (err: any) {
      alert("Failed to update account: " + err.message);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input autoComplete="one-time-code"
            type="text"
            placeholder="Search Portals (e.g. RevaPay)..."
            value={portalSearch}
            onChange={(e) => setPortalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold placeholder-slate-400 focus:outline-none shadow-sm"
          />
        </div>

        <button
          onClick={() => setShowPortalDrawer(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" /> Register Portal
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {portalDirectory
          .filter(p => (p.name || "").toLowerCase().includes(portalSearch.toLowerCase()))
          .map((group) => (
            <div
              key={group.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          {group.name}
                          {group.show_in_online_payment && (
                            <span className="px-1 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[7px] font-black rounded uppercase">Online</span>
                          )}
                        </h3>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setSelectedGroup(group);
                          setEditingGroupId(group.id);
                          setEditingGroupName(group.name);
                          setEditingGroupBalanceAdjustment("");
                          setEditGroupOnline(!!group.show_in_online_payment);
                          setIsAccountModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-650 dark:text-slate-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        title="Edit Portal Settings"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="p-1.5 text-slate-450 hover:text-red-600 transition-colors cursor-pointer"
                        title="Delete Portal Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-black text-slate-455 uppercase tracking-wider block mb-0.5">Portal Balance</span>
                      <span className={`text-xs font-black ${group.balance < 0 ? 'text-red-655 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                        {group.balance < 0 ? '-' : ''}₹{Math.abs(group.balance || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* Registered bank accounts with balances */}
                  {group.portals && group.portals.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <button
                        onClick={() => toggleGroupExpand(group.id)}
                        className="w-full flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider hover:text-indigo-650 transition-colors"
                      >
                        <span>Registered Banks ({group.portals.length})</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedGroups[group.id] ? "rotate-180 text-indigo-600" : ""}`} />
                      </button>
                      
                      {expandedGroups[group.id] && (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 mt-2 animate-slide-down">
                          {group.portals.map((p: any) => (
                            <div key={p.id} className="text-[10px] text-slate-505 dark:text-slate-400 flex items-center justify-between bg-slate-50 dark:bg-slate-955 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-805 dark:text-slate-200 truncate flex items-center gap-1.5">
                                  {p.portal_name}
                                </span>
                                <span className="text-[8px] text-slate-400 truncate">{p.bank_name || 'N/A'} • {p.bank_account_no || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-700 dark:text-slate-300 flex-shrink-0">
                                  ₹{Number(p.balance || 0).toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenLedger(p)}
                                  className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-955/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-bold rounded cursor-pointer"
                                >
                                  Ledger
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        if (group.portals && group.portals.length > 0) {
                          handleOpenLedger(group.portals[0]);
                        } else {
                          showToastNotification("No bank account registered for this portal!");
                        }
                      }}
                      className="py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-105 dark:border-emerald-800/40 text-[10px] font-bold rounded-lg cursor-pointer flex items-center justify-center"
                    >
                      View Ledger
                    </button>
                    <button
                      onClick={() => {
                        setLedgerSearchTerm(group.name);
                        router.push("/admin/ledger");
                      }}
                      className="py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-955 dark:hover:bg-slate-900 text-slate-655 dark:text-slate-355 border border-slate-200 dark:border-slate-800 text-[10px] font-bold rounded-lg cursor-pointer text-center"
                    >
                      Audit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedGroup(group);
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name);
                        setEditingGroupBalanceAdjustment("");
                        setEditGroupOnline(!!group.show_in_online_payment);
                        setIsAccountModalOpen(true);
                      }}
                      className="py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-955 dark:hover:bg-slate-900 text-slate-655 dark:text-slate-355 border border-slate-200 dark:border-slate-800 text-[10px] font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3 h-3" /> Manage Portal
                    </button>
                  </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
       {portalDirectory.length === 0 && (
         <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 border-dashed dark:border-slate-800">
            <Globe className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">No Portals Found</p>
            <p className="text-[10px] text-slate-400 mt-1">Register a portal first.</p>
         </div>
       )}

      {/* ACCOUNTS MANAGEMENT MODAL */}
      {isAccountModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-6 animate-slide-up shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:border-slate-100">
                  Portal Accounts
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                  Portal: {selectedGroup.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAccountModalOpen(false);
                  setSelectedGroup(null);
                  setAccounts([]);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
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
                <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-4">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-black mb-1">Portal Name</label>
                    <input autoComplete="one-time-code" 
                      type="text" 
                      value={editingGroupName} 
                      onChange={e => setEditingGroupName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
                    />
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] mb-2">
                    <span className="text-slate-400 block mb-0.5">Current Balance</span>
                    <span className={`font-black ${selectedGroup.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                      {selectedGroup.balance < 0 ? '-' : ''}₹{Math.abs(selectedGroup.balance || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] text-slate-500 uppercase font-black mb-1">Adjust Balance (₹)</label>
                    <input autoComplete="one-time-code" 
                      type="number" 
                      placeholder="e.g. +1000 to add, -1000 to subtract"
                      value={editingGroupBalanceAdjustment} 
                      onChange={e => setEditingGroupBalanceAdjustment(e.target.value)}
                      onFocus={e => {
                        if (Number(e.target.value) === 0) setEditingGroupBalanceAdjustment("");
                        e.target.select();
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-1 py-1">
                    <input 
                      type="checkbox" 
                      id="editGroupOnline"
                      checked={editGroupOnline} 
                      onChange={(e) => setEditGroupOnline(e.target.checked)} 
                      className="w-4 h-4 rounded text-indigo-650 focus:ring-indigo-500 border-slate-200 dark:border-slate-800 dark:bg-slate-950 cursor-pointer"
                    />
                    <label htmlFor="editGroupOnline" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                      Online
                    </label>
                  </div>
                  <button 
                    onClick={() => handleUpdateGroup(selectedGroup.id)}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    Save Portal Settings
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
                      <div key={acc.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl group">
                        <div className="flex items-center justify-between mb-2">
                          {editingAccId === acc.id ? (
                            <input autoComplete="one-time-code" 
                              value={editAccName}
                              onChange={(e) => setEditAccName(e.target.value)}
                              className="text-xs font-black bg-white dark:bg-slate-800 border rounded px-2 py-0.5 outline-none"
                            />
                          ) : (
                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              {acc.portal_name}
                            </p>
                          )}
                          <div className="flex items-center gap-1">
                            {editingAccId === acc.id ? (
                              <button onClick={handleUpdateAccount} className="text-[9px] text-blue-600 font-bold mr-2">SAVE</button>
                            ) : (
                              <button 
                                onClick={() => {
                                  setEditingAccId(acc.id);
                                  setEditAccName(acc.portal_name);
                                  setEditAccBank(acc.bank_name || "");
                                  setEditAccNo(acc.bank_account_no || "");
                                  setEditAccIfsc(acc.ifsc_code || "");
                                  setEditAccOnline(!!acc.show_in_online_payment);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-650 transition-all"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteAccount(acc.id, acc.portal_name)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-all"
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
                            <div className="text-slate-707 dark:text-slate-300 font-bold">{acc.bank_account_no || "N/A"}</div>
                            <div className="text-slate-400">IFSC</div>
                            <div className="text-slate-707 dark:text-slate-300 font-bold">{acc.ifsc_code || "N/A"}</div>
                            <div className="text-slate-400 font-bold text-indigo-650 dark:text-indigo-400">Balance</div>
                            <div className="flex items-center justify-between text-indigo-650 dark:text-indigo-400 font-black">
                               <span>₹{Number(acc.balance || 0).toLocaleString()}</span>
                               <button
                                 type="button"
                                 onClick={() => {
                                   setIsAccountModalOpen(false);
                                   handleOpenLedger(acc);
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
                  <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input autoComplete="one-time-code"
                      type="text"
                      placeholder="Bank Name"
                      value={newAccBank}
                      onChange={(e) => setNewAccBank(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                    />
                    <input autoComplete="one-time-code"
                      type="text"
                      placeholder="Account No"
                      value={newAccNo}
                      onChange={(e) => setNewAccNo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                    />
                  </div>
                  <input autoComplete="one-time-code"
                    type="text"
                    placeholder="IFSC Code"
                    value={newAccIfsc}
                    onChange={(e) => setNewAccIfsc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isCreatingAcc}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> {isCreatingAcc ? "Adding..." : "Register Bank Account"}
                  </button>
                </form>
              </div>
            </div>
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
