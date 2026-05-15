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
  Download
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { format } from "date-fns";

export default function MobileLedger() {
  const { collections, deposits } = useAdmin();
  const [search, setSearch] = useState("");

  // Combine and sort ALL transactions
  const unifiedLedger = useMemo(() => {
    const combined = [
      ...(collections || []).map(c => ({ ...c, type: 'collection' })),
      ...(deposits || []).map(d => ({ ...d, type: 'deposit' }))
    ];
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [collections, deposits]);

  const filteredLedger = unifiedLedger.filter((item: any) => 
    (item.retailer_name || item.portal_name || item.staff_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search & Export Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Unified Ledger</h2>
        <button className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 px-2">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <button className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-500 shadow-sm">
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
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No transactions found</p>
          </div>
        ) : (
          filteredLedger.map((item: any, idx) => (
            <div 
              key={idx} 
              className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
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
                      <p className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-900/10 px-2 py-0.5 rounded-md">
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

      <div className="h-4" />
    </div>
  );
}
