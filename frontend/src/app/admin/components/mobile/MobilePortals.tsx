"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Globe, 
  Trash2,
  X,
  ArrowLeft,
  CreditCard,
  Edit,
  ChevronDown,
  Edit2,
  Store
} from "lucide-react";
import { api } from "@/app/utils/api";
import Link from "next/link";
import LedgerReportView from "../../../components/LedgerReportView";
import { useAdmin } from "../../context/AdminContext";
import { getISTDateString } from "../../../utils/dateHelpers";
import InlineSelect from "../../../components/InlineSelect";

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
  const { retailerDirectory, userDirectory } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterOnline, setFilterOnline] = useState<"all" | "online">("all");

  // Ledger Report View State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerPortal, setLedgerPortal] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerOutstanding, setLedgerOutstanding] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Edit Entry states (Portal Ledger)
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

  const reloadLedger = async (portal: any) => {
    setLoadingLedger(true);
    try {
      let res;
      if (portal.bank_name === "Consolidated Group Wallet") {
        res = await api.getPortalGroupLedger(portal.id);
      } else {
        res = await api.getPortalLedger(portal.id);
      }
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
    
    setSelectedNewRetailerId(item.retailer_id || "");
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
      if (ledgerPortal) {
        await reloadLedger(ledgerPortal);
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
      if (ledgerPortal) {
        await reloadLedger(ledgerPortal);
      }
      fetchData();
    } catch (err: any) {
      showToastNotification("Failed to update: " + err.message);
    } finally {
      setIsSavingEntry(false);
    }
  };

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

  const handleOpenGroupLedger = async (group: any) => {
    console.log("handleOpenGroupLedger called for group in MobilePortals:", group);
    setLedgerPortal({
      id: group.id,
      portal_name: group.name,
      bank_name: "Consolidated Group Wallet",
      bank_account_no: "All Connected Banks",
      ifsc_code: ""
    });
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    try {
      const res = await api.getPortalGroupLedger(group.id);
      console.log("getPortalGroupLedger response in MobilePortals:", res);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      console.error("getPortalGroupLedger failed in MobilePortals:", err);
      showToastNotification("Failed to load group ledger: " + err.message);
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

  useEffect(() => {
    if (editingPortalGroup && portalDirectory) {
      const fresh = portalDirectory.find(g => g.id === editingPortalGroup.id);
      if (fresh) {
        setEditingPortalGroup(fresh);
      }
    }
  }, [portalDirectory, editingPortalGroup]);

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
      showToastNotification(`Portal "${editPortalName}" updated`);
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
      showToastNotification(`Portal "${pName}" registered`);
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
      showToastNotification(`Account "${bAccLabel}" registered`);
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
      showToastNotification(`Account "${name}" removed`);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    }
  };

  const filtered = portalDirectory
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(p => filterOnline === "all" || p.show_in_online_payment === true);

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
      {/* Category Tabs */}
      <div className="px-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full shrink-0">
        <button
          type="button"
          onClick={() => setFilterOnline("all")}
          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 transition-all ${
            filterOnline === "all"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-black shadow-sm"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 cursor-pointer"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterOnline("online")}
          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border ${
            filterOnline === "online"
              ? "bg-indigo-650 border-indigo-600 text-white shadow-sm font-black"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 cursor-pointer"
          }`}
        >
          Online Only
        </button>
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
                onClick={() => {
                  handleOpenGroupLedger(group);
                }}
                className="bg-white dark:bg-slate-900 py-3 px-3 border-b border-slate-50 dark:border-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-955/20 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Globe className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate uppercase tracking-tight">{group.name}</span>
                      {group.show_in_online_payment && (
                        <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full text-[8px] font-bold uppercase tracking-wider scale-90 origin-left">Online</span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">{(group.portals || []).length} Accounts</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className={`font-black text-xs ${group.balance < 0 ? 'text-red-650 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                      {group.balance < 0 ? '-' : ''}₹{Math.round(Math.abs(group.balance || 0)).toLocaleString()}
                    </span>
                    <span className="text-[7px] font-bold text-slate-400 uppercase block tracking-tighter mt-0.5">Net Balance</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditPortal(group);
                    }}
                    className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border border-slate-100 dark:border-slate-800 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PORTAL EDIT MODAL */}
      {isEditPortalModalOpen && editingPortalGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-sm p-4 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Manage Portal Group</h3>
              <button 
                onClick={() => setIsEditPortalModalOpen(false)} 
                className="p-1 rounded bg-slate-105 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Balance & Ledger Button */}
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 text-[10px] flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Current Balance</span>
                <span className={`font-black text-xs ${editingPortalGroup.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                  {editingPortalGroup.balance < 0 ? '-' : ''}₹{Math.abs(editingPortalGroup.balance || 0).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditPortalModalOpen(false);
                  handleOpenGroupLedger(editingPortalGroup);
                }}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[8px] font-bold rounded cursor-pointer"
              >
                Ledger
              </button>
            </div>

            <form onSubmit={handleSavePortalEdit} className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-2">
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Portal Name</label>
                  <input autoComplete="one-time-code" 
                    type="text" 
                    value={editPortalName} 
                    onChange={(e) => setEditPortalName(e.target.value)} 
                    placeholder="Portal Name" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500/20" 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">Adjust Balance (₹)</label>
                  <input autoComplete="one-time-code" 
                    type="number" 
                    placeholder="e.g. +1000 to add, -1000 to subtract"
                    value={editPortalBalanceAdjustment} 
                    onChange={(e) => setEditPortalBalanceAdjustment(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none" 
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
                  <label htmlFor="editGroupOnlineMobile" className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                    Online
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98]"
                >
                  {submitting ? "Saving..." : "Save Settings"}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete the portal group "${editingPortalGroup.name}" and all its bank accounts?`)) {
                      handleDeletePortalGroup(editingPortalGroup.id, editingPortalGroup.name);
                      setIsEditPortalModalOpen(false);
                    }
                  }}
                  className="px-3 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Delete Group
                </button>
              </div>
            </form>

            {/* Active Bank Accounts section */}
            <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Registered Banks ({(editingPortalGroup.portals || []).length})</h4>
              {editingPortalGroup.portals && editingPortalGroup.portals.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {editingPortalGroup.portals.map((p: any) => (
                    <div key={p.id} className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center justify-between bg-slate-50 dark:bg-slate-955 p-2 rounded border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{p.portal_name}</span>
                        <span className="text-[7px] text-slate-400 truncate">{p.bank_name || 'N/A'} • {p.bank_account_no || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-black text-slate-700 dark:text-slate-300">₹{Number(p.balance || 0).toLocaleString()}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditPortalModalOpen(false);
                            handleOpenLedger(p);
                          }}
                          className="px-1 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-105 dark:border-emerald-900/30 text-[8px] font-bold rounded cursor-pointer"
                        >
                          Ledger
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Delete bank account "${p.portal_name}"?`)) {
                              await handleDeleteBankAccount(p.id, p.portal_name);
                            }
                          }}
                          className="p-0.5 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-slate-400 hover:text-red-550 cursor-pointer" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[8px] font-bold text-slate-400 text-center py-2">No bank accounts registered</p>
              )}
            </div>

            {/* Add New Bank Account section */}
            <div className="space-y-2">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Add Bank Account</h4>
              <div className="bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-150 dark:border-slate-800 rounded-lg space-y-2">
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
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                  />
                  <input autoComplete="one-time-code"
                    type="text"
                    placeholder="IFSC Code"
                    value={bIfsc}
                    onChange={e => setBIfsc(e.target.value)}
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-semibold focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!bAccLabel) {
                      alert("Please enter an Account Label");
                      return;
                    }
                    await handleAddBankAccount(editingPortalGroup.id);
                  }}
                  disabled={addingBank}
                  className="w-full py-1.5 bg-indigo-600 text-white rounded text-[9px] font-bold uppercase tracking-wider shadow-sm cursor-pointer"
                >
                  {addingBank ? "Adding..." : "Register Bank Account"}
                </button>
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
              onEditEntry={handleStartEditEntry}
              onDeleteEntry={handleDeleteEntry}
            />
          )}
        </div>
      )}

      {/* EDIT TRANSACTION ENTRY MODAL */}
      {isEditEntryModalOpen && editingEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-6 animate-slide-up shadow-2xl">
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
