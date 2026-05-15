"use client";

import React from "react";
import { TrendingUp, Globe, Calendar, Trash2 } from "lucide-react";
import { api } from "@/app/utils/api";

interface MobileDepositsProps {
  deposits: any[];
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function MobileDeposits({ deposits, showToastNotification, fetchData }: MobileDepositsProps) {
  
  const handleDelete = async (id: string) => {
    if (confirm("Delete this deposit?")) {
      try {
        await api.deleteDeposit(id);
        showToastNotification("Deposit deleted");
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Outgoing Cash</h3>
        <p className="text-[10px] font-black text-red-600 uppercase bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
          {deposits.length} Total
        </p>
      </div>

      <div className="space-y-3">
        {deposits.map((d) => (
          <div key={d.id} className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 text-red-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white">₹{d.amount.toLocaleString()}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Deposited</p>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(d.id)}
                className="p-2 text-red-400 hover:text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 dark:border-slate-800/50">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-300" />
                <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 truncate">
                  {d.portalName}
                </p>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                <p className="text-[10px] font-black text-slate-600 dark:text-slate-300">
                  {new Date(d.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {deposits.length === 0 && (
        <div className="py-20 text-center opacity-40">
          <p className="text-xs font-black uppercase tracking-widest">No Deposits Yet</p>
        </div>
      )}
    </div>
  );
}
