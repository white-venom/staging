"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../utils/api";
import { useAppStore } from "../../utils/store";
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Share2,
  CheckCircle,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Coins
} from "lucide-react";
import { numberToWordsIndian, shareCollectionEntry, shareDepositEntry } from "../../utils/shareHelper";

const getUtcDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  let s = String(dateStr).trim();
  if (s.includes(" ") && !s.includes("GMT") && !s.includes("+")) {
    s = s.replace(" ", "T");
  }
  if (!s.endsWith("Z") && !s.includes("+") && !s.includes("GMT")) {
    return new Date(s + "Z");
  }
  return new Date(s);
};

export default function StaffLedgerPage() {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const [collections, setCollections] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "in" | "out">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [editWindow, setEditWindow] = useState<number>(5);
  const [deleteWindow, setDeleteWindow] = useState<number>(5);

  useEffect(() => {
    loadLedgerData();
  }, []);

  const loadLedgerData = async () => {
    setIsLoading(true);
    try {
      const [apiCols, apiDeps, settings] = await Promise.all([
        api.getCollections(),
        api.getDeposits(),
        api.getAdminSettings().catch(() => ({ edit_window_minutes: 5, delete_window_minutes: 5 }))
      ]);
      setCollections(apiCols);
      setDeposits(apiDeps);
      setEditWindow(settings.edit_window_minutes ?? 5);
      setDeleteWindow(settings.delete_window_minutes ?? 5);
    } catch (err) {
      console.error("Failed to load staff ledger data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleDelete = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCollection = item.type === "collection";
    const typeLabel = isCollection ? "collection" : "deposit";
    if (!window.confirm(`Are you sure you want to delete this ${typeLabel} entry? This will revert balances.`)) return;

    try {
      if (isCollection) {
        await api.deleteCollection(item.id);
      } else {
        await api.deleteDeposit(item.id);
      }
      
      // Update local state by refetching
      await loadLedgerData();
      
      // Also update Zustand store lists
      const store = useAppStore.getState();
      if (isCollection) {
        store.setCollections(store.collections.filter(c => c.id !== item.id));
      } else {
        store.setDeposits(store.deposits.filter(d => d.id !== item.id));
      }
    } catch (err: any) {
      alert("Failed to delete: " + (err.response?.data?.detail || err.message));
    }
  };

  // Build unified list sorted chronologically to compute running balances
  const rawCombined = [
    ...collections.map(c => {
      let displayName = c.retailer_name || "Unknown Retailer";
      if (c.from_staff_id || c.retailer_name?.toLowerCase().startsWith("staff")) {
        const nameOnly = c.retailer_name?.replace(/^(Staff:?\s*-\s*|Staff:?\s*)/i, "") || c.from_staff_name || "Staff Member";
        displayName = `Staff - ${nameOnly}`;
      } else if (c.retailer_id) {
        const nameOnly = c.retailer_name?.replace(/^(Retailer:?\s*-\s*|Retailer:?\s*)/i, "");
        displayName = `Retailer - ${nameOnly || "Retailer"}`;
      } else if (c.retailer_name?.toLowerCase().startsWith("cms")) {
        displayName = `${c.retailer_name} - ${c.store_name || "Cash"}`;
      }
      return {
        ...c,
        type: "collection" as const,
        totalAmount: Number(c.total_amount),
        date: getUtcDate(c.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
        displayName,
        displayPortal: c.portal_name || "Cash"
      };
    }),
    ...deposits.map(d => {
      const isRecipient = d.recipient_staff_id === currentUser?.id && d.deposit_type === "staff";
      const targetName = (d.deposit_type === "portal" && d.portal_group_name) ? d.portal_group_name : (d.target_name || "Super Distributor");
      
      let displayName = targetName;
      if (d.deposit_type === "staff") {
        const nameOnly = isRecipient ? d.staff_name : d.target_name;
        const cleanName = nameOnly?.replace(/^(Staff:?\s*-\s*|Staff:?\s*|Received\s+from:\s*)/i, "");
        displayName = `Staff - ${cleanName || "Staff Member"}`;
      } else if (d.deposit_type === "retailer") {
        const cleanName = d.target_name?.replace(/^(Retailer:?\s*-\s*|Retailer:?\s*)/i, "");
        displayName = `Retailer - ${cleanName || "Retailer"}`;
      }
      
      return {
        ...d,
        type: isRecipient ? ("collection" as const) : ("deposit" as const),
        isStaffHandoverReceived: isRecipient,
        totalAmount: Number(d.amount),
        date: getUtcDate(d.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
        displayName,
        displayPortal: d.deposit_type === "staff" ? "Staff Handover" : (d.deposit_type || "Deposit")
      };
    })
  ]
  .filter(item => item.created_at)
  .sort((a, b) => new Date(getUtcDate(a.created_at)).getTime() - new Date(getUtcDate(b.created_at)).getTime());

  // Compute opening/closing balances for every item
  let runningBal = 0;
  const ledgerSnapshots = new Map();
  rawCombined.forEach(item => {
    const prev = runningBal;
    if (item.type === "collection") {
      runningBal += item.totalAmount;
    } else {
      runningBal -= item.totalAmount;
    }
    ledgerSnapshots.set(item.id, { prev, next: runningBal });
  });

  // Calculate Summary metrics
  const totalCollectedSum = rawCombined
    .filter(item => item.type === "collection")
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const totalDepositedSum = rawCombined
    .filter(item => item.type === "deposit")
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const netPortfolio = totalCollectedSum - totalDepositedSum;

  // Filter based on active tab, date range, and search query
  const filteredCombined = rawCombined.filter(item => {
    // Tab filter
    if (activeTab === "in" && item.type !== "collection") return false;
    if (activeTab === "out" && item.type !== "deposit") return false;

    // Date range filter
    if (dateFrom && item.date && item.date.split(" ")[0] < dateFrom) return false;
    if (dateTo && item.date && item.date.split(" ")[0] > dateTo) return false;

    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = item.displayName?.toLowerCase().includes(searchLower) || false;
    const portalMatch = item.displayPortal?.toLowerCase().includes(searchLower) || false;
    const amountMatch = String(item.totalAmount).includes(searchLower);
    
    return nameMatch || portalMatch || amountMatch;
  });

  // Apply sorting
  const sortedCombined = [...filteredCombined].sort((a, b) => {
    const timeA = new Date(getUtcDate(a.created_at)).getTime();
    const timeB = new Date(getUtcDate(b.created_at)).getTime();
    
    if (sortBy === "date-desc") return timeB - timeA;
    if (sortBy === "date-asc") return timeA - timeB;
    if (sortBy === "amount-desc") return b.totalAmount - a.totalAmount;
    if (sortBy === "amount-asc") return a.totalAmount - b.totalAmount;
    return 0;
  });

  const displayTimeline = sortedCombined;

  // Group by date
  const groupedTimeline: Record<string, any[]> = {};
  displayTimeline.forEach(item => {
    const dateStr = item.created_at ? getUtcDate(item.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "Unknown Date";
    if (!groupedTimeline[dateStr]) {
      groupedTimeline[dateStr] = [];
    }
    groupedTimeline[dateStr].push(item);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="flex-1 w-full max-w-md mx-auto px-2 py-3 flex flex-col gap-2.5 select-none pb-24">
        
        {/* Navigation Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/staff")}
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer animate-in fade-in duration-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Ledger</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">Your unified transaction history</p>
            </div>
          </div>
          <button
            onClick={loadLedgerData}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-500" : ""}`} />
          </button>
        </div>

        {/* Summary Blocks */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cash In</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-500 tracking-tight">
              ₹{totalCollectedSum.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cash Out</span>
            <span className="text-sm font-black text-red-600 dark:text-red-500 tracking-tight">
              ₹{totalDepositedSum.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="bg-slate-900 dark:bg-slate-100 p-2.5 rounded-xl border border-slate-800 dark:border-white shadow-md flex flex-col">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Cash</span>
            <span className="text-sm font-black text-white dark:text-slate-950 tracking-tight">
              ₹{netPortfolio.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Filter Input & Sorting */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input autoComplete="one-time-code"
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-bold shadow-sm"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none text-slate-800 dark:text-slate-200 shadow-sm cursor-pointer"
          >
            <option value="date-desc">LATEST FIRST</option>
            <option value="date-asc">OLDEST FIRST</option>
            <option value="amount-desc">AMOUNT: HIGH-LOW</option>
            <option value="amount-asc">AMOUNT: LOW-HIGH</option>
          </select>
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[7.5px] text-slate-400 font-black uppercase">Date From</span>
              <input autoComplete="one-time-code"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer p-0 h-4 min-h-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[7.5px] text-slate-400 font-black uppercase">Date To</span>
              <input autoComplete="one-time-code"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer p-0 h-4 min-h-0"
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/50 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200/20">
          {[
            { id: "all", label: "All Logs" },
            { id: "in", label: "Cash In" },
            { id: "out", label: "Cash Out" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-1.5 text-xs font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ledger list */}
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : Object.keys(groupedTimeline).length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-[10px] text-slate-400 dark:text-slate-500 font-bold">
              <Calendar className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
              No ledger records found.
            </div>
          ) : (
            Object.entries(groupedTimeline).map(([date, items]) => (
              <div key={date} className="space-y-1.5">
                <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 border-b border-slate-200 dark:border-slate-800 pb-0.5 mt-1.5">
                  {date}
                </h2>
                {items.map((item: any) => {
                  const snapshots = ledgerSnapshots.get(item.id) || { prev: 0, next: 0 };
                  const isExpanded = expandedId === item.id;
                  const den = item.denominations || {};
                  
                  // Edit and Delete window checks
                  const createdMs = item.created_at ? new Date(getUtcDate(item.created_at)).getTime() : 0;
                  const elapsedMin = (Date.now() - createdMs) / 60000;
                  const canEdit = editWindow === -1 || elapsedMin <= editWindow;
                  const canDelete = deleteWindow === -1 || elapsedMin <= deleteWindow;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border flex flex-col shadow-sm transition-all overflow-hidden ${
                        isExpanded
                          ? "bg-slate-50 dark:bg-slate-900 border-blue-200 dark:border-blue-900/40"
                          : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:shadow-md cursor-pointer"
                      }`}
                      onClick={() => toggleExpand(item.id)}
                    >
                      {/* Main Row */}
                      <div className="p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-inner ${
                            item.type === "collection" ? "text-emerald-500" : "text-red-500"
                          }`}>
                            {item.type === "collection" ? (
                              <CheckCircle className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-black text-slate-800 dark:text-slate-100 tracking-tight truncate">
                              {item.displayName}
                            </h3>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                              <span className="text-blue-500">{item.displayPortal}</span>
                              <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                              <span>{getUtcDate(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2 flex items-center gap-1.5">
                          <span className={`text-base font-black tracking-tight block ${
                            item.type === "collection" ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-400"
                          }`}>
                            {item.type === "collection" ? "+" : "-"}₹{item.totalAmount.toLocaleString("en-IN")}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>

                      {/* Running Balance Segment */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-100/50 dark:bg-slate-955/40 mx-2 mb-2 p-1.5 rounded-lg border border-slate-200/30 dark:border-slate-800/40">
                        <div className="flex flex-col pl-1">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Opening</span>
                          <span className="text-sm font-semibold text-slate-650 dark:text-slate-400">₹{snapshots.prev.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex flex-col text-right pr-1">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Closing</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200">₹{snapshots.next.toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div className="px-2 mx-2 mb-2 pb-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/40 space-y-2 text-xs font-bold text-slate-600 dark:text-slate-400" onClick={e => e.stopPropagation()}>
                          <div>
                            <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Cash Breakdown:</span>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-700 dark:text-slate-355">
                              {Number(den.note_500 || 0) > 0 && <div>₹500 Notes: <span className="font-black">{Number(den.note_500)}</span></div>}
                              {Number(den.note_200 || 0) > 0 && <div>₹200 Notes: <span className="font-black">{Number(den.note_200)}</span></div>}
                              {Number(den.note_100 || 0) > 0 && <div>₹100 Notes: <span className="font-black">{Number(den.note_100)}</span></div>}
                              {Number(den.note_50 || 0) > 0 && <div>₹50 Notes: <span className="font-black">{Number(den.note_50)}</span></div>}
                              {Number(den.note_20 || 0) > 0 && <div>₹20 Notes: <span className="font-black">{Number(den.note_20)}</span></div>}
                              {Number(den.note_10 || 0) > 0 && <div>₹10 Notes: <span className="font-black">{Number(den.note_10)}</span></div>}
                              {Number(den.coins || 0) > 0 && <div>Coins: <span className="font-black">₹{Number(den.coins).toFixed(2)}</span></div>}
                              {Number(den.online_amount || 0) > 0 && <div>UPI Online: <span className="font-black">₹{Number(den.online_amount).toLocaleString("en-IN")}</span></div>}
                              {!den.note_500 && !den.note_200 && !den.note_100 && !den.note_50 && !den.note_20 && !den.note_10 && !den.coins && !den.online_amount && (
                                <div className="text-slate-400 italic text-xs">No breakdown provided</div>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5">
                            <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Amount in words:</span>
                            <span className="text-slate-700 dark:text-slate-350 italic">{numberToWordsIndian(item.totalAmount)} Rupees Only</span>
                          </div>

                          {item.remarks && (
                            <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5 flex items-start gap-1">
                              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Remarks:</span>
                                <span className="text-slate-750 dark:text-slate-300 font-bold text-xs">{item.remarks}</span>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-2 flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                if (item.type === "collection") {
                                  shareCollectionEntry(
                                    {
                                      retailer_name: item.retailer_name,
                                      portal_name: item.portal_name,
                                      store_name: item.store_name,
                                      total_amount: item.totalAmount,
                                      denominations: item.denominations,
                                      created_at: item.created_at,
                                      remarks: item.remarks
                                    },
                                    currentUser?.name || "Staff Member"
                                  );
                                } else {
                                  shareDepositEntry(
                                    {
                                      deposit_type: item.deposit_type,
                                      target_name: item.target_name,
                                      portal_group_name: item.portal_group_name,
                                      amount: item.totalAmount,
                                      denominations: item.denominations,
                                      created_at: item.created_at,
                                      remarks: item.remarks,
                                      recipient_staff_id: item.recipient_staff_id
                                    },
                                    currentUser?.name || "Staff Member",
                                    currentUser?.id
                                  );
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/30 active:scale-95 transition-transform"
                          >
                            <Share2 className="w-2.5 h-2.5" /> Share
                          </button>

                          {canEdit || canDelete ? (
                            <>
                              {canEdit ? (
                                <button
                                  onClick={() => {
                                    const path = item.type === "collection" ? "/staff/cash-in-ledger" : "/staff/cash-out-ledger";
                                    router.push(`${path}?edit=${item.id}`);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider border border-blue-100 dark:border-blue-900/30 active:scale-95 transition-transform"
                                >
                                  <Edit2 className="w-2.5 h-2.5" /> Edit
                                </button>
                              ) : (
                                <div className="flex-1 text-center text-[7.5px] font-bold text-slate-400 py-1 bg-slate-150/40 dark:bg-slate-850/20 rounded-md border border-slate-200/10">
                                  Edit expired
                                </div>
                              )}
                              {canDelete ? (
                                <button
                                  onClick={(e) => handleDelete(item, e)}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 text-[8px] font-black uppercase tracking-wider border border-red-100 dark:border-red-900/30 active:scale-95 transition-transform"
                                >
                                  <Trash2 className="w-2.5 h-2.5" /> Delete
                                </button>
                              ) : (
                                <div className="flex-1 text-center text-[7.5px] font-bold text-slate-400 py-1 bg-slate-150/40 dark:bg-slate-850/20 rounded-md border border-slate-200/10">
                                  Delete expired
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex-1 text-center text-[7.5px] font-bold text-slate-400 py-1 bg-slate-100 dark:bg-slate-800/40 rounded-md border border-slate-200/30 dark:border-slate-800">
                              Action window expired
                            </div>
                          )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
