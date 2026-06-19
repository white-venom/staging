"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, X, Store as StoreIcon, Trash2, Edit2, Check, Phone, MapPin } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import { useRouter } from "next/navigation";
import LedgerReportView from "../../../components/LedgerReportView";

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
  const { collections, deposits, setLedgerSearchTerm, portalDirectory, userDirectory } = useAdmin();
  const [retailerSearch, setRetailerSearch] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState<any | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreArea, setNewStoreArea] = useState("");
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  // Ledger Report View State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerRetailer, setLedgerRetailer] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerOutstanding, setLedgerOutstanding] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const handleOpenLedger = async (retailer: any) => {
    setLedgerRetailer(retailer);
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    try {
      const res = await api.getPublicLedger(retailer.ledger_token);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      alert("Failed to load ledger: " + err.message);
      setIsLedgerModalOpen(false);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Retailer Edit state
  const [isEditRetailerModalOpen, setIsEditRetailerModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<any | null>(null);
  const [editRetName, setEditRetName] = useState("");
  const [editRetPhone, setEditRetPhone] = useState("");
  const [editRetArea, setEditRetArea] = useState("");
  const [editRetEmail, setEditRetEmail] = useState("");
  // (opening_to_take / to_give are set only at create time — not editable from list)

  // Store Edit state
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreArea, setEditStoreArea] = useState("");
  const [editStoreRetailerId, setEditStoreRetailerId] = useState("");

  // Entry Edit/Delete states
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = useState(false);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = useState("");
  const [selectedNewAmount, setSelectedNewAmount] = useState(0);
  const [selectedNewDate, setSelectedNewDate] = useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = useState("");
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  
  const [selectedNewDenoms, setSelectedNewDenoms] = useState({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0,
  });

  const reloadLedger = async (retailer: any) => {
    setLoadingLedger(true);
    try {
      const res = await api.getPublicLedger(retailer.ledger_token);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      showToastNotification("Failed to reload ledger: " + err.message);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleDenomValChange = (key: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value) || 0;
    setSelectedNewDenoms(prev => {
      const updated = {
        ...prev,
        [key]: val
      };
      
      const totalCash = (
        (updated.note_500 || 0) * 500 +
        (updated.note_200 || 0) * 200 +
        (updated.note_100 || 0) * 100 +
        (updated.note_50 || 0) * 50 +
        (updated.note_20 || 0) * 20 +
        (updated.note_10 || 0) * 10 +
        (updated.coins || 0)
      );
      setSelectedNewAmount(totalCash);
      return updated;
    });
  };

  const handleStartEditEntry = (item: any) => {
    const isDeposit = item.deposit_id != null;
    setEditingIsDeposit(isDeposit);
    setEditingEntry(item);
    
    setSelectedNewRetailerId(item.retailer_id || (ledgerRetailer ? ledgerRetailer.id : ""));
    setSelectedNewPortalId(item.portal_id || "");
    setSelectedNewRemarks(item.remarks || "");
    setSelectedNewDate((item.date || "").split(" ")[0]);
    
    const isOnlineCol = !isDeposit && (item.portal_id != null || (item.denominations && Number(item.denominations.online_amount || 0) > 0));
    const initialPaymentMode = isDeposit ? (item.payment_mode || "online") : (isOnlineCol ? "online" : "cash");
    setSelectedNewPaymentMode(initialPaymentMode);
    setSelectedNewAmount(Number(item.amount || 0));
    
    if (isDeposit) {
      setSelectedNewDepositType(item.deposit_type || "retailer");
      setSelectedNewRefNo(item.reference_no || "");
      setSelectedNewRecipientStaffId(item.recipient_staff_id || "");
      setSelectedNewToOffice(item.to_office === true);
    }
    
    if (item.denominations) {
      setSelectedNewDenoms({
        note_500: Number(item.denominations.note_500 || 0),
        note_200: Number(item.denominations.note_200 || 0),
        note_100: Number(item.denominations.note_100 || 0),
        note_50: Number(item.denominations.note_50 || 0),
        note_20: Number(item.denominations.note_20 || 0),
        note_10: Number(item.denominations.note_10 || 0),
        coins: Number(item.denominations.coins || 0),
        online_amount: Number(item.denominations.online_amount || 0),
      });
    } else {
      setSelectedNewDenoms({
        note_500: 0,
        note_200: 0,
        note_100: 0,
        note_50: 0,
        note_20: 0,
        note_10: 0,
        coins: 0,
        online_amount: initialPaymentMode === "online" ? Number(item.amount || 0) : 0,
      });
    }
    
    setIsEditEntryModalOpen(true);
  };

  const handleDeleteEntry = async (item: any) => {
    if (!window.confirm("Delete this entry? This will permanently update balances.")) return;
    try {
      const isDeposit = item.deposit_id != null;
      const targetId = item.collection_id || item.deposit_id;
      if (!targetId) return;

      if (isDeposit) {
        await api.deleteDeposit(targetId);
      } else {
        await api.deleteCollection(targetId);
      }
      showToastNotification("Entry deleted successfully.");
      if (ledgerRetailer) {
        await reloadLedger(ledgerRetailer);
      }
      fetchData();
    } catch (err: any) {
      showToastNotification("Failed to delete entry: " + err.message);
    }
  };

  const handleSaveEntryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setIsSavingEntry(true);
    
    try {
      const targetId = editingEntry.collection_id || editingEntry.deposit_id;
      if (!targetId) return;

      const payloadDenoms = selectedNewPaymentMode === "cash"
        ? { ...selectedNewDenoms, online_amount: 0 }
        : { note_500: 0, note_200: 0, note_100: 0, note_50: 0, note_20: 0, note_10: 0, coins: 0, online_amount: Number(selectedNewAmount) };

      if (editingIsDeposit) {
        await api.updateDeposit(targetId, {
          deposit_type: selectedNewDepositType,
          portal_id: selectedNewDepositType === "portal" ? selectedNewPortalId : null,
          retailer_id: selectedNewDepositType === "retailer" ? selectedNewRetailerId : null,
          recipient_staff_id: selectedNewDepositType === "staff" && !selectedNewToOffice ? selectedNewRecipientStaffId : null,
          to_office: selectedNewDepositType === "staff" ? selectedNewToOffice : false,
          payment_mode: selectedNewPaymentMode,
          amount: Number(selectedNewAmount),
          deposit_date: selectedNewDate || new Date().toISOString().split("T")[0],
          reference_no: selectedNewRefNo || null,
          remarks: selectedNewRemarks || null,
          denominations: payloadDenoms
        });
      } else {
        await api.updateCollection(targetId, {
          retailer_id: selectedNewRetailerId || null,
          portal_id: selectedNewPaymentMode === "online" ? selectedNewPortalId : null,
          total_amount: selectedNewAmount,
          collection_date: selectedNewDate || new Date().toISOString().split("T")[0],
          remarks: selectedNewRemarks || "",
          denominations: payloadDenoms
        });
      }
      showToastNotification("Entry updated successfully.");
      setIsEditEntryModalOpen(false);
      if (ledgerRetailer) {
        await reloadLedger(ledgerRetailer);
      }
      fetchData();
    } catch (err: any) {
      showToastNotification("Failed to update: " + err.message);
    } finally {
      setIsSavingEntry(false);
    }
  };

  useEffect(() => {
    if (selectedRetailer) {
      fetchStores(selectedRetailer.id);
      setStoreSearch("");
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
          <input autoComplete="one-time-code"
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
        {[...(retailerDirectory || [])]
          .filter(r => (r.name || "").toLowerCase().includes((retailerSearch || "").toLowerCase()))
          .sort((a, b) => {
            const nameA = (a.name || "").toLowerCase().trim();
            const nameB = (b.name || "").toLowerCase().trim();
            if (nameA === "cms" && nameB !== "cms") return -1;
            if (nameB === "cms" && nameA !== "cms") return 1;
            return 0;
          })
          .map((retailer) => (
            <div
              key={retailer.id}
              onClick={() => handleOpenLedger(retailer)}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer group active:scale-[0.99] select-none"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-xs text-slate-555 dark:text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0">
                  <StoreIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors truncate">{retailer.name}</h3>
                  {retailer.name.toLowerCase().trim() !== "cms" && retailer.area && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3 h-3 text-slate-450" />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">{retailer.area}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-sm font-black ${(retailer.balance || 0) <= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
                  ₹{Math.abs(retailer.balance || 0).toLocaleString()}
                </span>
                <span className="text-[8px] font-black text-slate-455 uppercase block tracking-wider mt-1">Outstanding Balance</span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-6 select-none animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Edit Retailer Profile</h3>
              <button onClick={() => setIsEditRetailerModalOpen(false)} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveRetailerEdit} className="space-y-4">
              <div className="space-y-3">
                <input autoComplete="one-time-code" type="text" value={editRetName} onChange={(e) => setEditRetName(e.target.value)} placeholder="Retailer Name" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" required />
                <input autoComplete="one-time-code" type="tel" value={editRetPhone} onChange={(e) => setEditRetPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" required />
                <input autoComplete="one-time-code" type="text" value={editRetArea} onChange={(e) => setEditRetArea(e.target.value)} placeholder="Area / Route" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" />
                <input autoComplete="one-time-code" type="email" value={editRetEmail} onChange={(e) => setEditRetEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" />
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] select-none">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Current Net Balance</span>
                    <span className={`font-black ${(editingRetailer.balance || 0) <= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
                      ₹{Math.abs(editingRetailer.balance || 0).toLocaleString()}
                    </span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
                  setStoreSearch("");
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide">Active Store Locations</span>
                  {stores.length > 0 && (
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                      <input autoComplete="off"
                        type="text"
                        placeholder="Search stores..."
                        value={storeSearch}
                        onChange={(e) => setStoreSearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-semibold placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
                {stores.length > 0 ? (
                  (() => {
                    const filteredStores = stores.filter((s) =>
                      (s.store_name || "").toLowerCase().includes(storeSearch.toLowerCase()) ||
                      (s.address || "").toLowerCase().includes(storeSearch.toLowerCase())
                    );
                    return filteredStores.length > 0 ? (
                      <div className="space-y-2">
                        {filteredStores.map((s) => (
                          <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl">
                            {editingStoreId === s.id ? (
                              /* EDIT MODE */
                              <div className="space-y-2">
                                <input autoComplete="one-time-code"
                                  type="text"
                                  value={editStoreName}
                                  onChange={(e) => setEditStoreName(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg text-xs font-semibold focus:outline-none"
                                  placeholder="Store Name"
                                />
                                <input autoComplete="one-time-code"
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
                      <div className="text-center py-4 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                        <p className="text-[10px] text-slate-400 font-bold">No matching stores found</p>
                      </div>
                    );
                  })()
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
                    <input autoComplete="one-time-code"
                      type="text"
                      placeholder="Store Name"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none"
                      required
                    />
                    <input autoComplete="one-time-code"
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

      {isLedgerModalOpen && ledgerRetailer && (
        <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto select-none">
          {loadingLedger ? (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <LedgerReportView 
              title={ledgerRetailer.name}
              subtitle={`Route: ${ledgerRetailer.area}`}
              data={ledgerData}
              outstandingBalance={ledgerOutstanding}
              isPublic={false}
              onBack={() => {
                setIsLedgerModalOpen(false);
                setLedgerRetailer(null);
                setLedgerData([]);
              }}
              publicLink={typeof window !== "undefined" ? `${window.location.origin}/public/ledger/${ledgerRetailer.ledger_token}` : ""}
              onEditRetailer={() => handleStartEditRetailer(ledgerRetailer)}
              onDeleteRetailer={() => {
                handleDeleteRetailer(ledgerRetailer.id, ledgerRetailer.name);
                setIsLedgerModalOpen(false);
              }}
              onManageStores={() => {
                setSelectedRetailer(ledgerRetailer);
                setIsStoreModalOpen(true);
              }}
              phone={ledgerRetailer.phone}
              onEditEntry={handleStartEditEntry}
              onDeleteEntry={handleDeleteEntry}
            />
          )}
        </div>
      )}
      {/* EDIT TRANSACTION ENTRY MODAL */}
      {isEditEntryModalOpen && editingEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-6 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {editingIsDeposit ? "Edit Cash Out Entry" : "Edit Cash In Entry"}
              </h3>
              <button 
                onClick={() => setIsEditEntryModalOpen(false)} 
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-550 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEntryEdit} className="space-y-4">
              <div className="space-y-3">
                
                {/* RETAILER INPUT (only for collections/Cash In) */}
                {!editingIsDeposit && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Retailer</label>
                    <select
                      value={selectedNewRetailerId}
                      onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                    >
                      <option value="">No Retailer</option>
                      {retailerDirectory.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* PAYMENT MODE SELECTOR (for Collections) */}
                {!editingIsDeposit && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Mode</label>
                    <select
                      value={selectedNewPaymentMode}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setSelectedNewPaymentMode(mode);
                        if (mode === "cash") {
                          setSelectedNewPortalId("");
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                )}

                {/* PORTAL SELECTOR (only for Online collections) */}
                {!editingIsDeposit && selectedNewPaymentMode === "online" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Portal Channel</label>
                    <select
                      value={selectedNewPortalId}
                      onChange={(e) => setSelectedNewPortalId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      required
                    >
                      <option value="">Select Portal Bank Account</option>
                      {portalDirectory
                        .flatMap((group: any) => (group.portals || []).map((p: any) => ({ ...p, groupName: group.name })))
                        .filter((p: any) => p.show_in_online_payment)
                        .map((p: any) => {
                          const displayName = p.groupName && p.groupName.toLowerCase() !== p.portal_name.toLowerCase()
                            ? `${p.groupName} - ${p.portal_name}`
                            : p.portal_name;
                          return (
                            <option key={p.id} value={p.id}>
                              {displayName} {p.bank_name ? `(${p.bank_name})` : ""}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}

                {/* DEPOSIT TYPE AND FIELDS (only for Deposits/Cash Out) */}
                {editingIsDeposit && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deposit Type</label>
                      <select
                        value={selectedNewDepositType}
                        onChange={(e) => setSelectedNewDepositType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="portal">Portal Bank Deposit</option>
                        <option value="retailer">Retailer Payout</option>
                        <option value="staff">Staff/Office Handover</option>
                        <option value="virtual">Virtual Limit Transfer</option>
                      </select>
                    </div>

                    {selectedNewDepositType === "portal" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Portal</label>
                        <select
                          value={selectedNewPortalId}
                          onChange={(e) => setSelectedNewPortalId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                          required
                        >
                          <option value="">Select Portal Bank Account</option>
                          {portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.portal_name} ({p.bank_name})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedNewDepositType === "retailer" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Retailer</label>
                        <select
                          value={selectedNewRetailerId}
                          onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                          required
                        >
                          <option value="">Select Retailer</option>
                          {retailerDirectory.map((r: any) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedNewDepositType === "staff" && (
                      <>
                        <div className="flex items-center gap-1.5 py-0.5">
                          <input
                            type="checkbox"
                            id="editToOfficeCheckboxDesktop"
                            checked={selectedNewToOffice}
                            onChange={(e) => setSelectedNewToOffice(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-205 dark:border-slate-800"
                          />
                          <label htmlFor="editToOfficeCheckboxDesktop" className="text-[10px] font-bold text-slate-650 dark:text-slate-400 uppercase">Handover to Cashier</label>
                        </div>
                        {!selectedNewToOffice && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Recipient Staff</label>
                            <select
                              value={selectedNewRecipientStaffId}
                              onChange={(e) => setSelectedNewRecipientStaffId(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                              required
                            >
                              <option value="">Select Staff</option>
                              {(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Mode</label>
                      <select
                        value={selectedNewPaymentMode}
                        onChange={(e) => setSelectedNewPaymentMode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="cash">Cash</option>
                        <option value="online">Online</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference No</label>
                      <input 
                        type="text" 
                        value={selectedNewRefNo} 
                        onChange={(e) => setSelectedNewRefNo(e.target.value)} 
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" 
                        placeholder="Optional reference number"
                      />
                    </div>
                  </>
                )}

                {/* DATE FIELD (Always visible) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Date</label>
                  <input 
                    type="date" 
                    value={selectedNewDate} 
                    onChange={(e) => setSelectedNewDate(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" 
                    required 
                  />
                </div>

                {/* AMOUNT FIELD (Always visible) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={selectedNewAmount} 
                    onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))} 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold disabled:opacity-75 disabled:bg-slate-100" 
                    required 
                    disabled={selectedNewPaymentMode === "cash"}
                  />
                </div>

                {/* DENOMINATIONS (for Cash Mode) */}
                {selectedNewPaymentMode === "cash" && (
                  <div className="bg-slate-50 dark:bg-slate-955 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 select-none">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Cash Denominations</label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-bold">
                      {[
                        { label: "500", key: "note_500" },
                        { label: "200", key: "note_200" },
                        { label: "100", key: "note_100" },
                        { label: "50", key: "note_50" },
                        { label: "20", key: "note_20" },
                        { label: "10", key: "note_10" },
                      ].map((n) => (
                        <div key={n.key} className="flex items-center gap-1.5 justify-between">
                          <span className="text-slate-500 w-8">₹{n.label}</span>
                          <input
                            type="number"
                            placeholder="0"
                            min="0"
                            value={selectedNewDenoms[n.key as keyof typeof selectedNewDenoms] || ""}
                            onChange={(e) => handleDenomValChange(n.key, e.target.value)}
                            className="w-16 px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-center text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                      ))}
                      <div className="col-span-2 flex items-center gap-1.5 justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Coins / ₹1</span>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          value={selectedNewDenoms.coins || ""}
                          onChange={(e) => handleDenomValChange("coins", e.target.value)}
                          className="w-16 px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-center text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* REMARKS FIELD */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                  <textarea 
                    value={selectedNewRemarks} 
                    onChange={(e) => setSelectedNewRemarks(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" 
                    rows={2}
                    placeholder="Remarks"
                  />
                </div>

              </div>
              <button 
                type="submit" 
                disabled={isSavingEntry}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                {isSavingEntry ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
