"use client";

import React, { useState, useEffect, useMemo } from "react";
import { History, Calendar, Search, Share2, FileDown, ArrowUpDown, Edit, Trash2, X, Save } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import InlineSelect from "../../../components/InlineSelect";

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
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
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
    "cash-in",
    "cash-out",
    "virtual-transfer",
    "move-to-dist"
  ]);
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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
      const portal = (portalDirectory || []).flatMap((g: any) => g.portals || []).find((p: any) => p.id === c.portal_id);
      const portalName = portal?.portal_name || c.portalName || "Portal";
      
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
        narrationTo: portalName,
        balance_snapshot: c.balance_snapshot || 0,
        rawRecord: c
      });
    });

    // Add deposits
    (deposits || []).forEach((d: any) => {
      const isVirtual = d.depositType === "virtual";
      const isRefund = d.isRefund === true || d.paymentMode === "refund" || d.payment_mode === "refund";
      
      let type = "cash-out";
      if (isVirtual) {
        type = isRefund ? "move-to-dist" : "virtual-transfer";
      }
      
      const portalName = d.portalGroupName || d.portalName || "Portal";
      let targetNameClean = d.targetName || "Retailer/Staff";
      if (d.depositType === "staff") {
        targetNameClean = d.targetName?.replace(/^(Staff:?\s*-\s*|Staff:?\s*|Received\s+from:\s*)/i, "") || "Staff";
      } else if (d.depositType === "retailer") {
        targetNameClean = d.targetName?.replace(/^(Retailer:?\s*-\s*|Retailer:?\s*)/i, "") || "Retailer";
      }
      
      const narrationFrom = isRefund ? targetNameClean : portalName;
      const narrationTo = isRefund ? portalName : targetNameClean;

      combined.push({
        id: d.id,
        date: d.date || d.created_at,
        amount: d.amount || 0,
        remarks: d.remarks || "",
        reference_no: d.reference_no || d.referenceNo || "",
        staffName: d.staffName || "Admin",
        type: type, // "cash-out" | "virtual-transfer" | "move-to-dist"
        isRefund: isRefund,
        narrationFrom,
        narrationTo,
        balance_snapshot: d.balance_snapshot || 0,
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
    let totalGave = 0; // cash-out & virtual-transfer
    let totalGot = 0;  // cash-in & move-to-dist
    
    filteredTransfers.forEach((tx: any) => {
      if (tx.type === "cash-in" || tx.type === "move-to-dist") {
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
    setSelectedNewPortalId(raw.portal_id || raw.portalId || "");
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
      setSelectedNewDate((raw.date || "").split(" ")[0] || new Date().toISOString().split("T")[0]);
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
        const portalId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewPortalId : null;
        const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
        const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
        const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

        await api.updateDeposit(editingCollection.id, {
          deposit_type: selectedNewDepositType,
          portal_id: portalId || null,
          retailer_id: retailerId || null,
          recipient_staff_id: recipientStaffId || null,
          to_office: toOffice,
          payment_mode: selectedNewPaymentMode,
          amount: Number(selectedNewAmount),
          deposit_date: selectedNewDate || new Date().toISOString().split("T")[0],
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
          portal_id: selectedNewPortalId || null,
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
        hour12: true,
        timeZone: "Asia/Kolkata"
      });

      return { date: datePart, time: timePart, full: `${datePart}, ${timePart}` };
    } catch {
      return { date: dateStr, time: "", full: dateStr };
    }
  };

  const handleDownloadPDF = () => {
    setIsDownloading(true);
    const element = document.getElementById("pdf-virtual-ledger-report");
    if (!element) {
      setIsDownloading(false);
      return;
    }

    const nameClean = "Universal_Ledger";
    const dateRangeStr = dateFrom === dateTo ? (dateFrom || "All_Time") : `${dateFrom || "Start"}_to_${dateTo || "End"}`;
    const filename = `${nameClean}_${dateRangeStr}.pdf`;

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     filename,
      image:        { type: "jpeg", quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: "in", format: "a4", orientation: "portrait" }
    };

    const runDownload = () => {
      try {
        (window as any).html2pdf().set(opt).from(element).save().then(() => {
          setIsDownloading(false);
        }).catch((e: any) => {
          console.error("PDF generation failed, falling back to print:", e);
          window.print();
          setIsDownloading(false);
        });
      } catch (err) {
        console.error("html2pdf call failed, falling back to print:", err);
        window.print();
        setIsDownloading(false);
      }
    };

    const loadAndRun = () => {
      if ((window as any).html2pdf) {
        runDownload();
        return;
      }
      const script = document.createElement("script");
      script.src = "/html2pdf.bundle.min.js";
      script.onload = () => {
        if ((window as any).html2pdf) {
          runDownload();
        } else {
          window.print();
          setIsDownloading(false);
        }
      };
      script.onerror = () => {
        window.print();
        setIsDownloading(false);
      };
      document.head.appendChild(script);
    };

    loadAndRun();
  };

  const handleShare = async () => {
    const shareText = `Universal Ledger Report
Net Balance: ₹ ${Math.abs(stats.netBalance).toLocaleString("en-IN")}
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* LEDGER VIEW CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
            Universal Ledger Statement
          </h3>
        </div>

        {/* Start & End Date controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-450 shrink-0" />
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
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-455 shrink-0" />
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
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-405 focus:outline-none shadow-xs"
            />
          </div>

          <div className="relative w-full">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-8 shadow-xs"
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
              { id: "cash-in", label: "Cash In", color: "emerald" },
              { id: "cash-out", label: "Cash Out", color: "rose" },
              { id: "virtual-transfer", label: "Virtual Transfer", color: "blue" },
              { id: "move-to-dist", label: "Move to Distributor", color: "purple" }
            ].map((t) => {
              const isActive = selectedTypes.includes(t.id);
              let colorClasses = "";
              if (t.color === "emerald") {
                colorClasses = isActive 
                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  : "bg-slate-50 dark:bg-slate-900/40 text-slate-450 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100";
              } else if (t.color === "rose") {
                colorClasses = isActive 
                  ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                  : "bg-slate-50 dark:bg-slate-900/40 text-slate-450 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100";
              } else if (t.color === "blue") {
                colorClasses = isActive 
                  ? "bg-blue-100 dark:bg-blue-955/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                  : "bg-slate-50 dark:bg-slate-900/40 text-slate-450 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100";
              } else if (t.color === "purple") {
                colorClasses = isActive 
                  ? "bg-purple-100 dark:bg-purple-955/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                  : "bg-slate-50 dark:bg-slate-900/40 text-slate-450 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100";
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
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all duration-200 ${colorClasses}`}
                >
                  {t.label}
                </button>
              );
            })}
            
            <button
              type="button"
              onClick={() => setSelectedTypes(["cash-in", "cash-out", "virtual-transfer", "move-to-dist"])}
              className="px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors ml-auto cursor-pointer"
            >
              Select All
            </button>
          </div>
        </div>

        {/* SCREEN LEDGER VIEW (With Pagination) */}
        <div className="space-y-4 text-slate-800 dark:text-slate-200">
          {/* Net Balance Card */}
          <div className="bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Net Balance</span>
              <span className={`text-base font-extrabold ${stats.netBalance > 0 ? "text-rose-500" : stats.netBalance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                ₹ {Math.abs(stats.netBalance).toLocaleString("en-IN")}
              </span>
            </div>
            
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-305 mt-0.5 block">{stats.entriesCount} Entries</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-rose-500 uppercase tracking-wider block">Total Gave</span>
                <span className="text-xs font-bold text-rose-500 mt-0.5 block">₹ {stats.totalGave.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-555 uppercase tracking-wider block">Total Got</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">₹ {stats.totalGot.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden shadow-xs">
            {paginatedTransfers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-505 font-bold italic">
                No ledger transactions found matching the selected filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {paginatedTransfers.map((tx: any) => {
                  const formatted = formatIST(tx.date);
                  const isGot = tx.type === "cash-in" || tx.type === "move-to-dist";
                  
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
                    badgeColor = "bg-blue-100 dark:bg-blue-955 text-blue-700 dark:text-blue-300";
                  } else {
                    badgeLabel = "Move to Dist";
                    badgeColor = "bg-purple-100 dark:bg-purple-955 text-purple-700 dark:text-purple-300";
                  }

                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        setSelectedDepositId(tx.id);
                        setEditAmount(tx.amount || 0);
                        setEditRef(tx.reference_no || "");
                      }}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors cursor-pointer"
                    >
                      {/* Left: Date & Running Balance */}
                      <div className="flex flex-col gap-1 min-w-0 max-w-[125px] shrink-0">
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 shrink-0">{formatted.date}</span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 mt-0.5">{formatted.time}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-505 dark:text-slate-400 bg-slate-50 dark:bg-slate-955 border border-slate-200/60 dark:border-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider self-start mt-1">
                          Bal. ₹{Math.round(tx.balance_snapshot || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      
                      {/* Middle: Description */}
                      <div className="flex-1 px-4 text-xs font-semibold text-slate-705 dark:text-slate-300 break-words whitespace-pre-wrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider self-start ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                          <div className={`text-xs font-black flex items-center gap-1 mt-1 ${isGot ? 'text-emerald-700 dark:text-emerald-450' : 'text-rose-700 dark:text-rose-450'}`}>
                            <span className="truncate max-w-[80px]" title={tx.narrationFrom}>{tx.narrationFrom}</span>
                            <span className="text-slate-450">→</span>
                            <span className="truncate max-w-[80px]" title={tx.narrationTo}>{tx.narrationTo}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-550 font-bold mt-1">
                            Staff: <span className="uppercase">{tx.staffName || 'Admin'}</span>
                          </div>
                          {tx.remarks && (
                            <div className="text-[10px] text-slate-450 dark:text-slate-450 font-medium mt-0.5">
                              Remark: <span className="italic">{tx.remarks}</span>
                            </div>
                          )}
                          {tx.reference_no && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-455 font-medium mt-0.5">
                              Ref: {tx.reference_no}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right: Gave (Debit) vs Got (Credit) columns */}
                      <div className="flex items-center gap-3 w-44 shrink-0 text-right font-mono text-xs">
                        {/* Gave Column */}
                        <div className="w-22 font-black text-rose-500">
                          {!isGot ? `₹ ${Math.round(tx.amount || 0).toLocaleString("en-IN")}` : "—"}
                        </div>
                        {/* Got Column */}
                        <div className="w-22 font-black text-emerald-600 dark:text-emerald-400">
                          {isGot ? `₹ ${Math.round(tx.amount || 0).toLocaleString("en-IN")}` : "—"}
                        </div>
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
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-950/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
                        className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          currentPage === p
                            ? "bg-blue-600 border-blue-650 text-white font-bold"
                            : "border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950/20 text-slate-600"
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
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-955/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Footer Buttons for PDF & Share */}
        <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 no-print">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading || filteredTransfers.length === 0}
            className="flex-1 py-3 px-4 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-955/20 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {isDownloading ? "Downloading..." : "DOWNLOAD PDF"}
          </button>
          
          <button
            onClick={handleShare}
            disabled={filteredTransfers.length === 0}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-550 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            SHARE SUMMARY
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
                <p className="text-[10px] text-slate-400 font-bold mt-1">Generated: {new Date().toLocaleDateString("en-IN")}</p>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-404 uppercase tracking-widest block">Net Balance</span>
                <span className="text-base font-black text-slate-900">
                  ₹ {Math.abs(stats.netBalance).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="bg-slate-55 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Net Balance</span>
                <span className={`text-base font-extrabold ${stats.netBalance > 0 ? "text-rose-500" : stats.netBalance < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                  ₹ {Math.abs(stats.netBalance).toLocaleString("en-IN")}
                </span>
              </div>
              
              <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5 block">{stats.entriesCount} Entries</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-rose-500 uppercase tracking-wider block">Total Gave</span>
                  <span className="text-xs font-bold text-rose-500 mt-0.5 block">₹ {stats.totalGave.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider block">Total Got</span>
                  <span className="text-xs font-bold text-emerald-600 mt-0.5 block">₹ {stats.totalGot.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {filteredTransfers.map((tx: any) => {
                const formatted = formatIST(tx.date);
                const isGot = tx.type === "cash-in" || tx.type === "move-to-dist";
                
                return (
                  <div key={tx.id} className="p-3 flex items-center justify-between">
                    <div className="flex flex-col gap-1 w-32 shrink-0">
                      <span className="text-xs font-bold text-slate-800">{formatted.date}</span>
                      <span className="text-[9px] text-slate-400">{formatted.time}</span>
                      <span className="text-[9px] text-slate-500 font-bold">Bal: ₹{Math.round(tx.balance_snapshot || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex-1 px-4 text-xs font-medium text-slate-700">
                      <div className="font-bold uppercase text-[9px] text-slate-450">{tx.type.replace("-", " ")}</div>
                      <div className="font-black text-slate-800">{tx.narrationFrom} → {tx.narrationTo}</div>
                      {tx.remarks && <div className="italic text-[10px] text-slate-400">Remark: {tx.remarks}</div>}
                      {tx.reference_no && <div className="text-[10px] text-slate-400">Ref: {tx.reference_no}</div>}
                    </div>
                    <div className="flex items-center gap-3 w-40 shrink-0 text-right font-mono text-xs">
                      <div className="w-20 text-rose-500 font-bold">{!isGot ? `₹${Math.round(tx.amount || 0).toLocaleString()}` : "—"}</div>
                      <div className="w-20 text-emerald-600 font-bold">{isGot ? `₹${Math.round(tx.amount || 0).toLocaleString()}` : "—"}</div>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 select-none animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Audit Ledger Entry
              </h3>
              <button
                onClick={() => {
                  setSelectedDepositId(null);
                  setIsEditMode(false);
                }}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-505 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div className="p-4 bg-slate-50 dark:bg-slate-955 rounded-xl border border-slate-100 dark:border-slate-800">
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
                  <span className="text-sm font-black text-rose-600">₹{currentSelectionTx.amount.toLocaleString()}.00</span>
                </div>
              </div>

              {isEditMode ? (
                <form onSubmit={handleEdit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Correction Amount (₹)</label>
                    <input autoComplete="one-time-code" 
                      type="number" 
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Reference No</label>
                    <input autoComplete="one-time-code" 
                      type="text" 
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      handleStartEditDeposit(currentSelectionTx);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" /> Edit Entry
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="w-full py-3 border border-red-200 text-red-650 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-808 dark:text-slate-100 uppercase tracking-tighter">
                {editingIsDeposit ? "Edit Payout / Deposit Entry" : "Edit Cash In (Collection) Entry"}
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
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

                  {availableStores.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Parent Store</label>
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

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Portal Channel</label>
                    <InlineSelect
                      value={selectedNewPortalId}
                      onChange={setSelectedNewPortalId}
                      options={[
                        { value: "", label: "None / Cash" },
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
                      placeholder="None / Cash"
                    />
                  </div>

                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/50 space-y-2">
                    <span className="text-[9px] text-slate-400 font-black uppercase block">Denominations</span>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {[
                        { label: "₹500 Notes", key: "note_500", factor: 500 },
                        { label: "₹200 Notes", key: "note_200", factor: 200 },
                        { label: "₹100 Notes", key: "note_100", factor: 100 },
                        { label: "₹50 Notes", key: "note_50", factor: 50 },
                        { label: "₹20 Notes", key: "note_20", factor: 20 },
                        { label: "₹10 Notes", key: "note_10", factor: 10 },
                      ].map(item => (
                        <div key={item.key} className="flex flex-col gap-0.5">
                          <label className="text-[8px] font-bold text-slate-400">{item.label}</label>
                          <input autoComplete="one-time-code"
                            type="number"
                            value={selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setSelectedNewDenoms(prev => ({ ...prev, [item.key]: val }));
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                          />
                        </div>
                      ))}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[8px] font-bold text-slate-400">Coins Sum</label>
                        <input autoComplete="one-time-code"
                          type="number"
                          step="0.01"
                          value={selectedNewDenoms.coins}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSelectedNewDenoms(prev => ({ ...prev, coins: val }));
                          }}
                          className="px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[8px] font-bold text-slate-400">UPI / Online Amount</label>
                        <input autoComplete="one-time-code"
                          type="number"
                          value={selectedNewDenoms.online_amount}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setSelectedNewDenoms(prev => ({ ...prev, online_amount: val }));
                          }}
                          className="px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                        />
                      </div>
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
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-slate-800 dark:text-slate-100"
                      readOnly
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      rows={2}
                      placeholder="Remarks..."
                    />
                  </div>
                </div>
              ) : (
                // Deposit Form Fields (Cash Out, Virtual Transfers)
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-405 font-bold uppercase block ml-1">Deposit/Payout Type</label>
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
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
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Portal</label>
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
                          className="w-4 h-4 text-blue-650 bg-slate-100 border-slate-305 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="editToOfficeCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-355">Handover to Main Office Cashier</label>
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
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
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

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                        </label>
                        <select
                          value={selectedNewVirtualTargetType}
                          onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
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
                      value={selectedNewAmount}
                      onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Date</label>
                    <input autoComplete="one-time-code"
                      type="date"
                      value={selectedNewDate}
                      onChange={(e) => setSelectedNewDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Reference No</label>
                    <input autoComplete="one-time-code"
                      type="text"
                      value={selectedNewRefNo}
                      onChange={(e) => setSelectedNewRefNo(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
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
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-202 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCollection}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer disabled:opacity-50"
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
