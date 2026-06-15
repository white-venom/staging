"use client";

import React from "react";
import { ClipboardList, User, Calendar, Trash2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { api } from "@/app/utils/api";

interface MobileCollectionsProps {
  collections: any[];
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function MobileCollections({ collections, showToastNotification, fetchData }: MobileCollectionsProps) {
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = useState<Record<string, boolean>>({});
  
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
                  {c.date ? c.date.split(" ")[0].split("-").reverse().join("-") : ""}
                </p>
              </div>
            </div>
            
            <div className="mt-1.5 flex flex-col gap-1">
               <div className="flex items-center gap-1">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate">
                   {c.retailerName?.toLowerCase().startsWith("cms") 
                     ? `${c.retailerName} - ${c.store_name || "Cash"}` 
                     : c.retailerName}
                 </p>
                 {c.retailerName?.toLowerCase().startsWith("cms") && (
                   <button
                     onClick={() => setCmsRemarksExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                     className="p-0.5 bg-slate-50 dark:bg-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                     title="View Remark"
                   >
                     <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[c.id] ? 'rotate-180 text-indigo-500' : ''}`} />
                   </button>
                 )}
               </div>
               {c.retailerName?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[c.id] && (
                 <div className="p-1.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-200/50 dark:border-slate-800 text-[8px] font-medium text-slate-600 dark:text-slate-400">
                   <span className="text-[7px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                   <span className="italic">{c.remarks || "no remark"}</span>
                 </div>
               )}
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
