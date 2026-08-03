"use client";

import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Calendar,
  BarChart,
  PieChart,
  TrendingUp,
  Book,
  Receipt,
  FileSpreadsheet,
  IndianRupee,
  Activity,
  ArrowLeft,
  FileDown
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { getISTDateString, getUtcDate } from "../../../utils/dateHelpers";
import { downloadElementAsPdf } from "../../../utils/downloadElementAsPdf";

interface ReportsTabProps {
  collections: any[];
  deposits: any[];
}

export default function ReportsTab({ collections: propCols = [], deposits: propDeps = [] }: ReportsTabProps) {
  const adminCtx = useAdmin();
  
  const collections = adminCtx?.collections || propCols || [];
  const deposits = adminCtx?.deposits || propDeps || [];
  const retailerDirectory = adminCtx?.retailerDirectory || [];
  const portalDirectory = adminCtx?.portalDirectory || [];
  const userDirectory = adminCtx?.userDirectory || [];

  // Active Selected Report View: null = Overview cards, string = report type
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRetailerId, setSelectedRetailerId] = useState("all");
  const [selectedPortalId, setSelectedPortalId] = useState("all");
  const [selectedStaffId, setSelectedStaffId] = useState("all");
  const [dateFrom, setDateFrom] = useState(getISTDateString());
  const [dateTo, setDateTo] = useState(getISTDateString());

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Helper date formatter
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return { date: "-", time: "-" };
    try {
      let parseStr = dateStr;
      if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
        parseStr = dateStr.replace(" ", "T") + "Z";
      }
      const d = getUtcDate(parseStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: "-" };

      const datePart = d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata"
      });
      const timePart = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata"
      });

      return { date: datePart, time: timePart };
    } catch {
      return { date: dateStr, time: "-" };
    }
  };

  // Helper UUID checker
  const isUuid = (str: any) => {
    if (typeof str !== "string") return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str) || (str.length > 20 && str.includes("-"));
  };

  // Helper to map any transaction/user object to a clean human-readable Staff Name
  const getStaffName = (item: any): string => {
    if (!item) return "Staff Member";
    
    // Check direct name fields
    const directName = item.staff_name || item.staffName || item.from_staff_name || item.recipient_staff_name || item.name || item.full_name;

    if (directName && typeof directName === "string" && !isUuid(directName) && directName !== "Unknown Staff" && directName !== "System") {
      return directName;
    }

    // Lookup in userDirectory by staff ID
    const targetId = String(item.from_staff_id || item.staff_id || item.staffId || item.recipient_staff_id || item.id || item.user_id || "");
    if (targetId && userDirectory && userDirectory.length > 0) {
      const found = userDirectory.find((u: any) => String(u.id) === targetId || String(u.staff_id) === targetId || String(u.user_id) === targetId);
      if (found && (found.name || found.full_name || found.username)) {
        const uName = found.name || found.full_name || found.username;
        if (!isUuid(uName)) return uName;
      }
    }

    // Fallback if directName exists and is not UUID
    if (directName && typeof directName === "string" && !isUuid(directName)) {
      return directName;
    }

    return "Staff Member";
  };

  // Staff members dropdown list
  const staffList = useMemo(() => {
    const map = new Map<string, string>();
    
    if (userDirectory && userDirectory.length > 0) {
      userDirectory.forEach((u: any) => {
        const name = u.name || u.full_name || u.username;
        if (name && typeof name === "string" && !isUuid(name)) {
          map.set(String(u.id || name), name);
        }
      });
    }

    collections.forEach(c => {
      const name = getStaffName(c);
      const id = String(c.from_staff_id || c.staff_id || name);
      if (name && name !== "Staff Member" && name !== "Unknown Staff") {
        map.set(id, name);
      }
    });

    deposits.forEach(d => {
      const name = getStaffName(d);
      const id = String(d.staff_id || name);
      if (name && name !== "Staff Member" && name !== "Unknown Staff") {
        map.set(id, name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [userDirectory, collections, deposits]);

  // Retailer Directory options
  const retailerOptions = useMemo(() => {
    if (retailerDirectory && retailerDirectory.length > 0) {
      return retailerDirectory;
    }
    const names = new Set<string>();
    collections.forEach(c => { if (c.retailer_name && !isUuid(c.retailer_name)) names.add(c.retailer_name); });
    return Array.from(names).map(n => ({ id: n, name: n }));
  }, [retailerDirectory, collections]);

  // Portal Directory options
  const portalOptions = useMemo(() => {
    if (portalDirectory && portalDirectory.length > 0) {
      return portalDirectory;
    }
    const names = new Set<string>();
    deposits.forEach(d => { if (d.portal_name && !isUuid(d.portal_name)) names.add(d.portal_name); });
    collections.forEach(c => { if (c.portal_name && !isUuid(c.portal_name)) names.add(c.portal_name); });
    return Array.from(names).map(n => ({ id: n, name: n }));
  }, [portalDirectory, deposits, collections]);

  // Filtered Retailer Ledger Data
  const filteredRetailerLedger = useMemo(() => {
    return collections.filter((c: any) => {
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (dateFrom && cDate < dateFrom) return false;
      if (dateTo && cDate > dateTo) return false;

      if (selectedRetailerId !== "all") {
        const matchesId = String(c.retailer_id) === String(selectedRetailerId);
        const matchesName = c.retailer_name === selectedRetailerId;
        if (!matchesId && !matchesName) return false;
      }

      if (selectedStaffId !== "all") {
        const sName = getStaffName(c);
        const matchesStaffId = String(c.from_staff_id || c.staff_id) === String(selectedStaffId);
        const matchesStaffName = sName === selectedStaffId || sName.toLowerCase() === selectedStaffId.toLowerCase();
        if (!matchesStaffId && !matchesStaffName) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const retName = (c.retailer_name || "").toLowerCase();
        const storeName = (c.store_name || "").toLowerCase();
        const staffName = getStaffName(c).toLowerCase();
        const amount = String(c.total_amount || c.totalAmount || "");
        const remarks = (c.remarks || "").toLowerCase();
        if (!retName.includes(q) && !storeName.includes(q) && !staffName.includes(q) && !amount.includes(q) && !remarks.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
  }, [collections, dateFrom, dateTo, selectedRetailerId, selectedStaffId, searchQuery, userDirectory]);

  // Filtered Portal Ledger Data
  const filteredPortalLedger = useMemo(() => {
    return deposits.filter((d: any) => {
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dateFrom && dDate < dateFrom) return false;
      if (dateTo && dDate > dateTo) return false;

      if (selectedPortalId !== "all") {
        const matchesId = String(d.portal_id) === String(selectedPortalId);
        const matchesName = d.portal_name === selectedPortalId;
        if (!matchesId && !matchesName) return false;
      }

      if (selectedStaffId !== "all") {
        const sName = getStaffName(d);
        const matchesStaffId = String(d.staff_id) === String(selectedStaffId);
        const matchesStaffName = sName === selectedStaffId || sName.toLowerCase() === selectedStaffId.toLowerCase();
        if (!matchesStaffId && !matchesStaffName) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const portalName = (d.portal_name || "").toLowerCase();
        const targetName = (d.target_name || "").toLowerCase();
        const staffName = getStaffName(d).toLowerCase();
        const amount = String(d.amount || "");
        const remarks = (d.remarks || "").toLowerCase();
        if (!portalName.includes(q) && !targetName.includes(q) && !staffName.includes(q) && !amount.includes(q) && !remarks.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
  }, [deposits, dateFrom, dateTo, selectedPortalId, selectedStaffId, searchQuery, userDirectory]);

  // Filtered Staff Collection Efficiency Data
  const staffEfficiencyData = useMemo(() => {
    const map = new Map<string, {
      staffId: string;
      staffName: string;
      collectionsCount: number;
      collectionsTotal: number;
      depositsCount: number;
      depositsTotal: number;
    }>();

    // Process collections
    collections.forEach((c: any) => {
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (dateFrom && cDate < dateFrom) return;
      if (dateTo && cDate > dateTo) return;

      const resolvedName = getStaffName(c);
      const staffId = String(c.from_staff_id || c.staff_id || resolvedName);
      const mapKey = resolvedName !== "Staff Member" ? resolvedName : staffId;

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          staffId: staffId,
          staffName: resolvedName,
          collectionsCount: 0,
          collectionsTotal: 0,
          depositsCount: 0,
          depositsTotal: 0
        });
      }
      const entry = map.get(mapKey)!;
      entry.collectionsCount += 1;
      entry.collectionsTotal += Number(c.total_amount || c.totalAmount || 0);
    });

    // Process deposits
    deposits.forEach((d: any) => {
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dateFrom && dDate < dateFrom) return;
      if (dateTo && dDate > dateTo) return;

      const resolvedName = getStaffName(d);
      const staffId = String(d.staff_id || resolvedName);
      const mapKey = resolvedName !== "Staff Member" ? resolvedName : staffId;

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          staffId: staffId,
          staffName: resolvedName,
          collectionsCount: 0,
          collectionsTotal: 0,
          depositsCount: 0,
          depositsTotal: 0
        });
      }
      const entry = map.get(mapKey)!;
      entry.depositsCount += 1;
      entry.depositsTotal += Number(d.amount || 0);
    });

    let list = Array.from(map.values());

    if (selectedStaffId !== "all") {
      list = list.filter(item => 
        item.staffId === String(selectedStaffId) || 
        item.staffName === selectedStaffId ||
        item.staffName.toLowerCase() === selectedStaffId.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => item.staffName.toLowerCase().includes(q));
    }

    return list.sort((a, b) => b.collectionsTotal - a.collectionsTotal);
  }, [collections, deposits, dateFrom, dateTo, selectedStaffId, searchQuery, userDirectory]);

  // Export handlers
  const handleExportCsv = (reportType: string) => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `Report_${reportType}_${dateFrom}_to_${dateTo}.csv`;

    if (reportType === "retailer_ledger") {
      headers = ["No", "Date", "Time", "Retailer Name", "Store Name", "Staff Name", "Amount (IN)", "Remarks"];
      rows = filteredRetailerLedger.map((c, i) => {
        const dt = formatDateDisplay(c.created_at);
        return [
          i + 1,
          dt.date,
          dt.time,
          `"${(c.retailer_name || '').replace(/"/g, '""')}"`,
          `"${(c.store_name || 'Cash').replace(/"/g, '""')}"`,
          `"${getStaffName(c).replace(/"/g, '""')}"`,
          Number(c.total_amount || 0),
          `"${(c.remarks || '').replace(/"/g, '""')}"`
        ];
      });
    } else if (reportType === "portal_ledger") {
      headers = ["No", "Date", "Time", "Portal / Bank", "Deposit Type", "Target Name", "Staff Name", "Amount (OUT)", "Remarks"];
      rows = filteredPortalLedger.map((d, i) => {
        const dt = formatDateDisplay(d.created_at);
        return [
          i + 1,
          dt.date,
          dt.time,
          `"${(d.portal_name || 'Portal').replace(/"/g, '""')}"`,
          `"${(d.deposit_type || '').replace(/"/g, '""')}"`,
          `"${(d.target_name || 'Recipient').replace(/"/g, '""')}"`,
          `"${getStaffName(d).replace(/"/g, '""')}"`,
          Number(d.amount || 0),
          `"${(d.remarks || '').replace(/"/g, '""')}"`
        ];
      });
    } else if (reportType === "staff_efficiency") {
      headers = ["No", "Staff Name", "Collections Count", "Total Collected (IN)", "Deposits Count", "Total Deposited (OUT)", "Net Pending Handover"];
      rows = staffEfficiencyData.map((s, i) => [
        i + 1,
        `"${s.staffName.replace(/"/g, '""')}"`,
        s.collectionsCount,
        s.collectionsTotal,
        s.depositsCount,
        s.depositsTotal,
        s.collectionsTotal - s.depositsTotal
      ]);
    }

    if (rows.length === 0) {
      alert("No data available for export.");
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPdfReport = () => {
    setIsDownloadingPdf(true);
    const filename = `${selectedReport}_${dateFrom}_to_${dateTo}.pdf`;
    downloadElementAsPdf("report-export-content", filename, 0.3)
      .catch((err) => {
        console.error("PDF Download error, opening print dialog:", err);
        window.print();
      })
      .finally(() => setIsDownloadingPdf(false));
  };

  // Overview stats
  const totalCollected = collections.reduce((sum, c) => sum + Number(c.total_amount || c.totalAmount || 0), 0);
  const activeRetailers = new Set(collections.map(c => c.retailer_name || c.retailerName)).size;
  const avgValue = collections.length > 0 ? (totalCollected / collections.length) : 0;

  const reportSections = [
    {
      title: "Accounting & GST",
      reports: [
        { name: "GSTR-1 (Sales/Cash In)", icon: Receipt, formats: "XLSX • CSV", color: "blue", type: "collections" },
        { name: "GSTR-3B Summary", icon: FileSpreadsheet, formats: "PDF • XLSX", color: "blue" },
        { name: "Tally Friendly Import (XML)", icon: Book, formats: "XML • CSV", color: "blue" },
      ]
    },
    {
      title: "Daily Statements",
      reports: [
        { name: "Daybook Summary", icon: Calendar, formats: "PDF", color: "emerald", type: "daybook" },
        { name: "Cashbook (Physical Flow)", icon: IndianRupee, formats: "PDF • XLSX", color: "emerald", type: "cashbook" },
        { name: "Staff Collection Efficiency", icon: Activity, formats: "PDF • XLSX", color: "emerald", type: "staff_efficiency" },
      ]
    },
    {
      title: "Retailer & Portals",
      reports: [
        { name: "Retailer Ledger (A-Z)", icon: FileText, formats: "PDF • XLSX", color: "purple", type: "retailer_ledger" },
        { name: "Portal Ledger", icon: PieChart, formats: "PDF • XLSX", color: "purple", type: "portal_ledger" },
      ]
    }
  ];

  // If a report is selected, render the dedicated Filter & Report Viewer!
  if (selectedReport) {
    let reportTitle = "Report View";
    if (selectedReport === "retailer_ledger") reportTitle = "Retailer Ledger Report (A-Z)";
    if (selectedReport === "portal_ledger") reportTitle = "Portal Ledger Report";
    if (selectedReport === "staff_efficiency") reportTitle = "Staff Collection Efficiency Report";

    return (
      <div className="space-y-4 pb-20">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedReport(null)}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-sm cursor-pointer transition-colors"
              title="Back to Reports Overview"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{reportTitle}</h2>
              <p className="text-[10px] text-slate-400 font-bold">Interactive data filter & statement generator</p>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportCsv(selectedReport)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[11px] font-bold cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel (CSV)</span>
            </button>
            <button
              onClick={handleDownloadPdfReport}
              disabled={isDownloadingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm text-[11px] font-bold disabled:opacity-50 cursor-pointer transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? "Downloading..." : "Download PDF"}</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3.5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* SEARCH */}
            <div>
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Search</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input autoComplete="one-time-code"
                  type="text"
                  placeholder="Search party or staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm pl-8 pr-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            {/* FILTER BY RETAILER/PARTY */}
            <div>
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Filter by Retailer/Party</label>
              <select
                value={selectedRetailerId}
                onChange={(e) => setSelectedRetailerId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Parties / Retailers</option>
                {retailerOptions.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* FILTER BY PORTAL/BANK */}
            <div>
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Filter by Portal/Bank</label>
              <select
                value={selectedPortalId}
                onChange={(e) => setSelectedPortalId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Portals</option>
                {portalOptions.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* STAFF */}
            <div>
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Staff</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Staff</option>
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* DATE FROM */}
            <div>
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Date From</label>
              <input autoComplete="one-time-code"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              />
            </div>

            {/* DATE TO */}
            <div>
              <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Date To</label>
              <input autoComplete="one-time-code"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Exportable Report Content Section */}
        <div id="report-export-content" className="bg-white text-black p-3 rounded-sm border border-slate-200 space-y-3 font-sans">
          
          {/* Top Banner Header */}
          <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-cyan-400 via-sky-400 to-blue-500 opacity-90 transform skew-x-12 origin-top-right -mr-3" />
            <div className="relative p-2.5 pr-28 z-10">
              <h2 className="text-sm font-black tracking-tight leading-none text-sky-900">{reportTitle}</h2>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-slate-50/50 py-1.5 text-center relative z-10">
              <span className="text-[9px] font-black text-slate-950 uppercase tracking-widest">
                Statement Period - {dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`}
              </span>
            </div>
          </div>

          {/* RETAILER LEDGER VIEW */}
          {selectedReport === "retailer_ledger" && (() => {
            const totalIn = filteredRetailerLedger.reduce((sum, c) => sum + Number(c.total_amount || c.totalAmount || 0), 0);
            const uniqueRetCount = new Set(filteredRetailerLedger.map(c => c.retailer_name)).size;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-3 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Retailers</span>
                    <span className="text-xs font-black text-slate-900 mt-0.5">{uniqueRetCount} Active</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Total Entries</span>
                    <span className="text-xs font-black text-slate-900 mt-0.5">{filteredRetailerLedger.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Total Collected (IN)</span>
                    <span className="text-xs font-black text-emerald-600 mt-0.5 font-mono">₹{totalIn.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                  {filteredRetailerLedger.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No retailer collection records found matching the filters.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[5%] text-[9px] uppercase">No</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[13%] text-[9px] uppercase">Date</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[25%] text-[9px] uppercase">Retailer</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[9px] uppercase">Store</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[15%] text-[9px] uppercase">Staff</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[14%] text-[9px] uppercase">Amount (IN)</th>
                          <th className="py-2 px-1 text-center w-[10%] text-[9px] uppercase">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredRetailerLedger.map((c, idx) => {
                          const dt = formatDateDisplay(c.created_at);
                          return (
                            <tr key={c.id || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center font-bold text-slate-800 text-[9.5px]">{idx + 1}</td>
                              <td className="py-2 px-0.5 text-center text-[9px] leading-tight font-semibold text-slate-700">
                                <div>{dt.date}</div>
                                <div className="text-slate-400 font-mono mt-0.5">{dt.time}</div>
                              </td>
                              <td className="py-2 px-1 text-center font-bold text-slate-900 text-[9.5px]">{c.retailer_name || "Retailer"}</td>
                              <td className="py-2 px-1 text-center font-semibold text-indigo-600 text-[9px]">{c.store_name || "Cash"}</td>
                              <td className="py-2 px-1 text-center font-bold text-slate-700 text-[9px] uppercase">{getStaffName(c)}</td>
                              <td className="py-2 px-0.5 text-center font-extrabold text-emerald-600 text-[9.5px] font-mono">₹{Number(c.total_amount || 0).toLocaleString("en-IN")}</td>
                              <td className="py-2 px-1 text-center text-slate-500 italic text-[8.5px]">{c.remarks || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* PORTAL LEDGER VIEW */}
          {selectedReport === "portal_ledger" && (() => {
            const totalOut = filteredPortalLedger.reduce((sum, d) => sum + Number(d.amount || 0), 0);
            const uniquePortalsCount = new Set(filteredPortalLedger.map(d => d.portal_name)).size;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-3 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Portals</span>
                    <span className="text-xs font-black text-slate-900 mt-0.5">{uniquePortalsCount} Active</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Total Entries</span>
                    <span className="text-xs font-black text-slate-900 mt-0.5">{filteredPortalLedger.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Total Deposited (OUT)</span>
                    <span className="text-xs font-black text-red-500 mt-0.5 font-mono">₹{totalOut.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                  {filteredPortalLedger.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No portal deposit records found matching the filters.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[5%] text-[9px] uppercase">No</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[13%] text-[9px] uppercase">Date</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[22%] text-[9px] uppercase">Portal / Bank</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[15%] text-[9px] uppercase">Deposit Type</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[9px] uppercase">Target Name</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[13%] text-[9px] uppercase">Staff</th>
                          <th className="py-2 px-0.5 text-center w-[14%] text-[9px] uppercase">Amount (OUT)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredPortalLedger.map((d, idx) => {
                          const dt = formatDateDisplay(d.created_at);
                          return (
                            <tr key={d.id || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center font-bold text-slate-800 text-[9.5px]">{idx + 1}</td>
                              <td className="py-2 px-0.5 text-center text-[9px] leading-tight font-semibold text-slate-700">
                                <div>{dt.date}</div>
                                <div className="text-slate-400 font-mono mt-0.5">{dt.time}</div>
                              </td>
                              <td className="py-2 px-1 text-center font-bold text-slate-900 text-[9.5px]">{d.portal_name || "Portal"}</td>
                              <td className="py-2 px-1 text-center font-semibold text-slate-600 text-[9px] uppercase">{d.deposit_type || "portal"}</td>
                              <td className="py-2 px-1 text-center font-semibold text-indigo-600 text-[9px]">{d.target_name || "-"}</td>
                              <td className="py-2 px-1 text-center font-bold text-slate-700 text-[9px] uppercase">{getStaffName(d)}</td>
                              <td className="py-2 px-0.5 text-center font-extrabold text-red-500 text-[9.5px] font-mono">-₹{Number(d.amount || 0).toLocaleString("en-IN")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* STAFF COLLECTION EFFICIENCY VIEW */}
          {selectedReport === "staff_efficiency" && (() => {
            const grandCollected = staffEfficiencyData.reduce((sum, s) => sum + s.collectionsTotal, 0);
            const grandDeposited = staffEfficiencyData.reduce((sum, s) => sum + s.depositsTotal, 0);
            const grandNetPending = grandCollected - grandDeposited;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Active Staff</span>
                    <span className="text-xs font-black text-slate-900 mt-0.5">{staffEfficiencyData.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Total Collected (IN)</span>
                    <span className="text-xs font-black text-emerald-600 mt-0.5 font-mono">₹{grandCollected.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Total Handed Over (OUT)</span>
                    <span className="text-xs font-black text-red-500 mt-0.5 font-mono">₹{grandDeposited.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Net Pending Cash</span>
                    <span className={`text-xs font-black mt-0.5 font-mono ${grandNetPending > 0 ? 'text-amber-600' : 'text-blue-900'}`}>
                      ₹{grandNetPending.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                  {staffEfficiencyData.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No staff activity records found matching the filters.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[6%] text-[9px] uppercase">No</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[24%] text-[9px] uppercase">Staff Name</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[9px] uppercase">Collections Count</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[9px] uppercase">Total Collected (IN)</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[16%] text-[9px] uppercase">Total Deposited</th>
                          <th className="py-2 px-1 text-center w-[18%] text-[9px] uppercase">Net Pending Cash</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {staffEfficiencyData.map((s, idx) => {
                          const net = s.collectionsTotal - s.depositsTotal;
                          return (
                            <tr key={s.staffId || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center font-bold text-slate-800 text-[9.5px]">{idx + 1}</td>
                              <td className="py-2 px-1 text-center font-black text-slate-900 text-[10px] uppercase">{s.staffName}</td>
                              <td className="py-2 px-1 text-center font-semibold text-slate-700 text-[9.5px]">{s.collectionsCount} trips</td>
                              <td className="py-2 px-1 text-center font-extrabold text-emerald-600 text-[10px] font-mono">₹{s.collectionsTotal.toLocaleString("en-IN")}</td>
                              <td className="py-2 px-1 text-center font-extrabold text-red-500 text-[10px] font-mono">₹{s.depositsTotal.toLocaleString("en-IN")}</td>
                              <td className={`py-2 px-1 text-center font-black text-[10px] font-mono ${net > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                                ₹{net.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    );
  }

  // DEFAULT VIEW: Professional Report Cards List
  return (
    <div className="space-y-3 pb-20">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-sm">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-sm uppercase tracking-tighter">Live Cash In</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Total Cash In</p>
          <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono tabular-nums">
            ₹{totalCollected.toLocaleString()}
          </h3>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-sm">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-sm uppercase tracking-tighter">Coverage</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Serviced Stores</p>
          <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono tabular-nums">
            {activeRetailers}
          </h3>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-sm">
              <BarChart className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-sm uppercase tracking-tighter">ATV</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Avg Cash In/Shop</p>
          <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono tabular-nums">
            ₹{avgValue.toFixed(0)}
          </h3>
        </div>
      </div>

      {/* Professional Report Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reportSections.map((section, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <div className={`w-1 h-3 rounded-sm ${section.title.includes('GST') ? 'bg-blue-500' : section.title.includes('Daily') ? 'bg-emerald-500' : 'bg-purple-500'}`} />
              {section.title}
            </h4>

            <div className="space-y-1.5">
              {section.reports.map((report, rIdx) => (
                <div 
                  key={rIdx} 
                  onClick={() => {
                    if (report.type) {
                      setSelectedReport(report.type);
                    } else {
                      alert("Report generator for " + report.name + " is being prepared.");
                    }
                  }}
                  className="group flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white dark:bg-slate-900 rounded-sm border border-slate-100 dark:border-slate-800 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                      <report.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{report.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{report.formats}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                       e.stopPropagation();
                       if (report.type) {
                         setSelectedReport(report.type);
                       } else {
                         alert("Report generator for " + report.name + " is being prepared.");
                       }
                    }}
                    className={`p-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity ${report.color === 'blue' ? 'bg-blue-600 text-white' : report.color === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
