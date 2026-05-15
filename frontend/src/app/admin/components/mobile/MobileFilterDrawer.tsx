"use client";

import React from "react";
import { X, Calendar, User, Filter, Globe, Store, ArrowUpDown, Tag } from "lucide-react";

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: string[];
  partyList: string[];
  portalList: string[];
  filters: {
    dateFrom: string;
    dateTo: string;
    staff: string;
    type: string;
    party: string;
    portal: string;
    sortBy: string;
  };
  setFilters: (filters: any) => void;
}

export default function MobileFilterDrawer({
  isOpen,
  onClose,
  staffList,
  partyList,
  portalList,
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
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-300 ease-out border-t border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Advanced Filters</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Desktop-Grade Refinement</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8 overflow-y-auto pb-10 px-1 scrollbar-hide">
          {/* 1. Party Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Store className="w-3 h-3" /> Retailer / Bank
            </label>
            <select 
              value={filters.party}
              onChange={(e) => setFilters({ ...filters, party: e.target.value })}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Parties</option>
              {partyList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* 2. Portal Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Globe className="w-3 h-3" /> Portal Group
            </label>
            <select 
              value={filters.portal}
              onChange={(e) => setFilters({ ...filters, portal: e.target.value })}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Portals</option>
              {portalList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* 3. Transaction Type */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Tag className="w-3 h-3" /> Transaction Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['all', 'collection', 'deposit'].map(type => (
                <button 
                  key={type}
                  onClick={() => setFilters({ ...filters, type })}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${filters.type === type ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                >
                  {type === 'all' ? 'All' : type === 'collection' ? 'Cash In' : 'Cash Out'}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Staff Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <User className="w-3 h-3" /> Staff Member
            </label>
            <select 
              value={filters.staff}
              onChange={(e) => setFilters({ ...filters, staff: e.target.value })}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Staff</option>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 5. Date Range */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                <p className="text-[7px] font-black text-slate-400 uppercase mb-1">From</p>
                <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="bg-transparent border-none p-0 text-xs font-bold w-full outline-none dark:text-white" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                <p className="text-[7px] font-black text-slate-400 uppercase mb-1">To</p>
                <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="bg-transparent border-none p-0 text-xs font-bold w-full outline-none dark:text-white" />
              </div>
            </div>
          </div>

          {/* 6. Sorting */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <ArrowUpDown className="w-3 h-3" /> Sort Results
            </label>
            <select 
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>
        </div>

        <div className="mt-auto pt-6 flex gap-3 shrink-0">
          <button 
            onClick={() => {
              setFilters({
                dateFrom: '',
                dateTo: '',
                staff: 'all',
                type: 'all',
                party: 'all',
                portal: 'all',
                sortBy: 'date-desc'
              });
              onClose();
            }}
            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-[10px] font-black uppercase text-slate-500 tracking-widest"
          >
            Reset
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-blue-600 rounded-2xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
