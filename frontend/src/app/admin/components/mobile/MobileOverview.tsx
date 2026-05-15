"use client";

import React, { useMemo } from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Users, 
  TrendingUp,
  Plus,
  ArrowRight
} from "lucide-react";
import { format, subDays, isSameDay } from "date-fns";

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
  collections,
  deposits,
  totalCollectedAmount,
  totalDepositedAmount,
  netCashBalance,
  totalToTake,
  totalToGive,
  todayCount
}: MobileOverviewProps) {
  
  // Calculate 7-day trend data
  const trendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
    
    return last7Days.map(day => {
      const dayCollections = collections
        .filter(c => isSameDay(new Date(c.created_at), day))
        .reduce((sum, c) => sum + (c.amount || 0), 0);
        
      const dayDeposits = deposits
        .filter(d => isSameDay(new Date(d.created_at), day))
        .reduce((sum, d) => sum + (d.amount || 0), 0);
        
      return {
        label: format(day, "EEE"),
        net: dayCollections - dayDeposits,
        date: format(day, "MMM d")
      };
    });
  }, [collections, deposits]);

  const maxNet = Math.max(...trendData.map(d => Math.abs(d.net)), 1000);

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

      {/* 7-Day Pulse (Dynamic Trend) */}
      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">7-Day Cash Pulse</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Daily Net Flow</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/10 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
            Live
          </div>
        </div>

        <div className="flex items-end justify-between h-32 gap-2 px-1">
          {trendData.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
              {/* Tooltip on hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                ₹{day.net.toLocaleString()}
              </div>
              
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-t-lg relative overflow-hidden h-24">
                <div 
                  className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out ${day.net >= 0 ? 'bg-blue-500' : 'bg-red-400'}`}
                  style={{ height: `${Math.max((Math.abs(day.net) / maxNet) * 100, 5)}%` }}
                />
              </div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{day.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
          <div className="w-10 h-10 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Take</p>
            <p className="text-lg font-black text-red-500 mt-1">₹{totalToTake.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Give</p>
            <p className="text-lg font-black text-emerald-500 mt-1">₹{totalToGive.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4 p-5 border-b border-slate-50 dark:border-slate-800/50">
          <div className="w-12 h-12 bg-orange-500/10 text-orange-600 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-white">{todayCount} Collections</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Received so far today</p>
          </div>
          <ArrowRight className="ml-auto w-4 h-4 text-slate-300" />
        </div>
        <div className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 bg-purple-500/10 text-purple-600 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-white">Active Staff</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Pulse of your team</p>
          </div>
          <ArrowRight className="ml-auto w-4 h-4 text-slate-300" />
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-2xl flex items-center justify-center z-50 active:scale-90 transition-transform">
        <Plus className="w-7 h-7" />
      </button>

      <div className="h-4" />
    </div>
  );
}
