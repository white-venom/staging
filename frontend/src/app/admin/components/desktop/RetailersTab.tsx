"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, X, Store as StoreIcon, Trash2, Edit2, Check, Phone, MapPin } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import { useRouter } from "next/navigation";

interface RetailersTabProps {
  retailerDirectory: any[];
  setShowRetailerDrawer: (val: boolean) => void;
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function RetailersTab({
  retailerDirectory,
  setShowRetailerDrawer,
  showToastNotification,
  fetchData
}: RetailersTabProps) {
  const router = useRouter();
  const { collections, deposits, setLedgerSearchTerm } = useAdmin();
  const [retailerSearch, setRetailerSearch] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState<any | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreArea, setNewStoreArea] = useState("");
  const [isCreatingStore, setIsCreatingStore] = useState(false);

  // Retailer Edit state
  const [isEditRetailerModalOpen, setIsEditRetailerModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<any | null>(null);
  const [editRetName, setEditRetName] = useState("");
  const [editRetPhone, setEditRetPhone] = useState("");
  const [editRetArea, setEditRetArea] = useState("");
  const [editRetEmail, setEditRetEmail] = useState("");
  const [editRetToGive, setEditRetToGive] = useState<string>("");
  const [editRetToTake, setEditRetToTake] = useState<string>("");

  // Inline adjustment state
  const [inlineEditingRetailer, setInlineEditingRetailer] = useState<{id: string, field: 'take' | 'give'} | null>(null);
  const [inlineRetailerValue, setInlineRetailerValue] = useState<string>("");
  const [isUpdatingRetailerBalance, setIsUpdatingRetailerBalance] = useState(false);

  // Store Edit state
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreArea, setEditStoreArea] = useState("");
  const [editStoreRetailerId, setEditStoreRetailerId] = useState("");

  useEffect(() => {
    if (selectedRetailer) {
      fetchStores(selectedRetailer.id);
    }
  }, [selectedRetailer]);

  const fetchStores = async (retailerId: string) => {
    try {
      const data = await api.getRetailerStores(retailerId);
      setStores(data);
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    }
  };

  const handleInlineRetailerUpdate = async (id: string, field: 'take' | 'give', valueToSave?: string) => {
    const valToUse = valueToSave !== undefined ? valueToSave : inlineRetailerValue;
    const targetValue = parseFloat(valToUse || "0");
    if (isNaN(targetValue) || targetValue <= 0) {
      setInlineEditingRetailer(null);
      return;
    }
    setIsUpdatingRetailerBalance(true);
    try {
      const retailer = retailerDirectory.find(r => r.id === id);
      if (!retailer) return;

      const payload: any = {};
      if (field === 'take' && targetValue > 0) payload.opening_to_take = targetValue;
      if (field === 'give' && targetValue > 0) payload.opening_to_give = targetValue;

      await api.updateRetailer(id, payload);
      showToastNotification("Balance updated.");
      setInlineEditingRetailer(null);
      fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsUpdatingRetailerBalance(false);
    }
  };

  // --- Retailer Actions ---
  const handleStartEditRetailer = (retailer: any) => {
    setEditingRetailer(retailer);
    setEditRetName(retailer.name);
    setEditRetPhone(retailer.phone);
    setEditRetArea(retailer.area);
    setEditRetEmail(retailer.email || "");
    setEditRetToGive("");
    setEditRetToTake("");
    setIsEditRetailerModalOpen(true);
  };

