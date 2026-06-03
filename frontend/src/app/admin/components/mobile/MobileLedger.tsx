"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar,
  User,
  History,
  Download,
  FileText,
  Table as TableIcon,
  X
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { format } from "date-fns";
import MobileFilterDrawer from "./MobileFilterDrawer";

export default function MobileLedger() {
  const { collections, deposits, retailerDirectory, portalDirectory } = useAdmin();
  const [search, setSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    staff: 'all',
    type: 'all',
    party: 'all',
    portal: 'all',
    sortBy: 'date-desc'
  });

  // Get unique lists for filters
  const staffList = useMemo(() => {
    return Array.from(new Set([
      ...(collections || []).map(c => c.staff_name),
      ...(deposits || []).map(d => d.staff_name)
    ].filter(Boolean))).sort() as string[];
  }, [collections, deposits]);

  const partyList = useMemo(() => {
    return (retailerDirectory || []).map((r: any) => r.name).sort();
  }, [retailerDirectory]);

  const portalList = useMemo(() => {
    return (portalDirectory || []).map((p: any) => p.name).sort();
  }, [portalDirectory]);

  // Combine and Apply ALL Filters
  const filteredLedger = useMemo(() => {
    let combined = [
      ...(collections || []).map(c => ({ ...c, type: 'collection' })),
      ...(deposits || []).map(d => ({ ...d, type: 'deposit' }))
    ];

    // Apply Search
    if (search) {
      const q = search.toLowerCase();
      combined = combined.filter(tx => 
        (tx.retailer_name || tx.portal_name || tx.staff_name || "").toLowerCase().includes(q)
      );
    }

    // Apply Filters
    if (filters.staff !== 'all') combined = combined.filter(tx => tx.staff_name === filters.staff);
    if (filters.party !== 'all') combined = combined.filter(tx => tx.retailer_name === filters.party);
    if (filters.portal !== 'all') combined = combined.filter(tx => tx.portal_name === filters.portal);
    if (filters.type !== 'all') combined = combined.filter(tx => tx.type === filters.type);

    // Apply Date Range
    if (filters.dateFrom) {
      combined = combined.filter(tx => format(new Date(tx.created_at || tx.date), 'yyyy-MM-dd') >= filters.dateFrom);
    }
    if (filters.dateTo) {
      combined = combined.filter(tx => format(new Date(tx.created_at || tx.date), 'yyyy-MM-dd') <= filters.dateTo);
    }

    // Apply Sorting
    combined.sort((a, b) => {
      if (filters.sortBy === "date-desc") return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
      if (filters.sortBy === "date-asc") return new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime();
      if (filters.sortBy === "amount-desc") return getTxAmount(b) - getTxAmount(a);
      if (filters.sortBy === "amount-asc") return getTxAmount(a) - getTxAmount(b);
      return 0;
    });

    return combined;
  }, [collections, deposits, search, filters]);

  // Helper: get display amount regardless of field name
  const getTxAmount = (tx: any) => tx.totalAmount ?? tx.amount ?? 0;

  const handleExportCSV = () => {
    const headers = ["Date", "Party", "Staff", "Type", "Amount"];
    const rows = filteredLedger.map(tx => [
      format(new Date(tx.created_at || tx.date), "yyyy-MM-dd HH:mm"),
      tx.retailer_name || tx.portal_name || 'N/A',
      tx.staff_name || 'Admin',
      tx.type,
      getTxAmount(tx)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Ledger_Export_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.click();
    setIsExportOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Unified Ledger</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredLedger.length} Records Found</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsExportOpen(true)}
            className="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 shadow-sm active:scale-90 transition-transform"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-2 px-2">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button 
          onClick={() => setIsFilterOpen(true)}
          className={`p-4 rounded-2xl border transition-all active:scale-90 ${isFilterOpen ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Transaction List (Table Format) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm mb-20">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse min-w-[550px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-tight text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 border-r border-slate-100 dark:border-slate-800 w-28">Date & Time</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800">Party</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800 text-center w-20">Type</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800 text-right w-24 bg-slate-100/50 dark:bg-slate-800/50">Amount</th>
                <th className="p-4 text-right bg-blue-50/20 dark:bg-blue-950/5 w-24">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLedger.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-400 italic font-bold">No matching records</td></tr>
              ) : filteredLedger.map((item: any, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800 font-bold text-slate-400">
                    <div className="flex flex-col">
                      <span className="whitespace-nowrap">{format(new Date(item.created_at || item.date), "dd-MM-yyyy")}</span>
                      <span className="text-[9px] font-medium opacity-60">
                        {format(new Date(item.created_at || item.date), "HH:mm")}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800">
                    <span className="font-extrabold text-slate-850 dark:text-slate-100 uppercase truncate block">
                      {item.retailer_name || item.portal_name || 'General Entry'}
                    </span>
                  </td>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800 text-center">
                     <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${item.type === 'collection' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {item.type === 'collection' ? 'Cash In' : 'Cash Out'}
                     </span>
                  </td>
                  <td className={`p-4 border-r border-slate-50 dark:border-slate-800 text-right font-black ${item.type === 'collection' ? 'text-emerald-700 bg-emerald-50/10' : 'text-red-700 bg-red-50/10'}`}>
                    {item.type === 'collection' ? '+' : '-'}₹{getTxAmount(item).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-bold text-slate-500 uppercase text-[9px]">
                    {item.staff_name || 'Admin'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Drawer */}
      <MobileFilterDrawer 
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        staffList={staffList}
        partyList={partyList}
        portalList={portalList}
        filters={filters}
        setFilters={setFilters}
      />

      {/* Export Options Bottom Sheet */}
      {isExportOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm" onClick={() => setIsExportOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Export Ledger</h3>
                <button onClick={() => setIsExportOpen(false)} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <button 
                 onClick={handleExportCSV}
                 className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center gap-3 border border-slate-100 dark:border-slate-700 active:scale-95 transition-transform"
               >
                 <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center"><TableIcon className="w-6 h-6" /></div>
                 <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Excel Format</span>
               </button>
               <button 
                 onClick={() => { window.print(); setIsExportOpen(false); }}
                 className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center gap-3 border border-slate-100 dark:border-slate-700 active:scale-95 transition-transform"
               >
                 <div className="w-12 h-12 bg-red-500/10 text-red-600 rounded-2xl flex items-center justify-center"><FileText className="w-6 h-6" /></div>
                 <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">PDF Document</span>
               </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
