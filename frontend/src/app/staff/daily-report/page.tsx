"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../utils/api";
import { useAppStore } from "../../utils/store";
import { 
  ArrowLeft, 
  Calendar, 
  Download, 
  RefreshCw,
  FileText
} from "lucide-react";
import { getISTDateString, getUtcDate } from "../../utils/dateHelpers";
import { downloadElementAsPdf } from "../../utils/downloadElementAsPdf";

export default function DailyReportPage() {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const [collections, setCollections] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getISTDateString()); // "YYYY-MM-DD" in IST
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cols, deps] = await Promise.all([
        api.getCollections(),
        api.getDeposits()
      ]);
      const filteredDeps = deps.filter((d: any) => {
        if (d.recipient_staff_id === currentUser?.id && d.deposit_type === "staff") {
          const hasMatchingCollection = cols.some((c: any) => 
            c.from_staff_id === d.staff_id && 
            Number(c.total_amount) === Number(d.amount)
          );
          return !hasMatchingCollection;
        }
        return true;
      });
      setCollections(cols);
      setDeposits(filteredDeps);
    } catch (err) {
      console.error("Failed to fetch ledger report data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // transactionDate (collection_date/deposit_date) drives the DATE shown, not
  // created_at -- a backdated entry must display under the day it claims to
  // represent. created_at still drives the time-of-day (the actual submission
  // instant), matching admin/context/AdminContext.tsx's pattern.
  const formatDateTime = (dateStr: string, transactionDate?: string | null) => {
    const dateObj = getUtcDate(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let day: string;
    let month: string;
    if (transactionDate) {
      const [, m, dd] = transactionDate.split("-");
      day = dd;
      month = months[Number(m) - 1];
    } else {
      day = String(dateObj.getDate()).padStart(2, '0');
      month = months[dateObj.getMonth()];
    }

    const hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const formattedHour = String(hours).padStart(2, '0');

    return {
      date: `${day}-${month}`,
      time: `${formattedHour}:${minutes}`
    };
  };

  // Filter lists based on the selected date -- bucketed by the transaction's OWN
  // date (collection_date/deposit_date), not created_at, so a backdated entry
  // correctly shows up under the day it claims to represent.
  const filteredCollections = collections.filter(c => {
    const localDateStr = c.collection_date || getISTDateString(getUtcDate(c.created_at));
    return localDateStr === selectedDate;
  });

  const filteredDeposits = deposits.filter(d => {
    const localDateStr = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
    return localDateStr === selectedDate;
  });

  // Combine items chronologically
  const reportItems = [
    ...filteredCollections.map(c => ({
      ...c,
      itemType: "collection",
      inAmount: c.total_amount,
      outAmount: null,
      detailsText: c.retailer_name || "Unknown Retailer"
    })),
    ...filteredDeposits.map(d => {
      const isRecipient = d.recipient_staff_id === currentUser?.id && d.deposit_type === "staff";
      const targetDisp = (d.deposit_type === "portal" && d.portal_name) ? d.portal_name : (d.target_name || "Super Distributor");
      return {
        ...d,
        itemType: isRecipient ? "collection" : "deposit",
        inAmount: isRecipient ? d.amount : null,
        outAmount: isRecipient ? null : d.amount,
        detailsText: isRecipient ? `Received from ${d.staff_name}` : targetDisp
      };
    })
  ].sort((a, b) => getUtcDate(a.created_at).getTime() - getUtcDate(b.created_at).getTime());

  // Calculate Running Balances -- bucketed by collection_date/deposit_date, not
  // created_at, matching the filters above.
  const totalInBefore = collections
    .filter(c => {
      const localDateStr = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      return localDateStr < selectedDate;
    })
    .reduce((sum, c) => sum + Number(c.total_amount), 0) +
    deposits
    .filter(d => {
      const isRecipient = d.recipient_staff_id === currentUser?.id && d.deposit_type === "staff";
      if (!isRecipient) return false;
      const localDateStr = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      return localDateStr < selectedDate;
    })
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalOutBefore = deposits
    .filter(d => {
      const isRecipient = d.recipient_staff_id === currentUser?.id && d.deposit_type === "staff";
      if (isRecipient) return false;
      const localDateStr = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      return localDateStr < selectedDate;
    })
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const openingBalance = totalInBefore - totalOutBefore;
  const totalInToday = reportItems.reduce((sum, item) => sum + Number(item.inAmount || 0), 0);
  const totalOutToday = reportItems.reduce((sum, item) => sum + Number(item.outAmount || 0), 0);
  const lastBalance = openingBalance + totalInToday - totalOutToday;

  // Honest-sum note-by-note walk (same approach as the live dashboard,
  // staff/page.tsx) so Opening Amount and Last Balance can show a real
  // denomination breakdown here too, not just a rupee total. Raw negative
  // counts are kept as-is rather than clamped, matching the live dashboard.
  const computeDenomBreakdown = (throughDateInclusive: string) => {
    const notes = { note500: 0, note200: 0, note100: 0, note50: 0, note20: 0, note10: 0, coins: 0 };
    collections.forEach((c) => {
      if (!c.denominations) return;
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (cDate > throughDateInclusive) return;
      notes.note500 += Number(c.denominations.note_500) || 0;
      notes.note200 += Number(c.denominations.note_200) || 0;
      notes.note100 += Number(c.denominations.note_100) || 0;
      notes.note50  += Number(c.denominations.note_50)  || 0;
      notes.note20  += Number(c.denominations.note_20)  || 0;
      notes.note10  += Number(c.denominations.note_10)  || 0;
      notes.coins   += Number(c.denominations.coins)    || 0;
    });
    deposits.forEach((d) => {
      if (!d.denominations) return;
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dDate > throughDateInclusive) return;
      const isReceivedHandover = d.recipient_staff_id === currentUser?.id && d.deposit_type === "staff";
      if (!isReceivedHandover && d.deposit_type === "virtual") return;
      const sign = isReceivedHandover ? 1 : -1;
      notes.note500 += sign * (Number(d.denominations.note_500) || 0);
      notes.note200 += sign * (Number(d.denominations.note_200) || 0);
      notes.note100 += sign * (Number(d.denominations.note_100) || 0);
      notes.note50  += sign * (Number(d.denominations.note_50)  || 0);
      notes.note20  += sign * (Number(d.denominations.note_20)  || 0);
      notes.note10  += sign * (Number(d.denominations.note_10)  || 0);
      notes.coins   += sign * (Number(d.denominations.coins)    || 0);
    });
    notes.coins = Math.round(notes.coins * 100) / 100;
    return notes;
  };

  // Opening = everything strictly before selectedDate; use a date one day
  // earlier as the inclusive upper bound for the same walk function.
  const dayBefore = (() => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return getISTDateString(d);
  })();
  const openingDenom = computeDenomBreakdown(dayBefore);
  const lastDenom = computeDenomBreakdown(selectedDate);

  const renderNetDenomBreakdown = (notes: typeof openingDenom) => {
    const items = [
      { label: "500", count: notes.note500 },
      { label: "200", count: notes.note200 },
      { label: "100", count: notes.note100 },
      { label: "50", count: notes.note50 },
      { label: "20", count: notes.note20 },
      { label: "10", count: notes.note10 },
    ];
    return (
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-bold justify-end">
        {items.map(n => (
          <span key={n.label} className={n.count < 0 ? "text-red-600" : "text-slate-600"}>
            {n.label}x{n.count}
          </span>
        ))}
        {notes.coins !== 0 && (
          <span className={notes.coins < 0 ? "text-red-600" : "text-slate-600"}>
            Coins={notes.coins.toFixed(2)}
          </span>
        )}
      </div>
    );
  };

  // Generate breakdown content cell in the format matching SS
  const renderNotesBreakdown = (item: any) => {
    const denoms = item.denominations || {};
    const isOut = item.itemType === "deposit";
    const prefix = isOut ? "-" : "";

    const lines: string[] = [];
    let noteCountSum = 0;

    const notesConfig = [
      { key: "note_500", label: "500" },
      { key: "note_200", label: "200" },
      { key: "note_100", label: "100" },
      { key: "note_50", label: "50" },
      { key: "note_20", label: "20" },
      { key: "note_10", label: "10" }
    ];

    notesConfig.forEach(n => {
      const val = Number(denoms[n.key] || 0);
      if (val !== 0) {
        noteCountSum += val;
        let countStr = "";
        let totalStr = "";
        if (val < 0) {
          countStr = `${val}`;
          totalStr = `${val * Number(n.label)}`;
        } else {
          countStr = `${prefix}${val}`;
          totalStr = `${prefix}${val * Number(n.label)}`;
        }
        lines.push(`${n.label}x${countStr}=${totalStr}`);
      }
    });

    const coinsVal = Number(denoms.coins || 0);
    if (coinsVal !== 0) {
      noteCountSum += coinsVal; // coins count towards notes in screenshot total count
      let countStr = "";
      let totalStr = "";
      if (coinsVal < 0) {
        countStr = `${Math.ceil(coinsVal)}`;
        totalStr = `${coinsVal.toFixed(0)}`;
      } else {
        countStr = `${prefix}${Math.floor(coinsVal)}`;
        totalStr = `${prefix}${coinsVal.toFixed(0)}`;
      }
      lines.push(`01x${countStr}=${totalStr}`);
    }

    const onlineVal = Number(denoms.online_amount || 0);
    if (onlineVal !== 0) {
      lines.push(`[+${onlineVal < 0 ? onlineVal : prefix + onlineVal}]`);
    }

    // Append total note line
    const totalNoteStr = noteCountSum < 0 ? `${noteCountSum}` : `${prefix}${noteCountSum}`;
    lines.push(`Total_${totalNoteStr}_Note`);

    return (
      <div className="text-[10px] leading-tight font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-pre-line font-mono">
        {lines.join("\n")}
      </div>
    );
  };

  const downloadPDF = () => {
    setIsDownloading(true);

    const staffNameClean = (currentUser?.name || "Staff").trim().replace(/\s+/g, "_");
    const dateStrClean = selectedDate.trim().replace(/\s+/g, "_");
    const filename = `${staffNameClean}_${dateStrClean}.pdf`;

    downloadElementAsPdf("report-content", filename, 0.3)
      .catch((e: any) => {
        console.error("PDF generation failed, falling back to print:", e);
        window.print();
      })
      .finally(() => setIsDownloading(false));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="w-full max-w-2xl mx-auto px-2 py-3 flex flex-col gap-2.5 pb-24">
        
        {/* Navigation Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/staff")}
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-sm cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Daily Cash Report</h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Export transaction breakdown report</p>
            </div>
          </div>

          <button
            onClick={downloadPDF}
            disabled={isDownloading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[10px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Download className="w-3 h-3" />
            {isDownloading ? "Downloading..." : "Download PDF"}
          </button>
        </div>

        {/* Date Filter & Refresh */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-sm border border-slate-200 dark:border-slate-800">
          <div className="flex-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input autoComplete="one-time-code"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-[11px] font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer w-full"
            />
          </div>
          <button
            onClick={fetchData}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            title="Refresh Report Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Report Content Container for PDF Generation */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden p-0.5">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div id="report-content" className="bg-white text-black p-2.5 font-sans flex flex-col gap-2.5">
              
              {/* Premium Heading block matching screenshot */}
              <div className="relative border border-slate-200 rounded-lg overflow-hidden">
                {/* Visual blue top-right gradient banner */}
                <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-cyan-400 via-sky-400 to-blue-500 opacity-90 transform skew-x-12 origin-top-right -mr-3" />
                
                <div className="relative p-2.5 pr-28 z-10">
                  <h2 className="text-sm font-black tracking-tight leading-none text-sky-900">{currentUser?.name || "Staff Member"}</h2>
                  
                  {/* Color dots row */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-300"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-200"></span>
                  </div>
                </div>

                {/* Centered Report Title bar at bottom */}
                <div className="border-t border-slate-200 bg-slate-50/50 py-1.5 text-center relative z-10">
                  <span className="text-[9px] font-black text-slate-950 uppercase tracking-widest">
                    Detailed Cash Report - {new Date(selectedDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric', timeZone: "Asia/Kolkata" })}
                  </span>
                </div>
              </div>

              {/* Balance Summary Row */}
              <div className="grid grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2.5 text-center divide-x divide-slate-200 shadow-xs">
                <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Opening Balance</span>
                  <span className="text-xs font-black text-blue-900 mt-1 tabular-nums whitespace-nowrap">
                    ₹{openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Today's In</span>
                  <span className="text-xs font-black text-emerald-600 mt-1 tabular-nums whitespace-nowrap">
                    ₹{totalInToday.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Today's Out</span>
                  <span className="text-xs font-black text-red-600 mt-1 tabular-nums whitespace-nowrap">
                    ₹{totalOutToday.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Last Balance</span>
                  <span className="text-xs font-black text-blue-900 mt-1 tabular-nums whitespace-nowrap">
                    ₹{lastBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Transaction Data Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                      <th className="py-2 px-1 border-r border-slate-200 text-center w-[5%] text-[9px] uppercase">No</th>
                      <th className="py-2 px-1 border-r border-slate-200 text-center w-[12%] text-[9px] uppercase">Date</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center w-[39%] text-[9px] uppercase">Description</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center w-[16%] text-[9px] uppercase">In</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center w-[16%] text-[9px] uppercase">Out</th>
                      <th className="py-2 px-1 border-r border-slate-200 text-center w-[12%] text-[9px] uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Opening Balance Row */}
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td className="py-2 px-1 border-r border-slate-200 text-center text-slate-400">-</td>
                      <td className="py-2 px-1 border-r border-slate-200 text-center text-[9px] text-slate-400">-</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-black text-slate-900 uppercase text-[9.5px] tracking-wider">
                        OPENING BALANCE
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-black text-blue-900 text-[10px] font-mono tabular-nums">
                        ₹{openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center text-slate-400">-</td>
                      <td className="py-2 px-1 align-middle bg-slate-50/50 text-right">
                        {renderNetDenomBreakdown(openingDenom)}
                      </td>
                    </tr>

                    {reportItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-slate-400 font-bold bg-white italic">
                          No transaction records found for {new Date(selectedDate).toLocaleDateString("en-IN", { dateStyle: 'medium', timeZone: "Asia/Kolkata" })}.
                        </td>
                      </tr>
                    ) : (
                      reportItems.map((item, idx) => {
                        const dt = formatDateTime(item.created_at, item.collection_date || item.deposit_date);
                        const isCol = item.itemType === "collection";
                        
                        const staffName = item.staff_name || currentUser?.name || "Staff";
                        let source = "";
                        let destination = "";
                        if (isCol) {
                          const isCms = item.retailer_name?.toLowerCase().startsWith("cms");
                          const storeStr = item.store_name && item.store_name !== "Cash" ? ` (${item.store_name})` : "";
                          const retDispName = isCms 
                            ? `${item.retailer_name} - ${item.store_name || "Cash"}` 
                            : (item.from_staff_name ? `Staff: ${item.from_staff_name}` : `${item.retailer_name || "Retailer"}${storeStr}`);
                          source = item.from_office
                            ? "Super Distributor"
                            : retDispName;
                          destination = item.portal_name
                             ? `${item.portal_name}${item.bank_name ? ` (${item.bank_name})` : (item.bank_account_name ? ` (${item.bank_account_name})` : "")}`
                             : staffName;
                        } else {
                          source = staffName;
                          const bankSuffix = (item.deposit_type === "portal" && item.bank_name)
                            ? ` (${item.bank_name})`
                            : (item.store_name && item.store_name !== "Cash" ? ` (${item.store_name})` : "");
                          const destName = (item.deposit_type === "portal" && item.portal_name) ? item.portal_name : (item.target_name || "Recipient");
                          destination = item.to_office
                            ? "Super Distributor"
                            : `${destName}${bankSuffix}`;
                        }
                        const narration = `From ${source} to ${destination}`;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            {/* No */}
                            <td className="py-2 px-1 border-r border-slate-200 text-center font-bold text-slate-800 text-[9.5px]">
                              {idx + 1}
                            </td>
                            
                            {/* Date & Time */}
                            <td className="py-2 px-1 border-r border-slate-200 text-center text-[9px] leading-tight font-semibold text-slate-700">
                              <div>{dt.date}</div>
                              <div className="text-slate-400 mt-0.5 font-mono">{dt.time}</div>
                            </td>
                            
                            {/* Description */}
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-semibold text-slate-800 break-words text-[9.5px] leading-snug whitespace-pre-line">
                              <div className="text-slate-900 font-bold">{narration}</div>
                              {item.remarks && (
                                <div className="text-[8.5px] text-slate-500 font-medium mt-0.5 italic">
                                  Remark: {item.remarks}
                                </div>
                              )}
                            </td>
                            
                            {/* In */}
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-extrabold text-emerald-600 text-[10px] font-mono tabular-nums">
                              {isCol ? `₹${Number(item.inAmount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            
                            {/* Out */}
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-extrabold text-red-600 text-[10px] font-mono tabular-nums">
                              {!isCol ? `-₹${Number(item.outAmount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            
                            {/* Notes */}
                            <td className="py-2 px-1 align-middle bg-slate-50/30">
                              {renderNotesBreakdown(item)}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Last Balance Row */}
                    <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                      <td className="py-2 px-1 border-r border-slate-200 text-center text-slate-400">-</td>
                      <td className="py-2 px-1 border-r border-slate-200 text-center text-[9px] text-slate-400">-</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-black text-slate-900 uppercase text-[9.5px] tracking-wider">
                        LAST BALANCE
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-black text-blue-900 text-[10px] font-mono tabular-nums">
                        ₹{lastBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center text-slate-400">-</td>
                      <td className="py-2 px-1 align-middle bg-slate-50/50 text-right">
                        {renderNetDenomBreakdown(lastDenom)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
