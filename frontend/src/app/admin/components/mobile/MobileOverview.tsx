"use client";

import React, { useMemo, useState, useEffect } from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  TrendingUp,
  History,
  Users,
  Store,
  Clock,
  X,
  MapPin,
  Camera
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
  userDirectory: any[];
  staffComplianceLogs: any[];
}

export default function MobileOverview({
  collections,
  deposits,
  totalCollectedAmount,
  totalDepositedAmount,
  netCashBalance,
  totalToTake,
  totalToGive,
  fetchData,
  todayCount,
  userDirectory,
  staffComplianceLogs
}: MobileOverviewProps) {
  
  // Calculate 7-day trend data
  const trendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
    
    return last7Days.map(day => {
      const dayCollections = collections
        .filter(c => isSameDay(new Date(c.created_at || c.date), day))
        .reduce((sum, c) => sum + (c.totalAmount || 0), 0);
        
      const dayDeposits = deposits
        .filter(d => isSameDay(new Date(d.created_at || d.date), day))
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

  // Filter for field staff
  const staffUsers = useMemo(() => {
    return (userDirectory || []).filter((u: any) => u.role === "field_staff" || u.role === "staff");
  }, [userDirectory]);

  // State to hold selected staff name
  const [selectedStaffName, setSelectedStaffName] = useState<string>("");

  // Set default selected staff once list is loaded
  useEffect(() => {
    if (staffUsers.length > 0 && !selectedStaffName) {
      setSelectedStaffName(staffUsers[0].name);
    }
  }, [staffUsers, selectedStaffName]);

  // Calculations for selected staff member
  const staffMetrics = useMemo(() => {
    if (!selectedStaffName) {
      return { collectedToday: 0, depositedToday: 0, remainingToday: 0, visitedStores: [] };
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Filter collections today by selected staff name
    const staffColsToday = (collections || []).filter(
      (c) => c.staffName === selectedStaffName && c.date?.startsWith(todayStr)
    );

    // Filter deposits today by selected staff name
    const staffDepsToday = (deposits || []).filter(
      (d) => d.staffName === selectedStaffName && d.date?.startsWith(todayStr)
    );

    const collectedToday = staffColsToday.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const depositedToday = staffDepsToday.reduce((s, d) => s + (d.amount || 0), 0);
    const remainingToday = collectedToday - depositedToday;

    // Get visited stores today (unique store/retailer name with visit details)
    const visitedStores = staffColsToday.map((c) => ({
      id: c.id,
      retailerName: c.retailerName,
      time: c.date ? c.date.split(" ")[1] : "N/A",
      amount: c.totalAmount,
      status: c.status || "verified",
    }));

    return {
      collectedToday,
      depositedToday,
      remainingToday,
      visitedStores,
    };
  }, [selectedStaffName, collections, deposits]);

  // Live compliance/attendance matching
  const selectedStaffCompliance = useMemo(() => {
    if (!selectedStaffName) return null;
    return (staffComplianceLogs || []).find(
      (log) => log.name?.toLowerCase() === selectedStaffName.toLowerCase()
    );
  }, [selectedStaffName, staffComplianceLogs]);

  // State for visited stores modal popup
  const [showVisitedModal, setShowVisitedModal] = useState(false);

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

      {/* Staff live Status & Cash Tracker Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm flex flex-col gap-5 animate-fade-in">
        {/* Header & Dropdown */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Staff Tracking</span>
              <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Live field reports</p>
            </div>
          </div>

          {/* Dropdown for selecting Staff */}
          <div className="relative">
            <select
              value={selectedStaffName}
              onChange={(e) => setSelectedStaffName(e.target.value)}
              className="pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-extrabold text-slate-800 dark:text-slate-200 focus:outline-none appearance-none cursor-pointer shadow-sm"
            >
              {staffUsers.length === 0 ? (
                <option value="">No Staff Active</option>
              ) : (
                staffUsers.map((u: any) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
              <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Collected today */}
          <div className="p-3 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/10 rounded-2xl flex flex-col justify-between min-h-[70px]">
            <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-450 tracking-wide">Collected</span>
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 mt-1">
              ₹{staffMetrics.collectedToday.toLocaleString()}
            </span>
          </div>

          {/* Deposited today */}
          <div className="p-3 bg-red-50/30 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/10 rounded-2xl flex flex-col justify-between min-h-[70px]">
            <span className="text-[8px] font-black uppercase text-red-600 dark:text-red-450 tracking-wide">Deposited</span>
            <span className="text-xs font-black text-red-700 dark:text-red-400 mt-1">
              ₹{staffMetrics.depositedToday.toLocaleString()}
            </span>
          </div>

          {/* Net remaining in hand */}
          <div className="p-3 bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/10 rounded-2xl flex flex-col justify-between min-h-[70px]">
            <span className="text-[8px] font-black uppercase text-blue-600 dark:text-blue-455 tracking-wide">In Hand</span>
            <span className="text-xs font-black text-blue-700 dark:text-blue-400 mt-1">
              ₹{staffMetrics.remainingToday.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Shift compliance status details */}
        <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100/50 dark:border-slate-850 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                selectedStaffCompliance?.status === "Active Duty" ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-700"
              }`} />
              <span className="font-extrabold text-slate-650 dark:text-slate-400 uppercase tracking-wider text-[9px]">
                {selectedStaffCompliance ? selectedStaffCompliance.status : "Not Checked In"}
              </span>
            </div>
            
            {selectedStaffCompliance && (
              <span className="font-extrabold text-slate-400 dark:text-slate-500">
                {selectedStaffCompliance.startTime ? `IN: ${selectedStaffCompliance.startTime}` : ""}
              </span>
            )}
          </div>

          {selectedStaffCompliance ? (
            <div className="flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              {/* Mileage & Route */}
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-400 uppercase tracking-wide">Odometer</span>
                <span className="font-black text-slate-700 dark:text-slate-300">
                  {selectedStaffCompliance.startKm ? `${selectedStaffCompliance.startKm} KM` : "0 KM"}
                  {selectedStaffCompliance.endKm ? ` → ${selectedStaffCompliance.endKm} KM` : " Started"}
                </span>
              </div>

              {/* Action Buttons for GPS Coordinates & photos */}
              <div className="flex flex-wrap gap-2 pt-1">
                {/* Start Coordinates Link */}
                {selectedStaffCompliance.startLatitude && selectedStaffCompliance.startLongitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedStaffCompliance.startLatitude},${selectedStaffCompliance.startLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/65 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950 transition-colors"
                  >
                    <MapPin className="w-3 h-3 text-blue-500" />
                    <span>Start Route</span>
                  </a>
                )}

                {/* Start Odometer Photo */}
                {selectedStaffCompliance.startKmImageUrl && (
                  <a
                    href={selectedStaffCompliance.startKmImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Camera className="w-3 h-3 text-slate-500" />
                    <span>Start Photo</span>
                  </a>
                )}

                {/* End Coordinates Link */}
                {selectedStaffCompliance.endLatitude && selectedStaffCompliance.endLongitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedStaffCompliance.endLatitude},${selectedStaffCompliance.endLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/65 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
                  >
                    <MapPin className="w-3 h-3 text-indigo-500" />
                    <span>End Route</span>
                  </a>
                )}

                {/* End Odometer Photo */}
                {selectedStaffCompliance.endKmImageUrl && (
                  <a
                    href={selectedStaffCompliance.endKmImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Camera className="w-3 h-3 text-slate-500" />
                    <span>End Photo</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[9px] font-bold text-slate-400 italic text-center pt-2">No shift log exists for today.</p>
          )}
        </div>

        {/* Stores Visited Today Button */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex items-center justify-between">
          <span className="text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest">Outings</span>
          
          <button
            onClick={() => staffMetrics.visitedStores.length > 0 && setShowVisitedModal(true)}
            className={`flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-xl transition-all ${
              staffMetrics.visitedStores.length > 0 
              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/80 cursor-pointer shadow-sm" 
              : "text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-950/20 cursor-not-allowed"
            }`}
            disabled={staffMetrics.visitedStores.length === 0}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Stores Visited Today: {staffMetrics.visitedStores.length}</span>
          </button>
        </div>
      </div>

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

      {/* Stores Visited Mobile Sliding Overlay Modal */}
      {showVisitedModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 pb-8 sm:pb-6 space-y-5 shadow-2xl animate-slide-up relative">
            {/* Grab handle for mobile feeling */}
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto sm:hidden -mt-2 mb-2" />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                    Visited Stores
                  </h3>
                  <p className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-0.5">
                    {selectedStaffName}'s Outings Today
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVisitedModal(false)}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Stores list */}
            <div className="max-h-[50vh] overflow-y-auto pr-1 divide-y divide-slate-105 dark:divide-slate-850">
              {staffMetrics.visitedStores.map((item: any, idx: number) => (
                <div key={idx} className="py-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/10 px-2 rounded-2xl transition-all">
                  <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight truncate text-xs">
                      {item.retailerName}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{(() => {
                        try {
                          let [hour, min] = item.time.split(":").map(Number);
                          const ampm = hour >= 12 ? 'PM' : 'AM';
                          hour = hour % 12 || 12;
                          return `${hour}:${min.toString().padStart(2, '0')} ${ampm}`;
                        } catch (e) {
                          return item.time;
                        }
                      })()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-black text-emerald-600 dark:text-emerald-450 text-xs">
                      +₹{item.amount.toLocaleString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                      item.status === 'verified'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30'
                      : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-100 dark:border-amber-900/30'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Total Visited Today</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-350">
                  {staffMetrics.visitedStores.length} Stores
                </span>
              </div>
              <button
                onClick={() => setShowVisitedModal(false)}
                className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black rounded-xl hover:bg-slate-850 dark:hover:bg-slate-100 transition-all cursor-pointer shadow-md"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
