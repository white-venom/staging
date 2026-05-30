"use client";

import React from "react";
import { X, Calendar, User, Filter, Globe, Store, ArrowUpDown, Tag } from "lucide-react";
import InlineSelect from "../../../../app/components/InlineSelect";
import InlineDatePicker from "../../../../app/components/InlineDatePicker";

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
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-8 shadow-2xl animate-in fade-in duration-200 border-t border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
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
            <InlineSelect
              value={filters.party}
              onChange={(val) => setFilters({ ...filters, party: val })}
              options={[
                { value: "all", label: "All Parties" },
                ...partyList.map(p => ({ value: p, label: p }))
              ]}
              placeholder="All Parties"
            />
          </div>

          {/* 2. Portal Filter */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Globe className="w-3 h-3" /> Portal Group
            </label>
            <InlineSelect
              value={filters.portal}
              onChange={(val) => setFilters({ ...filters, portal: val })}
              options={[
                { value: "all", label: "All Portals" },
                ...portalList.map(p => ({ value: p, label: p }))
              ]}
              placeholder="All Portals"
            />
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
            <InlineSelect
              value={filters.staff}
              onChange={(val) => setFilters({ ...filters, staff: val })}
              options={[
                { value: "all", label: "All Staff" },
                ...staffList.map(s => ({ value: s, label: s }))
              ]}
              placeholder="All Staff"
            />
          </div>

          {/* 5. Date Range — Custom inline Year → Month → Day picker */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Date Range
            </label>
            <div className="flex flex-col gap-3">
              <InlineDatePicker
                label="From"
                value={filters.dateFrom}
                onChange={(val) => setFilters({ ...filters, dateFrom: val })}
              />
              <InlineDatePicker
                label="To"
                value={filters.dateTo}
                onChange={(val) => setFilters({ ...filters, dateTo: val })}
              />
            </div>
          </div>

          {/* 6. Sorting */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <ArrowUpDown className="w-3 h-3" /> Sort Results
            </label>
            <InlineSelect
              value={filters.sortBy}
              onChange={(val) => setFilters({ ...filters, sortBy: val })}
              options={[
                { value: "date-desc", label: "Newest First" },
                { value: "date-asc", label: "Oldest First" },
                { value: "amount-desc", label: "Amount: High to Low" },
                { value: "amount-asc", label: "Amount: Low to High" }
              ]}
              placeholder="Sort Results"
            />
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
