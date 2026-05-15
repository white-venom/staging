"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, X, Store as StoreIcon, Trash2, Edit2, Check, Phone, MapPin } from "lucide-react";
import { api } from "../../utils/api";
import { useAdmin } from "../context/AdminContext";
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
  const { setLedgerSearchTerm } = useAdmin();
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
  const [editRetToGive, setEditRetToGive] = useState(0);
  const [editRetToTake, setEditRetToTake] = useState(0);

  // Store Edit state
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreArea, setEditStoreArea] = useState("");

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

  // --- Retailer Actions ---
  const handleStartEditRetailer = (retailer: any) => {
    setEditingRetailer(retailer);
    setEditRetName(retailer.name);
    setEditRetPhone(retailer.phone);
    setEditRetArea(retailer.area);
    setEditRetEmail(retailer.email || "");
    setEditRetToGive(retailer.opening_to_give || 0);
    setEditRetToTake(retailer.opening_to_take || 0);
    setIsEditRetailerModalOpen(true);
  };

  const handleSaveRetailerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRetailer) return;
    try {
      await api.updateRetailer(editingRetailer.id, {
        retailer_name: editRetName,
        phone: editRetPhone,
        address: editRetArea,
        email: editRetEmail,
        opening_to_give: editRetToGive,
        opening_to_take: editRetToTake
      });
      showToastNotification(`Retailer "${editRetName}" updated.`);
      setIsEditRetailerModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    }
  };

  const handleDeleteRetailer = async (id: string, name: string) => {
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
  };

  const handleSaveStoreEdit = async (storeId: string) => {
    if (!selectedRetailer || !editStoreName) return;
    try {
      await api.updateStore(selectedRetailer.id, storeId, {
        store_name: editStoreName,
        address: editStoreArea
      });
      showToastNotification(`Store updated successfully.`);
      setEditingStoreId(null);
      fetchStores(selectedRetailer.id);
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
              {/* Actions Overlay */}
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleStartEditRetailer(retailer)}
                  className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => handleDeleteRetailer(retailer.id, retailer.name)}
                  className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">{retailer.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-2.5 h-2.5 text-slate-400" />
                      <span className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">Route: {retailer.area}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{retailer.phone}</span>
                    </div>
                    {retailer.email && (
                      <span className="text-[8px] text-blue-500 font-medium mt-0.5">{retailer.email}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-wide block mb-0.5">To Take</span>
                    <span className="text-xs font-black text-red-600 dark:text-red-400">
                      ₹{(retailer.balance > 0 ? retailer.balance : 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-wide block mb-0.5">To Give</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-500">
                      ₹{(retailer.balance < 0 ? Math.abs(retailer.balance) : 0).toLocaleString()}
                    </span>
                  </div>
                </div>
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
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-red-500 uppercase">To Take</label>
                     <input 
                       type="number" 
                       value={editRetToTake || ""} 
                       onChange={(e) => setEditRetToTake(e.target.value ? Number(e.target.value) : 0)}
                       className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" 
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-emerald-500 uppercase">To Give</label>
                     <input 
                       type="number" 
                       value={editRetToGive || ""} 
                       onChange={(e) => setEditRetToGive(e.target.value ? Number(e.target.value) : 0)}
                       className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" 
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
