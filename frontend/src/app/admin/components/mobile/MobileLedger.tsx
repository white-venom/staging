"use client";

import React, { useState } from "react";
import { Search, User, Globe, ChevronRight, Filter } from "lucide-react";
import { useAdmin } from "../../context/AdminContext";

export default function MobileLedger() {
  const { retailerDirectory, portalDirectory } = useAdmin();
  const [activeTab, setActiveTab] = useState<"retailers" | "portals">("retailers");
  const [search, setSearch] = useState("");

  const data = activeTab === "retailers" ? retailerDirectory : portalDirectory;
  const filteredData = (data || []).filter((item: any) => 
    (item.retailer_name || item.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <button className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-500">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Segmented Control Toggle */}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-[1.5rem] flex items-center">
        <button 
          onClick={() => setActiveTab("retailers")}
          className={`flex-1 py-2.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "retailers" 
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" 
              : "text-slate-500"
          }`}
        >
          Retailers
        </button>
        <button 
          onClick={() => setActiveTab("portals")}
          className={`flex-1 py-2.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "portals" 
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" 
              : "text-slate-500"
          }`}
        >
          Portals
        </button>
      </div>

      {/* Ledger Cards List */}
      <div className="space-y-3">
        {filteredData.map((item: any) => (
          <div 
            key={item.id} 
            className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              activeTab === "retailers" 
                ? "bg-blue-500/10 text-blue-600" 
                : "bg-purple-500/10 text-purple-600"
            }`}>
              {activeTab === "retailers" ? <User className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
            </div>
            
            <div className="flex-1">
              <h4 className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[150px]">
                {item.retailer_name || item.name}
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                {activeTab === "retailers" ? item.phone || "No Phone" : "Portal Group"}
              </p>
            </div>

            <div className="text-right">
              <p className={`text-sm font-black ${item.balance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                ₹{Math.abs(item.balance).toLocaleString()}
              </p>
              <p className="text-[10px] font-black uppercase tracking-tighter opacity-40">
                {item.balance >= 0 ? "To Give" : "To Take"}
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-200 ml-1" />
          </div>
        ))}

        {filteredData.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No entries found</p>
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}
