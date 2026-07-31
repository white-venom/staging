"use client";

import React, { useState, useEffect, useMemo } from "react";
import { History, Calendar, Search, Share2, FileDown, ArrowUpDown, Edit, Trash2, X, Save } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import InlineSelect from "../../../components/InlineSelect";
import { getISTDateString } from "../../../utils/dateHelpers";
import { downloadElementAsPdf } from "../../../utils/downloadElementAsPdf";

export default function VirtualLedgerTab() {
  const adminContext = useAdmin();
  const { retailerDirectory, portalDirectory, userDirectory, deposits, collections, fetchData, showToastNotification } = adminContext;

  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState(0);
  const [editRef, setEditRef] = useState("");

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = useState(true);

  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
  const [selectedNewStoreId, setSelectedNewStoreId] = useState("");
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedNewBankAccountId, setSelectedNewBankAccountId] = useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = useState("");
  const [selectedNewAmount, setSelectedNewAmount] = useState(0);
  const [selectedNewDate, setSelectedNewDate] = useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = useState("");
  const [selectedNewVirtualTargetType, setSelectedNewVirtualTargetType] = useState("retailer");
  const [isSavingCollection, setIsSavingCollection] = useState(false);

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

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "virtual-transfer",
    "move-to-dist",
    "portal-transfer"
  ]);
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, searchQuery, selectedTypes, sortBy]);

  // Fetch stores dynamically in edit modal
  useEffect(() => {
    const fetchStores = async () => {
      if (selectedNewRetailerId) {
        try {
          const stores = await api.getRetailerStores(selectedNewRetailerId);
          setAvailableStores(stores || []);
          if (editingCollection && (editingCollection.retailer_id === selectedNewRetailerId || editingCollection.retailerId === selectedNewRetailerId)) {
            setSelectedNewStoreId(editingCollection.store_id || editingCollection.storeId || "");
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
  }, [selectedNewRetailerId, editingCollection]);

  // Consolidate both Collections and Deposits
  const allTransactions = useMemo(() => {
    const combined: any[] = [];
    
    // Add collections (Cash In)
    (collections || []).forEach((c: any) => {
      const retailer = (retailerDirectory || []).find((r: any) => r.id === c.retailer_id);
      const retailerName = retailer?.name || c.retailerName || "Retailer";
      const bankAccount = (portalDirectory || []).flatMap((g: any) => g.bankAccounts || []).find((p: any) => p.id === c.bank_account_id);
      const bankAccountName = bankAccount?.bank_account_name || c.bankAccountName || "Bank Account";
      
      combined.push({
        id: c.id,
        date: c.date || c.created_at,
        amount: c.total_amount || c.amount || 0,
        remarks: c.remarks || "",
        reference_no: c.reference_no || c.referenceNo || "",
        staffName: c.staffName || "Admin",
        type: "cash-in", // Cash In
        isRefund: false,
        narrationFrom: retailerName.replace(/^(Retailer:?\s*-\s*|Retailer:?\s*)/i, ""),
        narrationTo: bankAccountName,
        balance_snapshot: c.balance_snapshot || 0,
        balanceAccountLabel: bankAccountName,
        rawRecord: c
      });
    });

    // Add deposits
    (deposits || []).forEach((d: any) => {
      const isVirtual = d.depositType === "virtual";
      const isPortalTransfer = d.depositType === "portal_transfer";
      const isRefund = d.isRefund === true || d.paymentMode === "refund" || d.payment_mode === "refund";

      let type = "cash-out";
      if (isVirtual) {
        type = isRefund ? "move-to-dist" : "virtual-transfer";
      } else if (isPortalTransfer) {
        type = "portal-transfer";
      }

      const bankAccountName = d.portalName || d.bankAccountName || "Bank Account";
      let targetNameClean = d.targetName || "Retailer/Staff";
      if (d.depositType === "staff") {
        targetNameClean = d.targetName?.replace(/^(Staff:?\s*-\s*|Staff:?\s*|Received\s+from:\s*)/i, "") || "Staff";
      } else if (d.depositType === "retailer") {
        targetNameClean = d.targetName?.replace(/^(Retailer:?\s*-\s*|Retailer:?\s*)/i, "") || "Retailer";
      }

      let narrationFrom = isRefund ? targetNameClean : bankAccountName;
      let narrationTo = isRefund ? bankAccountName : targetNameClean;
      if (isPortalTransfer) {
        narrationFrom = d.fromPortalName || d.fromBankAccountName || "Portal";
        narrationTo = bankAccountName;
      }

      combined.push({
        id: d.id,
        date: d.date || d.created_at,
        amount: d.amount || 0,
        remarks: d.remarks || "",
        reference_no: d.reference_no || d.referenceNo || "",
        staffName: d.staffName || "Admin",
        type: type, // "cash-out" | "virtual-transfer" | "move-to-dist" | "portal-transfer"
        isRefund: isRefund,
        narrationFrom,
        narrationTo,
        balance_snapshot: d.balance_snapshot || 0,
        // Which account this row's running balance belongs to -- rows from
        // different bank accounts are interleaved chronologically in this
        // list, so without this label consecutive "Bal." figures look like
        // they don't add up (they're each a different account's own total).
        balanceAccountLabel: d.portalName && d.bankAccountName ? `${d.portalName} · ${d.bankAccountName}` : bankAccountName,
        rawRecord: d
      });
    });

    return combined;
  }, [deposits, collections, retailerDirectory, portalDirectory]);

  const filteredTransfers = useMemo(() => {
    return allTransactions
      .filter((tx: any) => {
        const txDateStr = tx.date?.substring(0, 10);
        
        // Date range filter
        if (dateFrom && txDateStr < dateFrom) return false;
        if (dateTo && txDateStr > dateTo) return false;
        
        // Search filter
        const narration = `${tx.narrationFrom} to ${tx.narrationTo}`;
        const typeLabel = tx.type === "cash-in" ? "Cash In"
          : tx.type === "cash-out" ? "Cash Out"
          : tx.type === "virtual-transfer" ? "Virtual Transfer"
          : tx.type === "portal-transfer" ? "Portal Transfer"
          : "Move to Distributor";
        
        const q = searchQuery.toLowerCase();
        if (
          searchQuery && 
          !narration.toLowerCase().includes(q) &&
          !typeLabel.toLowerCase().includes(q) &&
          !tx.remarks.toLowerCase().includes(q) &&
          !tx.reference_no.toLowerCase().includes(q) &&
          !tx.staffName.toLowerCase().includes(q) &&
          !tx.amount?.toString().includes(q)
        ) {
          return false;
        }
        
        // Type filter (multi-select)
        if (!selectedTypes.includes(tx.type)) return false;
        
        return true;
      })
      .sort((a: any, b: any) => {
        const da = a.created_at || a.date;
        const db = b.created_at || b.date;
        if (sortBy === "date-desc") return new Date(db || 0).getTime() - new Date(da || 0).getTime();
        if (sortBy === "date-asc") return new Date(da || 0).getTime() - new Date(db || 0).getTime();
        if (sortBy === "amount-desc") return (b.amount || 0) - (a.amount || 0);
        if (sortBy === "amount-asc") return (a.amount || 0) - (b.amount || 0);
        return 0;
      });
  }, [allTransactions, dateFrom, dateTo, searchQuery, selectedTypes, sortBy]);

  const stats = useMemo(() => {
    let totalGave = 0; // cash-out & move-to-dist (money out)
    let totalGot = 0;  // cash-in & virtual-transfer (money in)

    filteredTransfers.forEach((tx: any) => {
      // Portal-to-portal transfers move money between the business's own
      // accounts -- net-zero for the business, so they don't belong in
      // either bucket (counting them as a "gave" would make Net Balance
      // look like a real loss that never happened).
      if (tx.type === "portal-transfer") return;
      if (tx.type === "cash-in" || tx.type === "virtual-transfer") {
        totalGot += tx.amount || 0;
      } else {
        totalGave += tx.amount || 0;
      }
    });

    return {
      entriesCount: filteredTransfers.length,
      totalGave,
      totalGot,
      netBalance: totalGave - totalGot
    };
  }, [filteredTransfers]);

  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage) || 1;
  const paginatedTransfers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransfers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransfers, currentPage]);

  const currentSelectionTx = allTransactions.find((tx: any) => tx.id === selectedDepositId);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepositId || !currentSelectionTx) return;
    const isDeposit = currentSelectionTx.type !== "cash-in";
    const raw = currentSelectionTx.rawRecord;
    try {
      if (isDeposit) {
        await api.updateDeposit(selectedDepositId, {
          ...raw,
          amount: editAmount,
          reference_no: editRef
        });
      } else {
        await api.updateCollection(selectedDepositId, {
          ...raw,
          total_amount: editAmount,
          reference_no: editRef
        });
      }
      if (showToastNotification) showToastNotification("Updated successfully!");
      setIsEditMode(false);
      setSelectedDepositId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Update failed: " + err.message);
    }
  };

  const handleStartEditDeposit = (tx: any) => {
    const raw = tx.rawRecord || tx;
    const isDeposit = tx.type !== "cash-in";
    setEditingIsDeposit(isDeposit);
    setEditingCollection(raw);
    setSelectedNewRetailerId(raw.retailer_id || raw.retailerId || "");
    setSelectedNewPortalId(""); // re-derived from bank_account_id below via effectiveEditPortalId
    setSelectedNewBankAccountId(raw.bank_account_id || raw.bankAccountId || "");
    setSelectedNewRemarks(raw.remarks || "");
    
    if (isDeposit) {
      setSelectedNewDepositType(raw.deposit_type || raw.depositType || "virtual");
      setSelectedNewPaymentMode(raw.payment_mode || raw.paymentMode || "online");
      setSelectedNewAmount(Number(raw.amount || raw.totalAmount || raw.total_amount || 0));
      setSelectedNewDate(raw.deposit_date ? raw.deposit_date : (raw.date || "").split(" ")[0]);
      setSelectedNewRefNo(raw.reference_no || raw.referenceNo || "");
      setSelectedNewRecipientStaffId(raw.recipient_staff_id || raw.recipientStaffId || "");
      setSelectedNewToOffice(raw.to_office === true);
      const hasStaff = !!(raw.recipient_staff_id || raw.recipientStaffId);
      setSelectedNewVirtualTargetType(hasStaff ? "staff" : "retailer");
    } else {
      setSelectedNewAmount(Number(raw.total_amount || raw.amount || 0));
      setSelectedNewDate((raw.date || "").split(" ")[0] || getISTDateString());
      setSelectedNewRefNo(raw.reference_no || raw.referenceNo || "");
      setSelectedNewPaymentMode(raw.payment_mode || raw.paymentMode || "cash");
    }

    const den = raw.denominations || {};
    setSelectedNewDenoms({
      note_500: Number(den.note_500 || 0),
      note_200: Number(den.note_200 || 0),
      note_100: Number(den.note_100 || 0),
      note_50: Number(den.note_50 || 0),
      note_20: Number(den.note_20 || 0),
      note_10: Number(den.note_10 || 0),
      coins: Number(den.coins || 0),
      online_amount: Number(den.online_amount || 0),
    });

    setIsEditCollectionModalOpen(true);
    setSelectedDepositId(null);
  };

  const handleSaveDepositEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    setIsSavingCollection(true);

    try {
      if (editingIsDeposit) {
        const bankAccountId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewBankAccountId : null;
        const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
        const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
        const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

        await api.updateDeposit(editingCollection.id, {
          deposit_type: selectedNewDepositType,
          bank_account_id: bankAccountId || null,
          retailer_id: retailerId || null,
          recipient_staff_id: recipientStaffId || null,
          to_office: toOffice,
          payment_mode: selectedNewPaymentMode,
          amount: Number(selectedNewAmount),
          deposit_date: selectedNewDate || getISTDateString(),
          reference_no: selectedNewRefNo || null,
          remarks: selectedNewRemarks || "",
          denominations: selectedNewPaymentMode === "cash" ? selectedNewDenoms : null
        });
      } else {
        const computedCollectionTotal = (
          selectedNewDenoms.note_500 * 500 +
          selectedNewDenoms.note_200 * 200 +
          selectedNewDenoms.note_100 * 100 +
          selectedNewDenoms.note_50 * 50 +
          selectedNewDenoms.note_20 * 20 +
          selectedNewDenoms.note_10 * 10 +
          selectedNewDenoms.coins +
          selectedNewDenoms.online_amount
        );

        await api.updateCollection(editingCollection.id, {
          retailer_id: selectedNewRetailerId || null,
          bank_account_id: selectedNewBankAccountId || null,
          store_id: selectedNewStoreId || null,
          total_amount: computedCollectionTotal,
          remarks: selectedNewRemarks || "",
          denominations: selectedNewDenoms
        });
      }

      if (showToastNotification) showToastNotification("Updated successfully.");
      setIsEditCollectionModalOpen(false);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDepositId || !currentSelectionTx) return;
    const isDeposit = currentSelectionTx.type !== "cash-in";
    const name = isDeposit ? "deposit/transfer" : "cash collection";
    if (!confirm(`Are you sure you want to delete this ${name}?`)) return;
    
    try {
      if (isDeposit) {
        await api.deleteDeposit(selectedDepositId);
      } else {
        await api.deleteCollection(selectedDepositId);
      }
      if (showToastNotification) showToastNotification("Deleted successfully!");
      setSelectedDepositId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const formatIST = (dateStr: string) => {
    try {
      let parseStr = dateStr;
      if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
        parseStr = dateStr.replace(" ", "T") + "Z";
      }
      const d = new Date(parseStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: "", full: dateStr };

      const datePart = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        timeZone: "Asia/Kolkata"
      });

      const timePart = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata"
      });

      return { date: datePart, time: timePart, full: `${datePart}, ${timePart}` };
    } catch {
      return { date: dateStr, time: "", full: dateStr };
    }
  };

  const handleDownloadPDF = () => {
    setIsDownloading(true);

    const nameClean = "Universal_Ledger";
    const dateRangeStr = dateFrom === dateTo ? (dateFrom || "All_Time") : `${dateFrom || "Start"}_to_${dateTo || "End"}`;
    const filename = `${nameClean}_${dateRangeStr}.pdf`;

    downloadElementAsPdf("pdf-virtual-ledger-report", filename, 0.4)
      .catch((e: any) => {
        console.error("PDF generation failed, falling back to print:", e);
        window.print();
      })
      .finally(() => setIsDownloading(false));
  };

  const handleShare = async () => {
    const shareText = `Universal Ledger Report
Total Entries: ${stats.entriesCount}
Total Gave (Debit): ₹ ${stats.totalGave.toLocaleString("en-IN")}
Total Got (Credit): ₹ ${stats.totalGot.toLocaleString("en-IN")}
Period: ${dateFrom || "All Time"} to ${dateTo || "All Time"}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Universal Ledger`,
          text: shareText
        });
      } catch { /* ignored */ }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert("Report summary copied to clipboard!");
      } catch {
        alert("Failed to share.");
      }
    }
  };

  // Edit modal's portal selector: once the user picks one, use it. Before
  // that -- e.g. right when the modal opens pre-filled from an existing
  // deposit -- derive it from whichever portal actually owns the already
  // selected bank account, so editing an entry doesn't force a re-selection.
  const effectiveEditPortalId = selectedNewPortalId
    || (portalDirectory || []).find((g: any) => (g.bankAccounts || []).some((ba: any) => ba.id === selectedNewBankAccountId))?.id
    || "";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28 md:pb-20">
      {/* LEDGER VIEW CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
            Universal Ledger Statement
          </h3>
        </div>

        {/* Start & End Date controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[8px] text-slate-400 font-black uppercase">Start Date</span>
              <input autoComplete="one-time-code"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[8px] text-slate-400 font-black uppercase">End Date</span>
              <input autoComplete="one-time-code"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Search & Sort Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input autoComplete="one-time-code"
              type="text"
              placeholder="Search Entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="relative w-full">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-8"
            >
              <option value="date-desc">LATEST FIRST</option>
              <option value="date-asc">OLDEST FIRST</option>
              <option value="amount-desc">AMOUNT: HIGH-LOW</option>
              <option value="amount-asc">AMOUNT: LOW-HIGH</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Pills multi-select for Type Filter */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block ml-1">Filter by Type:</span>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { id: "virtual-transfer", label: "Virtual Transfer", color: "blue" },
              { id: "move-to-dist", label: "Move to Distributor", color: "purple" },
              { id: "portal-transfer", label: "Portal Transfer", color: "indigo" }
            ].map((t) => {
              const isActive = selectedTypes.includes(t.id);
              let colorClasses = "";
              if (t.color === "blue") {
                colorClasses = isActive
                  ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                  : "bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100";
              } else if (t.color === "purple") {
                colorClasses = isActive
                  ? "bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                  : "bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100";
              } else if (t.color === "indigo") {
                colorClasses = isActive
                  ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800"
                  : "bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100";
              }

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTypes(prev => {
                      if (prev.includes(t.id)) {
                        return prev.filter(x => x !== t.id);
                      } else {
                        return [...prev, t.id];
                      }
                    });
                  }}
                  className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-colors ${colorClasses}`}
                >
                  {t.label}
                </button>
              );
            })}
            
            <button
              type="button"
              onClick={() => setSelectedTypes(["virtual-transfer", "move-to-dist", "portal-transfer"])}
              className="px-2.5 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors ml-auto cursor-pointer"
            >
              Select All
            </button>
          </div>
        </div>

        {/* SCREEN LEDGER VIEW (With Pagination) */}
        <div className="space-y-4 text-slate-800 dark:text-slate-200">
          {/* Net Balance Card */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 block">{stats.entriesCount} Entries</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-rose-500 uppercase tracking-wider block">Total Gave</span>
                <span className="text-xs font-bold text-rose-500 mt-0.5 block font-mono tabular-nums">₹ {stats.totalGave.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Total Got</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block font-mono tabular-nums">₹ {stats.totalGot.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden">
            {paginatedTransfers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-400 font-bold italic">
                No ledger transactions found matching the selected filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedTransfers.map((tx: any) => {
                  const formatted = formatIST(tx.rawRecord?.created_at || tx.date);
                  // Universal rule: money in = green, out = red. Cash-in and a
                  // virtual-transfer load both increase this ledger; move-to-dist
                  // (a refund) decreases it, same as cash-out.
                  const isGot = tx.type === "cash-in" || tx.type === "virtual-transfer";
                  // Portal-to-portal transfers move money between two of the
                  // business's own accounts -- net-zero for the business as a
                  // whole, so neither green nor red applies; shown neutral.
                  const isPortalTransferRow = tx.type === "portal-transfer";

                  let badgeLabel = "";
                  let badgeColor = "";
                  if (tx.type === "cash-in") {
                    badgeLabel = "Cash In";
                    badgeColor = "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400";
                  } else if (tx.type === "cash-out") {
                    badgeLabel = "Cash Out";
                    badgeColor = "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300";
                  } else if (tx.type === "virtual-transfer") {
                    badgeLabel = "Virtual Transfer";
                    badgeColor = "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300";
                  } else if (tx.type === "portal-transfer") {
                    badgeLabel = "Portal Transfer";
                    badgeColor = "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300";
                  } else {
                    badgeLabel = "Move to Dist";
                    badgeColor = "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300";
                  }

                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        setSelectedDepositId(tx.id);
                        setEditAmount(tx.amount || 0);
                        setEditRef(tx.reference_no || "");
                      }}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors cursor-pointer"
                    >
                      {/* Left: Date & Running Balance */}
                      <div className="flex flex-col gap-1 min-w-0 max-w-[125px] shrink-0">
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 shrink-0">{formatted.date}</span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mt-0.5">{formatted.time}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 px-2 py-0.5 rounded-sm uppercase tracking-wider self-start mt-1 font-mono tabular-nums">
                          Bal. ₹{Math.round(tx.balance_snapshot || 0).toLocaleString("en-IN")}
                        </span>
                        {tx.balanceAccountLabel && (
                          <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[125px]" title={tx.balanceAccountLabel}>
                            {tx.balanceAccountLabel}
                          </span>
                        )}
                      </div>

                      {/* Middle: Description */}
                      <div className="flex-1 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider self-start ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                          <div className={`text-xs font-black flex items-center gap-1 mt-1 ${isPortalTransferRow ? 'text-indigo-700 dark:text-indigo-400' : isGot ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            <span className="truncate max-w-[80px]" title={tx.narrationFrom}>{tx.narrationFrom}</span>
                            <span className="text-slate-500">→</span>
                            <span className="truncate max-w-[80px]" title={tx.narrationTo}>{tx.narrationTo}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                            Staff: <span className="uppercase">{tx.staffName || 'Admin'}</span>
                          </div>
                          {tx.remarks && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-500 font-medium mt-0.5">
                              Remark: <span className="italic">{tx.remarks}</span>
                            </div>
                          )}
                          {tx.reference_no && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                              Ref: {tx.reference_no}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right: Gave (Debit) vs Got (Credit) columns -- a portal
                          transfer is an internal move between the business's own
                          accounts, neither a real gain nor loss, so it gets its
                          own neutral indigo figure instead of picking a side. */}
                      <div className="flex items-center gap-3 w-44 shrink-0 text-right font-mono tabular-nums text-xs">
                        {isPortalTransferRow ? (
                          <div className="w-44 font-black text-indigo-600 dark:text-indigo-400">
                            ₹ {Math.round(tx.amount || 0).toLocaleString("en-IN")}
                          </div>
                        ) : (
                          <>
                            {/* Gave Column */}
                            <div className="w-22 font-black text-rose-500">
                              {!isGot ? `₹ ${Math.round(tx.amount || 0).toLocaleString("en-IN")}` : "—"}
                            </div>
                            {/* Got Column */}
                            <div className="w-22 font-black text-emerald-600 dark:text-emerald-400">
                              {isGot ? `₹ ${Math.round(tx.amount || 0).toLocaleString("en-IN")}` : "—"}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 no-print">
            <div>
              Showing {Math.min(filteredTransfers.length, (currentPage - 1) * itemsPerPage + 1)}-
              {Math.min(filteredTransfers.length, currentPage * itemsPerPage)} of {filteredTransfers.length} entries
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`px-3 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                          currentPage === p
                            ? "bg-blue-600 border-blue-600 text-white font-bold"
                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/20 text-slate-600"
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Footer Buttons for PDF & Share */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3.5 px-4 flex gap-3 z-40 max-w-lg mx-auto rounded-t-sm md:relative md:bg-transparent md:border-t-0 md:py-0 md:px-0 md:shadow-none md:max-w-none md:rounded-none no-print">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading || filteredTransfers.length === 0}
            className="flex-1 py-3 px-4 rounded-sm border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {isDownloading ? "Downloading..." : "DOWNLOAD"}
          </button>
          
          <button
            onClick={handleShare}
            disabled={filteredTransfers.length === 0}
            className="flex-1 py-3 px-4 rounded-sm bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            SHARE
          </button>
        </div>

        {/* Hidden PDF Printable element containing all matching transactions (no pagination) */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "790px" }}>
          <div id="pdf-virtual-ledger-report" className="bg-white text-slate-900 p-8 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
              <div>
                <h1 className="text-lg font-black text-slate-900">Universal Ledger</h1>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                  Period: {dateFrom || "Start"} to {dateTo || "End"}
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Generated: {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-4 mb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5 block">{stats.entriesCount} Entries</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-rose-500 uppercase tracking-wider block">Total Gave</span>
                  <span className="text-xs font-bold text-rose-500 mt-0.5 block font-mono tabular-nums">₹ {stats.totalGave.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider block">Total Got</span>
                  <span className="text-xs font-bold text-emerald-600 mt-0.5 block font-mono tabular-nums">₹ {stats.totalGot.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden divide-y divide-slate-100">
              {filteredTransfers.map((tx: any) => {
                const formatted = formatIST(tx.rawRecord?.created_at || tx.date);
                const isGot = tx.type === "cash-in" || tx.type === "virtual-transfer";
                const isPortalTransferRow = tx.type === "portal-transfer";

                return (
                  <div key={tx.id} className="p-3 flex items-center justify-between">
                    <div className="flex flex-col gap-1 w-32 shrink-0">
                      <span className="text-xs font-bold text-slate-800">{formatted.date}</span>
                      <span className="text-[9px] text-slate-400">{formatted.time}</span>
                      <span className="text-[9px] text-slate-500 font-bold font-mono tabular-nums">Bal: ₹{Math.round(tx.balance_snapshot || 0).toLocaleString()}</span>
                      {tx.balanceAccountLabel && (
                        <span className="text-[8px] text-slate-400">{tx.balanceAccountLabel}</span>
                      )}
                    </div>
                    <div className="flex-1 px-4 text-xs font-medium text-slate-700">
                      <div className="font-bold uppercase text-[9px] text-slate-500">{tx.type.replace("-", " ")}</div>
                      <div className="font-black text-slate-800">{tx.narrationFrom} → {tx.narrationTo}</div>
                      {tx.remarks && <div className="italic text-[10px] text-slate-400">Remark: {tx.remarks}</div>}
                      {tx.reference_no && <div className="text-[10px] text-slate-400">Ref: {tx.reference_no}</div>}
                    </div>
                    <div className="flex items-center gap-3 w-40 shrink-0 text-right font-mono tabular-nums text-xs">
                      {isPortalTransferRow ? (
                        <div className="w-40 text-indigo-600 font-bold">₹{Math.round(tx.amount || 0).toLocaleString()}</div>
                      ) : (
                        <>
                          <div className="w-20 text-rose-500 font-bold">{!isGot ? `₹${Math.round(tx.amount || 0).toLocaleString()}` : "—"}</div>
                          <div className="w-20 text-emerald-600 font-bold">{isGot ? `₹${Math.round(tx.amount || 0).toLocaleString()}` : "—"}</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Drawer/Modal */}
      {selectedDepositId && currentSelectionTx && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm p-6 space-y-4 select-none">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Audit Ledger Entry
              </h3>
              <button
                onClick={() => {
                  setSelectedDepositId(null);
                  setIsEditMode(false);
                }}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Narration</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase truncate max-w-[180px]">{currentSelectionTx.narrationFrom} → {currentSelectionTx.narrationTo}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Staff</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelectionTx.staffName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Amount</span>
                  <span className="text-sm font-black text-rose-600 font-mono tabular-nums">₹{currentSelectionTx.amount.toLocaleString()}.00</span>
                </div>
              </div>

              {isEditMode ? (
                <form onSubmit={handleEdit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Correction Amount (₹)</label>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold outline-none focus:border-slate-500 dark:focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Reference No</label>
                    <input autoComplete="one-time-code" 
                      type="text" 
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-sm text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-sm text-xs font-bold">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      handleStartEditDeposit(currentSelectionTx);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-sm text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" /> Edit Entry
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="w-full py-3 border border-red-200 text-red-600 rounded-sm text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Entry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditCollectionModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                {editingIsDeposit ? "Edit Payout / Deposit Entry" : "Edit Cash In (Collection) Entry"}
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveDepositEdit} className="space-y-4">
              
              {!editingIsDeposit ? (
                // Collection Form Fields (Cash In)
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Parent Retailer</label>
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

                  {(availableStores.length > 0 || editingCollection?.store_name) && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block">Parent Store</label>
                        {editingCollection?.store_name && (
                          <span className="text-[9px] text-amber-500 font-bold">
                            (Original: {editingCollection.store_name})
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
                        <div className="text-[11px] text-slate-400 italic px-3 py-2 bg-slate-50 dark:bg-slate-950/40 rounded-sm border border-dashed border-slate-200 dark:border-slate-800">
                          No stores available for this retailer
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">BankAccount Channel</label>
                    <InlineSelect
                      value={selectedNewBankAccountId}
                      onChange={setSelectedNewBankAccountId}
                      options={[
                        { value: "", label: "None / Cash" },
                        ...portalDirectory
                          .flatMap((group: any) =>
                            (group.bankAccounts || [])
                              .filter((ba: any) => ba.show_in_online_payment)
                              .map((ba: any) => ({
                                value: String(ba.id),
                                label: `${group.name} — ${ba.bank_account_name}`,
                              }))
                          )
                      ]}
                      placeholder="None / Cash"
                    />
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-sm">
                    <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Counting Details (Notes)</span>
                    </div>
                    {[
                      { label: "₹500 Notes", key: "note_500", factor: 500 },
                      { label: "₹200 Notes", key: "note_200", factor: 200 },
                      { label: "₹100 Notes", key: "note_100", factor: 100 },
                      { label: "₹50 Notes", key: "note_50", factor: 50 },
                      { label: "₹20 Notes", key: "note_20", factor: 20 },
                      { label: "₹10 Notes", key: "note_10", factor: 10 },
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-2 justify-between px-2 py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">{item.label}</span>
                        <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">&times;</span>
                        <input autoComplete="one-time-code"
                          type="number"
                          inputMode="numeric"
                          value={selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setSelectedNewDenoms(prev => ({ ...prev, [item.key]: val }));
                          }}
                          className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                        />
                        <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>
                        <span className="text-xs font-black text-right w-16 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          ₹{(Number(selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0) * item.factor).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 justify-between px-2 py-0.5 border-b border-slate-100 dark:border-slate-800/40">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">Coins</span>
                      <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">&times;</span>
                      <input autoComplete="one-time-code"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={selectedNewDenoms.coins}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSelectedNewDenoms(prev => ({ ...prev, coins: val }));
                        }}
                        className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                      />
                      <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>
                      <span className="text-xs font-black text-right w-16 font-mono tabular-nums text-slate-700 dark:text-slate-300">₹{Number(selectedNewDenoms.coins || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-between px-2 py-0.5">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">Online</span>
                      <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">+</span>
                      <input autoComplete="one-time-code"
                        type="number"
                        inputMode="decimal"
                        value={selectedNewDenoms.online_amount}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setSelectedNewDenoms(prev => ({ ...prev, online_amount: val }));
                        }}
                        className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                      />
                      <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>
                      <span className="text-xs font-black text-right w-16 font-mono tabular-nums text-slate-700 dark:text-slate-300">₹{Number(selectedNewDenoms.online_amount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Total Amount (Calculated)</label>
                    <input autoComplete="one-time-code"
                      type="text"
                      value={`₹ ${(
                        selectedNewDenoms.note_500 * 500 +
                        selectedNewDenoms.note_200 * 200 +
                        selectedNewDenoms.note_100 * 100 +
                        selectedNewDenoms.note_50 * 50 +
                        selectedNewDenoms.note_20 * 20 +
                        selectedNewDenoms.note_10 * 10 +
                        selectedNewDenoms.coins +
                        selectedNewDenoms.online_amount
                      ).toLocaleString("en-IN")}`}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-right font-mono tabular-nums text-xs font-black text-slate-800 dark:text-slate-100"
                      readOnly
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                      rows={2}
                      placeholder="Remarks..."
                    />
                  </div>
                </div>
              ) : (
                // Deposit Form Fields (Cash Out, Virtual Transfers)
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Deposit/Payout Type</label>
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                    >
                      <option value="portal">Cash Out</option>
                      <option value="retailer">Retailer Payout</option>
                      <option value="staff">Direct Handover</option>
                      <option value="virtual-load">Virtual Transfer</option>
                      <option value="virtual-refund">Move to Distributor</option>
                    </select>
                  </div>

                  {selectedNewDepositType === "portal" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target BankAccount</label>
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
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Retailer</label>
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
                      <div className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id="editToOfficeCheckbox"
                          checked={selectedNewToOffice}
                          onChange={(e) => setSelectedNewToOffice(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="editToOfficeCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-400">Handover to Main Office Cashier</label>
                      </div>

                      {!selectedNewToOffice && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Recipient Staff</label>
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

                  {selectedNewDepositType === "virtual" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                            {selectedNewPaymentMode === "refund" ? "Destination Portal" : "Source Portal"}
                          </label>
                          <InlineSelect
                            value={effectiveEditPortalId}
                            onChange={(val) => { setSelectedNewPortalId(val); setSelectedNewBankAccountId(""); }}
                            options={portalDirectory.map((group: any) => ({ value: String(group.id), label: group.name }))}
                            placeholder="Select Portal"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
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

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                        </label>
                        <select
                          value={selectedNewVirtualTargetType}
                          onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                        >
                          <option value="retailer">Retailer</option>
                          <option value="staff">Staff Member</option>
                        </select>
                      </div>

                      {selectedNewVirtualTargetType === "retailer" ? (
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
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
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
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

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Amount</label>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      value={selectedNewAmount}
                      onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Date</label>
                    <input autoComplete="one-time-code"
                      type="date"
                      value={selectedNewDate}
                      onChange={(e) => setSelectedNewDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Reference No</label>
                    <input autoComplete="one-time-code"
                      type="text"
                      value={selectedNewRefNo}
                      onChange={(e) => setSelectedNewRefNo(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                      rows={2}
                      placeholder="Remarks..."
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditCollectionModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-sm text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCollection}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingCollection ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
