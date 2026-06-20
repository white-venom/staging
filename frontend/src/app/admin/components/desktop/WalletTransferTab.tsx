"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, History, Edit, Trash2, X, Save, Calendar, Search, Share2, FileDown, Filter, ArrowUpDown } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import InlineSelect from "../../../components/InlineSelect";

export default function WalletTransferTab() {
  const adminContext = useAdmin();
  const { retailerDirectory, portalDirectory, userDirectory, deposits, fetchData, showToastNotification } = adminContext;

  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState(0);
  const [editRef, setEditRef] = useState("");

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);

  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
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

  const handleStartEditDeposit = (item: any) => {
    setEditingCollection(item);
    setSelectedNewRetailerId(item.retailer_id || "");
    setSelectedNewPortalId(item.portal_id || "");
    setSelectedNewRemarks(item.remarks || "");
    setSelectedNewDepositType(item.depositType || item.deposit_type || "virtual");
    setSelectedNewPaymentMode(item.paymentMode || item.payment_mode || "online");
    setSelectedNewAmount(Number(item.amount || 0));
    setSelectedNewDate(item.deposit_date ? item.deposit_date : (item.date ? item.date.split(" ")[0] : new Date().toISOString().split("T")[0]));
    setSelectedNewRefNo(item.reference_no || item.referenceNo || "");
    setSelectedNewRecipientStaffId(item.recipient_staff_id || item.recipientStaffId || "");
    setSelectedNewToOffice(item.to_office === true);
    const hasStaff = !!(item.recipient_staff_id || item.recipientStaffId);
    setSelectedNewVirtualTargetType(hasStaff ? "staff" : "retailer");

    const den = item.denominations || {};
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

      if (showToastNotification) showToastNotification("Deposit/Payout updated successfully.");
      setIsEditCollectionModalOpen(false);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

  const currentSelection = (deposits || []).find((d: any) => d.id === selectedDepositId);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepositId || !currentSelection) return;
    try {
      await api.updateDeposit(selectedDepositId, {
        ...currentSelection,
        amount: editAmount,
        reference_no: editRef
      });
      if (showToastNotification) showToastNotification("Updated successfully!");
      setIsEditMode(false);
      setSelectedDepositId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Update failed: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedDepositId) return;
    if (!confirm("Are you sure you want to delete this virtual transfer?")) return;
    try {
      await api.deleteDeposit(selectedDepositId);
      if (showToastNotification) showToastNotification("Deleted successfully!");
      setSelectedDepositId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const [vSourcePortalId, setVSourcePortalId] = useState("");
  const [vDirection, setVDirection] = useState<"load" | "refund">("load");
  const [vDestType, setVDestType] = useState<"retailer" | "staff">("retailer");
  const [vDestRetailerId, setVDestRetailerId] = useState("");
  const [vDestStaffId, setVDestStaffId] = useState("");
  const [vAmount, setVAmount] = useState("");
  const [vRemarks, setVRemarks] = useState("");
  const [vDate, setVDate] = useState(() => {
    const d = new Date();
    const tzString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const parts = new Date(tzString);
    const y = parts.getFullYear();
    const m = String(parts.getMonth() + 1).padStart(2, "0");
    const day = String(parts.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [isTransferring, setIsTransferring] = useState(false);

  const allPortals = (portalDirectory || []).flatMap((g: any) => 
    (g.portals || []).map((p: any) => ({
      ...p,
      groupName: g.name
    }))
  );

  const handleVirtualTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vSourcePortalId) {
      alert("Please select a source portal account");
      return;
    }
    const amt = parseFloat(vAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid transfer amount greater than 0");
      return;
    }

    const payload: any = {
      portal_id: vSourcePortalId,
      amount: amt,
      remarks: vRemarks || undefined,
      direction: vDirection,
      transfer_date: vDate
    };

    if (vDestType === "retailer") {
      if (!vDestRetailerId) {
        alert("Please select a destination retailer");
        return;
      }
      payload.retailer_id = vDestRetailerId;
    } else {
      if (!vDestStaffId) {
        alert("Please select a destination staff member");
        return;
      }
      payload.staff_id = vDestStaffId;
    }

    setIsTransferring(true);
    try {
      await api.virtualTransfer(payload);

      const targetMsg = vDestType === "retailer" ? "Retailer" : "Staff";
      const actionMsg = vDirection === "load" 
        ? `Virtually loaded ₹${amt.toLocaleString()} to ${targetMsg}'s wallet!`
        : `Moved ₹${amt.toLocaleString()} from ${targetMsg} back to Portal!`;

      if (showToastNotification) {
        showToastNotification(actionMsg);
      } else {
        alert(actionMsg);
      }

      setVSourcePortalId("");
      setVDestRetailerId("");
      setVDestStaffId("");
      setVAmount("");
      setVRemarks("");
      setVDate(() => {
        const d = new Date();
        const tzString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const parts = new Date(tzString);
        const y = parts.getFullYear();
        const m = String(parts.getMonth() + 1).padStart(2, "0");
        const day = String(parts.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      });

      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Transfer Error: " + err.message);
    } finally {
      setIsTransferring(false);
    }
  };  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "load" | "refund">("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const virtualDeps = (deposits || []).filter((d: any) => d.depositType === "virtual");
    if (virtualDeps.length > 0) {
      const dates = virtualDeps.map(d => d.date?.substring(0, 10)).filter(Boolean);
      dates.sort();
      if (dates.length > 0) {
        setDateFrom(prev => prev || dates[0]);
        setDateTo(prev => prev || dates[dates.length - 1]);
      }
    } else {
      const today = new Date().toISOString().substring(0, 10);
      setDateFrom(prev => prev || today);
      setDateTo(prev => prev || today);
    }
  }, [deposits]);

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

    const nameClean = "Virtual_Money_Ledger";
    const dateRangeStr = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;
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
    const shareText = `Virtual Money Ledger Report
Net Balance: ₹ ${Math.abs(stats.netBalance).toLocaleString("en-IN")}
Total Entries: ${stats.entriesCount}
You Gave (Virtual Transfer): ₹ ${stats.totalGave.toLocaleString("en-IN")}
You Got (Move to Dist): ₹ ${stats.totalGot.toLocaleString("en-IN")}
Period: ${dateFrom} to ${dateTo}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Virtual Money Ledger`,
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

  const filteredVirtualTransfers = React.useMemo(() => {
    const virtualDeps = (deposits || []).filter((d: any) => d.depositType === "virtual");
    return virtualDeps
      .filter((tx: any) => {
        const txDateStr = tx.date?.substring(0, 10);
        
        // Date range filter
        if (dateFrom && txDateStr < dateFrom) return false;
        if (dateTo && txDateStr > dateTo) return false;
        
        // Search filter
        const isRefund = tx.isRefund === true;
        const portalName = tx.portalGroupName || tx.portalName || "Portal";
        const retailer = (retailerDirectory || []).find((r: any) => r.id === tx.retailer_id);
        const retailerName = retailer?.name || tx.targetName || "Retailer/Staff";
        const narrationFrom = isRefund ? retailerName : portalName;
        const narrationTo = isRefund ? portalName : retailerName;
        const narration = `${isRefund ? "Move to Distributor" : "Virtual Transfer"} ${narrationFrom} to ${narrationTo}`;
        const remarkText = tx.remarks || "";
        const refNoText = tx.reference_no || tx.referenceNo || "";
        const staffText = tx.staffName || "";
        
        const q = searchQuery.toLowerCase();
        if (
          searchQuery && 
          !narration.toLowerCase().includes(q) &&
          !remarkText.toLowerCase().includes(q) &&
          !refNoText.toLowerCase().includes(q) &&
          !staffText.toLowerCase().includes(q) &&
          !tx.amount?.toString().includes(q)
        ) {
          return false;
        }
        
        // Type filter
        if (filterType === "load" && isRefund) return false;
        if (filterType === "refund" && !isRefund) return false;
        
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
  }, [deposits, dateFrom, dateTo, searchQuery, filterType, sortBy, retailerDirectory]);

  const stats = React.useMemo(() => {
    let totalGave = 0; // load
    let totalGot = 0;  // refund
    
    filteredVirtualTransfers.forEach((tx: any) => {
      if (tx.isRefund === true) {
        totalGot += tx.amount || 0;
      } else {
        totalGave += tx.amount || 0;
      }
    });
    
    return {
      entriesCount: filteredVirtualTransfers.length,
      totalGave,
      totalGot,
      netBalance: totalGave - totalGot
    };
  }, [filteredVirtualTransfers]);

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
              Virtual Money Transfer
            </h3>
          </div>
          <select
            value={vDirection}
            onChange={(e) => setVDirection(e.target.value as "load" | "refund")}
            className="text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value="load">Virtual Transfer</option>
            <option value="refund">Move to Distributor</option>
          </select>
        </div>

        <form onSubmit={handleVirtualTransfer} className="space-y-4">
          <div className={`flex ${vDirection === 'load' ? 'flex-col' : 'flex-col-reverse'} gap-4`}>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                {vDirection === "load" ? "Source Portal" : "Destination Portal"}
              </label>
              <InlineSelect
                value={vSourcePortalId}
                onChange={(val) => setVSourcePortalId(val)}
                options={(portalDirectory || []).map((g: any) => {
                  const primaryPortalId = g.portals && g.portals.length > 0 ? g.portals[0].id : "";
                  return {
                    value: primaryPortalId,
                    label: `${g.name} - Bal: ₹${(g.balance || 0).toLocaleString()}`
                  };
                })}
                placeholder="Select Portal"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                {vDirection === "load" ? "Destination Retailer" : "Source Retailer"}
              </label>
              <InlineSelect
                value={vDestRetailerId}
                onChange={(val) => setVDestRetailerId(val)}
                options={(retailerDirectory || []).map((r: any) => {
                  const bal = r.balance || 0;
                  const balText = bal < 0 
                    ? `To Give: ₹${Math.abs(bal).toLocaleString()}` 
                    : `To Take: ₹${bal.toLocaleString()}`;
                  return {
                    value: r.id,
                    label: `${r.name} (${balText})`
                  };
                })}
                placeholder="Select Retailer"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Transfer Date</label>
            <input autoComplete="one-time-code"
              type="date"
              value={vDate}
              onChange={e => setVDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200 text-left cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Amount to Load (₹)</label>
            <input autoComplete="one-time-code"
              type="number"
              value={vAmount}
              onChange={e => setVAmount(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200"
              min="1"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isTransferring}
            className={`w-full py-3 text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              vDirection === 'load' 
                ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600' 
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            }`}
          >
            {isTransferring 
              ? "Processing Transfer..." 
              : vDirection === "load" 
                ? "Virtual Transfer" 
                : "Move to Distributor"}
          </button>
        </form>
      </div>

      {/* LEDGER VIEW */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4 col-span-1 lg:col-span-2">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
            Virtual Transfer & Move to Distributor Ledger
          </h3>
        </div>

        {/* Start & End Date controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 shadow-xs">
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
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-450 shrink-0" />
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

        {/* Search, Type, and Sorting Filters */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input autoComplete="one-time-code"
              type="text"
              placeholder="Search Entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-405 focus:outline-none shadow-xs"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="relative w-full">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-8 shadow-xs"
              >
                <option value="all">ALL ENTRIES</option>
                <option value="load">VIRTUAL TRANSFER</option>
                <option value="refund">MOVE TO DISTRIBUTOR</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>

            <div className="relative w-full">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-8 shadow-xs"
              >
                <option value="date-desc">LATEST FIRST</option>
                <option value="date-asc">OLDEST FIRST</option>
                <option value="amount-desc">AMOUNT: HIGH-LOW</option>
                <option value="amount-asc">AMOUNT: LOW-HIGH</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Printable container */}
        <div id="pdf-virtual-ledger-report" className="space-y-4 bg-transparent text-slate-800 dark:text-slate-200 p-0.5">
          {/* Printable Header - hidden on screen, shown in PDF */}
          <div className="hidden pdf-only flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-4 text-slate-900 dark:text-white mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-lg font-black">Virtual Money Ledger</h1>
                {dateFrom && dateTo && (
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Period: {dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`}
                  </p>
                )}
                <p className="text-[10px] text-slate-450 font-bold mt-1">Generated: {new Date().toLocaleDateString("en-IN")}</p>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-405 uppercase tracking-widest block">Net Balance</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  ₹ {Math.abs(stats.netBalance).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Net Balance Card */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Net Balance</span>
              <span className={`text-base font-extrabold ${stats.netBalance > 0 ? "text-red-500" : stats.netBalance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                ₹ {Math.abs(stats.netBalance).toLocaleString("en-IN")}
              </span>
            </div>
            
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-305 mt-0.5 block">{stats.entriesCount} Entries</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-red-500 uppercase tracking-wider block">You Gave</span>
                <span className="text-xs font-bold text-red-500 mt-0.5 block">₹ {stats.totalGave.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-wider block">You Got</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">₹ {stats.totalGot.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden shadow-xs">
            {filteredVirtualTransfers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 font-bold italic">
                No ledger transactions found in the selected date range.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredVirtualTransfers.map((tx: any) => {
                  const formatted = formatIST(tx.date);
                  const isRefund = tx.isRefund === true;
                  const portalName = tx.portalGroupName || tx.portalName || "Portal";
                  const retailer = (retailerDirectory || []).find((r: any) => r.id === tx.retailer_id);
                  const retailerName = retailer?.name || tx.targetName || "Retailer/Staff";
                  
                  const narrationFrom = isRefund ? retailerName : portalName;
                  const narrationTo = isRefund ? portalName : retailerName;

                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        setSelectedDepositId(tx.id);
                        setEditAmount(tx.amount || 0);
                        setEditRef(tx.reference_no || tx.referenceNo || "");
                      }}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors cursor-pointer"
                    >
                      {/* Left: Date & Running Balance */}
                      <div className="flex flex-col gap-1 min-w-0 max-w-[125px] shrink-0">
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 shrink-0">{formatted.date}</span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{formatted.time}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider self-start mt-1">
                          Bal. ₹{Math.round(tx.balance_snapshot || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      
                      {/* Middle: Description */}
                      <div className="flex-1 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider self-start ${
                            isRefund
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {isRefund ? 'Move to Distributor' : 'Virtual Transfer'}
                          </span>
                          <div className={`text-xs font-black flex items-center gap-1 mt-1 ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-slate-805 dark:text-slate-200'}`}>
                            <span className="truncate max-w-[80px]" title={narrationFrom}>{narrationFrom}</span>
                            <span className="text-slate-450">→</span>
                            <span className="truncate max-w-[80px]" title={narrationTo}>{narrationTo}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                            Staff: <span className="uppercase">{tx.staffName || 'Admin'}</span>
                          </div>
                          {tx.remarks && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-450 font-medium mt-0.5">
                              Remark: <span className="italic">{tx.remarks}</span>
                            </div>
                          )}
                          {(tx.reference_no || tx.referenceNo) && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-455 font-medium mt-0.5">
                              Ref: {tx.reference_no || tx.referenceNo}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right: Gave (Debit) vs Got (Credit) numeric columns */}
                      <div className="flex items-center gap-3 w-44 shrink-0 text-right font-mono text-xs">
                        {/* Gave Column */}
                        <div className="w-22 font-black text-red-500">
                          {!isRefund ? `₹ ${Math.round(tx.amount || 0).toLocaleString("en-IN")}` : "—"}
                        </div>
                        {/* Got Column */}
                        <div className="w-22 font-black text-emerald-600 dark:text-emerald-400">
                          {isRefund ? `₹ ${Math.round(tx.amount || 0).toLocaleString("en-IN")}` : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons for PDF & Share */}
        <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 no-print">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading || filteredVirtualTransfers.length === 0}
            className="flex-1 py-3 px-4 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {isDownloading ? "Downloading..." : "DOWNLOAD PDF"}
          </button>
          
          <button
            onClick={handleShare}
            disabled={filteredVirtualTransfers.length === 0}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            SHARE SUMMARY
          </button>
        </div>
      </div>

      {/* Audit Drawer/Modal */}
      {selectedDepositId && currentSelection && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 select-none animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Audit Virtual Transfer Entry
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
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Target (Bank/Portal)</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.targetName}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Staff</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.staffName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Amount</span>
                  <span className="text-sm font-black text-red-600">₹{currentSelection.amount.toLocaleString()}.00</span>
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
                      handleStartEditDeposit(currentSelection);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" /> Edit Entry
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="w-full py-3 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
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
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                Edit Virtual Transfer Entry
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveDepositEdit} className="space-y-4">
              
              <div className="space-y-3">
                {/* Deposit Type */}
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
                    className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                  >
                    <option value="portal">Cash Out</option>
                    <option value="retailer">Retailer Payout</option>
                    <option value="staff">Direct Handover</option>
                    <option value="virtual-load">Virtual Transfer</option>
                    <option value="virtual-refund">Move to Distributor</option>
                  </select>
                </div>

                {/* Target Fields depending on deposit type */}
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
                        className="w-4 h-4 text-blue-650 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
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

                {/* Amount */}
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

                {/* Date */}
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

                {/* Reference No */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Reference No</label>
                  <input autoComplete="one-time-code"
                    type="text"
                    value={selectedNewRefNo}
                    onChange={(e) => setSelectedNewRefNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                    placeholder="Optional"
                  />
                </div>

                {/* Remarks */}
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

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditCollectionModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
