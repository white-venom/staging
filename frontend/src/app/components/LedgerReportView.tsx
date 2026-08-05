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
import { getISTDateString } from "../utils/dateHelpers";
import { downloadElementAsPdf } from "../utils/downloadElementAsPdf";
import { downloadCsv } from "../utils/downloadCsv";

const cleanDescription = (desc: string, tx?: any): string => {
  if (!desc) return "";
  // Used to append the portal name into this title (e.g. "move to
  // distributor vidcom") -- now redundant and duplicated, since the portal
  // is always shown as its own subtitle line below the title.
  return desc
    .replace(/\s*\(auto-verified\)/gi, "")
    .replace(/cash payout/gi, "cash out")
    .replace(/cash collection/gi, "cash in");
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
    <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-sm border border-slate-100 dark:border-slate-800 space-y-2 mt-2">
      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Cash Denominations</span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium tabular-nums">
        {notes.map(n => (
          <div key={n.label} className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-0.5">
            <span>₹{n.label} × {n.count}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">₹{parseInt(n.label) * n.count}</span>
          </div>
        ))}
        {hasCoins && (
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-0.5">
            <span>Coins</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">₹{parseFloat(denom.coins.toString()).toFixed(2)}</span>
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
  bank_account_name?: string | null;
  bank_name?: string | null;
  portal_name?: string | null;
  staff_name?: string | null;
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
  outstandingBalance?: number;
  isPublic?: boolean;
  onBack?: () => void;
  publicLink?: string;
  onEditRetailer?: () => void;
  onDeleteRetailer?: () => void;
  onManageStores?: () => void;
  phone?: string;
  onEditEntry?: (entry: any) => void;
  onDeleteEntry?: (entry: any) => void;
  hideBankNames?: boolean;
  // "You Gave / You Got" only makes sense when there's a real counterparty
  // relationship being described (a retailer). A staff member or a portal
  // (a payment gateway account) isn't a "you" in that sense, so those views
  // use neutral Total In / Total Out labels instead.
  subjectType?: "retailer" | "staff" | "portal";
}

export default function LedgerReportView({
  title,
  subtitle,
  data = [],
  outstandingBalance,
  isPublic = false,
  onBack,
  publicLink,
  subjectType = "retailer",
  onEditRetailer,
  onDeleteRetailer,
  onManageStores,
  phone,
  onEditEntry,
  onDeleteEntry,
  hideBankNames = false
}: LedgerReportViewProps) {
  const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<LedgerTransaction | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // PDF/Excel export is a superadmin-controlled feature flag (Part 1). It has
  // no separate backend call to gate -- generation happens entirely in the
  // browser -- so this is enforced by hiding the buttons. Skipped on the
  // public (unauthenticated) statement page; defaults to shown if the flag
  // fetch fails, so a transient error never silently removes a working button.
  const [pdfExportEnabled, setPdfExportEnabled] = useState(true);
  useEffect(() => {
    if (isPublic) return;
    (async () => {
      try {
        const { api } = await import("../utils/api");
        const settings = await api.getAdminSettings();
        if (settings?.feature_flags && "pdf_export" in settings.feature_flags) {
          setPdfExportEnabled(!!settings.feature_flags.pdf_export);
        }
      } catch {
        // fail open -- keep the export buttons visible
      }
    })();
  }, [isPublic]);
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
        const bankAccountText = tx.bank_account_name || "";
        const bankText = tx.bank_name || "";
        const q = searchQuery.toLowerCase();
        if (
          searchQuery && 
          !cleanDesc.toLowerCase().includes(q) &&
          !remarkText.toLowerCase().includes(q) &&
          !refNoText.toLowerCase().includes(q) &&
          !storeText.toLowerCase().includes(q) &&
          !bankAccountText.toLowerCase().includes(q) &&
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
      const isDebit = tx.transaction_type === "debit";
      let isGaveForDisplay = isDebit;
      // The public link is the RETAILER's own statement, not the admin's --
      // whatever the business "Got" is what the retailer "Gave" and vice
      // versa, so the whole bucket flips for that audience.
      if (isPublic) isGaveForDisplay = !isGaveForDisplay;
      if (isGaveForDisplay) {
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
  }, [filteredTransactions, isPublic]);

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

    const nameClean = title.trim().replace(/\s+/g, "_");
    const dateRangeStr = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
    const filename = `${nameClean}_${dateRangeStr}.pdf`;

    downloadElementAsPdf("pdf-ledger-report", filename, 0.4)
      .catch((e: any) => {
        console.error("PDF generation failed, falling back to print:", e);
        window.print();
      })
      .finally(() => setIsDownloading(false));
  };

  const handleShare = async () => {
    const shareText = `Report of ${title}
${outstandingBalance !== undefined ? `Outstanding Balance: ₹ ${Math.abs(outstandingBalance).toLocaleString("en-IN")}\n` : ""}Total Entries: ${stats.entriesCount}
${subjectType === "retailer" ? "You Gave" : "Total Out"}: ₹ ${stats.youGave.toLocaleString("en-IN")}
${subjectType === "retailer" ? "You Got" : "Total In"}: ₹ ${stats.youGot.toLocaleString("en-IN")}
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
      <div className="bg-indigo-600 dark:bg-indigo-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack} 
              className="p-1 rounded-sm hover:bg-indigo-500 text-white transition-colors cursor-pointer"
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyLink}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-sm border border-white/20 transition-colors cursor-pointer flex items-center justify-center"
              title={isCopied ? "Copied Link" : "Copy Portal Link"}
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleShare}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-sm border border-white/20 transition-colors cursor-pointer flex items-center justify-center"
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
          <div className="bg-white border border-slate-200 rounded-sm p-3 flex items-center justify-around gap-2">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 rounded-sm text-slate-700 text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-slate-100"
              >
                <Phone className="w-4 h-4 text-slate-500" />
                <span>Call</span>
              </a>
            )}
            {onEditRetailer && (
              <button
                onClick={onEditRetailer}
                className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-sm text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-blue-100/50 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
            {onManageStores && (
              <button
                onClick={onManageStores}
                className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-sm text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-indigo-100/50 cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>Stores</span>
              </button>
            )}
            {onDeleteRetailer && title.toLowerCase().trim() !== "cms" && (
              <button
                onClick={onDeleteRetailer}
                className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-sm text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-red-100/50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
        {/* 2. Start Date & End Date controls */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-sm px-3 py-2">
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
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-sm px-3 py-2">
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
              className="w-full bg-white border border-slate-200 rounded-sm pl-9 pr-3 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="relative w-full">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2.5 text-xs font-black text-slate-800 focus:outline-none cursor-pointer appearance-none pr-8"
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
                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2.5 text-xs font-black text-slate-800 focus:outline-none cursor-pointer appearance-none pr-8"
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
          
          {/* Premium Heading block matching daily cash report */}
          <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-white">
            {/* Visual blue top-right gradient banner */}
            <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-cyan-400 via-sky-400 to-blue-500 opacity-90 transform skew-x-12 origin-top-right -mr-3" />
            
            <div className="relative p-2.5 pr-28 z-10">
              <h2 className="text-base font-black tracking-tight leading-none text-sky-900">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{subtitle}</p>}
              
              {/* Color dots row */}
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
              </div>
            </div>

            {/* Centered Period Title bar at bottom */}
            <div className="border-t border-slate-200 bg-slate-50/50 py-1.5 text-center relative z-10">
              <span className="text-[11px] font-black text-slate-950 uppercase tracking-widest">
                Statement Period - {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
              </span>
            </div>
          </div>

          {/* Summary Box */}
          <div className={`grid ${outstandingBalance !== undefined ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} border border-slate-200 rounded-lg bg-slate-50 py-2.5 text-center divide-x divide-slate-200 shadow-xs gap-y-2 sm:gap-y-0`}>
            {outstandingBalance !== undefined && (
              <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Current Outstanding</span>
                <span className={`text-sm font-black mt-1 tabular-nums whitespace-nowrap ${outstandingBalance < 0 ? "text-emerald-600" : outstandingBalance > 0 ? "text-red-500" : "text-slate-500"}`}>
                  {outstandingBalance < 0 ? "-" : ""}₹{Math.abs(outstandingBalance).toLocaleString("en-IN")}
                </span>
              </div>
            )}
            <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {isPublic ? (subjectType === "retailer" ? "You Gave" : "Total Out") : (subjectType === "retailer" ? "You Gave" : "Total Out")}
              </span>
              <span className="text-sm font-black text-red-500 mt-1 tabular-nums whitespace-nowrap">
                ₹{stats.youGave.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {isPublic ? (subjectType === "retailer" ? "You Got" : "Total In") : (subjectType === "retailer" ? "You Got" : "Total In")}
              </span>
              <span className="text-sm font-black text-emerald-600 mt-1 tabular-nums whitespace-nowrap">
                ₹{stats.youGot.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Net Balance (Period)</span>
              <span className={`text-sm font-black mt-1 tabular-nums whitespace-nowrap ${stats.netBalance < 0 ? "text-emerald-600" : stats.netBalance > 0 ? "text-red-500" : "text-slate-500"}`}>
                ₹{Math.abs(stats.netBalance).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                No ledger transactions found in the selected date range.
              </div>
            ) : (
              <table className="w-full min-w-[550px] text-xs text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                    <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[4%] text-[11px] uppercase">No</th>
                    <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[12%] text-[11px] uppercase">Date</th>
                    <th className="py-2 px-1 border-r border-slate-200 text-center w-[31%] text-[11px] uppercase">Description</th>
                    <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[17%] text-[11px] uppercase">
                      {isPublic ? (subjectType === "retailer" ? "You Got" : "Total In") : (subjectType === "retailer" ? "You Gave" : "Total Out")}
                    </th>
                    <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[17%] text-[11px] uppercase">
                      {isPublic ? (subjectType === "retailer" ? "You Gave" : "Total Out") : (subjectType === "retailer" ? "You Got" : "Total In")}
                    </th>
                    <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[19%] text-[11px] uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransactions.map((tx, idx) => {
                    const formattedIST = formatIST(tx.date);
                    const isDebit = tx.transaction_type === "debit";
                    let isGaveForDisplay = isDebit;
                    if (isPublic) isGaveForDisplay = !isGaveForDisplay;
                    const amountColor = isGaveForDisplay ? "text-red-500" : "text-emerald-600";

                    return (
                      <tr 
                        key={tx.id} 
                        onClick={() => {
                          setSelectedEntryForDetails(tx);
                        }}
                        className="hover:bg-slate-50/50 cursor-pointer divide-x divide-slate-200"
                      >
                        {/* No */}
                        <td className="py-2 px-0.5 text-center font-bold text-slate-800 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Date & Time */}
                        <td className="py-2 px-0.5 text-center text-[11px] leading-tight font-semibold text-slate-700">
                          <div>{formattedIST.date}</div>
                          <div className="text-slate-400 mt-0.5 font-mono text-[10px]">{formattedIST.time}</div>
                        </td>

                        {/* Description */}
                        <td className="py-2 px-1 text-center font-semibold text-slate-800 break-words text-[11.5px] leading-snug whitespace-pre-line">
                          <div className="text-slate-900 font-bold">{cleanDescription(tx.description, tx)}</div>
                          {tx.store_name && (
                            <div className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                              Store: <span className="font-extrabold uppercase tracking-tight">{tx.store_name}</span>
                            </div>
                          )}
                          {(tx.bank_account_name || tx.portal_name) && (
                            <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                              {tx.deposit_type === "retailer"
                                ? `Retailer - ${tx.bank_account_name}`
                                : tx.deposit_type === "staff"
                                ? `Staff - ${tx.bank_account_name}`
                                : hideBankNames
                                ? (tx.portal_name || "Portal")
                                : (tx.portal_name ? `${tx.portal_name}${tx.bank_account_name ? ` (${tx.bank_account_name})` : ""}` : tx.bank_account_name)}
                            </div>
                          )}
                          {!isPublic && tx.staff_name && (
                            <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                              Staff: <span className="uppercase">{tx.staff_name}</span>
                            </div>
                          )}
                          {tx.remarks && (
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 italic">
                              Remark: {tx.remarks}
                            </div>
                          )}
                          {tx.reference_no && (
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-mono">
                              Ref: {tx.reference_no}
                            </div>
                          )}
                        </td>

                        {/* Gave / Out */}
                        <td className={`py-2 px-0.5 text-center font-extrabold text-xs font-mono tabular-nums ${amountColor}`}>
                          {isGaveForDisplay ? `₹${Math.round(tx.amount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                        </td>

                        {/* Got / In */}
                        <td className={`py-2 px-0.5 text-center font-extrabold text-xs font-mono tabular-nums ${amountColor}`}>
                          {!isGaveForDisplay ? `₹${Math.round(tx.amount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                        </td>

                        {/* Balance */}
                        <td className="py-2 px-0.5 text-center font-bold text-slate-900 text-xs font-mono tabular-nums">
                          ₹{Math.round(tx.running_balance).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 6. Footer Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3.5 px-4 flex gap-3 z-40 max-w-lg mx-auto rounded-t-sm">
        {pdfExportEnabled && (
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading || filteredTransactions.length === 0}
            className="flex-1 py-3 px-4 rounded-sm border border-indigo-500 text-indigo-600 hover:bg-indigo-50 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {isDownloading ? "Downloading..." : "DOWNLOAD"}
          </button>
        )}

        <button
          onClick={handleShare}
          disabled={filteredTransactions.length === 0}
          className="flex-1 py-3 px-4 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" />
          SHARE
        </button>
      </div>

      {selectedEntryForDetails && (() => {
        const detailIsDebit = selectedEntryForDetails.transaction_type === "debit";
        let detailIsGaveForDisplay = detailIsDebit;
        if (isPublic) detailIsGaveForDisplay = !detailIsGaveForDisplay;
        const detailColorClass = detailIsGaveForDisplay ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
        const detailBgClass = detailIsGaveForDisplay ? "bg-red-50 dark:bg-red-950/20" : "bg-emerald-50 dark:bg-emerald-950";

        return (
        <div className="fixed inset-0 z-50 flex items-end justify-center select-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setSelectedEntryForDetails(null)}
          />
          {/* Content */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-sm p-6 space-y-4 border-t border-slate-200 dark:border-slate-800 pb-8 z-10">
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
                className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details Content */}
            <div className="space-y-3.5 text-slate-700 dark:text-slate-300 max-h-[50vh] overflow-y-auto pr-1">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</span>
                <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-sm ${detailBgClass} ${detailColorClass}`}>
                  {cleanDescription(selectedEntryForDetails.description, selectedEntryForDetails)}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</span>
                <span className={`text-base font-extrabold font-mono tabular-nums ${detailColorClass}`}>
                  ₹ {selectedEntryForDetails.amount.toLocaleString("en-IN")}
                </span>
              </div>

              {selectedEntryForDetails.store_name && (
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Store Name</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    {selectedEntryForDetails.store_name}
                  </span>
                </div>
              )}

              {!isPublic && selectedEntryForDetails.staff_name && (
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    {selectedEntryForDetails.staff_name}
                  </span>
                </div>
              )}

              {/* Cash In (Collection) Details */}
              {selectedEntryForDetails.transaction_type === "credit" && (
                <>
                  {/* Show Online Bank Account Name if payment was online */}
                  {(selectedEntryForDetails.bank_account_name || selectedEntryForDetails.portal_name) && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3.5 rounded-sm border border-emerald-100/50 dark:border-emerald-900/20 flex justify-between items-center text-xs">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">Online Bank Account</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {hideBankNames
                          ? (selectedEntryForDetails.portal_name || "Portal")
                          : (selectedEntryForDetails.portal_name
                            ? `${selectedEntryForDetails.portal_name}${selectedEntryForDetails.bank_account_name ? ` (${selectedEntryForDetails.bank_account_name})` : ""}`
                            : selectedEntryForDetails.bank_account_name)}
                        {selectedEntryForDetails.denominations?.online_amount ? (
                          <span className="font-mono tabular-nums"> (₹{selectedEntryForDetails.denominations.online_amount})</span>
                        ) : ""}
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
               (selectedEntryForDetails.deposit_type === "retailer" || selectedEntryForDetails.deposit_type === "staff" || !hideBankNames || selectedEntryForDetails.portal_name) && 
               (selectedEntryForDetails.bank_account_name || selectedEntryForDetails.portal_name || selectedEntryForDetails.bank_name) && (
                 <div className="bg-indigo-50/50 dark:bg-indigo-950/15 p-3.5 rounded-sm border border-indigo-100/50 dark:border-indigo-900/30 space-y-2 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                   <span className="text-[10px] font-black text-indigo-400 dark:text-indigo-550 uppercase tracking-widest block">Transfer Target</span>
                   {(selectedEntryForDetails.bank_account_name || selectedEntryForDetails.portal_name) && (
                     <div className="flex justify-between border-b border-indigo-100/20 dark:border-indigo-900/10 pb-1">
                       <span className="font-extrabold uppercase tracking-wide">
                         {selectedEntryForDetails.deposit_type === "retailer"
                           ? `Retailer - ${selectedEntryForDetails.bank_account_name}`
                           : selectedEntryForDetails.deposit_type === "staff"
                           ? `Staff - ${selectedEntryForDetails.bank_account_name}`
                           : hideBankNames
                           ? (selectedEntryForDetails.portal_name || "Portal")
                           : (selectedEntryForDetails.portal_name
                             ? `${selectedEntryForDetails.portal_name}${selectedEntryForDetails.bank_account_name ? ` (${selectedEntryForDetails.bank_account_name})` : ""}`
                             : selectedEntryForDetails.bank_account_name)}
                       </span>
                     </div>
                   )}
                   {(selectedEntryForDetails.bank_name) && !hideBankNames && (
                     <div className="flex justify-between pb-0.5">
                       <span>Bank Name</span>
                       <span className="font-extrabold">{selectedEntryForDetails.bank_name}</span>
                     </div>
                   )}
                 </div>
              )}

              {selectedEntryForDetails.remarks && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Remarks</span>
                  <p className="italic font-medium text-slate-600 dark:text-slate-400">{selectedEntryForDetails.remarks}</p>
                </div>
              )}

              {selectedEntryForDetails.reference_no && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-100 dark:border-slate-800 text-xs flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Reference No.</span>
                  <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{selectedEntryForDetails.reference_no}</span>
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
${entry.store_name ? `Store: ${entry.store_name}\n` : ''}${entry.bank_account_name ? `Bank: ${entry.bank_account_name}\n` : ''}Remarks: ${entry.remarks || 'None'}`;
                  if (navigator.share) {
                    navigator.share({ title: "Transaction Receipt", text: shareText }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(shareText);
                    alert("Receipt summary copied!");
                  }
                }}
                className="flex-1 py-3 px-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-sm text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-100 dark:border-emerald-900/30"
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
                      className="flex-1 py-3 px-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-sm text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer border border-blue-100 dark:border-blue-900/30"
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
                      className="flex-1 py-3 px-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 rounded-sm text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer border border-red-100 dark:border-red-900/30"
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
        );
      })()}
    </div>
  );
}
