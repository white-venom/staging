"use client";

import React, { useMemo, useState } from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  History,
  Users,
  Store,
  Clock,
  X,
  MapPin,
  Camera,
  ChevronDown
} from "lucide-react";
import { format, subDays, isSameDay } from "date-fns";
import Link from "next/link";

interface VisitedStore {
  id: string;
  retailerName: string;
  time: string;
  amount: number;
  status: string;
}

interface StaffCompliance {
  status?: string;
  startTime?: string;
  startKm?: string | number;
  endKm?: string | number;
  startLatitude?: number;
  startLongitude?: number;
  startKmImageUrl?: string;
  endLatitude?: number;
  endLongitude?: number;
  endKmImageUrl?: string;
}

interface StaffListData {
  name: string;
  collectedToday: number;
  depositedToday: number;
  remainingToday: number;
  visitedStores: VisitedStore[];
  compliance?: StaffCompliance;
}

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
        .filter(d => isSameDay(new Date(d.created_at || d.date), day) && d.depositType?.toLowerCase() !== 'virtual')
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
        store_name: c.store_name || null,
        staff: c.staffName || "Admin",
        amount: c.totalAmount,
        type: 'collection',
        balance: c.balance_snapshot
      })),
      ...(deposits || []).map(d => ({
        id: d.id,
        date: d.date,
        party: d.portalGroupName ? `${d.portalGroupName} (${d.targetName})` : d.targetName,
        store_name: null,
        staff: d.staffName || "Admin",
        amount: d.amount,
        type: 'deposit',
        balance: d.balance_snapshot
      }))
    ];
    return combined
      .sort((a, b) => new Date(b.date.replace(" ", "T")).getTime() - new Date(a.date.replace(" ", "T")).getTime())
      .slice(0, 10);
  }, [collections, deposits]);

  const maxNet = Math.max(...trendData.map(d => Math.abs(d.net)), 1000);

  // Filter for field staff
  const staffUsers = useMemo(() => {
    return (userDirectory || []).filter((u: { role: string }) => u.role === "field_staff" || u.role === "staff");
  }, [userDirectory]);

  // State to track which staff cards are expanded
  const [expandedStaffNames, setExpandedStaffNames] = useState<Record<string, boolean>>({});

  const toggleStaffExpanded = (name: string) => {
    setExpandedStaffNames(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // State for active modal visited stores
  const [activeModalStaff, setActiveModalStaff] = useState<{ name: string; visitedStores: VisitedStore[] } | null>(null);

  // Precalculate daily metrics for all active field staff
  const staffListData = useMemo<StaffListData[]>(() => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    return (staffUsers || []).map((user: { name: string }) => {
      const name = user.name;
      
      // Filter collections today by staff name
      const staffColsToday = (collections || []).filter(
        (c) => c.staffName === name && c.date?.startsWith(todayStr)
      );

      // Filter deposits today by staff name
      const staffDepsToday = (deposits || []).filter(
        (d) => d.staffName === name && d.date?.startsWith(todayStr) && d.depositType?.toLowerCase() !== 'virtual'
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

      // Get compliance/attendance log for this staff member (prioritize active/latest shift, trim and ignore case)
      const compliance = (staffComplianceLogs || [])
        .filter((log) => log.name?.trim().toLowerCase() === name.trim().toLowerCase())
        .sort((a, b) => {
          if (a.status === "Active Duty" && b.status !== "Active Duty") return -1;
          if (a.status !== "Active Duty" && b.status === "Active Duty") return 1;
          return 0;
        })[0];

      return {
        name,
        collectedToday,
        depositedToday,
        remainingToday,
        visitedStores,
        compliance,
      };
    });
  }, [staffUsers, collections, deposits, staffComplianceLogs]);

  return (
    <div className="space-y-6">
      {/* Premium Summary Card */}
      <div className="relative overflow-hidden bg-slate-900 dark:bg-white rounded-3xl p-5 text-white dark:text-slate-950 shadow-xl shadow-blue-500/10">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Wallet className="w-24 h-24 rotate-12" />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Net Cash in Hand</p>
          <h2 className="text-3xl font-black mt-0.5">₹{netCashBalance.toLocaleString()}</h2>
          
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 bg-white/10 dark:bg-slate-100 p-2.5 rounded-xl backdrop-blur-md">
              <p className="text-[9px] font-black uppercase opacity-60">Cash In</p>
              <p className="text-xs font-black mt-0.5">₹{totalCollectedAmount.toLocaleString()}</p>
            </div>
            <div className="flex-1 bg-white/10 dark:bg-slate-100 p-2.5 rounded-xl backdrop-blur-md">
              <p className="text-[9px] font-black uppercase opacity-60">Cash Out</p>
              <p className="text-xs font-black mt-0.5">₹{totalDepositedAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff live Status & Cash Tracker Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm flex flex-col gap-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Staff Tracking</span>
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Live field reports</p>
          </div>
        </div>

        {/* List of active field staff */}
        {staffListData.length === 0 ? (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic text-center py-4">No staff members found.</p>
        ) : (
          <div className="space-y-4">
            {staffListData.map((staff) => {
              const isExpanded = !!expandedStaffNames[staff.name];
              const isActive = staff.compliance?.status === "Active Duty";
              return (
                <div key={staff.name} className="border border-slate-100 dark:border-slate-800 rounded-[1.75rem] p-4 bg-slate-50/30 dark:bg-slate-900/20 space-y-3">
                  {/* Card Header (Clickable to Expand) */}
                  <div 
                    onClick={() => toggleStaffExpanded(staff.name)}
                    className="flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350 dark:bg-slate-700'}`} />
                      <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-455 transition-colors">
                        {staff.name}
                      </span>
                      <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase">
                        {isActive ? "Active" : "Offline"}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-450 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Summary Stats Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-100/30 dark:border-emerald-900/5 rounded-xl flex flex-col">
                      <span className="text-[7px] font-black uppercase text-emerald-600 tracking-wide">Collected</span>
                      <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                        ₹{staff.collectedToday.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2 bg-red-50/20 dark:bg-red-950/5 border border-red-100/30 dark:border-red-900/5 rounded-xl flex flex-col">
                      <span className="text-[7px] font-black uppercase text-red-600 tracking-wide">Deposited</span>
                      <span className="text-[10px] font-black text-red-700 dark:text-red-400 mt-0.5">
                        ₹{staff.depositedToday.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2 bg-blue-50/20 dark:bg-blue-950/5 border border-blue-100/30 dark:border-blue-900/5 rounded-xl flex flex-col">
                      <span className="text-[7px] font-black uppercase text-blue-600 tracking-wide">In Hand</span>
                      <span className={`text-[10px] font-black mt-0.5 ${staff.remainingToday < 0 ? 'text-red-600 dark:text-red-450' : 'text-blue-700 dark:text-blue-400'}`}>
                        ₹{staff.remainingToday.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible details section */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 space-y-3 animate-slide-up">
                      {/* Check-in info */}
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wide">Shift Status</span>
                        <span className="font-black text-slate-700 dark:text-slate-350">
                          {staff.compliance ? staff.compliance.status : "Not Checked In"}
                          {staff.compliance?.startTime ? ` (IN: ${staff.compliance.startTime})` : ""}
                        </span>
                      </div>

                      {staff.compliance ? (
                        <div className="flex flex-col gap-2">
                          {/* Odometer mileage */}
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="font-bold text-slate-400 uppercase tracking-wide">Odometer</span>
                            <span className="font-black text-slate-700 dark:text-slate-300">
                              {staff.compliance.startKm ? `${staff.compliance.startKm} KM` : "0 KM"}
                              {staff.compliance.endKm ? ` → ${staff.compliance.endKm} KM` : " Started"}
                            </span>
                          </div>

                          {/* Action Buttons for GPS Coordinates & photos */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {/* Start Coordinates Link */}
                            {staff.compliance.startLatitude && staff.compliance.startLongitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.startLatitude},${staff.compliance.startLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/65 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950 transition-colors"
                              >
                                <MapPin className="w-2.5 h-2.5 text-blue-500" />
                                <span>Start Route</span>
                              </a>
                            )}

                            {/* Start Odometer Photo */}
                            {staff.compliance.startKmImageUrl && (
                              <a
                                href={staff.compliance.startKmImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-650 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Camera className="w-2.5 h-2.5 text-slate-500" />
                                <span>Start Photo</span>
                              </a>
                            )}

                            {/* End Coordinates Link */}
                            {staff.compliance.endLatitude && staff.compliance.endLongitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.endLatitude},${staff.compliance.endLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/65 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
                              >
                                <MapPin className="w-2.5 h-2.5 text-indigo-500" />
                                <span>End Route</span>
                              </a>
                            )}

                            {/* End Odometer Photo */}
                            {staff.compliance.endKmImageUrl && (
                              <a
                                href={staff.compliance.endKmImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-650 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Camera className="w-2.5 h-2.5 text-slate-500" />
                                <span>End Photo</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[8px] font-bold text-slate-400 italic text-center py-1">No shift log exists for today.</p>
                      )}

                      {/* Visited stores button inside collapsed card details */}
                      <div className="border-t border-slate-100 dark:border-slate-850 pt-2.5 flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Outings</span>
                        <button
                          onClick={() => staff.visitedStores.length > 0 && setActiveModalStaff({ name: staff.name, visitedStores: staff.visitedStores })}
                          className={`flex items-center gap-1 font-black uppercase tracking-wider text-[8px] px-2.5 py-1.5 rounded-lg transition-all ${
                            staff.visitedStores.length > 0 
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/80 cursor-pointer shadow-sm" 
                            : "text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-950/20 cursor-not-allowed"
                          }`}
                          disabled={staff.visitedStores.length === 0}
                        >
                          <Store className="w-3 h-3" />
                          <span>Stores Visited: {staff.visitedStores.length}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                    {item.party} {item.store_name && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">({item.store_name})</span>}
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
                  {item.balance !== undefined && item.balance !== null && (
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase">Due: ₹{Number(item.balance).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="h-4" />

      {/* Stores Visited Mobile Sliding Overlay Modal */}
      {activeModalStaff && (
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
                    {activeModalStaff.name}&apos;s Outings Today
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalStaff(null)}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Stores list */}
            <div className="max-h-[50vh] overflow-y-auto pr-1 divide-y divide-slate-105 dark:divide-slate-850">
              {activeModalStaff.visitedStores.map((item: VisitedStore, idx: number) => (
                <div key={idx} className="py-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/10 px-2 rounded-2xl transition-all">
                  <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight truncate text-xs">
                      {item.retailerName}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{(() => {
                        try {
                          const [rawHour, min] = item.time.split(":").map(Number);
                          const ampm = rawHour >= 12 ? 'PM' : 'AM';
                          const hour = rawHour % 12 || 12;
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
                  {activeModalStaff.visitedStores.length} Stores
                </span>
              </div>
              <button
                onClick={() => setActiveModalStaff(null)}
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
