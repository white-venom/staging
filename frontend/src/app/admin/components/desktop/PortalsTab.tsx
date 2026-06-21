"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, Globe, Building, X, CreditCard, ChevronRight, ChevronDown, Edit, Trash2, Edit2, Store } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import { useRouter } from "next/navigation";
import LedgerReportView from "../../../components/LedgerReportView";
import InlineSelect from "../../../components/InlineSelect";

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
  const { setLedgerSearchTerm, retailerDirectory, userDirectory } = useAdmin();
  const [portalSearch, setPortalSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [filterOnline, setFilterOnline] = useState<"all" | "online">("all");
  
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
      if (fetchData) fetchData();
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
          deposit_date: selectedNewDate || new Date().toISOString().split("T")[0],
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
          collection_date: selectedNewDate || new Date().toISOString().split("T")[0],
          remarks: selectedNewRemarks || "",
          denominations: payloadDenoms
        });
      }
      showToastNotification("Entry updated successfully.");
      setIsEditEntryModalOpen(false);
      if (ledgerPortal) {
        await reloadLedger(ledgerPortal);
      }
      if (fetchData) fetchData();
    } catch (err: any) {
      showToastNotification("Failed to update: " + err.message);
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleOpenLedger = async (portal: any) => {
    console.log("handleOpenLedger called for portal:", portal);
    setLedgerPortal(portal);
    setIsLedgerModalOpen(true);
    setLoadingLedger(true);
    try {
      const res = await api.getPortalLedger(portal.id);
      console.log("getPortalLedger response:", res);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      console.error("getPortalLedger failed:", err);
      alert("Failed to load ledger: " + err.message);
      setIsLedgerModalOpen(false);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleOpenGroupLedger = async (group: any) => {
    console.log("handleOpenGroupLedger called for group:", group);
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
      console.log("getPortalGroupLedger response:", res);
      setLedgerData(res.statement_history || []);
      setLedgerOutstanding(res.outstanding_balance || 0);
    } catch (err: any) {
      console.error("getPortalGroupLedger failed:", err);
      alert("Failed to load group ledger: " + err.message);
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

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
        <button
          type="button"
          onClick={() => setFilterOnline("all")}
          className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 transition-all ${
            filterOnline === "all"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-955 font-black shadow-sm"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 cursor-pointer"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterOnline("online")}
          className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border ${
            filterOnline === "online"
              ? "bg-indigo-605 border-indigo-600 text-white shadow-sm font-black"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 cursor-pointer"
          }`}
        >
          Online Only
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {portalDirectory
          .filter(p => (p.name || "").toLowerCase().includes(portalSearch.toLowerCase()))
          .filter(group => filterOnline === "all" || group.show_in_online_payment === true)
          .map((group) => (
            <div
              key={group.id}
              onClick={() => {
                handleOpenGroupLedger(group);
              }}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-slate-350 dark:hover:border-slate-700 transition-all flex flex-col justify-between cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Globe className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      {group.name}
                      {group.show_in_online_payment && (
                        <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[7px] font-black rounded uppercase">Online</span>
                      )}
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{(group.portals || []).length} Accounts</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Portal Balance</span>
                    <span className={`text-xs font-black ${group.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                      {group.balance < 0 ? '-' : ''}₹{Math.abs(group.balance || 0).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGroup(group);
                      setEditingGroupId(group.id);
                      setEditingGroupName(group.name);
                      setEditingGroupBalanceAdjustment("");
                      setEditGroupOnline(!!group.show_in_online_payment);
                      setIsAccountModalOpen(true);
                    }}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
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
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Current Balance</span>
                      <span className={`font-black ${selectedGroup.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                        {selectedGroup.balance < 0 ? '-' : ''}₹{Math.abs(selectedGroup.balance || 0).toLocaleString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountModalOpen(false);
                        handleOpenGroupLedger(selectedGroup);
                      }}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-105 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 text-[9px] font-bold rounded cursor-pointer"
                    >
                      Ledger
                    </button>
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
                  <button 
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete the portal group "${selectedGroup.name}" and all its bank accounts?`)) {
                        handleDeleteGroup(selectedGroup.id, selectedGroup.name);
                        setIsAccountModalOpen(false);
                      }
                    }}
                    className="w-full mt-2 py-2 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/10 text-red-650 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Delete Portal Group
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
                            const displayName = p.groupName && p.groupName.toLowerCase() !== p.portal_name.toLowerCase()
                              ? `${p.groupName} - ${p.portal_name}`
                              : p.portal_name;
                            return { value: String(p.id), label: `${displayName}${p.bank_name ? ` (${p.bank_name})` : ""}` };
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
                            ...portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => ({ value: String(p.id), label: `${p.portal_name} (${p.bank_name})` }))
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
                              ...portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => ({ value: String(p.id), label: `${p.portal_name} (${p.bank_name})` }))
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold" 
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
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
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
