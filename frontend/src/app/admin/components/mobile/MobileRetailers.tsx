"use client";

import React, { useState } from "react";
import { 
  Search, 
  Plus, 
  Store, 
  MapPin, 
  Phone, 
  ChevronRight,
  MoreVertical,
  Filter
} from "lucide-react";

interface MobileRetailersProps {
  retailerDirectory: any[];
  setShowRetailerDrawer: (show: boolean) => void;
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function MobileRetailers({
  retailerDirectory,
  setShowRetailerDrawer
}: MobileRetailersProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = retailerDirectory.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Retailers</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{retailerDirectory.length} Total Partners</p>
        </div>
        <button 
          onClick={() => setShowRetailerDrawer(true)}
          className="w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-90 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 px-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search retailer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button className="w-14 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-800">
          <Filter className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Retailer Cards */}
      <div className="space-y-4 pb-20">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <Store className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No retailers found</p>
          </div>
        ) : (
          filtered.map((retailer) => (
            <div 
              key={retailer.id}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white truncate max-w-[150px]">{retailer.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                      <MapPin className="w-3 h-3" /> {retailer.location || 'Unknown'}
                    </div>
                  </div>
                </div>
                <button className="p-2 text-slate-300">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Current Balance</p>
                  <p className={`text-sm font-black mt-0.5 ${retailer.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    ₹{Math.abs(retailer.balance || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl flex items-center justify-center">
                   <button className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase">
                     <Phone className="w-3 h-3" /> Call Now
                   </button>
                </div>
              </div>

              <button className="w-full py-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                View Transaction History <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
