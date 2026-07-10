"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowLeft, 
  Calendar, 
  Search, 
  Share2, 
  FileDown, 
  Copy, 
  Check, 
  Filter,
  ArrowUpDown,
  Phone,
  Edit2,
  Trash2,
  Store,
  X
} from "lucide-react";
import Script from "next/script";
import { getISTDateString } from "../utils/dateHelpers";

const cleanDescription = (desc: string, tx?: any): string => {
  if (!desc) return "";
  let cleaned = desc
    .replace(/\s*\(auto-verified\)/gi, "")
    .replace(/cash payout/gi, "cash out")
    .replace(/cash collection/gi, "cash in");
    
  if (cleaned.toLowerCase().startsWith("move to distributor")) {
    const portal = tx?.portal_group_name || tx?.portal_name || "";
    if (portal) {
      cleaned = `move to distributor ${portal.toLowerCase()}`;
    }
  }
  return cleaned;
};

const renderDenominations = (denom: any) => {
  if (!denom) return null;
  const notes = [
    { label: "500", count: denom.note_500 },
    { label: "200", count: denom.note_200 },
    { label: "100", count: denom.note_100 },
    { label: "50", count: denom.note_50 },
    { label: "20", count: denom.note_20 },
    { label: "10", count: denom.note_10 },
  ].filter(n => n && typeof n.count === 'number' && n.count !== 0);

  const hasCoins = !!(denom.coins && parseFloat(denom.coins.toString()) !== 0);
  
  if (notes.length === 0 && !hasCoins) return null;
  
  return (
    <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 mt-2">
      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Cash Denominations</span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-350 font-medium">
        {notes.map(n => (
          <div key={n.label} className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-0.5 animate-fade-in">
            <span>₹{n.label} × {n.count}</span>
            <span className="font-mono font-bold text-slate-850 dark:text-slate-100">₹{parseInt(n.label) * n.count}</span>
          </div>
        ))}
        {hasCoins && (
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-0.5 animate-fade-in">
            <span>Coins</span>
            <span className="font-mono font-bold text-slate-850 dark:text-slate-100">₹{parseFloat(denom.coins.toString()).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface LedgerTransaction {
  id: string;
  date: string; // YYYY-MM-DD HH:MM:SS
  transaction_type: "credit" | "debit"; // credit = You Got, debit = You Gave
  amount: number;
  running_balance: number;
  description: string;
  remarks?: string;
  reference_no?: string;
  collection_id?: string | null;
  deposit_id?: string | null;
  store_name?: string | null;
  portal_name?: string | null;
  portal_bank_name?: string | null;
  bank_name?: string | null;
  portal_group_name?: string | null;
  portal_bank_account?: string | null;
  deposit_type?: string | null;
  denominations?: {
    note_500: number;
    note_200: number;
    note_100: number;
    note_50: number;
    note_20: number;
    note_10: number;
    coins: number;
    online_amount: number;
  } | null;
}

interface LedgerReportViewProps {
  title: string;
  subtitle?: string;
  data: LedgerTransaction[];
  outstandingBalance: number;
  isPublic?: boolean;
  onBack?: () => void;
  publicLink?: string;
  onEditRetailer?: () => void;
  onDeleteRetailer?: () => void;
  onManageStores?: () => void;
  phone?: string;
  onEditEntry?: (entry: any) => void;
  onDeleteEntry?: (entry: any) => void;
  hidePortalBankNames?: boolean;
}

export default function LedgerReportView({
  title,
  subtitle,
  data = [],
  outstandingBalance,
  isPublic = false,
  onBack,
  publicLink,
  onEditRetailer,
  onDeleteRetailer,
  onManageStores,
  phone,
  onEditEntry,
  onDeleteEntry,
  hidePortalBankNames = false
}: LedgerReportViewProps) {
  const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<LedgerTransaction | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "debit" | "credit">("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Set default start/end date range to cover all data if available
  useEffect(() => {
    if (data.length > 0) {
      const dates = data.map(d => d.date.substring(0, 10));
      dates.sort();
      setStartDate(dates[0]);
      setEndDate(dates[dates.length - 1]);
    } else {
      const today = getISTDateString();
      setStartDate(today);
      setEndDate(today);
    }
  }, [data]);

  // Intercept phone hardware back button: push a fake state so pressing back
  // closes the ledger view instead of leaving the admin page entirely.
  useEffect(() => {
    if (!onBack) return;
    // Push a sentinel entry so there's something to go "back" from
    window.history.pushState({ ledgerOpen: true }, "");
    const handlePopState = (e: PopStateEvent) => {
      // If we pop back to the sentinel-less state, close the ledger
      onBack();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [onBack]);

  const handleCopyLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Filter and compute data
  const filteredTransactions = useMemo(() => {
    return data
      .filter((tx) => {
        const txDateStr = tx.date.substring(0, 10);
        
        // Date range filter
        if (startDate && txDateStr < startDate) return false;
        if (endDate && txDateStr > endDate) return false;
        
        // Search filter
        const cleanDesc = cleanDescription(tx.description, tx);
        const remarkText = tx.remarks || "";
        const refNoText = tx.reference_no || "";
        const storeText = tx.store_name || "";
        const portalText = tx.portal_name || "";
        const bankText = tx.portal_bank_name || tx.bank_name || "";
        const q = searchQuery.toLowerCase();
        if (
          searchQuery && 
          !cleanDesc.toLowerCase().includes(q) &&
          !remarkText.toLowerCase().includes(q) &&
          !refNoText.toLowerCase().includes(q) &&
          !storeText.toLowerCase().includes(q) &&
          !portalText.toLowerCase().includes(q) &&
          !bankText.toLowerCase().includes(q) &&
          !tx.amount.toString().includes(q)
        ) {
          return false;
        }
        
        // Type filter
        if (filterType === "credit" && tx.transaction_type !== "credit") return false;
        if (filterType === "debit" && tx.transaction_type !== "debit") return false;
        
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === "amount-desc") return b.amount - a.amount;
        if (sortBy === "amount-asc") return a.amount - b.amount;
        return 0;
      });
  }, [data, startDate, endDate, searchQuery, filterType, sortBy]);

  // KPI Calculations
  const stats = useMemo(() => {
    let youGave = 0;
    let youGot = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.transaction_type === "debit") {
        youGave += tx.amount;
      } else {
        youGot += tx.amount;
      }
    });

    return {
      entriesCount: filteredTransactions.length,
      youGave,
      youGot,
      netBalance: youGave - youGot
    };
  }, [filteredTransactions]);

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
    const element = document.getElementById("pdf-ledger-report");
    if (!element) {
      setIsDownloading(false);
      return;
    }

    const nameClean = title.trim().replace(/\s+/g, "_");
    const dateRangeStr = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
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
    const shareText = `Report of ${title}
Outstanding Balance: ₹ ${Math.abs(outstandingBalance).toLocaleString("en-IN")}
Total Entries: ${stats.entriesCount}
You Gave: ₹ ${stats.youGave.toLocaleString("en-IN")}
You Got: ₹ ${stats.youGot.toLocaleString("en-IN")}
${publicLink ? `\nView Full Ledger: ${publicLink}` : ""}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ledger Report - ${title}`,
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
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans pb-24">
      {/* 1. Header with back arrow */}
      <div className="bg-indigo-600 dark:bg-indigo-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack} 
              className="p-1 rounded-full hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Report of {title}</h1>
            {subtitle && <p className="text-[10px] text-indigo-100 font-semibold">{subtitle}</p>}
          </div>
        </div>
        
        {publicLink && !isPublic && (
          <div className="flex items-center gap-1.5 animate-fade-in">
            <button
              onClick={handleCopyLink}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all cursor-pointer flex items-center justify-center active:scale-95"
              title={isCopied ? "Copied Link" : "Copy Portal Link"}
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleShare}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all cursor-pointer flex items-center justify-center active:scale-95"
              title="Share Portal Link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Retailer Actions (Admin Only / Non-Public) */}
        {!isPublic && (onEditRetailer || onDeleteRetailer || onManageStores || phone) && (
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center justify-around gap-2">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 text-xs font-bold flex flex-col items-center gap-1 transition-all active:scale-95 border border-slate-100"
              >
                <Phone className="w-4 h-4 text-slate-500" />
                <span>Call</span>
              </a>
            )}
            {onEditRetailer && (
              <button
                onClick={onEditRetailer}
                className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all active:scale-95 border border-blue-100/50 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
            {onManageStores && (
              <button
                onClick={onManageStores}
                className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all active:scale-95 border border-indigo-100/50 cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>Stores</span>
              </button>
            )}
            {onDeleteRetailer && title.toLowerCase().trim() !== "cms" && (
              <button
                onClick={onDeleteRetailer}
                className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all active:scale-95 border border-red-100/50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
        {/* 2. Start Date & End Date controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[8px] text-slate-400 font-black uppercase">Start Date</span>
              <input autoComplete="one-time-code"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 focus:outline-none w-full cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[8px] text-slate-400 font-black uppercase">End Date</span>
              <input autoComplete="one-time-code"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 focus:outline-none w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 3. Search, Type, and Sorting Filters */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input autoComplete="one-time-code"
              type="text"
              placeholder="Search Entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none shadow-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="relative w-full">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 focus:outline-none cursor-pointer appearance-none pr-8 shadow-sm"
              >
                <option value="all">ALL ENTRIES</option>
                <option value="debit">GAVE</option>
                <option value="credit">GOT</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>

            <div className="relative w-full">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 focus:outline-none cursor-pointer appearance-none pr-8 shadow-sm"
              >
                <option value="date-desc">LATEST FIRST</option>
                <option value="date-asc">OLDEST FIRST</option>
                <option value="amount-desc">AMOUNT: HIGH-LOW</option>
                <option value="amount-asc">AMOUNT: LOW-HIGH</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Printable/Export Content container */}
        <div id="pdf-ledger-report" className="space-y-4 bg-transparent text-slate-800 p-0.5">
          {/* Printable Header - hidden on screen, shown in PDF */}
          <div className="hidden pdf-only flex-col gap-2 border-b border-slate-200 pb-4 text-slate-900 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-lg font-black text-slate-900">{title}</h1>
                {subtitle && <p className="text-xs text-slate-500 font-bold mt-0.5">{subtitle}</p>}
                {startDate && endDate && (
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Statement Period: {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-bold mt-1">Generated: {new Date().toLocaleDateString("en-IN")}</p>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Net Balance</span>
                <span className="text-base font-black text-slate-900">
                  ₹ {Math.abs(stats.netBalance).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Net Balance Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            {outstandingBalance !== undefined && (
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-900 uppercase">Current Outstanding</span>
                <span className={`text-base font-black ${outstandingBalance < 0 ? "text-emerald-600" : outstandingBalance > 0 ? "text-red-500" : "text-slate-500"}`}>
                  {outstandingBalance < 0 ? "-" : ""}₹ {Math.abs(outstandingBalance).toLocaleString("en-IN")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Net Balance (Period)</span>
              <span className={`text-base font-extrabold ${stats.netBalance < 0 ? "text-emerald-600" : stats.netBalance > 0 ? "text-red-500" : "text-slate-500"}`}>
                ₹ {Math.abs(stats.netBalance).toLocaleString("en-IN")}
              </span>
            </div>
            
            <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total</span>
                <span className="text-xs font-bold text-slate-700 mt-0.5 block">{stats.entriesCount} Entries</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block text-red-500">You Gave</span>
                <span className="text-xs font-bold text-red-500 mt-0.5 block">₹ {stats.youGave.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block text-emerald-600">You Got</span>
                <span className="text-xs font-bold text-emerald-600 mt-0.5 block">₹ {stats.youGot.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* 5. Transactions Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-bold">
                No ledger transactions found in the selected date range.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const formattedIST = formatIST(tx.date);
                  const isDebit = tx.transaction_type === "debit"; // You Gave
                  
                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        setSelectedEntryForDetails(tx);
                      }}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      {/* Left: Date & Running Balance */}
                      <div className="flex flex-col gap-1 min-w-0 max-w-[125px]">
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm font-extrabold text-slate-800 shrink-0">{formattedIST.date}</span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5">{formattedIST.time}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider self-start mt-1">
                          Bal. ₹{Math.round(tx.running_balance).toLocaleString("en-IN")}
                        </span>
                      </div>
                      
                      {/* Middle: Description */}
                      <div className="flex-1 px-4 text-base font-semibold text-slate-700 break-words whitespace-pre-wrap">
                        <div className="text-slate-900 font-extrabold">{cleanDescription(tx.description, tx)}</div>
                        {tx.store_name && (
                          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            Store: <span className="font-extrabold uppercase tracking-tight">{tx.store_name}</span>
                          </div>
                        )}
                        {isDebit && (tx.portal_name || tx.portal_group_name) && (
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                            {tx.deposit_type === "retailer"
                              ? `Retailer - ${tx.portal_name}`
                              : tx.deposit_type === "staff"
                              ? `Staff - ${tx.portal_name}`
                              : hidePortalBankNames
                              ? (tx.portal_group_name || "Portal")
                              : (tx.portal_group_name ? `${tx.portal_group_name}${tx.portal_name ? ` (${tx.portal_name})` : ""}` : tx.portal_name)}
                          </div>
                        )}
                        {tx.remarks && (
                          <div className="text-xs text-slate-450 font-medium mt-0.5">
                            Remark: <span className="italic">{tx.remarks}</span>
                          </div>
                        )}
                        {tx.reference_no && (
                          <div className="text-xs text-slate-450 font-medium mt-0.5">
                            Ref: {tx.reference_no}
                          </div>
                        )}
                      </div>
                      
                      {/* Right: Gave (Debit) vs Got (Credit) numeric columns */}
                      <div className="flex items-center gap-3 w-44 shrink-0 text-right font-mono text-base">
                        {/* Gave Column */}
                        <div className="w-22 font-black text-red-500">
                          {isDebit ? `₹ ${Math.round(tx.amount).toLocaleString("en-IN")}` : "—"}
                        </div>
                        {/* Got Column */}
                        <div className="w-22 font-black text-emerald-600">
                          {!isDebit ? `₹ ${Math.round(tx.amount).toLocaleString("en-IN")}` : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Footer Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3.5 px-4 flex gap-3 shadow-2xl z-40 max-w-lg mx-auto rounded-t-2xl">
        <button
          onClick={handleDownloadPDF}
          disabled={isDownloading || filteredTransactions.length === 0}
          className="flex-1 py-3 px-4 rounded-xl border border-indigo-500 text-indigo-600 hover:bg-indigo-50 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" />
          {isDownloading ? "Downloading..." : "DOWNLOAD"}
        </button>
        
        <button
          onClick={handleShare}
          disabled={filteredTransactions.length === 0}
          className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" />
          SHARE
        </button>
      </div>

      {/* Transaction Details Bottom Sheet */}
      {selectedEntryForDetails && (
        <div className="fixed inset-0 z-50 flex items-end justify-center select-none">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedEntryForDetails(null)}
          />
          {/* Content */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-2xl space-y-4 animate-slide-up border-t border-slate-200 dark:border-slate-800 pb-8 z-10">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  Transaction Details
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  {formatIST(selectedEntryForDetails.date).full}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntryForDetails(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details Content */}
            <div className="space-y-3.5 text-slate-700 dark:text-slate-300 max-h-[50vh] overflow-y-auto pr-1">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</span>
                <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedEntryForDetails.transaction_type === "credit" 
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400" 
                    : "bg-red-50 dark:bg-red-955/20 text-red-500 dark:text-red-400"
                }`}>
                  {cleanDescription(selectedEntryForDetails.description, selectedEntryForDetails)}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</span>
                <span className={`text-base font-extrabold ${
                  selectedEntryForDetails.transaction_type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                }`}>
                  ₹ {selectedEntryForDetails.amount.toLocaleString("en-IN")}
                </span>
              </div>

              {selectedEntryForDetails.store_name && (
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Store Name</span>
                  <span className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                    {selectedEntryForDetails.store_name}
                  </span>
                </div>
              )}

              {/* Cash In (Collection) Details */}
              {selectedEntryForDetails.transaction_type === "credit" && (
                <>
                  {/* Show Online Portal Name if payment was online */}
                  {(selectedEntryForDetails.portal_name || selectedEntryForDetails.portal_group_name) && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3.5 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20 flex justify-between items-center text-xs">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">Online Portal</span>
                      <span className="font-extrabold text-emerald-650 dark:text-emerald-400 uppercase tracking-wider">
                        {hidePortalBankNames
                          ? (selectedEntryForDetails.portal_group_name || "Portal")
                          : (selectedEntryForDetails.portal_group_name
                            ? `${selectedEntryForDetails.portal_group_name}${selectedEntryForDetails.portal_name ? ` (${selectedEntryForDetails.portal_name})` : ""}`
                            : selectedEntryForDetails.portal_name)}
                        {selectedEntryForDetails.denominations?.online_amount ? ` (₹${selectedEntryForDetails.denominations.online_amount})` : ""}
                      </span>
                    </div>
                  )}

                  {/* Cash Denominations breakdown */}
                  {selectedEntryForDetails.denominations && (
                    renderDenominations(selectedEntryForDetails.denominations)
                  )}
                </>
              )}

              {/* Cash Out (Deposit/Payout) Details */}
              {selectedEntryForDetails.transaction_type === "debit" && 
               (selectedEntryForDetails.deposit_type === "retailer" || selectedEntryForDetails.deposit_type === "staff" || !hidePortalBankNames || selectedEntryForDetails.portal_group_name) && 
               (selectedEntryForDetails.portal_name || selectedEntryForDetails.portal_group_name || selectedEntryForDetails.portal_bank_name || selectedEntryForDetails.bank_name) && (
                 <div className="bg-indigo-50/50 dark:bg-indigo-950/15 p-3.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30 space-y-2 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                   <span className="text-[10px] font-black text-indigo-400 dark:text-indigo-550 uppercase tracking-widest block">Transfer Target</span>
                   {(selectedEntryForDetails.portal_name || selectedEntryForDetails.portal_group_name) && (
                     <div className="flex justify-between border-b border-indigo-100/20 dark:border-indigo-900/10 pb-1">
                       <span className="font-extrabold uppercase tracking-wide">
                         {selectedEntryForDetails.deposit_type === "retailer"
                           ? `Retailer - ${selectedEntryForDetails.portal_name}`
                           : selectedEntryForDetails.deposit_type === "staff"
                           ? `Staff - ${selectedEntryForDetails.portal_name}`
                           : hidePortalBankNames
                           ? (selectedEntryForDetails.portal_group_name || "Portal")
                           : (selectedEntryForDetails.portal_group_name
                             ? `${selectedEntryForDetails.portal_group_name}${selectedEntryForDetails.portal_name ? ` (${selectedEntryForDetails.portal_name})` : ""}`
                             : selectedEntryForDetails.portal_name)}
                       </span>
                     </div>
                   )}
                   {(selectedEntryForDetails.portal_bank_name || selectedEntryForDetails.bank_name) && !hidePortalBankNames && (
                     <div className="flex justify-between pb-0.5">
                       <span>Bank Name</span>
                       <span className="font-extrabold">{selectedEntryForDetails.portal_bank_name || selectedEntryForDetails.bank_name}</span>
                     </div>
                   )}
                 </div>
              )}

              {selectedEntryForDetails.remarks && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Remarks</span>
                  <p className="italic font-medium text-slate-600 dark:text-slate-350">{selectedEntryForDetails.remarks}</p>
                </div>
              )}

              {selectedEntryForDetails.reference_no && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Reference No.</span>
                  <span className="font-mono font-bold text-slate-650 dark:text-slate-300">{selectedEntryForDetails.reference_no}</span>
                </div>
              )}
            </div>

            {/* Actions Grid */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  const entry = selectedEntryForDetails;
                  setSelectedEntryForDetails(null);
                  const shareText = `Statement Entry details:
Date: ${formatIST(entry.date).full}
Type: ${entry.transaction_type === "credit" ? "Cash In" : "Cash Out"}
Amount: ₹ ${Math.round(entry.amount).toLocaleString()}
Desc: ${cleanDescription(entry.description, entry)}
${entry.store_name ? `Store: ${entry.store_name}\n` : ''}${entry.portal_name ? `Portal: ${entry.portal_name}\n` : ''}Remarks: ${entry.remarks || 'None'}`;
                  if (navigator.share) {
                    navigator.share({ title: "Transaction Receipt", text: shareText }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(shareText);
                    alert("Receipt summary copied!");
                  }
                }}
                className="flex-1 py-3 px-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-100 dark:border-emerald-900/30"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Receipt</span>
              </button>

              {!isPublic && (selectedEntryForDetails.collection_id || selectedEntryForDetails.deposit_id) && (onEditEntry || onDeleteEntry) && (
                <>
                  {onEditEntry && (
                    <button
                      onClick={() => {
                        const entry = selectedEntryForDetails;
                        setSelectedEntryForDetails(null);
                        onEditEntry(entry);
                      }}
                      className="flex-1 py-3 px-2 bg-blue-50 dark:bg-blue-955/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer border border-blue-100 dark:border-blue-900/30"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  )}
                  {onDeleteEntry && (
                    <button
                      onClick={() => {
                        const entry = selectedEntryForDetails;
                        setSelectedEntryForDetails(null);
                        onDeleteEntry(entry);
                      }}
                      className="flex-1 py-3 px-2 bg-red-50 dark:bg-red-955/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer border border-red-100 dark:border-red-900/30"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
