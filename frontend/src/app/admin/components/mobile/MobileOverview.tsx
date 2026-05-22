"use client";

import React, { useMemo } from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  TrendingUp,
  History
} from "lucide-react";
import { format, subDays, isSameDay } from "date-fns";
import Link from "next/link";

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
  totalToGive
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

  // Combine and sort recent transactions using the unified ledger properties
  const recentActivity = useMemo(() => {
    const combined = [
      ...(collections || []).map(c => ({
        id: c.id,
        date: c.date,
        party: c.retailerName,
        staff: c.staffName || "Admin",
        amount: c.totalAmount,
        type: 'collection'
      })),
      ...(deposits || []).map(d => ({
        id: d.id,
        date: d.date,
        party: d.portalGroupName ? `${d.portalGroupName} (${d.targetName})` : d.targetName,
        staff: d.staffName || "Admin",
        amount: d.amount,
        type: 'deposit'
      }))
    ];
    return combined
      .sort((a, b) => new Date(b.date.replace(" ", "T")).getTime() - new Date(a.date.replace(" ", "T")).getTime())
      .slice(0, 10);
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

      {/* 7-Day Pulse */}
      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">Financial Trend</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Last 7 Days Net Flow</p>
          </div>
          <TrendingUp className="w-4 h-4 text-blue-500" />
        </div>

        <div className="flex items-end justify-between h-24 gap-1.5 px-1">
          {trendData.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-t-lg relative overflow-hidden h-16">
                <div 
                  className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out ${day.net >= 0 ? 'bg-blue-500' : 'bg-red-400'}`}
                  style={{ height: `${Math.max((Math.abs(day.net) / maxNet) * 100, 5)}%` }}
                />
              </div>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">{day.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-28">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Take</p>
          <p className="text-lg font-black text-red-500">₹{totalToTake.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-28">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Give</p>
          <p className="text-lg font-black text-emerald-500">₹{totalToGive.toLocaleString()}</p>
        </div>
      </div>

      {/* Recent Activity */}
      <section className="space-y-4 pb-8">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
            <History className="w-3 h-3" /> Recent Ledger
          </h3>
          <Link href="/admin/ledger" className="text-[10px] font-black text-blue-600 uppercase">View All</Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm mb-12">
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
              No recent activity
            </div>
          ) : (
            recentActivity.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 border-b border-slate-50 dark:border-slate-800/50 active:bg-slate-50 dark:active:bg-slate-800/30 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'collection' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                  {item.type === 'collection' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">
                    {item.party}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase truncate">
                    {(() => {
                      if (!item.date) return "N/A";
                      try {
                        const [datePart, timePart] = item.date.split(" ");
                        const [year, month, day] = datePart.split("-");
                        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        const formattedMonth = months[parseInt(month, 10) - 1] || month;
                        return `${formattedMonth} ${parseInt(day, 10)}, ${timePart}`;
                      } catch (e) {
                        return item.date;
                      }
                    })()} • {item.staff}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${item.type === 'collection' ? 'text-blue-600' : 'text-red-600'}`}>
                    {item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="h-4" />
    </div>
  );
}
