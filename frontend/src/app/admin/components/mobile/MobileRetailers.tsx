"use client";

import React, { useState } from "react";
import { 
  Search, 
  Plus, 
  Store, 
  MapPin, 
  Phone, 
  Trash2,
  X,
  ArrowLeft,
  Edit2
} from "lucide-react";
import { api } from "@/app/utils/api";
import Link from "next/link";
import { useAdmin } from "../../context/AdminContext";

interface MobileRetailersProps {
  retailerDirectory: any[];
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function MobileRetailers({
  retailerDirectory,
  showToastNotification,
  fetchData
}: MobileRetailersProps) {
  const { collections, deposits } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [retName, setRetName] = useState("");
  const [retPhone, setRetPhone] = useState("");
  const [retArea, setRetArea] = useState("");
  const [retEmail, setRetEmail] = useState("");
  const [retToTake, setRetToTake] = useState("");
  const [retToGive, setRetToGive] = useState("");

  // Retailer Edit state
  const [isEditRetailerModalOpen, setIsEditRetailerModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<any | null>(null);
  const [editRetName, setEditRetName] = useState("");
  const [editRetPhone, setEditRetPhone] = useState("");
  const [editRetArea, setEditRetArea] = useState("");
  const [editRetEmail, setEditRetEmail] = useState("");
  const [editRetToGive, setEditRetToGive] = useState<string>("");
  const [editRetToTake, setEditRetToTake] = useState<string>("");

  // Inline balance editing states
  const [inlineEditing, setInlineEditing] = useState<{ id: string, field: 'take' | 'give' } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  // Retailer Store logic
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedRetailerStore, setSelectedRetailerStore] = useState<any | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreArea, setNewStoreArea] = useState("");
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreArea, setEditStoreArea] = useState("");
  const [editStoreRetailerId, setEditStoreRetailerId] = useState("");

  React.useEffect(() => {
    if (selectedRetailerStore) {
      fetchStores(selectedRetailerStore.id);
    }
  }, [selectedRetailerStore]);

  const fetchStores = async (retailerId: string) => {
    try {
      const data = await api.getRetailerStores(retailerId);
      setStores(data);
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRetailerStore || !newStoreName) return;

    setIsCreatingStore(true);
    try {
      await api.createStore(selectedRetailerStore.id, {
        store_name: newStoreName,
        address: newStoreArea || selectedRetailerStore.area
      });
      showToastNotification(`Store "${newStoreName}" added`);
      setNewStoreName("");
      setNewStoreArea("");
      fetchStores(selectedRetailerStore.id);
    } catch (err: any) {
      showToastNotification("Failed to add store: " + err.message);
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleDeleteStore = async (storeId: string, storeName: string) => {
    if (!selectedRetailerStore) return;
    if (!confirm(`Delete store "${storeName}"? This cannot be undone.`)) return;
    try {
      await api.deleteStore(selectedRetailerStore.id, storeId);
      showToastNotification(`Store "${storeName}" deleted.`);
      fetchStores(selectedRetailerStore.id);
    } catch (err: any) {
      showToastNotification("Failed to delete store: " + err.message);
    }
  };

  const handleStartEditStore = (store: any) => {
    setEditingStoreId(store.id);
    setEditStoreName(store.store_name);
    setEditStoreArea(store.address || "");
    setEditStoreRetailerId(store.retailer_id || selectedRetailerStore.id);
  };

  const handleSaveStoreEdit = async (storeId: string) => {
    if (!selectedRetailerStore || !editStoreName) return;
    try {
      await api.updateStore(selectedRetailerStore.id, storeId, {
        store_name: editStoreName,
        address: editStoreArea,
        new_retailer_id: editStoreRetailerId || undefined
      });
      showToastNotification(`Store updated successfully.`);
      setEditingStoreId(null);
      fetchStores(selectedRetailerStore.id);
      fetchData();
    } catch (err: any) {
      showToastNotification("Failed to update store: " + err.message);
    }
  };

  const handleInlineRetailerUpdate = async (id: string, field: 'take' | 'give', valueToSave?: string) => {
    const valToUse = valueToSave !== undefined ? valueToSave : inlineValue;
    const targetValue = parseFloat(valToUse || "0");
    if (isNaN(targetValue) || targetValue <= 0) {
      setInlineEditing(null);
      return;
    }
    setIsUpdatingBalance(true);
    try {
      const retailer = retailerDirectory.find(r => r.id === id);
      if (!retailer) return;

      const payload: any = {
        retailer_name: retailer.name,
        phone: retailer.phone,
        address: retailer.area,
        email: retailer.email || "",
      };
      if (field === 'take' && targetValue > 0) payload.opening_to_take = targetValue;
      if (field === 'give' && targetValue > 0) payload.opening_to_give = targetValue;

      await api.updateRetailer(id, payload);
      showToastNotification(`✓ Balance updated for ${retailer.name}`);
      setInlineEditing(null);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setIsUpdatingBalance(false);
    }
  };

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
      showToastNotification("Negative values are not allowed.");
      return;
    }
    setSubmitting(true);
    try {
      await api.updateRetailer(editingRetailer.id, {
        retailer_name: editRetName,
        phone: editRetPhone,
        address: editRetArea,
        email: editRetEmail,
        opening_to_give: addGive,
        opening_to_take: addTake
      });
      showToastNotification(`✓ Retailer "${editRetName}" updated`);
      setIsEditRetailerModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const takeVal = parseFloat(retToTake || "0");
    const giveVal = parseFloat(retToGive || "0");
    if (takeVal < 0 || giveVal < 0) {
      showToastNotification("Opening balances cannot be negative");
      setSubmitting(false);
      return;
    }
    try {
      await api.createRetailer({
        retailer_name: retName,
        phone: retPhone,
        address: retArea,
        email: retEmail,
        opening_to_take: takeVal,
        opening_to_give: giveVal
      });
      showToastNotification(`✓ Retailer "${retName}" registered`);
      setRetName(""); setRetPhone(""); setRetArea(""); setRetEmail(""); setRetToTake(""); setRetToGive("");
      setShowAddForm(false);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRetailer = async (id: string, name: string) => {
    const normalized = name.toLowerCase().trim();
    if (normalized === "cms" || normalized === "cmd") {
      showToastNotification("CMS/CMD retailer cannot be deleted");
      return;
    }
    if (!confirm(`Delete retailer "${name}"?`)) return;
    try {
      await api.deleteRetailer(id);
      showToastNotification(`Retailer "${name}" deleted`);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    }
  };

  const filtered = retailerDirectory.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone?.includes(searchTerm)
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
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Retailers</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{retailerDirectory.length} Total Partners</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(v => !v)}
          className={`w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform ${showAddForm ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-355 shadow-none' : 'bg-emerald-600 text-white shadow-emerald-500/30'}`}
        >
          {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {/* Add Retailer Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-3 duration-250">
          <p className="text-[10px] font-black text-emerald-650 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">New Retailer</p>
          <form onSubmit={handleCreateRetailer} className="space-y-3">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Retailer Name</label>
              <input
                type="text"
                value={retName}
                onChange={e => setRetName(e.target.value)}
                placeholder="e.g. Laxmi Telecom"
                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  value={retPhone}
                  onChange={e => setRetPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={retEmail}
                  onChange={e => setRetEmail(e.target.value)}
                  placeholder="laxmi@gmail.com"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Address/Area</label>
              <input
                type="text"
                value={retArea}
                onChange={e => setRetArea(e.target.value)}
                placeholder="Sector 62, Noida"
                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Opening To Take (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={retToTake}
                  onChange={e => setRetToTake(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Opening To Give (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={retToGive}
                  onChange={e => setRetToGive(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Registering..." : "Register Retailer"}
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
            placeholder="Search retailer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Retailer Cards */}
      <div className="space-y-4 pb-20">
        {filtered.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <Store className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No retailers found</p>
          </div>
        ) : (
          filtered.map((retailer) => {
            const isEditingThis = inlineEditing?.id === retailer.id;
            const editingField = inlineEditing && inlineEditing.id === retailer.id ? inlineEditing.field : null;
            return (
              <div 
                key={retailer.id}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white truncate max-w-[150px]">{retailer.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                      <MapPin className="w-3 h-3" /> {retailer.area || 'Unknown'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {retailer.phone && (
                    <a 
                      href={`tel:${retailer.phone}`}
                      className="p-2.5 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl active:scale-95 transition-transform"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  <button 
                    onClick={() => handleStartEditRetailer(retailer)}
                    className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 rounded-xl active:scale-95 transition-transform cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteRetailer(retailer.id, retailer.name)}
                    className="p-2.5 bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 rounded-xl active:scale-95 transition-transform cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-black text-red-500 uppercase tracking-tighter">To Take</p>
                    <button
                      onClick={() => {
                        setInlineEditing({ id: retailer.id, field: 'take' });
                        setInlineValue("");
                      }}
                      className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded text-red-500 hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <p className="text-xs font-black mt-0.5 text-red-650 dark:text-red-400">
                    ₹{(retailer.opening_to_take || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">To Give</p>
                    <button
                      onClick={() => {
                        setInlineEditing({ id: retailer.id, field: 'give' });
                        setInlineValue("");
                      }}
                      className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded text-emerald-500 hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <p className="text-xs font-black mt-0.5 text-emerald-650 dark:text-emerald-555">
                    ₹{(retailer.opening_to_give || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Net Bal</p>
                  <p className={`text-xs font-black mt-0.5 ${(retailer.balance || 0) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    ₹{Math.abs(retailer.balance || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {isEditingThis && editingField && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2 animate-in fade-in duration-200">
                  <p className="text-[9px] font-black text-slate-450 uppercase tracking-wider">
                    Add more to {editingField === 'take' ? 'To Take (Red)' : 'To Give (Green)'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount to Add"
                      value={inlineValue}
                      onChange={e => setInlineValue(e.target.value)}
                      onBlur={(e) => {
                        handleInlineRetailerUpdate(retailer.id, editingField, e.target.value);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setInlineEditing(null);
                      }}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-150 dark:border-slate-800 space-y-2">
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
                                  <span className="font-extrabold text-slate-755 dark:text-slate-200 uppercase">{tx.type}</span>
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
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setSelectedRetailerStore(retailer);
                    setIsStoreModalOpen(true);
                  }}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-[10px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5" /> Manage Stores
                </button>
              </div>
            </div>
          );})
        )}
      </div>

      {/* RETAILER EDIT MODAL */}
      {isEditRetailerModalOpen && editingRetailer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] w-full max-w-sm p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Edit Retailer</h3>
              <button 
                onClick={() => setIsEditRetailerModalOpen(false)} 
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-250 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRetailerEdit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Retailer Name</label>
                  <input 
                    type="text" 
                    value={editRetName} 
                    onChange={(e) => setEditRetName(e.target.value)} 
                    placeholder="Retailer Name" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Phone</label>
                  <input 
                    type="tel" 
                    value={editRetPhone} 
                    onChange={(e) => setEditRetPhone(e.target.value)} 
                    placeholder="Phone" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Area / Route</label>
                  <input 
                    type="text" 
                    value={editRetArea} 
                    onChange={(e) => setEditRetArea(e.target.value)} 
                    placeholder="Area / Route" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Email</label>
                  <input 
                    type="email" 
                    value={editRetEmail} 
                    onChange={(e) => setEditRetEmail(e.target.value)} 
                    placeholder="Email" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px]">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Current To Take</span>
                    <span className="font-black text-red-650 dark:text-red-400">₹{(editingRetailer.opening_to_take || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Current To Give</span>
                    <span className="font-black text-emerald-650 dark:text-emerald-555">₹{(editingRetailer.opening_to_give || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-[8px] font-black text-red-500 uppercase tracking-wider block mb-1">Add to To Take</label>
                     <input 
                       type="number" 
                       min="0"
                       placeholder="Amount to Add"
                       value={editRetToTake} 
                       onChange={(e) => setEditRetToTake(e.target.value)}
                       className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                     />
                   </div>
                   <div>
                     <label className="text-[8px] font-black text-emerald-500 uppercase tracking-wider block mb-1">Add to To Give</label>
                     <input 
                       type="number" 
                       min="0"
                       placeholder="Amount to Add"
                       value={editRetToGive} 
                       onChange={(e) => setEditRetToGive(e.target.value)}
                       className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                     />
                   </div>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RETAILER STORES MODAL */}
      {isStoreModalOpen && selectedRetailerStore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Manage Stores</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{selectedRetailerStore.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-250 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 space-y-4 min-h-0">
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide">Active Store Locations</span>
                {stores.length > 0 ? (
                  <div className="space-y-2">
                    {stores.map((s) => (
                      <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                        {editingStoreId === s.id ? (
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
                            {selectedRetailerStore.name.toLowerCase().trim() === "cms" && (
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Move to Retailer</label>
                                <select
                                  value={editStoreRetailerId}
                                  onChange={(e) => setEditStoreRetailerId(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                                >
                                  <option value={selectedRetailerStore.id}>Keep in CMS</option>
                                  {retailerDirectory
                                    .filter((r) => r.id !== selectedRetailerStore.id)
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>{r.name}</option>
                                    ))
                                  }
                                </select>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveStoreEdit(s.id)}
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingStoreId(null)}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                <Store className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{s.store_name}</p>
                                <p className="text-[9px] text-slate-400 font-medium">{s.address || "—"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleStartEditStore(s)}
                                className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                                title="Edit store"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStore(s.id, s.store_name)}
                                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
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
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
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
