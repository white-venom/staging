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
  RefreshCw,
  X,
  LayoutList,
  Table,
  User
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
  store_id?: string | null;
  retailer_name?: string | null;
  retailer_id?: string | null;
  bank_account_id?: string | null;
  bank_account_name?: string | null;
  bank_name?: string | null;
  portal_name?: string | null;
  staff_name?: string | null;
  deposit_type?: string | null;
  payment_mode?: string | null;
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
  onRefresh?: () => void;
  // "You Gave / You Got" only makes sense when there's a real counterparty
  // relationship being described (a retailer). A staff member or a portal
  // (a payment gateway account) isn't a "you" in that sense, so those views
  // use neutral Total In / Total Out labels instead.
  subjectType?: "retailer" | "staff" | "portal";
  initialStartDate?: string;
  initialEndDate?: string;
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
  onRefresh,
  hideBankNames = false,
  initialStartDate,
  initialEndDate
}: LedgerReportViewProps) {
  const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<LedgerTransaction | null>(null);
  const [startDate, setStartDate] = useState(initialStartDate || "");
  const [endDate, setEndDate] = useState(initialEndDate || "");
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
  const [viewMode, setViewMode] = useState<"card" | "table">("table");

  // Default to compact Card View on mobile screens (< 768px), Table View on laptops/desktops
  useEffect(() => {
    if (typeof window !== "undefined") {
      setViewMode(window.innerWidth < 768 ? "card" : "table");
    }
  }, []);

  // Set default start/end date range to cover all data if available
  useEffect(() => {
    if (initialStartDate || initialEndDate) {
      setStartDate(initialStartDate || "");
      setEndDate(initialEndDate || "");
      return;
    }
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
  }, [data, initialStartDate, initialEndDate]);

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
        const retailerText = tx.retailer_name || "";
        const staffText = tx.staff_name || "";
        const bankAccountText = tx.bank_account_name || "";
        const bankText = tx.bank_name || "";
        const q = searchQuery.toLowerCase();
        if (
          searchQuery && 
          !cleanDesc.toLowerCase().includes(q) &&
          !remarkText.toLowerCase().includes(q) &&
          !refNoText.toLowerCase().includes(q) &&
          !storeText.toLowerCase().includes(q) &&
          !retailerText.toLowerCase().includes(q) &&
          !staffText.toLowerCase().includes(q) &&
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

    // In CrediiFlow accounting:
    // When isPublic is false (Admin view):
    //   youGot = Inflow (Collections / Credit)
    //   youGave = Outflow (Payouts / Debit)
    //   Net period change = youGot - youGave
    // When isPublic is true (Retailer statement view):
    //   youGave = Retailer gave to business (Collections)
    //   youGot = Retailer received from business (Payouts)
    //   Net period change = youGave - youGot
    const netBalance = isPublic ? (youGave - youGot) : (youGot - youGave);

    return {
      entriesCount: filteredTransactions.length,
      youGave,
      youGot,
      netBalance
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

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    const prevMode = viewMode;

    try {
      if (prevMode !== "table") {
        setViewMode("table");
        // Give React a tick to render the complete table for PDF snapshot
        await new Promise((r) => setTimeout(r, 150));
      }
      const nameClean = title.trim().replace(/\s+/g, "_");
      const dateRangeStr = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
      const filename = `${nameClean}_${dateRangeStr}.pdf`;

      await downloadElementAsPdf("pdf-ledger-report", filename, 0.4);
    } catch (e: any) {
      console.error("PDF generation failed, falling back to print:", e);
      window.print();
    } finally {
      if (prevMode !== "table") {
        setViewMode(prevMode);
      }
      setIsDownloading(false);
    }
  };

  const cleanTitle = (title || "").replace(/\s+'s/i, "'s").trim();

  const handleShare = async () => {
    const shareText = `Report of ${cleanTitle}
${outstandingBalance !== undefined ? `Outstanding Balance: ₹ ${Math.abs(outstandingBalance).toLocaleString("en-IN")}\n` : ""}Total Entries: ${stats.entriesCount}
${subjectType === "retailer" ? "You Gave" : "Total Out"}: ₹ ${stats.youGave.toLocaleString("en-IN")}
${subjectType === "retailer" ? "You Got" : "Total In"}: ₹ ${stats.youGot.toLocaleString("en-IN")}
${publicLink ? `\nView Full Ledger: ${publicLink}` : ""}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ledger Report - ${cleanTitle}`,
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-24">
      {/* 1. Header with back arrow */}
      <div className="bg-indigo-600 dark:bg-indigo-700 px-4 py-3 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack} 
                className="p-1 rounded-sm hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">Report of {cleanTitle}</h1>
              {subtitle && <p className="text-[10px] sm:text-xs text-indigo-100 font-semibold">{subtitle}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-sm border border-white/20 transition-colors cursor-pointer flex items-center justify-center"
                title="Refresh Statement"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {publicLink && !isPublic && (
              <>
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
              </>
            )}
            {pdfExportEnabled && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloading || filteredTransactions.length === 0}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-sm border border-white/25 transition-colors cursor-pointer text-xs font-bold disabled:opacity-50"
                title="Download PDF"
              >
                <FileDown className="w-4 h-4" />
                <span>{isDownloading ? "..." : "PDF"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {/* Retailer Actions (Admin Only / Non-Public) */}
        {!isPublic && (onEditRetailer || onDeleteRetailer || onManageStores || phone) && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 flex items-center justify-around gap-2 shadow-xs">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-md text-slate-700 dark:text-slate-200 text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-slate-100 dark:border-slate-700"
              >
                <Phone className="w-4 h-4 text-slate-500" />
                <span>Call</span>
              </a>
            )}
            {onEditRetailer && (
              <button
                onClick={onEditRetailer}
                className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-md text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-blue-100/50 dark:border-blue-900/30 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
            {onManageStores && (
              <button
                onClick={onManageStores}
                className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-md text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-indigo-100/50 dark:border-indigo-900/30 cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>Stores</span>
              </button>
            )}
            {onDeleteRetailer && title.toLowerCase().trim() !== "cms" && (
              <button
                onClick={onDeleteRetailer}
                className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 rounded-md text-xs font-bold flex flex-col items-center gap-1 transition-colors border border-red-100/50 dark:border-red-900/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}

        {/* 2. Date controls & Filter Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 sm:p-4 space-y-3 shadow-xs">
          {/* Top row: Date Range and Quick Presets */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 max-w-lg">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 sm:py-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-[8px] text-slate-400 font-black uppercase">Start Date</span>
                  <input autoComplete="one-time-code"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:outline-none w-full cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 sm:py-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-[8px] text-slate-400 font-black uppercase">End Date</span>
                  <input autoComplete="one-time-code"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:outline-none w-full cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => {
                  if (data.length > 0) {
                    const dates = data.map(d => d.date.substring(0, 10)).sort();
                    setStartDate(dates[0]);
                    setEndDate(dates[dates.length - 1]);
                  } else {
                    const today = getISTDateString();
                    setStartDate(today);
                    setEndDate(today);
                  }
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = getISTDateString();
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const yest = getISTDateString(d);
                  setStartDate(yest);
                  setEndDate(yest);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = getISTDateString();
                  const firstDay = `${today.substring(0, 7)}-01`;
                  setStartDate(firstDay);
                  setEndDate(today);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = getISTDateString();
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  const past = getISTDateString(d);
                  setStartDate(past);
                  setEndDate(today);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* Bottom row: Search, Type filter, Sort and View mode switcher */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input autoComplete="one-time-code"
                type="text"
                placeholder="Search entries, amount, remarks, reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-36">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer appearance-none pr-8"
                >
                  <option value="all">ALL ENTRIES</option>
                  <option value="debit">GAVE ONLY</option>
                  <option value="credit">GOT ONLY</option>
                </select>
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>

              <div className="relative flex-1 sm:w-44">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer appearance-none pr-8"
                >
                  <option value="date-desc">LATEST FIRST</option>
                  <option value="date-asc">OLDEST FIRST</option>
                  <option value="amount-desc">AMOUNT: HIGH-LOW</option>
                  <option value="amount-asc">AMOUNT: LOW-HIGH</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>

              {/* View Switcher Toggle */}
              <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("card")}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "card"
                      ? "bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs font-extrabold"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                  title="Card / Mobile List View"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "table"
                      ? "bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs font-extrabold"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                  title="Spreadsheet Table View"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Printable/Export Content container */}
        <div id="pdf-ledger-report" className="space-y-4 bg-transparent text-slate-800 dark:text-slate-100 p-0.5">
          
          {/* Premium Heading block matching daily cash report */}
          <div className="relative border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            {/* Visual blue top-right gradient banner */}
            <div className="absolute top-0 right-0 w-28 sm:w-36 h-full bg-gradient-to-l from-cyan-400 via-sky-400 to-blue-500 opacity-90 transform skew-x-12 origin-top-right -mr-3" />
            
            <div className="relative p-3 sm:p-4 pr-32 z-10">
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-none text-sky-900 dark:text-sky-100">{cleanTitle}</h2>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wider">{subtitle}</p>}
              
              {/* Color dots row */}
              <div className="flex items-center gap-1 mt-2">
                <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              </div>
            </div>

            {/* Centered Period Title bar at bottom */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 py-1.5 px-3 flex items-center justify-between relative z-10">
              <span className="text-[11px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-widest">
                Statement Period: {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {filteredTransactions.length} Entries
              </span>
            </div>
          </div>

          {/* Summary Box */}
          {(() => {
            const isWalletOrStaff = subjectType === "staff" || subjectType === "portal";
            const periodNet = isWalletOrStaff ? (stats.youGot - stats.youGave) : stats.netBalance;
            const staffOutstanding = outstandingBalance ?? 0;

            const outstandingLabel = subjectType === "staff" ? "Cash In Hand" : "Current Outstanding";
            const outstandingColor = isWalletOrStaff
              ? (staffOutstanding >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")
              : (staffOutstanding < 0 ? "text-red-500 dark:text-red-400" : staffOutstanding > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500");

            const periodNetColor = periodNet < 0
              ? "text-red-600 dark:text-red-400"
              : periodNet > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-500";

            return (
              <div className={`grid ${outstandingBalance !== undefined ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2 sm:gap-3`}>
                {outstandingBalance !== undefined && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 text-center flex flex-col justify-center items-center shadow-xs min-h-[64px]">
                    <span className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center leading-tight mb-1">
                      {outstandingLabel}
                    </span>
                    <span className={`text-sm sm:text-base font-black tabular-nums tracking-tight ${outstandingColor}`}>
                      {outstandingBalance < 0 ? "-" : ""}₹{Math.abs(outstandingBalance).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 text-center flex flex-col justify-center items-center shadow-xs min-h-[64px]">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center leading-tight mb-1">
                    {subjectType === "retailer" ? "You Gave" : "Total Out"}
                  </span>
                  <span className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 tabular-nums tracking-tight">
                    ₹{stats.youGave.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 text-center flex flex-col justify-center items-center shadow-xs min-h-[64px]">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center leading-tight mb-1">
                    {subjectType === "retailer" ? "You Got" : "Total In"}
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                    ₹{stats.youGot.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 text-center flex flex-col justify-center items-center shadow-xs min-h-[64px]">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center leading-tight mb-1">
                    Net Balance (Period)
                  </span>
                  <span className={`text-sm sm:text-base font-black tabular-nums tracking-tight ${periodNetColor}`}>
                    {periodNet < 0 ? "-" : periodNet > 0 ? "+" : ""}₹{Math.abs(periodNet).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Transactions Presentation */}
          {filteredTransactions.length === 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center text-xs text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-900 italic shadow-xs">
              No ledger transactions found in the selected date range.
            </div>
          ) : viewMode === "card" ? (
            /* MOBILE / CARD VIEW: 100% Fits phone screen without horizontal scrolling */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                <span>Transactions Feed</span>
                <span className="text-[10px] uppercase">Tap card for details</span>
              </div>
              {filteredTransactions.map((tx, idx) => {
                const formattedIST = formatIST(tx.date);
                const isDebit = tx.transaction_type === "debit";
                let isGaveForDisplay = isDebit;
                if (isPublic) isGaveForDisplay = !isGaveForDisplay;
                const amountColor = isGaveForDisplay ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
                const isNegativeBal = tx.running_balance < 0;
                const formattedBal = `${isNegativeBal ? '-' : ''}₹${Math.abs(Math.round(tx.running_balance)).toLocaleString("en-IN")}`;

                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedEntryForDetails(tx)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer shadow-xs space-y-2 active:scale-[0.99]"
                  >
                    {/* Top Row: Sr No, Date & Time, Running Balance */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-300">
                          {idx + 1}
                        </span>
                        <span>{formattedIST.date}</span>
                        <span className="text-slate-400 font-mono text-[10px]">• {formattedIST.time}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Bal:</span>
                        <span className="text-[11px] font-black font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {formattedBal}
                        </span>
                      </div>
                    </div>

                    {/* Main Row: Description and Amount */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                          {cleanDescription(tx.description, tx)}
                        </div>

                        {/* Meta tags: Retailer, Store, Bank, Staff, Remarks, Ref */}
                        <div className="flex flex-wrap gap-1 items-center pt-0.5">
                          {tx.retailer_name && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold uppercase border border-purple-100 dark:border-purple-900/30">
                              Retailer: {tx.retailer_name}
                            </span>
                          )}
                          {tx.store_name && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold uppercase border border-indigo-100 dark:border-indigo-900/30">
                              <Store className="w-3 h-3" />
                              Store: {tx.store_name}
                            </span>
                          )}
                          {(tx.bank_account_name || tx.portal_name) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                              {tx.deposit_type === "retailer"
                                ? `Retailer - ${tx.bank_account_name}`
                                : tx.deposit_type === "staff"
                                ? `Staff - ${tx.bank_account_name}`
                                : hideBankNames
                                ? (tx.portal_name || "Portal")
                                : (tx.portal_name ? `${tx.portal_name}${tx.bank_account_name ? ` (${tx.bank_account_name})` : ""}` : tx.bank_account_name)}
                            </span>
                          )}
                          {!isPublic && tx.staff_name && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase border border-amber-200 dark:border-amber-900/30">
                              <User className="w-3 h-3" />
                              Staff: {tx.staff_name}
                            </span>
                          )}
                        </div>

                        {tx.remarks && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5 break-words">
                            Remark: {tx.remarks}
                          </p>
                        )}
                        {tx.reference_no && (
                          <p className="text-[9.5px] text-slate-400 font-mono">
                            Ref: {tx.reference_no}
                          </p>
                        )}
                      </div>

                      {/* Amount Column */}
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <div className={`text-sm sm:text-base font-black font-mono tabular-nums ${amountColor}`}>
                          {isGaveForDisplay ? `- ₹${Math.round(tx.amount).toLocaleString("en-IN")}` : `+ ₹${Math.round(tx.amount).toLocaleString("en-IN")}`}
                        </div>
                        <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-xs mt-1 border ${
                          isGaveForDisplay 
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30' 
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                        }`}>
                          {isGaveForDisplay ? (isPublic ? 'YOU GAVE' : 'GAVE / OUT') : (isPublic ? 'YOU GOT' : 'GOT / IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW: Spacious, full-width desktop view & horizontal scrollable on phone */
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto bg-white dark:bg-slate-900 shadow-xs">
              <div className="sm:hidden px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                <span>← Swipe sideways to see all columns →</span>
                <span>{filteredTransactions.length} entries</span>
              </div>
              <table className="w-full text-xs text-left border-collapse table-auto md:table-fixed">
                <thead>
                  <tr className="bg-sky-900 dark:bg-sky-950 border-b-2 border-sky-950 dark:border-sky-900 text-white font-bold">
                    <th className="py-3 px-2 border-r border-sky-800 text-center w-[45px] min-w-[45px] text-[11px] font-black uppercase tracking-wider">No</th>
                    <th className="py-3 px-2 border-r border-sky-800 text-center w-[110px] min-w-[105px] text-[11px] font-black uppercase tracking-wider">Date & Time</th>
                    <th className="py-3 px-3 border-r border-sky-800 text-left min-w-[190px] text-[11px] font-black uppercase tracking-wider">Description</th>
                    <th className="py-3 px-2.5 border-r border-sky-800 text-right w-[125px] min-w-[115px] text-[11px] font-black uppercase tracking-wider">
                      {isPublic ? (subjectType === "retailer" ? "You Got" : "Total In") : (subjectType === "retailer" ? "You Gave" : "Total Out")}
                    </th>
                    <th className="py-3 px-2.5 border-r border-sky-800 text-right w-[125px] min-w-[115px] text-[11px] font-black uppercase tracking-wider">
                      {isPublic ? (subjectType === "retailer" ? "You Gave" : "Total Out") : (subjectType === "retailer" ? "You Got" : "Total In")}
                    </th>
                    <th className="py-3 px-3 text-right w-[130px] min-w-[120px] text-[11px] font-black uppercase tracking-wider">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredTransactions.map((tx, idx) => {
                    const formattedIST = formatIST(tx.date);
                    const isDebit = tx.transaction_type === "debit";
                    let isGaveForDisplay = isDebit;
                    if (isPublic) isGaveForDisplay = !isGaveForDisplay;
                    const amountColor = isGaveForDisplay ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400";
                    const isEven = idx % 2 === 0;
                    const isNegativeBal = tx.running_balance < 0;
                    const formattedBal = `${isNegativeBal ? '-' : ''}₹${Math.abs(Math.round(tx.running_balance)).toLocaleString("en-IN")}`;

                    return (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedEntryForDetails(tx)}
                        className={`${isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-900/50'} hover:bg-sky-50/50 dark:hover:bg-sky-950/20 cursor-pointer transition-colors`}
                      >
                        {/* No */}
                        <td className="py-3 px-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-2 border-r border-slate-200 dark:border-slate-800 text-center text-[11px] leading-tight font-bold text-slate-900 dark:text-slate-100">
                          <div>{formattedIST.date}</div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5 font-mono text-[10px] font-medium">{formattedIST.time}</div>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-left text-xs leading-snug">
                          <div className="text-slate-900 dark:text-slate-100 font-bold break-words">
                            {cleanDescription(tx.description, tx)}
                          </div>
                          {tx.retailer_name && (
                            <div className="text-[10.5px] font-extrabold text-purple-700 dark:text-purple-400 mt-1 flex items-center gap-1">
                              <span>Retailer: <span className="uppercase tracking-tight">{tx.retailer_name}</span></span>
                            </div>
                          )}
                          {tx.store_name && (
                            <div className="text-[10.5px] font-extrabold text-indigo-700 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                              <Store className="w-3 h-3 shrink-0" />
                              <span>Store: <span className="uppercase tracking-tight">{tx.store_name}</span></span>
                            </div>
                          )}
                          {(tx.bank_account_name || tx.portal_name) && (
                            <div className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">
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
                            <div className="text-[10.5px] font-extrabold text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3 shrink-0" />
                              <span>Staff: <span className="uppercase tracking-tight">{tx.staff_name}</span></span>
                            </div>
                          )}
                          {tx.remarks && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 italic">
                              Remark: {tx.remarks}
                            </div>
                          )}
                          {tx.reference_no && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 font-mono">
                              Ref: {tx.reference_no}
                            </div>
                          )}
                        </td>

                        {/* Gave / Out */}
                        <td className={`py-3 px-2.5 border-r border-slate-200 dark:border-slate-800 text-right font-black text-xs font-mono tabular-nums whitespace-nowrap ${amountColor}`}>
                          {isGaveForDisplay ? `₹${Math.round(tx.amount).toLocaleString("en-IN")}` : <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>}
                        </td>

                        {/* Got / In */}
                        <td className={`py-3 px-2.5 border-r border-slate-200 dark:border-slate-800 text-right font-black text-xs font-mono tabular-nums whitespace-nowrap ${amountColor}`}>
                          {!isGaveForDisplay ? `₹${Math.round(tx.amount).toLocaleString("en-IN")}` : <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>}
                        </td>

                        {/* Balance */}
                        <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-slate-100 text-xs font-mono tabular-nums whitespace-nowrap">
                          {formattedBal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6. Footer Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-3 px-4 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:block">
            Total Entries: <span className="font-extrabold text-slate-900 dark:text-white">{filteredTransactions.length}</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {pdfExportEnabled && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloading || filteredTransactions.length === 0}
                className="flex-1 sm:flex-initial py-2.5 px-4 rounded-md border border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                <span>{isDownloading ? "Downloading..." : "DOWNLOAD PDF"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              disabled={filteredTransactions.length === 0}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>SHARE</span>
            </button>
          </div>
        </div>
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

              {selectedEntryForDetails.retailer_name && (
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-sm border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Retailer</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    {selectedEntryForDetails.retailer_name}
                  </span>
                </div>
              )}

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