  const handleSaveRetailerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRetailer) return;
    const addTake = parseFloat(editRetToTake || "0");
    const addGive = parseFloat(editRetToGive || "0");
    if (addTake < 0 || addGive < 0) {
      alert("Negative values are not allowed.");
      return;
    }
    try {
      await api.updateRetailer(editingRetailer.id, {
        retailer_name: editRetName,
        phone: editRetPhone,
        address: editRetArea,
        email: editRetEmail,
        opening_to_give: addGive,
        opening_to_take: addTake
      });
      showToastNotification(`Retailer "${editRetName}" updated.`);
      setIsEditRetailerModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    }
  };
  const handleDeleteRetailer = async (id: string, name: string) => {
    if (name.toLowerCase().trim() === "cms") {
      alert("CMS retailer cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete Retailer "${name}"? This will also delete all associated stores and ledger records.`)) return;
    try {
      await api.deleteRetailer(id);
      showToastNotification(`Retailer "${name}" deleted.`);
      fetchData();
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  // --- Store Actions ---
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRetailer || !newStoreName) return;

    setIsCreatingStore(true);
    try {
      await api.createStore(selectedRetailer.id, {
        store_name: newStoreName,
        address: newStoreArea || selectedRetailer.area
      });
      showToastNotification(`Store "${newStoreName}" added to ${selectedRetailer.name}`);
      setNewStoreName("");
      setNewStoreArea("");
      fetchStores(selectedRetailer.id);
    } catch (err: any) {
      alert("Failed to add store: " + err.message);
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleDeleteStore = async (storeId: string, storeName: string) => {
    if (!selectedRetailer) return;
    if (!confirm(`Delete store "${storeName}"? This cannot be undone.`)) return;
    try {
      await api.deleteStore(selectedRetailer.id, storeId);
      showToastNotification(`Store "${storeName}" deleted.`);
      fetchStores(selectedRetailer.id);
    } catch (err: any) {
      alert("Failed to delete store: " + err.message);
    }
  };

  const handleStartEditStore = (store: any) => {
    setEditingStoreId(store.id);
    setEditStoreName(store.store_name);
    setEditStoreArea(store.address || "");
    setEditStoreRetailerId(store.retailer_id || selectedRetailer.id);
  };

  const handleSaveStoreEdit = async (storeId: string) => {
    if (!selectedRetailer || !editStoreName) return;
    try {
      await api.updateStore(selectedRetailer.id, storeId, {
        store_name: editStoreName,
        address: editStoreArea,
        new_retailer_id: editStoreRetailerId || undefined
      });
      showToastNotification(`Store updated successfully.`);
      setEditingStoreId(null);
      fetchStores(selectedRetailer.id);
      fetchData();
    } catch (err: any) {
      alert("Failed to update store: " + err.message);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search store directory profiles..."
            value={retailerSearch}
            onChange={(e) => setRetailerSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold placeholder-slate-400 focus:outline-none shadow-sm"
          />
        </div>

        <button
          onClick={() => setShowRetailerDrawer(true)}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Register Retailer
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(retailerDirectory || [])
          .filter(r => (r.name || "").toLowerCase().includes((retailerSearch || "").toLowerCase()))
          .map((retailer) => (
            <div
              key={retailer.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between group relative overflow-hidden"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div>
                      <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">{retailer.name}</h3>
                      {retailer.name.toLowerCase().trim() !== "cms" && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="w-2.5 h-2.5 text-slate-400" />
                          <span className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">Route: {retailer.area}</span>
                        </div>
                      )}
                    </div>
                    {/* Actions Overlay */}
                    <div className="flex items-center gap-1 transition-opacity">
                      {retailer.name.toLowerCase().trim() !== "cms" && (
                        <button 
                          onClick={() => handleStartEditRetailer(retailer)}
                          className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                          title="Edit Retailer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {retailer.name.toLowerCase().trim() !== "cms" && (
                        <button 
                          onClick={() => handleDeleteRetailer(retailer.id, retailer.name)}
                          className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                          title="Delete Retailer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {retailer.name.toLowerCase().trim() !== "cms" && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{retailer.phone}</span>
                      </div>
                    )}
                    {retailer.email && (
                      <span className="text-[8px] text-blue-500 font-medium mt-0.5">{retailer.email}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {/* To Take Field */}
                  <div>
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-wide block mb-0.5">To Take</span>
                    {inlineEditingRetailer?.id === retailer.id && inlineEditingRetailer?.field === 'take' ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="0"
                          placeholder="+ Add"
                          autoFocus
                          value={inlineRetailerValue}
                          onChange={e => setInlineRetailerValue(e.target.value)}
                          onFocus={e => {
                            if (Number(e.target.value) === 0) setInlineRetailerValue("");
                            e.target.select();
                          }}
                          onBlur={(e) => {
                            handleInlineRetailerUpdate(retailer.id, 'take', e.target.value);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setInlineEditingRetailer(null);
                          }}
                          className="w-20 px-1.5 py-1 text-xs font-bold bg-white dark:bg-slate-850 border border-blue-400 rounded outline-none shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-red-655 dark:text-red-400">
                          ₹{(retailer.opening_to_take || 0).toLocaleString()}
                        </span>
                        <button 
                          onClick={() => {
                            setInlineEditingRetailer({ id: retailer.id, field: 'take' });
                            setInlineRetailerValue("");
                          }}
                          className="p-0.5 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                          title="Add to To Take"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* To Give Field */}
                  <div>
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-wide block mb-0.5">To Give</span>
                    {inlineEditingRetailer?.id === retailer.id && inlineEditingRetailer?.field === 'give' ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="0"
                          placeholder="+ Add"
                          autoFocus
                          value={inlineRetailerValue}
                          onChange={e => setInlineRetailerValue(e.target.value)}
                          onFocus={e => {
                            if (Number(e.target.value) === 0) setInlineRetailerValue("");
                            e.target.select();
                          }}
                          onBlur={(e) => {
                            handleInlineRetailerUpdate(retailer.id, 'give', e.target.value);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setInlineEditingRetailer(null);
                          }}
                          className="w-20 px-1.5 py-1 text-xs font-bold bg-white dark:bg-slate-850 border border-blue-400 rounded outline-none shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-emerald-655 dark:text-emerald-500">
                          ₹{(retailer.opening_to_give || 0).toLocaleString()}
                        </span>
                        <button 
                          onClick={() => {
                            setInlineEditingRetailer({ id: retailer.id, field: 'give' });
                            setInlineRetailerValue("");
                          }}
                          className="p-0.5 text-slate-400 hover:text-emerald-650 transition-all cursor-pointer"
                          title="Add to To Give"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Net Bal Field */}
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide block mb-0.5">Net Bal</span>
                    <span className={`text-xs font-black ${(retailer.balance || 0) <= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
                      ₹{Math.abs(retailer.balance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {inlineEditingRetailer?.id === retailer.id && (
                  <div className="mt-4 pt-3 border-t border-slate-150 dark:border-slate-800 space-y-2">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Retailer Transaction Ledger</span>
                    {(() => {
                      const retailerTx = [
                        ...(collections || [])
                          .filter(c => c.retailerId === retailer.id)
                          .map(c => ({
                            id: c.id,
                            date: c.date,
                            type: "Cash In",
                            staff: c.staffName || "Admin",
                            amount: c.totalAmount,
                            isCredit: true,
                            balance: c.balance_snapshot
                          })),
                        ...(deposits || [])
                          .filter(d => d.retailerId === retailer.id)
                          .map(d => ({
                            id: d.id,
                            date: d.date,
                            type: "Cash Out",
                            staff: d.staffName || "Admin",
                            amount: d.amount,
                            isCredit: false,
                            balance: d.balance_snapshot
                          }))
                      ].sort((a, b) => new Date(b.date.replace(" ", "T")).getTime() - new Date(a.date.replace(" ", "T")).getTime());

                      if (retailerTx.length === 0) {
                        return (
                          <p className="text-[10px] font-bold text-slate-400 italic py-2">No transaction history found.</p>
                        );
                      }

                      return (
                        <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800/80 rounded-xl divide-y divide-slate-150/40 dark:divide-slate-800/40">
                          {retailerTx.map(tx => (
                            <div key={tx.id} className="p-2.5 flex items-center justify-between text-[10px] bg-slate-50/40 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-slate-750 dark:text-slate-200 uppercase">{tx.type}</span>
                                  <span className="text-[8px] font-bold text-slate-400">by {tx.staff}</span>
                                </div>
                                <span className="text-[8px] text-slate-400 block mt-0.5">{tx.date}</span>
                              </div>
                              <div className="text-right">
                                <span className={`font-black ${tx.isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {tx.isCredit ? '+' : '-'}₹{tx.amount.toLocaleString()}
                                </span>
                                {tx.balance !== undefined && (
                                  <span className="text-[8px] text-slate-400 block mt-0.5">Bal: ₹{Number(tx.balance).toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setLedgerSearchTerm(retailer.name);
                    router.push("/admin/ledger");
                  }}
                  className="py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  Audit Ledger
                </button>
                <button
                  onClick={() => {
                    setSelectedRetailer(retailer);
                    setIsStoreModalOpen(true);
                  }}
                  className="py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-[10px] font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <StoreIcon className="w-3.5 h-3.5" /> Manage Stores
                </button>
              </div>
            </div>
          ))}
      </div>

      {(retailerDirectory || []).length === 0 && (
        <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 border-dashed dark:border-slate-800">
           <StoreIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
           <p className="text-sm font-bold text-slate-500">No Retailers Found</p>
           <p className="text-[10px] text-slate-400 mt-1">Register a retailer first.</p>
        </div>
      )}

      {/* RETAILER EDIT MODAL */}
      {isEditRetailerModalOpen && editingRetailer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-6 select-none animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Edit Retailer Profile</h3>
              <button onClick={() => setIsEditRetailerModalOpen(false)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveRetailerEdit} className="space-y-4">
              <div className="space-y-3">
                <input type="text" value={editRetName} onChange={(e) => setEditRetName(e.target.value)} placeholder="Retailer Name" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" required />
                <input type="tel" value={editRetPhone} onChange={(e) => setEditRetPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" required />
                <input type="text" value={editRetArea} onChange={(e) => setEditRetArea(e.target.value)} placeholder="Area / Route" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" />
                <input type="email" value={editRetEmail} onChange={(e) => setEditRetEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" />
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] select-none space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Current To Take</span>
                      <span className="font-black text-red-655 dark:text-red-400">₹{(editingRetailer.opening_to_take || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Current To Give</span>
                      <span className="font-black text-emerald-655 dark:text-emerald-555">₹{(editingRetailer.opening_to_give || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Current Net Balance</span>
                    <span className={`font-black ${(editingRetailer.balance || 0) <= 0 ? 'text-emerald-655 dark:text-emerald-500' : 'text-red-655 dark:text-red-400'}`}>
                      ₹{Math.abs(editingRetailer.balance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-red-500 uppercase">Add to To Take</label>
                     <input 
                       type="number" 
                       min="0"
                       placeholder="Amount to Add"
                       value={editRetToTake} 
                       onChange={(e) => setEditRetToTake(e.target.value)}
                       onFocus={e => {
                         if (Number(e.target.value) === 0) setEditRetToTake("");
                         e.target.select();
                       }}
                       className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none" 
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-emerald-500 uppercase">Add to To Give</label>
                     <input 
                       type="number" 
                       min="0"
                       placeholder="Amount to Add"
                       value={editRetToGive} 
                       onChange={(e) => setEditRetToGive(e.target.value)}
                       onFocus={e => {
                         if (Number(e.target.value) === 0) setEditRetToGive("");
                         e.target.select();
                       }}
                       className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none" 
                     />
                   </div>
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl text-xs font-bold">Update Profile</button>
            </form>
          </div>
        </div>
      )}

      {/* STORE MANAGEMENT MODAL */}
      {isStoreModalOpen && selectedRetailer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-6 select-none animate-slide-up shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  Manage Stores
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                  Retailer: {selectedRetailer.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsStoreModalOpen(false);
                  setSelectedRetailer(null);
                  setStores([]);
                  setEditingStoreId(null);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide">Active Store Locations</span>
                {stores.length > 0 ? (
                  <div className="space-y-2">
                    {stores.map((s) => (
                      <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                        {editingStoreId === s.id ? (
                          /* EDIT MODE */
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editStoreName}
                              onChange={(e) => setEditStoreName(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg text-xs font-semibold focus:outline-none"
                              placeholder="Store Name"
                            />
                            <input
                              type="text"
                              value={editStoreArea}
                              onChange={(e) => setEditStoreArea(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                              placeholder="Area / Address"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveStoreEdit(s.id)}
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                onClick={() => setEditingStoreId(null)}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* VIEW MODE */
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                <StoreIcon className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{s.store_name}</p>
                                <p className="text-[9px] text-slate-400 font-medium">{s.address || "—"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleStartEditStore(s)}
                                className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                title="Edit store"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStore(s.id, s.store_name)}
                                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                title="Delete store"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold">No stores registered for this retailer</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide block mb-3">Add New Store Location</span>
                <form onSubmit={handleCreateStore} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Store Name"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Area / Address"
                      value={newStoreArea}
                      onChange={(e) => setNewStoreArea(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreatingStore}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> {isCreatingStore ? "Adding..." : "Register Store Location"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
