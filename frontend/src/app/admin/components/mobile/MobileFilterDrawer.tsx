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
        className="absolute inset-0 bg-slate-955/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-lg p-3 shadow-2xl animate-in fade-in duration-150 border-t border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">Advanced Filters</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Filter Ledger History</p>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-805 rounded-full flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 overflow-y-auto pb-4 px-0.5 scrollbar-hide">
          {/* 1. Party Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
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
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
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
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Transaction Type
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {['all', 'collection', 'deposit'].map(type => (
                <button 
                  key={type}
                  onClick={() => setFilters({ ...filters, type })}
                  className={`py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${filters.type === type ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-805 text-slate-500'}`}
                >
                  {type === 'all' ? 'All' : type === 'collection' ? 'Cash In' : 'Cash Out'}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Staff Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
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

          {/* 5. Date Range */}
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Date Range
            </label>
            <div className="flex flex-col gap-1.5">
              <InlineDatePicker
                label="From"
                value={filters.dateFrom}
                onChange={(val) => setFilters({ ...filters, dateFrom: val })}
                type="from"
              />
              <InlineDatePicker
                label="To"
                value={filters.dateTo}
                onChange={(val) => setFilters({ ...filters, dateTo: val })}
                type="to"
              />
            </div>
          </div>

          {/* 6. Sorting */}
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
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

        {/* Footer Actions */}
        <div className="mt-auto pt-3 flex gap-2 shrink-0 border-t border-slate-100 dark:border-slate-800">
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
            className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] font-bold uppercase text-slate-500 tracking-wider cursor-pointer"
          >
            Reset
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-1.5 bg-blue-600 rounded-lg text-[9px] font-bold uppercase text-white tracking-wider shadow-sm active:scale-95 transition-transform cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
