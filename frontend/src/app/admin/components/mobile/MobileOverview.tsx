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
  ChevronDown,
  Share2,
  Edit2,
  Trash2
} from "lucide-react";
import { format, subDays, isSameDay } from "date-fns";
import Link from "next/link";
import { numberToWordsIndian, shareCollectionEntry, shareDepositEntry } from "../../../utils/shareHelper";
import { api } from "../../../utils/api";

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
        remarks: c.remarks || "",
        staff: c.staffName || "Admin",
        amount: c.totalAmount,
        type: 'collection',
        balance: c.balance_snapshot,
        denominations: c.denominations,
        retailer_id: c.retailer_id,
        store_id: c.store_id,
        portal_id: c.portal_id
      })),
      ...(deposits || []).map(d => ({
        id: d.id,
        date: d.date,
        party: d.portalGroupName ? `${d.portalGroupName} (${d.targetName})` : d.targetName,
        store_name: null,
        remarks: d.remarks || "",
        staff: d.staffName || "Admin",
        amount: d.amount,
        type: 'deposit',
        balance: d.balance_snapshot,
        denominations: d.denominations,
        deposit_type: d.depositType,
        portal_id: d.portal_id,
        retailer_id: d.retailer_id,
        recipient_staff_id: d.recipient_staff_id,
        paymentMode: d.paymentMode
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
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = useState<Record<string, boolean>>({});
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

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
    <div className="space-y-3.5">
      {/* Premium Summary Card */}
      <div className="relative overflow-hidden bg-slate-900 dark:bg-white rounded-lg p-3 text-white dark:text-slate-955 shadow-md">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Wallet className="w-16 h-16 rotate-12" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Net Cash in Hand</p>
            <h2 className="text-xl font-black mt-0.5">₹{netCashBalance.toLocaleString()}</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-white/10 dark:bg-slate-100 px-2 py-1 rounded-md backdrop-blur-md">
              <p className="text-[7px] font-black uppercase opacity-60">Cash In</p>
              <p className="text-[10px] font-black mt-0.5">₹{totalCollectedAmount.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 dark:bg-slate-100 px-2 py-1 rounded-md backdrop-blur-md">
              <p className="text-[7px] font-black uppercase opacity-60">Cash Out</p>
              <p className="text-[10px] font-black mt-0.5">₹{totalDepositedAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff live Status & Cash Tracker Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-sm flex flex-col gap-2 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-md">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Staff Tracking</span>
            <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase">Live field reports</p>
          </div>
        </div>

        {/* List of active field staff */}
        {staffListData.length === 0 ? (
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold italic text-center py-2">No staff members found.</p>
        ) : (
          <div className="space-y-1.5">
            {staffListData.map((staff) => {
              const isExpanded = !!expandedStaffNames[staff.name];
              const isActive = staff.compliance?.status === "Active Duty";
              return (
                <div key={staff.name} className="border border-slate-100 dark:border-slate-800 rounded-md p-1.5 bg-slate-50/30 dark:bg-slate-900/20 space-y-1.5">
                  {/* Card Header (Clickable to Expand) */}
                  <div 
                    onClick={() => toggleStaffExpanded(staff.name)}
                    className="flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350 dark:bg-slate-700'}`} />
                      <span className="text-[10px] font-black text-slate-850 dark:text-white uppercase tracking-tight group-hover:text-blue-655 dark:group-hover:text-blue-455 transition-colors">
                        {staff.name}
                      </span>
                      <span className="text-[7px] font-extrabold text-slate-400 dark:text-slate-500 uppercase">
                        {isActive ? "Active" : "Offline"}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-450 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Summary Stats Row */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="p-1 bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-100/30 dark:border-emerald-900/5 rounded-md flex flex-col">
                      <span className="text-[6.5px] font-black uppercase text-emerald-600 tracking-wide">Collected</span>
                      <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400">
                        ₹{staff.collectedToday.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-1 bg-red-50/20 dark:bg-red-950/5 border border-red-100/30 dark:border-red-900/5 rounded-md flex flex-col">
                      <span className="text-[6.5px] font-black uppercase text-red-600 tracking-wide">Deposited</span>
                      <span className="text-[9px] font-black text-red-700 dark:text-red-400">
                        ₹{staff.depositedToday.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-1 bg-blue-50/20 dark:bg-blue-950/5 border border-blue-100/30 dark:border-blue-900/5 rounded-md flex flex-col">
                      <span className="text-[6.5px] font-black uppercase text-blue-600 tracking-wide">In Hand</span>
                      <span className={`text-[9px] font-black ${staff.remainingToday < 0 ? 'text-red-650 dark:text-red-450' : 'text-blue-700 dark:text-blue-400'}`}>
                        ₹{staff.remainingToday.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible details section */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800/80 pt-1.5 space-y-1.5 animate-slide-up">
                      {/* Check-in info */}
                      <div className="flex items-center justify-between text-[8px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wide">Shift Status</span>
                        <span className="font-black text-slate-705 dark:text-slate-350">
                          {staff.compliance ? staff.compliance.status : "Not Checked In"}
                          {staff.compliance?.startTime ? ` (IN: ${staff.compliance.startTime})` : ""}
                        </span>
                      </div>

                      {staff.compliance ? (
                        <div className="flex flex-col gap-1">
                          {/* Odometer mileage */}
                          <div className="flex items-center justify-between text-[8px]">
                            <span className="font-bold text-slate-400 uppercase tracking-wide">Odometer</span>
                            <span className="font-black text-slate-705 dark:text-slate-300">
                              {staff.compliance.startKm ? `${staff.compliance.startKm} KM` : "0 KM"}
                              {staff.compliance.endKm ? ` → ${staff.compliance.endKm} KM` : " Started"}
                            </span>
                          </div>

                          {/* Action Buttons for GPS Coordinates & photos */}
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {/* Start Coordinates Link */}
                            {staff.compliance.startLatitude && staff.compliance.startLongitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.startLatitude},${staff.compliance.startLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-955/65 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950 transition-colors"
                              >
                                <MapPin className="w-2 h-2 text-blue-500" />
                                <span>Start Route</span>
                              </a>
                            )}

                            {/* Start Odometer Photo */}
                            {staff.compliance.startKmImageUrl && (
                              <a
                                href={staff.compliance.startKmImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-850 text-slate-655 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Camera className="w-2 h-2 text-slate-500" />
                                <span>Start Photo</span>
                              </a>
                            )}

                            {/* End Coordinates Link */}
                            {staff.compliance.endLatitude && staff.compliance.endLongitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.endLatitude},${staff.compliance.endLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-955/65 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
                              >
                                <MapPin className="w-2 h-2 text-indigo-500" />
                                <span>End Route</span>
                              </a>
                            )}

                            {/* End Odometer Photo */}
                            {staff.compliance.endKmImageUrl && (
                              <a
                                href={staff.compliance.endKmImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-850 text-slate-655 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Camera className="w-2 h-2 text-slate-500" />
                                <span>End Photo</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[7px] font-bold text-slate-400 italic text-center py-0.5">No shift log exists for today.</p>
                      )}

                      {/* Visited stores button inside collapsed card details */}
                      <div className="border-t border-slate-100 dark:border-slate-850 pt-1.5 flex items-center justify-between">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Outings</span>
                        <button
                          onClick={() => staff.visitedStores.length > 0 && setActiveModalStaff({ name: staff.name, visitedStores: staff.visitedStores })}
                          className={`flex items-center gap-1 font-black uppercase tracking-wider text-[7px] px-1.5 py-0.5 rounded transition-all ${
                            staff.visitedStores.length > 0 
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-955/40 hover:bg-blue-100 dark:hover:bg-blue-955/80 cursor-pointer shadow-xs" 
                            : "text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-955/20 cursor-not-allowed"
                          }`}
                          disabled={staff.visitedStores.length === 0}
                        >
                          <Store className="w-2.5 h-2.5" />
                          <span>Stores: {staff.visitedStores.length}</span>
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
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-16">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To Take</p>
          <p className="text-sm font-black text-red-500">₹{totalToTake.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-16">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To Give</p>
          <p className="text-sm font-black text-emerald-500">₹{totalToGive.toLocaleString()}</p>
        </div>
      </div>

      {/* Recent Ledger Activity */}
      <section className="space-y-2 pb-4">
        <div className="flex items-center justify-between px-1.5">
          <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Recent Ledger
          </h3>
          <Link href="/admin/ledger" className="text-[8px] font-black text-blue-650 uppercase">View All</Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xs mb-4">
          {recentActivity.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-[9px] font-black uppercase tracking-widest">
              No recent activity
            </div>
          ) : (
            recentActivity.map((item: any, idx) => {
              const isExpanded = expandedActivityId === item.id;
              const den = item.denominations || {};
              return (
              <div key={idx} className={`border-b border-slate-50 dark:border-slate-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/80 dark:bg-slate-800/20' : 'active:bg-slate-50 dark:active:bg-slate-800/30'}`} onClick={() => setExpandedActivityId(prev => prev === item.id ? null : item.id)}>
                <div className="flex items-center gap-2 py-1.5 px-2.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${item.type === 'collection' ? 'bg-blue-50 text-blue-650' : 'bg-red-50 text-red-650'}`}>
                    {item.type === 'collection' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black text-slate-800 dark:text-white truncate block">
                        {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms")
                          ? `${item.party} - ${item.store_name || "Direct"}`
                          : item.party}
                      </span>
                      {item.store_name && !(item.type === 'collection' && item.party?.toLowerCase().startsWith("cms")) && (
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">({item.store_name})</span>
                      )}
                      {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms") && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCmsRemarksExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] })); }}
                          className="p-0.5 bg-slate-50 dark:bg-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                          title="View Remark"
                        >
                          <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[item.id] ? 'rotate-180 text-indigo-505' : ''}`} />
                        </button>
                      )}
                    </div>
                    {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[item.id] && (
                      <div className="mt-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-200/50 dark:border-slate-800 text-[8px] font-medium text-slate-605 dark:text-slate-400 max-w-[200px] break-words">
                        <span className="text-[7px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                        <span className="italic">{item.remarks || "no remark"}</span>
                      </div>
                    )}
                    <p className="text-[8px] font-bold text-slate-400 uppercase truncate mt-0.5">
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
                  <div className="text-right flex items-center gap-1">
                    <div>
                      <p className={`text-[11px] font-black ${item.type === 'collection' ? 'text-blue-650' : 'text-red-650'}`}>
                        {item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}
                      </p>
                      {item.balance !== undefined && item.balance !== null && (
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Due: ₹{Number(item.balance).toLocaleString()}</p>
                      )}
                    </div>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-2 pt-1 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                    <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cash Breakdown</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8.5px] font-bold text-slate-600 dark:text-slate-300">
                      {Number(den.note_500) > 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                      {Number(den.note_200) > 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                      {Number(den.note_100) > 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                      {Number(den.note_50) > 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                      {Number(den.note_20) > 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                      {Number(den.note_10) > 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                      {Number(den.coins) > 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                      {Number(den.online_amount) > 0 && <span>UPI = ₹{Number(den.online_amount).toLocaleString()}</span>}
                      {!den.note_500 && !den.note_200 && !den.note_100 && !den.note_50 && !den.note_20 && !den.note_10 && !den.coins && !den.online_amount && <span className="text-slate-400 italic">No breakdown</span>}
                    </div>
                    <div className="mt-1 text-[8.5px] font-bold text-slate-500 italic">{numberToWordsIndian(item.amount)} Rupees</div>
                    <div className="flex gap-1.5 mt-1.5 w-full">
                      <button
                        onClick={() => {
                          if (item.type === 'collection') {
                            shareCollectionEntry({ retailer_name: item.party, store_name: item.store_name, total_amount: item.amount, denominations: item.denominations, created_at: item.date, remarks: item.remarks }, item.staff);
                          } else {
                            shareDepositEntry({ target_name: item.party, amount: item.amount, denominations: item.denominations, created_at: item.date, remarks: item.remarks }, item.staff);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/30 active:scale-95 transition-transform"
                      >
                        <Share2 className="w-2.5 h-2.5" /> Share
                      </button>
                      <button
                        onClick={async () => {
                          if (item.type === 'collection') {
                            const newAmount = prompt("Enter correct collection amount:", item.amount.toString());
                            if (newAmount !== null && !isNaN(parseFloat(newAmount))) {
                              try {
                                await api.updateCollection(item.id, {
                                  retailer_id: item.retailer_id,
                                  store_id: item.store_id,
                                  total_amount: parseFloat(newAmount),
                                  remarks: item.remarks,
                                  denominations: {
                                    ...item.denominations,
                                    online_amount: parseFloat(newAmount)
                                  }
                                });
                                fetchData();
                              } catch (err: any) {
                                alert("Failed to update: " + err.message);
                              }
                            }
                          } else {
                            const newAmount = prompt("Enter correct deposit amount:", item.amount.toString());
                            if (newAmount !== null && !isNaN(parseFloat(newAmount))) {
                              try {
                                await api.updateDeposit(item.id, {
                                  amount: parseFloat(newAmount),
                                  payment_mode: item.paymentMode || item.payment_mode || "online",
                                  deposit_date: item.date.split(' ')[0],
                                  denominations: item.denominations
                                });
                                fetchData();
                              } catch (err: any) {
                                alert("Failed to update: " + err.message);
                              }
                            }
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider border border-blue-100 dark:border-blue-900/30 active:scale-95 transition-transform"
                      >
                        <Edit2 className="w-2.5 h-2.5" /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          const confirmText = item.type === 'collection' ? "Delete this collection?" : "Delete this deposit?";
                          if (confirm(confirmText)) {
                            try {
                              if (item.type === 'collection') {
                                await api.deleteCollection(item.id);
                              } else {
                                await api.deleteDeposit(item.id);
                              }
                              fetchData();
                            } catch (err: any) {
                              alert("Failed to delete: " + err.message);
                            }
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[8px] font-black uppercase tracking-wider border border-red-100 dark:border-red-900/30 active:scale-95 transition-transform"
                      >
                        <Trash2 className="w-2.5 h-2.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      </section>

      {/* Stores Visited Mobile Sliding Overlay Modal */}
      {activeModalStaff && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-205 dark:border-slate-800 rounded-t-lg sm:rounded-lg w-full max-w-md p-3 pb-4 space-y-2.5 shadow-2xl animate-slide-up relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-md">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Visited Stores
                  </h3>
                  <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase mt-0.5">
                    {activeModalStaff.name}&apos;s Outings Today
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalStaff(null)}
                className="p-1 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body: Stores list */}
            <div className="max-h-[40vh] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-850">
              {activeModalStaff.visitedStores.map((item: VisitedStore, idx: number) => (
                <div key={idx} className="py-1.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/10 px-1 rounded-md transition-all">
                  <div className="flex flex-col min-w-0 flex-1 pr-1.5">
                    <span className="font-black text-slate-800 dark:text-slate-205 uppercase tracking-tight truncate text-[11px]">
                      {item.retailerName}
                    </span>
                    <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                      <Clock className="w-3 h-3 text-slate-400" />
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

                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-650 dark:text-emerald-450 text-[11px]">
                      +₹{item.amount.toLocaleString()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${
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
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wide">Total Visited Today</span>
                <span className="text-[10px] font-black text-slate-705 dark:text-slate-350">
                  {activeModalStaff.visitedStores.length} Stores
                </span>
              </div>
              <button
                onClick={() => setActiveModalStaff(null)}
                className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[9px] font-black rounded-lg hover:bg-slate-850 dark:hover:bg-slate-100 transition-all cursor-pointer shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
