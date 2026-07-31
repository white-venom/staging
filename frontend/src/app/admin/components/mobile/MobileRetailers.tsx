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
import { useRouter } from "next/navigation";
import { useAdmin } from "../../context/AdminContext";
import { getISTDateString } from "../../../utils/dateHelpers";
import LedgerReportView from "../../../components/LedgerReportView";
import InlineSelect from "@/app/components/InlineSelect";

interface MobileRetailersProps {
  retailerDirectory: any[];
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
  // Set when reached directly at /admin/retailers/[token]/ledger so a page
  // refresh re-opens the same ledger instead of the bare retailer list.
  initialLedgerToken?: string;
}

export default function MobileRetailers({
  retailerDirectory,
  showToastNotification,
  fetchData,
  initialLedgerToken
}: MobileRetailersProps) {
  const router = useRouter();
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

  const handleOpenLedger = async (retailer: any, opts?: { skipNav?: boolean }) => {
    setLedgerRetailer(retailer);
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    if (!opts?.skipNav) {
      router.push(`/admin/retailers/${retailer.ledger_token}/ledger`);
    }
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

  // Re-open the right ledger when this component is reached directly at
  // /admin/retailers/[token]/ledger (a fresh load or a page refresh).
  useEffect(() => {
    if (!initialLedgerToken || isLedgerModalOpen) return;
    const match = retailerDirectory.find((r) => r.ledger_token === initialLedgerToken);
    if (match) {
      handleOpenLedger(match, { skipNav: true });
    }
  }, [initialLedgerToken, retailerDirectory]);

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
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedNewBankAccountId, setSelectedNewBankAccountId] = useState("");
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
    setSelectedNewPortalId(""); // re-derived from bank_account_id below via effectiveEditPortalId
    setSelectedNewBankAccountId(item.bank_account_id || "");
    setSelectedNewRemarks(item.remarks || "");
    setSelectedNewDate((item.date || "").split(" ")[0]);
    
    const isOnlineCol = !isDeposit && (item.bank_account_id != null || (item.denominations && Number(item.denominations.online_amount || 0) > 0));
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
        const bankAccountId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewBankAccountId : null;
        const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
        const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
        const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

        await api.updateDeposit(targetId, {
          deposit_type: selectedNewDepositType,
          bank_account_id: bankAccountId,
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
          bank_account_id: selectedNewPaymentMode === "online" ? selectedNewBankAccountId : null,
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

  // Edit modal's portal selector: once the user picks one, use it. Before
  // that -- e.g. right when the modal opens pre-filled from an existing
  // deposit -- derive it from whichever portal actually owns the already
  // selected bank account, so editing an entry doesn't force a re-selection.
  const effectiveEditPortalId = selectedNewPortalId
    || (portalDirectory || []).find((g: any) => (g.bankAccounts || []).some((ba: any) => ba.id === selectedNewBankAccountId))?.id
    || "";

  return (
    <div className="space-y-2">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm text-slate-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Retailers</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{retailerDirectory.length} Partners</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(v => !v)}
          className={`w-8 h-8 rounded-sm flex items-center justify-center transition-colors ${showAddForm ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-emerald-600 text-white'}`}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Add Retailer Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3 space-y-2">
          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider border-l-2 border-emerald-500 pl-1.5">New Retailer</p>
          <form onSubmit={handleCreateRetailer} className="space-y-2">
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Retailer Name</label>
              <input autoComplete="one-time-code"
                type="text"
                value={retName}
                onChange={e => setRetName(e.target.value)}
                placeholder="e.g. Laxmi Telecom"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
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
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
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
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
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
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Category</label>
              <input autoComplete="one-time-code"
                type="text"
                value={retCategory}
                onChange={e => setRetCategory(e.target.value)}
                placeholder="e.g. Supermarket, Wholesaler"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Opening You Gave (₹)</label>
                <input autoComplete="one-time-code"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={retToTake}
                  onChange={e => setRetToTake(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Opening You Got (₹)</label>
                <input autoComplete="one-time-code"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={retToGive}
                  onChange={e => setRetToGive(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-emerald-600 text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
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
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm py-1.5 pl-9 pr-3 text-xs font-medium focus:border-slate-500 dark:focus:border-slate-400"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className={`px-3 py-1 rounded-sm text-[9px] font-black uppercase tracking-wider shrink-0 transition-colors ${
                selectedCategories.length === 0
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-black"
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
                  className={`px-3 py-1 rounded-sm text-[9px] font-black uppercase tracking-wider shrink-0 transition-colors border ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white"
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
          <div className="py-8 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-sm flex items-center justify-center mx-auto mb-2 opacity-50">
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
                className="bg-white dark:bg-slate-900 py-3 px-3 border-b border-slate-50 dark:border-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Store className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{retailer.name}</span>
                      {retailer.category && (
                        <span className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 rounded-sm text-[8px] font-bold uppercase tracking-wider scale-90 origin-left">
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
                  <span className={`font-black text-xs font-mono tabular-nums ${(retailer.balance || 0) <= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
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
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-xs p-3 space-y-3">
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
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400" 
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
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400" 
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
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Email</label>
                  <input autoComplete="one-time-code" 
                    type="email" 
                    value={editRetEmail} 
                    onChange={(e) => setEditRetEmail(e.target.value)} 
                    placeholder="Email" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400" 
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Category</label>
                  <input autoComplete="one-time-code" 
                    type="text" 
                    value={editRetCategory} 
                    onChange={(e) => setEditRetCategory(e.target.value)} 
                    placeholder="Category" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400" 
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-sm border border-slate-100 dark:border-slate-800 text-[9px] flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Net Balance</span>
                  <span className={`font-extrabold font-mono tabular-nums ${(editingRetailer.balance || 0) <= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
                    ₹{Math.abs(editingRetailer.balance || 0).toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-2">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Opening Balance Adjustment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[8px] font-bold text-red-500 uppercase mb-0.5">You Gave (₹)</label>
                      <input
                        autoComplete="one-time-code"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={editRetToTake}
                        onChange={(e) => setEditRetToTake(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-emerald-500 uppercase mb-0.5">You Got (₹)</label>
                      <input
                        autoComplete="one-time-code"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={editRetToGive}
                        onChange={(e) => setEditRetToGive(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RETAILER STORES MODAL */}
      {isStoreModalOpen && selectedRetailerStore && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm p-3 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Manage Stores</h3>
                  <p className="text-[9px] font-bold text-slate-500">{selectedRetailerStore.name}</p>
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
                        className="w-full pl-6 pr-1.5 py-0.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[9px] font-semibold placeholder-slate-400 focus:outline-none"
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
                          <div key={s.id} className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded">
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
                      <div className="text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded">
                        <p className="text-[9px] text-slate-400 font-bold">No matching stores found.</p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded">
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
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-[10px] font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
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
              <div className="w-8 h-8 border-4 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
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
                if (initialLedgerToken) router.push("/admin/retailers");
              }}
              publicLink={typeof window !== "undefined" ? `${window.location.origin}/public/ledger/${ledgerRetailer.ledger_token}` : ""}
              onEditEntry={handleStartEditEntry}
              onDeleteEntry={handleDeleteEntry}
              hideBankNames={true}
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
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {editingIsDeposit ? "Edit Cash Out Entry" : "Edit Cash In Entry"}
              </h3>
              <button 
                onClick={() => setIsEditEntryModalOpen(false)} 
                className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
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

                {!editingIsDeposit && (availableStores.length > 0 || editingEntry?.store_name) && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Parent Store (Shop/Branch)</label>
                      {editingEntry?.store_name && (
                        <span className="text-[9px] text-amber-500 font-bold">
                          (Original: {editingEntry.store_name})
                        </span>
                      )}
                    </div>
                    {availableStores.length > 0 ? (
                      <InlineSelect
                        value={selectedNewStoreId}
                        onChange={setSelectedNewStoreId}
                        options={[
                          { value: "", label: "None / Cash" },
                          ...availableStores.map((s: any) => ({ value: String(s.id), label: s.store_name }))
                        ]}
                        placeholder="None / Cash"
                      />
                    ) : (
                      <div className="text-[11px] text-slate-400 italic px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-sm border border-dashed border-slate-200 dark:border-slate-800">
                        No stores available for this retailer
                      </div>
                    )}
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
                          setSelectedNewBankAccountId("");
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                )}

                {/* PORTAL SELECTOR (only for Online collections) */}
                {!editingIsDeposit && selectedNewPaymentMode === "online" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Online Payment Portal</label>
                    <InlineSelect
                      value={
                        portalDirectory.find((group: any) =>
                          (group.bankAccounts || []).some((ba: any) => String(ba.id) === selectedNewBankAccountId)
                        )?.id || ""
                      }
                      onChange={(portalId) => {
                        const account = portalDirectory
                          .find((group: any) => String(group.id) === String(portalId))
                          ?.bankAccounts?.find((ba: any) => ba.show_in_online_payment);
                        setSelectedNewBankAccountId(account ? String(account.id) : "");
                      }}
                      options={[
                        { value: "", label: "Select Portal" },
                        ...portalDirectory
                          .filter((group: any) => (group.bankAccounts || []).some((ba: any) => ba.show_in_online_payment))
                          .map((group: any) => ({ value: String(group.id), label: group.name }))
                      ]}
                      placeholder="Select Portal"
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
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
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
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target BankAccount</label>
                        <InlineSelect
                          value={selectedNewBankAccountId}
                          onChange={setSelectedNewBankAccountId}
                          options={[
                            { value: "", label: "Select Bank Account" },
                            ...portalDirectory
                              .flatMap((group: any) =>
                                (group.bankAccounts || []).map((ba: any) => ({
                                  value: String(ba.id),
                                  label: `${group.name} — ${ba.bank_account_name}`,
                                }))
                              )
                          ]}
                          placeholder="Select Bank Account"
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
                          <label htmlFor="editToOfficeCheckboxMobile" className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Handover to Cashier</label>
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
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Destination Portal" : "Source Portal"}
                            </label>
                            <InlineSelect
                              value={effectiveEditPortalId}
                              onChange={(val) => { setSelectedNewPortalId(val); setSelectedNewBankAccountId(""); }}
                              options={portalDirectory.map((group: any) => ({ value: String(group.id), label: group.name }))}
                              placeholder="Select Portal"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                              {selectedNewPaymentMode === "refund" ? "Destination BankAccount" : "Source BankAccount"}
                            </label>
                            <InlineSelect
                              value={selectedNewBankAccountId}
                              onChange={setSelectedNewBankAccountId}
                              disabled={!effectiveEditPortalId}
                              options={
                                (portalDirectory.find((group: any) => String(group.id) === effectiveEditPortalId)?.bankAccounts || [])
                                  .map((ba: any) => ({ value: String(ba.id), label: ba.bank_account_name }))
                              }
                              placeholder={effectiveEditPortalId ? "Select Bank Account" : "Select a portal first"}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                          </label>
                          <select
                            value={selectedNewVirtualTargetType}
                            onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
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
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold"
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
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold" 
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold" 
                    required 
                  />
                </div>

                {/* AMOUNT FIELD – only shown for online mode */}
                {selectedNewPaymentMode !== "cash" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={selectedNewAmount}
                      onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400"
                      required
                    />
                  </div>
                )}

                {/* DENOMINATIONS (for Cash Mode) – staff-style full-row layout */}
                {selectedNewPaymentMode === "cash" && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-200 dark:border-slate-800 space-y-1.5 select-none">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Counting Details (Notes)</label>
                    <div className="space-y-1">
                      {[
                        { label: "₹500 Notes", key: "note_500", multiplier: 500 },
                        { label: "₹200 Notes", key: "note_200", multiplier: 200 },
                        { label: "₹100 Notes", key: "note_100", multiplier: 100 },
                        { label: "₹50 Notes",  key: "note_50",  multiplier: 50  },
                        { label: "₹20 Notes",  key: "note_20",  multiplier: 20  },
                        { label: "₹10 Notes",  key: "note_10",  multiplier: 10  },
                        { label: "Coins / ₹1", key: "coins",    multiplier: 1   },
                      ].map((n) => (
                        <div key={n.key} className="flex items-center gap-2 justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-20 shrink-0">{n.label}</span>
                          <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">&times;</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            min="0"
                            value={selectedNewDenoms[n.key as keyof typeof selectedNewDenoms] || ""}
                            onChange={(e) => handleDenomValChange(n.key, e.target.value)}
                            className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold outline-none focus:border-slate-500 dark:focus:border-slate-400"
                          />
                          <span className="text-slate-300 dark:text-slate-600 text-[9px] font-bold">＝</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right w-14 shrink-0 font-mono tabular-nums">
                            ₹{(Number(selectedNewDenoms[n.key as keyof typeof selectedNewDenoms] || 0) * n.multiplier).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Live total summary */}
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Total (Cash)</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white font-mono tabular-nums">₹{selectedNewAmount.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* REMARKS FIELD */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                  <textarea 
                    value={selectedNewRemarks} 
                    onChange={(e) => setSelectedNewRemarks(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold" 
                    rows={2}
                    placeholder="Remarks"
                  />
                </div>

              </div>
              <button 
                type="submit" 
                disabled={isSavingEntry}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm text-xs font-bold transition-colors disabled:opacity-50"
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
