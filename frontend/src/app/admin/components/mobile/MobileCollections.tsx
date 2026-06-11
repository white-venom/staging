"use client";

import React from "react";
import { ClipboardList, User, Calendar, Trash2 } from "lucide-react";
import { api } from "@/app/utils/api";

interface MobileCollectionsProps {
  collections: any[];
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function MobileCollections({ collections, showToastNotification, fetchData }: MobileCollectionsProps) {
  
  const handleDelete = async (id: string) => {
    if (confirm("Delete this collection?")) {
      try {
        await api.deleteCollection(id);
        showToastNotification("Collection deleted");
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1.5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Incoming Cash</h3>
        <p className="text-[8px] font-black text-blue-600 uppercase bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
          {collections.length} Total
        </p>
      </div>

      <div className="space-y-1.5">
        {collections.map((c) => (
          <div key={c.id} className="bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800 shadow-xs relative overflow-hidden group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-500/10 text-emerald-600 rounded-md flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-white">₹{c.totalAmount.toLocaleString()}</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Received</p>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(c.id)}
                className="p-1 text-red-400 hover:text-red-500 bg-red-50 dark:bg-red-900/10 rounded-md transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-50 dark:border-slate-800/50">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-slate-300" />
                <p className="text-[9px] font-black text-slate-605 dark:text-slate-300 truncate">
                  {c.staffName || "System"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <Calendar className="w-3 h-3 text-slate-300" />
                <p className="text-[9px] font-black text-slate-605 dark:text-slate-300">
                  {new Date(c.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="mt-1.5">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate">
                 {c.retailerName} • {c.area}
               </p>
            </div>
          </div>
        ))}
      </div>
      
      {collections.length === 0 && (
        <div className="py-10 text-center opacity-40">
          <p className="text-[9px] font-black uppercase tracking-widest">No Collections Yet</p>
        </div>
      )}
    </div>
  );
}
