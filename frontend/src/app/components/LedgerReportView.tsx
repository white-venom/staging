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
  ArrowUpDown
} from "lucide-react";
import Script from "next/script";

interface LedgerTransaction {
  id: string;
  date: string; // YYYY-MM-DD HH:MM:SS
  transaction_type: "credit" | "debit"; // credit = You Got, debit = You Gave
  amount: number;
  running_balance: number;
  description: string;
}

interface LedgerReportViewProps {
  title: string;
  subtitle?: string;
  data: LedgerTransaction[];
  outstandingBalance: number;
  isPublic?: boolean;
  onBack?: () => void;
  publicLink?: string;
}

export default function LedgerReportView({
  title,
  subtitle,
  data = [],
  outstandingBalance,
  isPublic = false,
  onBack,
  publicLink
}: LedgerReportViewProps) {
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
      const today = new Date().toISOString().substring(0, 10);
      setStartDate(today);
      setEndDate(today);
    }
  }, [data]);

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
        const cleanDesc = tx.description ? tx.description.replace(/\s*\(auto-verified\)/gi, "") : "";
        if (
          searchQuery && 
          !cleanDesc.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !tx.amount.toString().includes(searchQuery)
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

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr.replace(" ", "T"));
      if (isNaN(d.getTime())) return dateStr;
      
      const day = d.getDate();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear().toString().substring(2);
      
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const handleDownloadPDF = () => {
    setIsDownloading(true);
    const element = document.getElementById("pdf-ledger-report");
    if (!element) {
      setIsDownloading(false);
      return;
    }

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `Ledger_Report_${title.replace(/\s+/g, "_")}.pdf`,
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

    if ((window as any).html2pdf) {
      runDownload();
    } else {
      console.warn("html2pdf not found on window, falling back to print");
      window.print();
      setIsDownloading(false);
    }
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
      <div className="bg-indigo-650 dark:bg-indigo-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
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
          <button
            onClick={handleCopyLink}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all cursor-pointer flex items-center justify-center"
            title={isCopied ? "Copied Link" : "Copy Portal Link"}
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-4 space-y-4">
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
                <p className="text-[10px] text-slate-400 font-bold mt-1">Generated: {new Date().toLocaleDateString()}</p>
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Net Balance</span>
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
                  const dateLabel = formatDateLabel(tx.date);
                  const isDebit = tx.transaction_type === "debit"; // You Gave
                  
                  return (
                    <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      {/* Left: Date & Running Balance */}
                      <div className="flex flex-col gap-1.5 min-w-0 max-w-[120px]">
                        <span className="text-xs font-bold text-slate-700 shrink-0">{dateLabel}</span>
                        <span className="text-[8px] font-black text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider self-start">
                          Bal. ₹{Math.round(tx.running_balance).toLocaleString("en-IN")}
                        </span>
                      </div>
                      
                      {/* Middle: Description */}
                      <div className="flex-1 px-4 text-xs font-semibold text-slate-600 break-words whitespace-pre-wrap">
                        {tx.description ? tx.description.replace(/\s*\(auto-verified\)/gi, "") : ""}
                      </div>
                      
                      {/* Right: Gave (Debit) vs Got (Credit) numeric columns */}
                      <div className="flex items-center gap-3 w-40 shrink-0 text-right font-mono text-xs">
                        {/* Gave Column */}
                        <div className="w-20 font-black text-red-500">
                          {isDebit ? `₹ ${Math.round(tx.amount).toLocaleString("en-IN")}` : "—"}
                        </div>
                        {/* Got Column */}
                        <div className="w-20 font-black text-emerald-600">
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

      <Script src="/html2pdf.bundle.min.js" strategy="lazyOnload" />
    </div>
  );
}
