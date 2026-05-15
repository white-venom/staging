"use client";

import React from "react";
import { X, Calendar, User, Filter, CheckCircle2, Clock } from "lucide-react";

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: string[];
  filters: {
    dateFrom: string;
    dateTo: string;
    staff: string;
    status: string;
    type: string;
  };
  setFilters: (filters: any) => void;
}

export default function MobileFilterDrawer({
  isOpen,
  onClose,
  staffList,
  filters,
  setFilters
}: MobileFilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-300 ease-out border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Refine Results</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Apply Filters to Ledger</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto max-h-[60vh] pb-6 px-1">
          {/* Staff Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <User className="w-3 h-3" /> Select Staff
            </label>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setFilters({ ...filters, staff: 'all' })}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filters.staff === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
              >
                All Staff
              </button>
              {staffList.map(staff => (
                <button 
                  key={staff}
                  onClick={() => setFilters({ ...filters, staff })}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filters.staff === staff ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                >
                  {staff}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Date Range
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">From</p>
                <input 
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="bg-transparent border-none p-0 text-sm font-bold w-full outline-none dark:text-white"
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">To</p>
                <input 
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="bg-transparent border-none p-0 text-sm font-bold w-full outline-none dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" /> Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setFilters({ ...filters, status: 'verified' })}
                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${filters.status === 'verified' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase">Verified</span>
              </button>
              <button 
                onClick={() => setFilters({ ...filters, status: 'pending' })}
                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${filters.status === 'pending' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}
              >
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase">Pending</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => {
              setFilters({
                dateFrom: '',
                dateTo: '',
                staff: 'all',
                status: 'all',
                type: 'all'
              });
              onClose();
            }}
            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-[10px] font-black uppercase text-slate-500 tracking-widest active:scale-95 transition-transform"
          >
            Reset All
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-blue-600 rounded-2xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
