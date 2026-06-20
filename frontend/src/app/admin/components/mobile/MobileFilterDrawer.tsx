"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Calendar, User, Filter, Globe, Store, ArrowUpDown, Tag } from "lucide-react";
import InlineSelect from "../../../../app/components/InlineSelect";
import InlineDatePicker from "../../../../app/components/InlineDatePicker";
import { api } from "../../../utils/api";

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: string[];
  retailerDirectory: any[];
  portalDirectory: any[];
  filters: {
    dateFrom: string;
    dateTo: string;
    staff: string;
    selectedTypes: string[];
    retailerId: string;
    storeId: string;
    portalGroupId: string;
    portalId: string;
    sortBy: string;
  };
  setFilters: (filters: any) => void;
}

export default function MobileFilterDrawer({
  isOpen,
  onClose,
  staffList,
  retailerDirectory,
  portalDirectory,
  filters,
  setFilters
}: MobileFilterDrawerProps) {
  const [availableFilterStores, setAvailableFilterStores] = useState<any[]>([]);

  useEffect(() => {
    const fetchStores = async () => {
      if (filters.retailerId && filters.retailerId !== 'all') {
        try {
          const stores = await api.getRetailerStores(filters.retailerId);
          setAvailableFilterStores(stores || []);
        } catch (err) {
          console.error("Failed to fetch filter stores:", err);
          setAvailableFilterStores([]);
        }
      } else {
        setAvailableFilterStores([]);
      }
    };
    if (isOpen) {
      fetchStores();
    }
  }, [filters.retailerId, isOpen]);

  const availableFilterBanks = useMemo(() => {
    if (filters.portalGroupId && filters.portalGroupId !== 'all') {
      const group = portalDirectory.find((g: any) => String(g.id) === String(filters.portalGroupId));
      return group?.portals || [];
    }
    return [];
  }, [filters.portalGroupId, portalDirectory]);

  if (!isOpen) return null;

  const getTodayDateString = () => {
    const d = new Date();
    const tzString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const parts = new Date(tzString);
    const y = parts.getFullYear();
    const m = String(parts.getMonth() + 1).padStart(2, "0");
    const day = String(parts.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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
          {/* 1. Retailer Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Store className="w-3 h-3" /> Retailer
            </label>
            <InlineSelect
              value={filters.retailerId}
              onChange={(val) => setFilters({ ...filters, retailerId: val, storeId: "all" })}
              options={[
                { value: "all", label: "All Retailers" },
                ...retailerDirectory.map(r => ({ value: String(r.id), label: r.name }))
              ]}
              placeholder="All Retailers"
            />
          </div>

          {/* 1b. Store Filter (Dynamic) */}
          {filters.retailerId !== "all" && availableFilterStores.length > 0 && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Store className="w-3 h-3" /> Store
              </label>
              <InlineSelect
                value={filters.storeId}
                onChange={(val) => setFilters({ ...filters, storeId: val })}
                options={[
                  { value: "all", label: "All Stores" },
                  ...availableFilterStores.map(s => ({ value: String(s.id), label: s.store_name }))
                ]}
                placeholder="All Stores"
              />
            </div>
          )}

          {/* 2. Portal Filter */}
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> Portal Group
            </label>
            <InlineSelect
              value={filters.portalGroupId}
              onChange={(val) => setFilters({ ...filters, portalGroupId: val, portalId: "all" })}
              options={[
                { value: "all", label: "All Portal Groups" },
                ...portalDirectory.map(g => ({ value: String(g.id), label: g.name }))
              ]}
              placeholder="All Portal Groups"
            />
          </div>

          {/* 2b. Bank/Account Filter (Dynamic) */}
          {filters.portalGroupId !== "all" && availableFilterBanks.length > 0 && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Bank Account / Branch
              </label>
              <InlineSelect
                value={filters.portalId}
                onChange={(val) => setFilters({ ...filters, portalId: val })}
                options={[
                  { value: "all", label: "All Bank Accounts" },
                  ...availableFilterBanks.map((p: any) => {
                    const displayName = p.portal_name + (p.bank_name ? ` (${p.bank_name})` : "");
                    return { value: String(p.id), label: displayName };
                  })
                ]}
                placeholder="All Bank Accounts"
              />
            </div>
          )}

          {/* 3. Transaction Type */}
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Transaction Type
            </label>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {[
                { id: "cash-in", label: "Cash In" },
                { id: "cash-out", label: "Cash Out" },
                { id: "virtual-transfer", label: "Virtual Transfer" },
                { id: "move-to-dist", label: "Move to Distributor" }
              ].map((t) => {
                const isActive = filters.selectedTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const next = filters.selectedTypes.includes(t.id)
                        ? filters.selectedTypes.filter((x: string) => x !== t.id)
                        : [...filters.selectedTypes, t.id];
                      setFilters({ ...filters, selectedTypes: next });
                    }}
                    className={`px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? "bg-blue-100 dark:bg-blue-955/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-bold"
                        : "bg-slate-50 dark:bg-slate-900/40 text-slate-450 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
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
              const today = getTodayDateString();
              setFilters({
                dateFrom: today,
                dateTo: today,
                staff: 'all',
                selectedTypes: ["cash-in", "cash-out", "virtual-transfer", "move-to-dist"],
                retailerId: 'all',
                storeId: 'all',
                portalGroupId: 'all',
                portalId: 'all',
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
