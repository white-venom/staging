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
  Edit
} from "lucide-react";
import { api } from "@/app/utils/api";
import Link from "next/link";

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

  // Portal form states
  const [pName, setPName] = useState("");
  const [pToTake, setPToTake] = useState("");
  const [pToGive, setPToGive] = useState("");

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
  const [editPortalToGive, setEditPortalToGive] = useState<string>("");
  const [editPortalToTake, setEditPortalToTake] = useState<string>("");

  // Inline balance editing states
  const [inlineEditing, setInlineEditing] = useState<{ id: string, field: 'take' | 'give' } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  const handleInlinePortalUpdate = async (id: string, field: 'take' | 'give') => {
    setIsUpdatingBalance(true);
    try {
      const group = portalDirectory.find(g => g.id === id);
      if (!group) return;

      const targetValue = parseFloat(inlineValue || "0");
      if (targetValue < 0) {
        showToastNotification("Negative values are not allowed.");
        setIsUpdatingBalance(false);
        return;
      }

      // In the additive model, we send name and ONLY the increment to the backend
      const payload: any = { name: group.name };
      if (field === 'take' && targetValue > 0) payload.opening_to_take = targetValue;
      if (field === 'give' && targetValue > 0) payload.opening_to_give = targetValue;

      await api.updatePortalGroup(id, payload);
      showToastNotification(`✓ Balance updated for ${group.name}`);
      setInlineEditing(null);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  const handleStartEditPortal = (group: any) => {
    setEditingPortalGroup(group);
    setEditPortalName(group.name);
    setEditPortalToGive("");
    setEditPortalToTake("");
    setIsEditPortalModalOpen(true);
  };

  const handleSavePortalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPortalGroup) return;
    const addTake = parseFloat(editPortalToTake || "0");
    const addGive = parseFloat(editPortalToGive || "0");
    if (addTake < 0 || addGive < 0) {
      showToastNotification("Negative values are not allowed.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { name: editPortalName };
      if (addTake > 0) payload.opening_to_take = addTake;
      if (addGive > 0) payload.opening_to_give = addGive;

      await api.updatePortalGroup(editingPortalGroup.id, payload);
      showToastNotification(`✓ Portal "${editPortalName}" updated`);
      setIsEditPortalModalOpen(false);
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
    const takeVal = parseFloat(pToTake || "0");
    const giveVal = parseFloat(pToGive || "0");
    if (takeVal < 0 || giveVal < 0) {
      showToastNotification("Opening balances cannot be negative");
      setSubmitting(false);
      return;
    }
    try {
      await api.createPortalGroup({
        name: pName,
        opening_to_give: giveVal,
        opening_to_take: takeVal
      });
      showToastNotification(`✓ Portal "${pName}" registered`);
      setPName(""); setPToTake(""); setPToGive("");
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
        ifsc_code: bIfsc
      });
      showToastNotification(`✓ Account "${bAccLabel}" registered`);
      setBAccLabel(""); setBBankName(""); setBAccNo(""); setBIfsc("");
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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-500 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Portals</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{portalDirectory.length} Groups Active</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(v => !v)}
          className={`w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform ${showAddForm ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-355 shadow-none' : 'bg-indigo-650 bg-indigo-600 text-white shadow-indigo-500/30'}`}
        >
          {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {/* Add Portal Group Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-3 duration-250">
          <p className="text-[10px] font-black text-indigo-650 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">New Portal Group</p>
          <form onSubmit={handleCreatePortal} className="space-y-3">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Portal Group Name</label>
              <input
                type="text"
                value={pName}
                onChange={e => setPName(e.target.value)}
                placeholder="e.g. Paytm, PhonePe, Bank Portal"
                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Opening To Take (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={pToTake}
                  onChange={e => setPToTake(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Opening To Give (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={pToGive}
                  onChange={e => setPToGive(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Registering..." : "Register Portal"}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="px-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search portal groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>

      {/* Portal Group Cards */}
      <div className="space-y-4 pb-20">
        {filtered.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <Globe className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No portals found</p>
          </div>
        ) : (
          filtered.map((group) => {
            const isEditingThis = inlineEditing?.id === group.id;
            const editingField = inlineEditing && inlineEditing.id === group.id ? inlineEditing.field : null;
            return (
              <div 
                key={group.id}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">{group.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(group.portals || []).length} Accounts Active</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleStartEditPortal(group)}
                    className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 rounded-xl active:scale-95 transition-transform cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeletePortalGroup(group.id, group.name)}
                    className="p-2.5 bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 rounded-xl active:scale-95 transition-transform cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Group To Take & To Give raw inputs */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/40">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter block mb-0.5">To Take</span>
                    <button
                      onClick={() => {
                        setInlineEditing({ id: group.id, field: 'take' });
                        setInlineValue("");
                      }}
                      className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded text-red-500 hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="text-xs font-black text-red-650 dark:text-red-400">
                    ₹{(group.opening_to_take || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter block mb-0.5">To Give</span>
                    <button
                      onClick={() => {
                        setInlineEditing({ id: group.id, field: 'give' });
                        setInlineValue("");
                      }}
                      className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded text-emerald-500 hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="text-xs font-black text-emerald-650 dark:text-emerald-555">
                    ₹{(group.opening_to_give || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block mb-0.5">Net Bal</span>
                  <span className={`text-xs font-black ${(group.balance || 0) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    ₹{Math.abs(group.balance || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {isEditingThis && editingField && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2 animate-in fade-in duration-200">
                  <p className="text-[9px] font-black text-slate-450 uppercase tracking-wider">
                    Add more to {editingField === 'take' ? 'To Take (Red)' : 'To Give (Green)'}
                  </p>
                  <div className="flex flex-col gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount to Add"
                      value={inlineValue}
                      onChange={e => setInlineValue(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInlinePortalUpdate(group.id, editingField)}
                        disabled={isUpdatingBalance}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setInlineEditing(null)}
                        className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-portals List */}
              {group.portals && group.portals.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Registered Banks</p>
                  {group.portals.map((p: any) => (
                    <div key={p.id} className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{p.portal_name}</span>
                        <span className="text-[8px] text-slate-400 truncate">{p.bank_name || 'N/A'} • {p.bank_account_no || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-black text-slate-700 dark:text-slate-300">₹{Number(p.balance || 0).toLocaleString()}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBankAccount(p.id, p.portal_name)}
                          className="p-1 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-450 hover:text-red-500 cursor-pointer" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline Form to Add Bank Account */}
              <div className="mt-2">
                {selectedGroupIdForNewBank === group.id ? (
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">New Bank Account</p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Account Label (e.g. Primary, ICICI)"
                        value={bAccLabel}
                        onChange={e => setBAccLabel(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Bank Name (e.g. ICICI Bank)"
                        value={bBankName}
                        onChange={e => setBBankName(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Account Number"
                          value={bAccNo}
                          onChange={e => setBAccNo(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="IFSC Code"
                          value={bIfsc}
                          onChange={e => setBIfsc(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGroupIdForNewBank(null)}
                        className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBankAccount(group.id)}
                        disabled={addingBank}
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md shadow-indigo-500/25 cursor-pointer"
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
                    className="w-full py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Bank Account
                  </button>
                )}
              </div>
            </div>
          );})
        )}
      </div>

      {/* PORTAL EDIT MODAL */}
      {isEditPortalModalOpen && editingPortalGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] w-full max-w-sm p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Edit Portal Group</h3>
              <button 
                onClick={() => setIsEditPortalModalOpen(false)} 
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-250 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePortalEdit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Portal Name</label>
                  <input 
                    type="text" 
                    value={editPortalName} 
                    onChange={(e) => setEditPortalName(e.target.value)} 
                    placeholder="Portal Name" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px]">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Current To Take</span>
                    <span className="font-black text-red-650 dark:text-red-400">₹{(editingPortalGroup.opening_to_take || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Current To Give</span>
                    <span className="font-black text-emerald-650 dark:text-emerald-555">₹{(editingPortalGroup.opening_to_give || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-[8px] font-black text-red-500 uppercase tracking-wider block mb-1">Add to To Take</label>
                     <input 
                       type="number" 
                       min="0"
                       placeholder="Amount to Add"
                       value={editPortalToTake} 
                       onChange={(e) => setEditPortalToTake(e.target.value)}
                       className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                     />
                   </div>
                   <div>
                     <label className="text-[8px] font-black text-emerald-500 uppercase tracking-wider block mb-1">Add to To Give</label>
                     <input 
                       type="number" 
                       min="0"
                       placeholder="Amount to Add"
                       value={editPortalToGive} 
                       onChange={(e) => setEditPortalToGive(e.target.value)}
                       className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                     />
                   </div>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
