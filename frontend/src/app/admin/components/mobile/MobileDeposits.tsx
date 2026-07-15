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
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1.5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outgoing Cash</h3>
        <p className="text-[8px] font-black text-red-600 uppercase bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-sm">
          {deposits.length} Total
        </p>
      </div>

      <div className="space-y-1.5">
        {deposits.map((d) => (
          <div key={d.id} className="bg-white dark:bg-slate-900 rounded-sm p-2 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-red-500/10 text-red-600 rounded-sm flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-white font-mono tabular-nums">₹{d.amount.toLocaleString()}</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Deposited</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="p-1 text-red-400 hover:text-red-500 bg-red-50 dark:bg-red-900/10 rounded-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-slate-300" />
                <p className="text-[9px] font-black text-slate-600 dark:text-slate-300 truncate">
                  {d.bankAccountName}
                </p>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <Calendar className="w-3 h-3 text-slate-300" />
                <p className="text-[9px] font-black text-slate-600 dark:text-slate-300">
                  {d.date ? d.date.split(" ")[0].split("-").reverse().join("-") : ""}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {deposits.length === 0 && (
        <div className="py-10 text-center opacity-40">
          <p className="text-[9px] font-black uppercase tracking-widest">No Deposits Yet</p>
        </div>
      )}
    </div>
  );
}
