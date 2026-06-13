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
  // (opening_to_take / to_give are set only at create time — not editable from list)

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



  const handleStartEditRetailer = (retailer: any) => {
    setEditingRetailer(retailer);
    setEditRetName(retailer.name);
    setEditRetPhone(retailer.phone);
    setEditRetArea(retailer.area);
    setEditRetEmail(retailer.email || "");

    setIsEditRetailerModalOpen(true);
  };

  const handleSaveRetailerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRetailer) return;
    setSubmitting(true);
    try {
      await api.updateRetailer(editingRetailer.id, {
        retailer_name: editRetName,
        phone: editRetPhone,
        address: editRetArea,
        email: editRetEmail,
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
    if (name.toLowerCase().trim() === "cms") {
      showToastNotification("CMS retailer cannot be deleted");
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
    <div className="space-y-2">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md text-slate-500 active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Retailers</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{retailerDirectory.length} Partners</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(v => !v)}
          className={`w-8 h-8 rounded-lg shadow flex items-center justify-center active:scale-90 transition-transform ${showAddForm ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-none' : 'bg-emerald-600 text-white shadow-emerald-500/30'}`}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Add Retailer Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg p-3 space-y-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider border-l-2 border-emerald-500 pl-1.5">New Retailer</p>
          <form onSubmit={handleCreateRetailer} className="space-y-2">
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Retailer Name</label>
              <input
                type="text"
                value={retName}
                onChange={e => setRetName(e.target.value)}
                placeholder="e.g. Laxmi Telecom"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Phone</label>
                <input
                  type="tel"
                  value={retPhone}
                  onChange={e => setRetPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Email</label>
                <input
                  type="email"
                  value={retEmail}
                  onChange={e => setRetEmail(e.target.value)}
                  placeholder="laxmi@gmail.com"
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Address/Area</label>
              <input
                type="text"
                value={retArea}
                onChange={e => setRetArea(e.target.value)}
                placeholder="Sector 62, Noida"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Opening To Take (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={retToTake}
                  onChange={e => setRetToTake(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Opening To Give (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={retToGive}
                  onChange={e => setRetToGive(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-emerald-600 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Registering..." : "Register Retailer"}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="px-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search retailer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium shadow-sm focus:ring-1 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Retailer Cards */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 pb-20">
        {filtered.length === 0 ? (
          <div className="py-8 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2 opacity-50">
              <Store className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No retailers found</p>
          </div>
        ) : (
          filtered.map((retailer) => {
            return (
              <div 
                key={retailer.id}
                className="bg-white dark:bg-slate-900 py-1.5 px-2 border-b border-slate-50 dark:border-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/20"
              >
                {/* Row Header */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Store className="w-3.5 h-3.5 text-emerald-650 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[130px]">{retailer.name}</span>
                        {retailer.name.toLowerCase().trim() !== "cms" && retailer.area && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase truncate">({retailer.area})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {retailer.phone && retailer.name.toLowerCase().trim() !== "cms" && (
                      <a 
                        href={`tel:${retailer.phone}`}
                        className="p-1 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded hover:bg-slate-100 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                    <button 
                      onClick={() => handleStartEditRetailer(retailer)}
                      className="p-1 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {retailer.name.toLowerCase().trim() !== "cms" && (
                      <button 
                        onClick={() => handleDeleteRetailer(retailer.id, retailer.name)}
                        className="p-1 bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 rounded hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedRetailerStore(retailer);
                        setIsStoreModalOpen(true);
                      }}
                      className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-[9px] font-bold rounded cursor-pointer"
                      title="Manage Stores"
                    >
                      Stores
                    </button>
                  </div>
                </div>

                {/* Net Balance only */}
                <div className="mt-1 flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-[10px]">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Net Bal:</span>
                  <span className={`font-black ${(retailer.balance || 0) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    ₹{Math.round(Math.abs(retailer.balance || 0))}
                  </span>
                </div>
              </div>
            );})
        )}
      </div>

      {/* RETAILER EDIT MODAL */}
      {isEditRetailerModalOpen && editingRetailer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-xs p-3 space-y-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Edit Retailer</h3>
              <button 
                onClick={() => setIsEditRetailerModalOpen(false)} 
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleSaveRetailerEdit} className="space-y-2.5">
              <div className="space-y-2">
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Retailer Name</label>
                  <input 
                    type="text" 
                    value={editRetName} 
                    onChange={(e) => setEditRetName(e.target.value)} 
                    placeholder="Retailer Name" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Phone</label>
                  <input 
                    type="tel" 
                    value={editRetPhone} 
                    onChange={(e) => setEditRetPhone(e.target.value)} 
                    placeholder="Phone" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Area / Route</label>
                  <input 
                    type="text" 
                    value={editRetArea} 
                    onChange={(e) => setEditRetArea(e.target.value)} 
                    placeholder="Area / Route" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Email</label>
                  <input 
                    type="email" 
                    value={editRetEmail} 
                    onChange={(e) => setEditRetEmail(e.target.value)} 
                    placeholder="Email" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-md border border-slate-100 dark:border-slate-800 text-[9px] flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Net Balance</span>
                  <span className={`font-extrabold ${(editingRetailer.balance || 0) <= 0 ? 'text-emerald-650 dark:text-emerald-500' : 'text-red-650 dark:text-red-400'}`}>
                    ₹{Math.abs(editingRetailer.balance || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98]"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RETAILER STORES MODAL */}
      {isStoreModalOpen && selectedRetailerStore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-sm p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-650" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Manage Stores</h3>
                  <p className="text-[9px] font-bold text-slate-450">{selectedRetailerStore.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-y-auto pr-0.5 flex-1 space-y-3 min-h-0">
              <div className="space-y-1.5">
                <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">Active Store Locations</span>
                {stores.length > 0 ? (
                  <div className="space-y-1">
                    {stores.map((s) => (
                      <div key={s.id} className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded">
                        {editingStoreId === s.id ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editStoreName}
                              onChange={(e) => setEditStoreName(e.target.value)}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded text-xs font-semibold focus:outline-none"
                              placeholder="Store Name"
                            />
                            <input
                              type="text"
                              value={editStoreArea}
                              onChange={(e) => setEditStoreArea(e.target.value)}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                              placeholder="Area / Address"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleSaveStoreEdit(s.id)}
                                className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold flex items-center justify-center cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingStoreId(null)}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[9px] font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <Store className="w-3 h-3 text-blue-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{s.store_name}</p>
                                <p className="text-[8px] text-slate-400 font-medium truncate">{s.address || "—"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEditStore(s)}
                                className="p-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Edit store"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteStore(s.id, s.store_name)}
                                className="p-1 rounded bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors cursor-pointer"
                                title="Delete store"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 border border-dashed border-slate-205 dark:border-slate-800 rounded">
                    <p className="text-[9px] text-slate-400 font-bold">No stores registered.</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 shrink-0">
                <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Add New Store</span>
                <form onSubmit={handleCreateStore} className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder="Store Name"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Area / Address"
                      value={newStoreArea}
                      onChange={(e) => setNewStoreArea(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreatingStore}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shadow flex items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> {isCreatingStore ? "Adding..." : "Register Store"}
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
