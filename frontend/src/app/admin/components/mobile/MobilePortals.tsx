"use client";

import React, { useState } from "react";
import { 
  Search, 
  Plus, 
  Globe, 
  ChevronRight,
  MoreVertical,
  Layers,
  CreditCard
} from "lucide-react";

interface MobilePortalsProps {
  portalDirectory: any[];
  showToastNotification: (msg: string) => void;
  setShowPortalDrawer: (show: boolean) => void;
  fetchData: () => void;
}

export default function MobilePortals({
  portalDirectory,
  setShowPortalDrawer
}: MobilePortalsProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = portalDirectory.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Portals</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{portalDirectory.length} Groups Active</p>
        </div>
        <button 
          onClick={() => setShowPortalDrawer(true)}
          className="w-12 h-12 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-500/30 flex items-center justify-center active:scale-90 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search portal groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>

      {/* Portal Group Cards */}
      <div className="space-y-4 pb-20">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <Globe className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No portals found</p>
          </div>
        ) : (
          filtered.map((group) => (
            <div 
              key={group.id}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">{group.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(group.portals || []).length} Sub-Portals</p>
                  </div>
                </div>
                <button className="p-2 text-slate-300">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-portals List */}
              <div className="space-y-3">
                {(group.portals || []).slice(0, 3).map((portal: any) => (
                  <div key={portal.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 dark:text-white">{portal.name}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">ID: {portal.id.slice(0,8)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-black ${portal.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ₹{(portal.balance || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full mt-4 py-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-purple-600 tracking-widest active:scale-95 transition-transform">
                Manage Group <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
