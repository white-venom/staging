"use client";

import React from "react";
import { 
  TrendingUp, 
  FileText, 
  CheckCircle2, 
  BarChart2,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Edit,
  Users,
  Store,
  Clock,
  X,
  MapPin,
  Camera
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../../utils/api";

interface OverviewTabProps {
  collections: any[];
  deposits: any[];
  totalCollectedAmount: number;
  totalDepositedAmount: number;
  netCashBalance: number;
  totalToTake: number;
  totalToGive: number;
  fetchData: () => void;
  todayCount?: number;
  userDirectory?: any[];
  staffComplianceLogs?: any[];
}

export default function OverviewTab({
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
}: OverviewTabProps) {
  const router = useRouter();
  const safeCollections = collections || [];
  const safeDeposits = deposits || [];

  // Filter for field staff
  const staffUsers = React.useMemo(() => {
    return (userDirectory || []).filter((u: any) => u.role === "field_staff" || u.role === "staff");
  }, [userDirectory]);

  // State to hold selected staff name
  const [selectedStaffName, setSelectedStaffName] = React.useState<string>("");

  // Set default selected staff once list is loaded
  React.useEffect(() => {
    if (staffUsers.length > 0 && !selectedStaffName) {
      setSelectedStaffName(staffUsers[0].name);
    }
  }, [staffUsers, selectedStaffName]);

  // Calculations for selected staff member
  const staffMetrics = React.useMemo(() => {
    if (!selectedStaffName) {
      return { collectedToday: 0, depositedToday: 0, remainingToday: 0, visitedStores: [] };
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Filter collections today by selected staff name
    const staffColsToday = safeCollections.filter(
      (c) => c.staffName === selectedStaffName && c.date?.startsWith(todayStr)
    );

    // Filter deposits today by selected staff name
    const staffDepsToday = safeDeposits.filter(
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
  }, [selectedStaffName, safeCollections, safeDeposits]);

  // Live compliance/attendance matching
  const selectedStaffCompliance = React.useMemo(() => {
    if (!selectedStaffName) return null;
    return (staffComplianceLogs || []).find(
      (log) => log.name?.toLowerCase() === selectedStaffName.toLowerCase()
    );
  }, [selectedStaffName, staffComplianceLogs]);

  // State for visited stores modal popup
  const [showVisitedModal, setShowVisitedModal] = React.useState(false);

  // Pre-calculate running balances for all transactions
  const combinedTimeline = [
    ...safeCollections.map(c => ({ ...c, type: 'collection', amt: c.totalAmount })),
    ...safeDeposits.map(d => ({ ...d, type: 'deposit', amt: d.amount }))
  ].filter(item => item.date)
   .sort((a, b) => new Date(a.date.replace(' ', 'T')).getTime() - new Date(b.date.replace(' ', 'T')).getTime());

  let runningBal = 0;
  const balanceSnapshots = new Map();
  combinedTimeline.forEach(item => {
    const prev = runningBal;
    if (item.type === 'collection') runningBal += item.amt;
    else runningBal -= item.amt;
    balanceSnapshots.set(item.id, { prev, next: runningBal });
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Khatabook Summary Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in flex flex-col justify-between">
          <div className="flex divide-x divide-slate-100 dark:divide-slate-800 flex-1 items-center">
            {/* You will Give (Hum Denge) */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">You will give</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500 tracking-tight">
                ₹{(totalToGive || 0).toLocaleString()}
              </span>
            </div>

            {/* You will Get (Hum Lenge) */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">You will get</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-500 tracking-tight">
                ₹{(totalToTake || 0).toLocaleString()}
              </span>
            </div>
          </div>
          
          {/* Blue Footer Bar */}
          <div 
            onClick={() => router.push('/admin/reports')}
            className="bg-blue-50 dark:bg-blue-900/10 py-3 flex items-center justify-center border-t border-slate-100 dark:border-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase">PDF</div>
              <span className="text-sm font-black text-blue-700 dark:text-blue-400 group-hover:underline">View Reports</span>
            </div>
          </div>
        </div>

        {/* Staff Live Status & Cash Tracker Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 animate-fade-in flex flex-col justify-between gap-4">
          {/* Header & Dropdown */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">Staff Tracking</span>
            </div>

            {/* Dropdown for selecting Staff */}
            <div className="relative">
              <select
                value={selectedStaffName}
                onChange={(e) => setSelectedStaffName(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-extrabold text-slate-800 dark:text-slate-200 focus:outline-none appearance-none cursor-pointer"
              >
                {staffUsers.length === 0 ? (
                  <option value="">No Staff Active</option>
                ) : (
                  staffUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Collected today */}
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/60 dark:border-emerald-900/20 rounded-xl flex flex-col justify-between">
              <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-450 tracking-wide block">Collected</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 block mt-1">
                ₹{staffMetrics.collectedToday.toLocaleString()}
              </span>
            </div>

            {/* Deposited today */}
            <div className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-100/60 dark:border-red-900/20 rounded-xl flex flex-col justify-between">
              <span className="text-[8px] font-black uppercase text-red-600 dark:text-red-450 tracking-wide block">Deposited</span>
              <span className="text-sm font-black text-red-700 dark:text-red-400 block mt-1">
                ₹{staffMetrics.depositedToday.toLocaleString()}
              </span>
            </div>

            {/* Net remaining in hand */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/60 dark:border-blue-900/20 rounded-xl flex flex-col justify-between">
              <span className="text-[8px] font-black uppercase text-blue-600 dark:text-blue-455 tracking-wide block">Remaining</span>
              <span className="text-sm font-black text-blue-700 dark:text-blue-400 block mt-1">
                ₹{staffMetrics.remainingToday.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Outings compliance & stores visited link */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-[10px]">
            {/* Live duty check-in */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  selectedStaffCompliance?.status === "Active Duty" ? "bg-emerald-500 animate-pulse" : "bg-slate-350 dark:bg-slate-700"
                }`} />
                <span className="font-extrabold text-slate-550 dark:text-slate-400">
                  {selectedStaffCompliance ? (
                    `${selectedStaffCompliance.status} (${selectedStaffCompliance.endKm ? (selectedStaffCompliance.endKm - selectedStaffCompliance.startKm) : 0} km)`
                  ) : (
                    "Not Checked In"
                  )}
                </span>
              </div>
              
              {selectedStaffCompliance && (
                <div className="flex items-center gap-2 mt-1">
                  {/* Start route */}
                  {selectedStaffCompliance.startLatitude && selectedStaffCompliance.startLongitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedStaffCompliance.startLatitude},${selectedStaffCompliance.startLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      title="View starting location on Google Maps"
                    >
                      <MapPin className="w-2.5 h-2.5 text-blue-500" />
                      <span>Start Route</span>
                    </a>
                  )}

                  {/* Start Odometer Photo */}
                  {selectedStaffCompliance.startKmImageUrl && (
                    <a
                      href={selectedStaffCompliance.startKmImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="View starting odometer photo"
                    >
                      <Camera className="w-2.5 h-2.5 text-slate-500" />
                      <span>Start Photo</span>
                    </a>
                  )}

                  {/* End Route */}
                  {selectedStaffCompliance.endLatitude && selectedStaffCompliance.endLongitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedStaffCompliance.endLatitude},${selectedStaffCompliance.endLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                      title="View ending location on Google Maps"
                    >
                      <MapPin className="w-2.5 h-2.5 text-indigo-500" />
                      <span>End Route</span>
                    </a>
                  )}

                  {/* End Odometer Photo */}
                  {selectedStaffCompliance.endKmImageUrl && (
                    <a
                      href={selectedStaffCompliance.endKmImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="View ending odometer photo"
                    >
                      <Camera className="w-2.5 h-2.5 text-slate-500" />
                      <span>End Photo</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Clickable Stores Visited element */}
            <button
              onClick={() => staffMetrics.visitedStores.length > 0 && setShowVisitedModal(true)}
              className={`flex items-center gap-1 font-black uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-all ${
                staffMetrics.visitedStores.length > 0 
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/80 cursor-pointer" 
                : "text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-950/20 cursor-not-allowed"
              }`}
              disabled={staffMetrics.visitedStores.length === 0}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Stores Visited: {staffMetrics.visitedStores.length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stores Visited Modal Popup */}
      {showVisitedModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-fade-in relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600 dark:text-blue-450" />
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                    Stores Visited Today
                  </h3>
                  <p className="text-[9px] font-bold text-slate-450 dark:text-slate-550">
                    {selectedStaffName.toUpperCase()}'S ACTIVE OUTINGS
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVisitedModal(false)}
                className="p-1.5 rounded-lg bg-slate-105 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body: Stores list */}
            <div className="max-h-60 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-850">
              {staffMetrics.visitedStores.map((item: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-850/10 px-2 rounded-xl transition-all">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
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
                    <span className="font-black text-emerald-600 dark:text-emerald-450">
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
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Total Visited Today</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-350">
                  {staffMetrics.visitedStores.length} Stores
                </span>
              </div>
              <button
                onClick={() => setShowVisitedModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black rounded-xl hover:bg-slate-850 dark:hover:bg-slate-100 transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Activity Heading */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-1 h-4 bg-blue-600 rounded-full" />
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Today's Activity</h2>
      </div>

      {/* KPI Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        
        {/* Total Collection */}
        <div className="p-5 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-2xl shadow-lg shadow-emerald-900/15 border border-emerald-500/20 hover:scale-[1.03] active:scale-95 transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <div className="flex items-start justify-between w-full">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-inner">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-100" />
            </div>
             <span className="text-[8px] font-black uppercase tracking-wide text-emerald-100/70 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-500/10">
               Today's Collection
             </span>
          </div>
          <div className="mt-4">
            <span className="text-xl md:text-2xl font-black block tracking-tight text-white">
              ₹{(totalCollectedAmount || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-100/80 font-bold block mt-1 tracking-wide">
              Logged cash receipts
            </span>
          </div>
        </div>

        {/* Total Deposits */}
        <div className="p-5 bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white rounded-2xl shadow-lg shadow-red-950/15 border border-red-500/20 hover:scale-[1.03] active:scale-95 transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <div className="flex items-start justify-between w-full">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-inner">
              <FileText className="w-4.5 h-4.5 text-red-100" />
            </div>
             <span className="text-[8px] font-black uppercase tracking-wide text-red-100/70 bg-red-950/30 px-2 py-0.5 rounded-full border border-red-500/10">
               Today's Deposits
             </span>
          </div>
          <div className="mt-4">
            <span className="text-xl md:text-2xl font-black block tracking-tight text-white">
              ₹{(totalDepositedAmount || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-red-100/80 font-bold block mt-1 tracking-wide">
              Bank Deposit Logs
            </span>
          </div>
        </div>

        {/* Net Balance */}
        <div className="p-5 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-800 text-white rounded-2xl shadow-lg shadow-blue-900/15 border border-blue-500/20 hover:scale-[1.03] active:scale-95 transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <div className="flex items-start justify-between w-full">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-4.5 h-4.5 text-blue-100" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-wide text-blue-100/70 bg-blue-950/30 px-2 py-0.5 rounded-full border border-blue-500/10">
              Net Cash
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xl md:text-2xl font-black block tracking-tight text-white">
              ₹{(netCashBalance || 0).toLocaleString()}
            </span>
             <span className="text-[10px] text-blue-100/85 font-bold block mt-1 tracking-wide">
               {todayCount || 0} Entries Today
             </span>
          </div>
        </div>
      </div>

      {/* Recent Ledger Panel */}
      {(() => {
        const recentActivity = [
          ...safeCollections.map(c => ({
            id: c.id,
            date: c.date,
            party: c.retailerName,
            staff: c.staffName || "Admin",
            amount: c.totalAmount,
            type: 'collection'
          })),
          ...safeDeposits.map(d => ({
            id: d.id,
            date: d.date,
            party: d.portalGroupName ? `${d.portalGroupName} (${d.targetName})` : d.targetName,
            staff: d.staffName || "Admin",
            amount: d.amount,
            type: 'deposit'
          }))
        ].sort((a, b) => new Date(b.date.replace(" ", "T")).getTime() - new Date(a.date.replace(" ", "T")).getTime())
         .slice(0, 10);

        return (
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Recent Ledger Activity</h2>
              </div>
              <span className="text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-bold border border-blue-200/60 dark:border-blue-900/40">
                Latest 10 Entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-[9px] font-black uppercase tracking-tight text-slate-400 border-b border-slate-200 dark:border-slate-850">
                    <th className="px-4 py-2.5">Date & Time</th>
                    <th className="px-4 py-2.5">Party / Target Account</th>
                    <th className="px-4 py-2.5">Logged By</th>
                    <th className="px-4 py-2.5 text-right">Transaction Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic font-bold">
                        No recent ledger entries found.
                      </td>
                    </tr>
                  ) : (
                    recentActivity.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-450 dark:text-slate-500 whitespace-nowrap">
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
                          })()}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                          <span className={`inline-block mr-2 w-1.5 h-1.5 rounded-full ${item.type === 'collection' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {item.party}
                        </td>
                        <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {item.staff}
                        </td>
                        <td className={`px-4 py-3 text-right font-black ${item.type === 'collection' ? 'text-emerald-600 bg-emerald-50/5 dark:bg-emerald-950/2' : 'text-red-600 bg-red-50/5 dark:bg-red-950/2'}`}>
                          {item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Recent Activity Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recent Collections Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1">
            <div className="px-5 py-3 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Recent Collections</h2>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
               {safeCollections.slice(0, 5).map((c, idx) => {
                 const snapshots = balanceSnapshots.get(c.id) || { prev: 0, next: 0 };
                 return (
                   <div key={idx} className="p-4 flex flex-col gap-3 group border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition-colors">
                     <div className="flex items-center justify-between text-[11px]">
                       <div className="flex flex-col">
                         <span className="font-extrabold text-slate-850 dark:text-slate-100">{c.retailerName}</span>
                         <span className="text-[9px] text-slate-400 font-bold uppercase">{c.date}</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <span className="font-black text-emerald-600 text-sm">+₹{(c.totalAmount || 0).toLocaleString()}</span>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                           <button 
                             onClick={async () => {
                               const newAmount = prompt("Enter correct collection amount:", c.totalAmount.toString());
                               if(newAmount !== null && !isNaN(parseFloat(newAmount))) {
                                 try {
                                   await api.updateCollection(c.id, {
                                     retailer_id: c.retailer_id,
                                     store_id: c.store_id,
                                     total_amount: parseFloat(newAmount),
                                     remarks: c.remarks,
                                     denominations: {
                                       ...c.denominations,
                                       online_amount: parseFloat(newAmount)
                                     }
                                   });
                                   fetchData();
                                 } catch (err: any) {
                                   alert("Failed to update: " + err.message);
                                 }
                               }
                             }}
                             className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                           >
                             <Edit className="w-3 h-3" />
                           </button>
                           <button 
                             onClick={async () => {
                               if(confirm("Delete this collection?")) {
                                 try {
                                   await api.deleteCollection(c.id);
                                   fetchData();
                                 } catch (err: any) {
                                   alert("Failed to delete: " + err.message);
                                 }
                               }
                             }}
                             className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                           >
                             <Trash2 className="w-3 h-3" />
                           </button>
                         </div>
                       </div>
                     </div>
                     
                     <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Opening</span>
                         <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">₹{snapshots.prev.toLocaleString()}</span>
                       </div>
                       <div className="flex flex-col border-x border-slate-200 dark:border-slate-800 px-3">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Collector</span>
                         <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 line-clamp-1">{c.staffName || 'System'}</span>
                       </div>
                       <div className="flex flex-col text-right">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Closing</span>
                         <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">₹{snapshots.next.toLocaleString()}</span>
                       </div>
                     </div>
                   </div>
                 );
               })}
              {safeCollections.length === 0 && <div className="p-8 text-center text-slate-400 text-[10px] font-bold italic">No collections.</div>}
            </div>
          </div>

          {/* Recent Deposits Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1">
            <div className="px-5 py-3 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Recent Deposits</h2>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
               {safeDeposits.slice(0, 5).map((d, idx) => {
                 const snapshots = balanceSnapshots.get(d.id) || { prev: 0, next: 0 };
                 return (
                   <div key={idx} className="p-4 flex flex-col gap-3 group border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition-colors">
                     <div className="flex items-center justify-between text-[11px]">
                       <div className="flex flex-col">
                         <span className="font-extrabold text-slate-850 dark:text-slate-100">{d.targetName}</span>
                         <span className="text-[9px] text-slate-400 font-bold uppercase">{d.date}</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <span className="font-black text-red-600 text-sm">-₹{(d.amount || 0).toLocaleString()}</span>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                           <button 
                             onClick={async () => {
                               const newAmount = prompt("Enter correct deposit amount:", d.amount.toString());
                               if(newAmount !== null && !isNaN(parseFloat(newAmount))) {
                                 try {
                                   await api.updateDeposit(d.id, {
                                     deposit_type: d.depositType,
                                     portal_id: d.portal_id,
                                     retailer_id: d.retailer_id,
                                     recipient_staff_id: d.recipient_staff_id,
                                     amount: parseFloat(newAmount),
                                     payment_mode: d.paymentMode,
                                     deposit_date: d.date.split(' ')[0], // Extract YYYY-MM-DD
                                     denominations: d.denominations
                                   });
                                   fetchData();
                                 } catch (err: any) {
                                   alert("Failed to update: " + err.message);
                                 }
                               }
                             }}
                             className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                           >
                             <Edit className="w-3 h-3" />
                           </button>
                           <button 
                             onClick={async () => {
                               if(confirm("Delete this deposit?")) {
                                 try {
                                   await api.deleteDeposit(d.id);
                                   fetchData();
                                 } catch (err: any) {
                                   alert("Failed to delete: " + err.message);
                                 }
                               }
                             }}
                             className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                           >
                             <Trash2 className="w-3 h-3" />
                           </button>
                         </div>
                       </div>
                     </div>
 
                     <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Opening</span>
                         <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">₹{snapshots.prev.toLocaleString()}</span>
                       </div>
                       <div className="flex flex-col border-x border-slate-200 dark:border-slate-800 px-3">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Deposited By</span>
                         <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 line-clamp-1">{d.staffName || 'System'}</span>
                       </div>
                       <div className="flex flex-col text-right">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Closing</span>
                         <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">₹{snapshots.next.toLocaleString()}</span>
                       </div>
                     </div>
                   </div>
                 );
               })}
              {safeDeposits.length === 0 && <div className="p-8 text-center text-slate-400 text-[10px] font-bold italic">No deposits.</div>}
            </div>
          </div>
        </div>
    </div>
  );
}
