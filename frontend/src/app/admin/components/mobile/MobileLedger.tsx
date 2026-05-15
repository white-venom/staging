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
  const { collections, deposits } = useAdmin();
  const [search, setSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    staff: 'all',
    status: 'all',
    type: 'all'
  });

  // Get unique staff list for filter
  const staffList = useMemo(() => {
    return Array.from(new Set([
      ...(collections || []).map(c => c.staff_name),
      ...(deposits || []).map(d => d.staff_name)
    ].filter(Boolean))).sort() as string[];
  }, [collections, deposits]);

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

    // Apply Staff Filter
    if (filters.staff !== 'all') {
      combined = combined.filter(tx => tx.staff_name === filters.staff);
    }

    // Apply Status Filter
    if (filters.status !== 'all') {
      combined = combined.filter(tx => tx.status === filters.status);
    }

    // Apply Date Range
    if (filters.dateFrom) {
      combined = combined.filter(tx => format(new Date(tx.created_at), 'yyyy-MM-dd') >= filters.dateFrom);
    }
    if (filters.dateTo) {
      combined = combined.filter(tx => format(new Date(tx.created_at), 'yyyy-MM-dd') <= filters.dateTo);
    }

    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [collections, deposits, search, filters]);

  const handleExportCSV = () => {
    const headers = ["Date", "Party", "Staff", "Type", "Status", "Amount"];
    const rows = filteredLedger.map(tx => [
      format(new Date(tx.created_at), "yyyy-MM-dd HH:mm"),
      tx.retailer_name || tx.portal_name || 'N/A',
      tx.staff_name || 'Admin',
      tx.type,
      tx.status,
      tx.amount
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
            onChange={(e) => setSearch(setSearch(e.target.value))}
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

      {/* Transaction List */}
      <div className="space-y-4 pb-20">
        {filteredLedger.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <History className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching records</p>
          </div>
        ) : (
          filteredLedger.map((item: any, idx) => (
            <div 
              key={idx} 
              className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    item.type === 'collection' 
                      ? "bg-blue-50 text-blue-600" 
                      : "bg-red-50 text-red-600"
                  }`}>
                    {item.type === 'collection' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white truncate max-w-[160px]">
                      {item.retailer_name || item.portal_name || 'General Entry'}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${item.type === 'collection' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {item.type === 'collection' ? 'Cash In' : 'Cash Out'}
                      </p>
                      <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'verified' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.status}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${item.type === 'collection' ? "text-blue-600" : "text-red-600"}`}>
                    {item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800/50">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <User className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{item.staff_name || 'Admin'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {format(new Date(item.created_at), "MMM d, yyyy • HH:mm")}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter Drawer */}
      <MobileFilterDrawer 
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        staffList={staffList}
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
