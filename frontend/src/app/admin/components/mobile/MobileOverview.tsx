"use client";

import React from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Users, 
  Briefcase, 
  ArrowRight,
  TrendingUp,
  Plus
} from "lucide-react";

interface MobileOverviewProps {
  collections: any[];
  deposits: any[];
  totalCollectedAmount: number;
  totalDepositedAmount: number;
  netCashBalance: number;
  totalToTake: number;
  totalToGive: number;
  fetchData: () => void;
  todayCount: number;
}

export default function MobileOverview({
  totalCollectedAmount,
  totalDepositedAmount,
  netCashBalance,
  totalToTake,
  totalToGive,
  todayCount
}: MobileOverviewProps) {
  
  return (
    <div className="space-y-6">
      {/* Premium Summary Card */}
      <div className="relative overflow-hidden bg-slate-900 dark:bg-white rounded-[2.5rem] p-6 text-white dark:text-slate-950 shadow-2xl shadow-blue-500/20">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Wallet className="w-32 h-32 rotate-12" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-widest opacity-60">Net Cash in Hand</p>
          <h2 className="text-4xl font-black mt-1">₹{netCashBalance.toLocaleString()}</h2>
          
          <div className="flex items-center gap-4 mt-6">
            <div className="flex-1 bg-white/10 dark:bg-slate-100 p-3 rounded-2xl backdrop-blur-md">
              <p className="text-[10px] font-black uppercase opacity-60">Cash In</p>
              <p className="text-sm font-black mt-0.5">₹{totalCollectedAmount.toLocaleString()}</p>
            </div>
            <div className="flex-1 bg-white/10 dark:bg-slate-100 p-3 rounded-2xl backdrop-blur-md">
              <p className="text-[10px] font-black uppercase opacity-60">Cash Out</p>
              <p className="text-sm font-black mt-0.5">₹{totalDepositedAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
          <div className="w-10 h-10 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total to Take</p>
            <p className="text-lg font-black text-red-500 mt-1">₹{totalToTake.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total to Give</p>
            <p className="text-lg font-black text-emerald-500 mt-1">₹{totalToGive.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Today's Activity Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">Today's Pulse</h3>
          <button className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
            Real-time <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-2 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 p-4 border-b border-slate-50 dark:border-slate-800/50">
            <div className="w-12 h-12 bg-orange-500/10 text-orange-600 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">{todayCount} Collections</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Received so far today</p>
            </div>
            <div className="ml-auto">
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
          <div className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 bg-purple-500/10 text-purple-600 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">Staff Active</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Tracking 5 members</p>
            </div>
            <div className="ml-auto">
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Button for Mobile */}
      <button className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-2xl flex items-center justify-center z-50 transform transition-transform active:scale-90">
        <Plus className="w-7 h-7" />
      </button>

      <div className="h-4" /> {/* Spacer for bottom nav */}
    </div>
  );
}
