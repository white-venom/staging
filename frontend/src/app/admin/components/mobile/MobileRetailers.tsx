"use client";

import React, { useState, useEffect } from "react";
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
import { getISTDateString } from "../../../utils/dateHelpers";
import LedgerReportView from "../../../components/LedgerReportView";
import InlineSelect from "@/app/components/InlineSelect";

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
  const { collections, deposits, portalDirectory, userDirectory } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      showToastNotification("Failed to load ledger: " + err.message);
      setIsLedgerModalOpen(false);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Form states
  const [retName, setRetName] = useState("");
  const [retPhone, setRetPhone] = useState("");
  const [retArea, setRetArea] = useState("");
  const [retEmail, setRetEmail] = useState("");
  const [retCategory, setRetCategory] = useState("");
  const [retToTake, setRetToTake] = useState("");
  const [retToGive, setRetToGive] = useState("");

  // Retailer Edit state
  const [isEditRetailerModalOpen, setIsEditRetailerModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<any | null>(null);
  const [editRetName, setEditRetName] = useState("");
  const [editRetPhone, setEditRetPhone] = useState("");
  const [editRetArea, setEditRetArea] = useState("");
  const [editRetEmail, setEditRetEmail] = useState("");
  const [editRetCategory, setEditRetCategory] = useState("");
  const [editRetToTake, setEditRetToTake] = useState("");
  const [editRetToGive, setEditRetToGive] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Retailer Store logic
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedRetailerStore, setSelectedRetailerStore] = useState<any | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreArea, setNewStoreArea] = useState("");
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreArea, setEditStoreArea] = useState("");
  const [editStoreRetailerId, setEditStoreRetailerId] = useState("");

  // Entry Edit/Delete states
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = useState(false);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
  const [selectedNewStoreId, setSelectedNewStoreId] = useState("");
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = useState("");
  const [selectedNewAmount, setSelectedNewAmount] = useState(0);
  const [selectedNewDate, setSelectedNewDate] = useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = useState("");
  const [selectedNewVirtualTargetType, setSelectedNewVirtualTargetType] = useState("retailer");
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

  useEffect(() => {
    const fetchStores = async () => {
      if (selectedNewRetailerId) {
        try {
          const stores = await api.getRetailerStores(selectedNewRetailerId);
          setAvailableStores(stores || []);
          if (editingEntry && (editingEntry.retailer_id === selectedNewRetailerId || editingEntry.retailerId === selectedNewRetailerId)) {
            setSelectedNewStoreId(editingEntry.store_id || editingEntry.storeId || "");
          } else {
            setSelectedNewStoreId("");
          }
        } catch (err) {
          console.error("Failed to fetch stores in edit modal:", err);
          setAvailableStores([]);
          setSelectedNewStoreId("");
        }
      } else {
        setAvailableStores([]);
        setSelectedNewStoreId("");
      }
    };
    fetchStores();
  }, [selectedNewRetailerId, editingEntry]);

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
    setSelectedNewStoreId(item.store_id || item.storeId || "");
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
      const hasStaff = !!(item.recipient_staff_id || item.recipientStaffId);
      setSelectedNewVirtualTargetType(hasStaff ? "staff" : "retailer");
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
        const portalId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewPortalId : null;
        const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
        const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
        const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

        await api.updateDeposit(targetId, {
          deposit_type: selectedNewDepositType,
          portal_id: portalId,
          retailer_id: retailerId,
          recipient_staff_id: recipientStaffId,
          to_office: toOffice,
          payment_mode: selectedNewPaymentMode,
          amount: Number(selectedNewAmount),
          deposit_date: selectedNewDate || getISTDateString(),
          reference_no: selectedNewRefNo || null,
          remarks: selectedNewRemarks || null,
          denominations: payloadDenoms
        });
      } else {
        await api.updateCollection(targetId, {
          retailer_id: selectedNewRetailerId || null,
          portal_id: selectedNewPaymentMode === "online" ? selectedNewPortalId : null,
          store_id: selectedNewStoreId || null,
          total_amount: selectedNewAmount,
          collection_date: selectedNewDate || getISTDateString(),
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

  React.useEffect(() => {
    if (selectedRetailerStore) {
      fetchStores(selectedRetailerStore.id);
      setStoreSearch("");
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
    setEditRetCategory(retailer.category || "");
    setEditRetToTake(String(retailer.opening_to_take ?? 0));
    setEditRetToGive(String(retailer.opening_to_give ?? 0));

    setIsEditRetailerModalOpen(true);
  };

  const handleSaveRetailerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRetailer) return;
    setSubmitting(true);
    try {
      const newToTake = parseFloat(editRetToTake || "0") || 0;
      const newToGive = parseFloat(editRetToGive || "0") || 0;
      const currentToTake = parseFloat(String(editingRetailer.opening_to_take ?? 0)) || 0;
      const currentToGive = parseFloat(String(editingRetailer.opening_to_give ?? 0)) || 0;
      const deltaToTake = newToTake - currentToTake;
      const deltaToGive = newToGive - currentToGive;

      const payload: any = {
        retailer_name: editRetName,
        phone: editRetPhone,
        address: editRetArea,
        email: editRetEmail,
        category: editRetCategory || null
      };
      if (deltaToTake !== 0) payload.opening_to_take = deltaToTake;
      if (deltaToGive !== 0) payload.opening_to_give = deltaToGive;

      await api.updateRetailer(editingRetailer.id, payload);
      showToastNotification(`Retailer "${editRetName}" updated`);
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
        category: retCategory || undefined,
        opening_to_take: takeVal,
        opening_to_give: giveVal
      });
      showToastNotification(`Retailer "${retName}" registered`);
      setRetName(""); setRetPhone(""); setRetArea(""); setRetEmail(""); setRetCategory(""); setRetToTake(""); setRetToGive("");
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

  const categories = React.useMemo(() => {
    const normalizedList = (retailerDirectory || [])
      .map((r) => r.category)
      .filter((c): c is string => typeof c === "string" && c.trim() !== "")
      .map((c) => {
        return c.trim()
          .toLowerCase()
          .split(/\s+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      });
    return Array.from(new Set(normalizedList)).sort();
  }, [retailerDirectory]);

  const filtered = React.useMemo(() => {
    return [...retailerDirectory]
      .filter(r => 
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.phone?.includes(searchTerm)
      )
      .filter(r => {
        if (selectedCategories.length === 0) return true;
        if (!r.category) return false;
        const normalized = r.category.trim()
          .toLowerCase()
          .split(/\s+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        return selectedCategories.includes(normalized);
      })
      .sort((a, b) => {
        const nameA = (a.name || "").toLowerCase().trim();
        const nameB = (b.name || "").toLowerCase().trim();
        if (nameA === "cms" && nameB !== "cms") return -1;
        if (nameB === "cms" && nameA !== "cms") return 1;
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
  }, [retailerDirectory, searchTerm, selectedCategories]);

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
              <input autoComplete="one-time-code"
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
                <input autoComplete="one-time-code"
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
                <input autoComplete="one-time-code"
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
              <input autoComplete="one-time-code"
                type="text"
                value={retArea}
                onChange={e => setRetArea(e.target.value)}
                placeholder="Sector 62, Noida"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Category</label>
              <input autoComplete="one-time-code"
                type="text"
                value={retCategory}
                onChange={e => setRetCategory(e.target.value)}
                placeholder="e.g. Supermarket, Wholesaler"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Opening To Take (₹)</label>
                <input autoComplete="one-time-code"
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
                <input autoComplete="one-time-code"
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

      {/* Search & Sort */}
      <div className="px-1 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input autoComplete="one-time-code" 
            type="text"
            placeholder="Search retailer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium shadow-sm focus:ring-1 focus:ring-blue-500/20"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 transition-all ${
                selectedCategories.length === 0
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-black shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400"
              }`}
            >
              All
            </button>
            {categories.map((cat) => {
              const isActive = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategories((prev) =>
                      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
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
                onClick={() => handleOpenLedger(retailer)}
                className="bg-white dark:bg-slate-900 py-3 px-3 border-b border-slate-50 dark:border-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-955/20 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Store className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{retailer.name}</span>
                      {retailer.category && (
                        <span className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 rounded-full text-[8px] font-bold uppercase tracking-wider scale-90 origin-left">
                          {retailer.category.trim()
                            .toLowerCase()
                            .split(/\s+/)
                            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                        </span>
                      )}
                    </div>
                    {retailer.name.toLowerCase().trim() !== "cms" && retailer.area && (
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate block mt-0.5">{retailer.area}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`font-black text-xs ${(retailer.balance || 0) <= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
                    ₹{Math.round(Math.abs(retailer.balance || 0)).toLocaleString()}
                  </span>
                  <span className="text-[7px] font-bold text-slate-400 uppercase block tracking-tighter mt-0.5">Net Balance</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RETAILER EDIT MODAL */}
      {isEditRetailerModalOpen && editingRetailer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2">
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
                  <input autoComplete="one-time-code" 
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
                  <input autoComplete="one-time-code" 
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
                  <input autoComplete="one-time-code" 
                    type="text" 
                    value={editRetArea} 
                    onChange={(e) => setEditRetArea(e.target.value)} 
                    placeholder="Area / Route" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Email</label>
                  <input autoComplete="one-time-code" 
                    type="email" 
                    value={editRetEmail} 
                    onChange={(e) => setEditRetEmail(e.target.value)} 
                    placeholder="Email" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Category</label>
                  <input autoComplete="one-time-code" 
                    type="text" 
                    value={editRetCategory} 
                    onChange={(e) => setEditRetCategory(e.target.value)} 
                    placeholder="Category" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-md border border-slate-100 dark:border-slate-800 text-[9px] flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Net Balance</span>
                  <span className={`font-extrabold ${(editingRetailer.balance || 0) <= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
                    ₹{Math.abs(editingRetailer.balance || 0).toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-2">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Opening Balance Adjustment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[8px] font-bold text-amber-500 uppercase mb-0.5">To Take (₹)</label>
                      <input
                        autoComplete="one-time-code"
                        type="number"
                        step="any"
                        min="0"
                        value={editRetToTake}
                        onChange={(e) => setEditRetToTake(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-md text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-blue-500 uppercase mb-0.5">To Give (₹)</label>
                      <input
                        autoComplete="one-time-code"
                        type="number"
                        step="any"
                        min="0"
                        value={editRetToGive}
                        onChange={(e) => setEditRetToGive(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-md text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-sm p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Manage Stores</h3>
                  <p className="text-[9px] font-bold text-slate-450">{selectedRetailerStore.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsStoreModalOpen(false);
                  setStoreSearch("");
                }}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-y-auto pr-0.5 flex-1 space-y-3 min-h-0">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">Active Store Locations</span>
                  {stores.length > 0 && (
                    <div className="relative w-36">
                      <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-400" />
                      <input autoComplete="off"
                        type="text"
                        placeholder="Search stores..."
                        value={storeSearch}
                        onChange={(e) => setStoreSearch(e.target.value)}
                        className="w-full pl-6 pr-1.5 py-0.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-[9px] font-semibold placeholder-slate-400 focus:outline-none"
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
                      <div className="space-y-1">
                        {filteredStores.map((s) => (
                          <div key={s.id} className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded">
                            {editingStoreId === s.id ? (
                              <div className="space-y-1.5">
                                <input autoComplete="one-time-code"
                                  type="text"
                                  value={editStoreName}
                                  onChange={(e) => setEditStoreName(e.target.value)}
                                  className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded text-xs font-semibold focus:outline-none"
                                  placeholder="Store Name"
                                />
                                <input autoComplete="one-time-code"
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
                      <div className="text-center py-4 border border-dashed border-slate-205 dark:border-slate-805 rounded">
                        <p className="text-[9px] text-slate-400 font-bold">No matching stores found.</p>
                      </div>
                    );
                  })()
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
                    <input autoComplete="one-time-code"
                      type="text"
                      placeholder="Store Name"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                      required
                    />
                    <input autoComplete="one-time-code"
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
              onEditEntry={handleStartEditEntry}
              onDeleteEntry={handleDeleteEntry}
              hidePortalBankNames={true}
              onEditRetailer={() => handleStartEditRetailer(ledgerRetailer)}
              onDeleteRetailer={() => {
                handleDeleteRetailer(ledgerRetailer.id, ledgerRetailer.name);
                setIsLedgerModalOpen(false);
              }}
              onManageStores={() => {
                setSelectedRetailerStore(ledgerRetailer);
                setIsStoreModalOpen(true);
              }}
              phone={ledgerRetailer.phone}
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
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-505 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEntryEdit} className="space-y-4">
              <div className="space-y-3">
                
                {!editingIsDeposit && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Retailer</label>
                    <InlineSelect
                      value={selectedNewRetailerId}
                      onChange={setSelectedNewRetailerId}
                      options={[
                        { value: "", label: "No Retailer" },
                        ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                      ]}
                      placeholder="No Retailer"
                    />
                  </div>
                )}

                {!editingIsDeposit && availableStores.length > 0 && (
                  <div className="animate-in fade-in duration-200">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Parent Store (Shop/Branch)</label>
                    <InlineSelect
                      value={selectedNewStoreId}
                      onChange={setSelectedNewStoreId}
                      options={[
                        { value: "", label: "None / Cash" },
                        ...availableStores.map((s: any) => ({ value: String(s.id), label: s.store_name }))
                      ]}
                      placeholder="None / Cash"
                    />
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
                    <InlineSelect
                      value={selectedNewPortalId}
                      onChange={setSelectedNewPortalId}
                      options={[
                        { value: "", label: "Select Portal Bank Account" },
                        ...portalDirectory
                          .flatMap((group: any) => (group.portals || []).map((p: any) => ({ ...p, groupName: group.name })))
                          .filter((p: any) => p.show_in_online_payment)
                          .map((p: any) => {
                            return { value: String(p.id), label: p.groupName || p.portal_name };
                          })
                      ]}
                      placeholder="Select Portal Bank Account"
                    />
                  </div>
                )}

                {/* DEPOSIT TYPE AND FIELDS (only for Deposits/Cash Out) */}
                {editingIsDeposit && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deposit Type</label>
                      <select
                        value={selectedNewDepositType === "virtual" ? (selectedNewPaymentMode === "refund" ? "virtual-refund" : "virtual-load") : selectedNewDepositType}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "virtual-load") {
                            setSelectedNewDepositType("virtual");
                            setSelectedNewPaymentMode("online");
                          } else if (val === "virtual-refund") {
                            setSelectedNewDepositType("virtual");
                            setSelectedNewPaymentMode("refund");
                          } else {
                            setSelectedNewDepositType(val);
                            if (val === "portal" || val === "retailer") {
                              setSelectedNewPaymentMode("online");
                            } else if (val === "staff") {
                              setSelectedNewPaymentMode("cash");
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <option value="portal">Cash Out</option>
                        <option value="retailer">Retailer Payout</option>
                        <option value="staff">Direct Handover</option>
                        <option value="virtual-load">Virtual Transfer</option>
                        <option value="virtual-refund">Move to Distributor</option>
                      </select>
                    </div>

                    {selectedNewDepositType === "portal" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Portal</label>
                        <InlineSelect
                          value={selectedNewPortalId}
                          onChange={setSelectedNewPortalId}
                          options={[
                            { value: "", label: "Select Portal Bank Account" },
                            ...portalDirectory.flatMap((group: any) => (group.portals || []).map((p: any) => {
                              return { value: String(p.id), label: (group.name || p.portal_name).split(' - ')[0].trim() };
                            }))
                          ]}
                          placeholder="Select Portal Bank Account"
                        />
                      </div>
                    )}

                    {selectedNewDepositType === "retailer" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Retailer</label>
                        <InlineSelect
                          value={selectedNewRetailerId}
                          onChange={setSelectedNewRetailerId}
                          options={[
                            { value: "", label: "Select Retailer" },
                            ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                          ]}
                          placeholder="Select Retailer"
                        />
                      </div>
                    )}

                    {selectedNewDepositType === "staff" && (
                      <>
                        <div className="flex items-center gap-1.5 py-0.5">
                          <input
                            type="checkbox"
                            id="editToOfficeCheckboxMobile"
                            checked={selectedNewToOffice}
                            onChange={(e) => setSelectedNewToOffice(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-200 dark:border-slate-800"
                          />
                          <label htmlFor="editToOfficeCheckboxMobile" className="text-[10px] font-bold text-slate-650 dark:text-slate-400 uppercase">Handover to Cashier</label>
                        </div>
                        {!selectedNewToOffice && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Recipient Staff</label>
                            <InlineSelect
                              value={selectedNewRecipientStaffId}
                              onChange={setSelectedNewRecipientStaffId}
                              options={[
                                { value: "", label: "Select Staff" },
                                ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                              ]}
                              placeholder="Select Staff"
                            />
                          </div>
                        )}
                      </>
                    )}
                    {selectedNewDepositType === "virtual" && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            {selectedNewPaymentMode === "refund" ? "Destination Portal" : "Source Portal"}
                          </label>
                          <InlineSelect
                            value={selectedNewPortalId}
                            onChange={setSelectedNewPortalId}
                            options={[
                              { value: "", label: "Select Portal Bank Account" },
                              ...portalDirectory.flatMap((group: any) => (group.portals || []).map((p: any) => {
                                return { value: String(p.id), label: (group.name || p.portal_name).split(' - ')[0].trim() };
                              }))
                            ]}
                            placeholder="Select Portal Bank Account"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                          </label>
                          <select
                            value={selectedNewVirtualTargetType}
                            onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                          >
                            <option value="retailer">Retailer</option>
                            <option value="staff">Staff Member</option>
                          </select>
                        </div>

                        {selectedNewVirtualTargetType === "retailer" ? (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Source Retailer" : "Destination Retailer"}
                            </label>
                            <InlineSelect
                              value={selectedNewRetailerId}
                              onChange={setSelectedNewRetailerId}
                              options={[
                                { value: "", label: "Select Retailer" },
                                ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                              ]}
                              placeholder="Select Retailer"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Source Staff Member" : "Destination Staff Member"}
                            </label>
                            <InlineSelect
                              value={selectedNewRecipientStaffId}
                              onChange={setSelectedNewRecipientStaffId}
                              options={[
                                { value: "", label: "Select Staff Member" },
                                ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                              ]}
                              placeholder="Select Staff Member"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {selectedNewDepositType !== "virtual" && (
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
                    )}

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
