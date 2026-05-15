"use client";

import React, { useState, useEffect } from "react";
import { Clock, ShieldAlert, Check, X, Settings2, Sparkles, UserCheck, Calendar } from "lucide-react";
import { api } from "../../utils/api";

interface AttendanceTabProps {
  showToastNotification: (msg: string) => void;
}

export default function AttendanceTab({ showToastNotification }: AttendanceTabProps) {
  const [lateThreshold, setLateThreshold] = useState("10:00");
  const [latePenalty, setLatePenalty] = useState(100);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [pendingPenalties, setPendingPenalties] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
    loadPenalties();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getAdminSettings();
      setLateThreshold(data.late_threshold);
      setLatePenalty(data.late_penalty);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadPenalties = async () => {
    try {
      const data = await api.getPendingPenalties();
      setPendingPenalties(data);
    } catch (err) {
      console.error("Failed to load penalties:", err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await api.updateAdminSettings({
        late_threshold: lateThreshold,
        late_penalty: latePenalty
      });
      showToastNotification("Attendance configuration updated!");
    } catch (err: any) {
      alert("Failed to update settings: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleProcessPenalty = async (id: string, approve: boolean) => {
    try {
      await api.approvePenalty(id, approve);
      showToastNotification(approve ? "Penalty Approved" : "Penalty Rejected");
      loadPenalties();
    } catch (err: any) {
      alert("Error processing penalty: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="grid md:grid-cols-12 gap-6">
        
        {/* LATE PENALTY SETTINGS */}
        <div className="md:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Settings2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Late Policy Config</h3>
          </div>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
             <div>
               <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Late Threshold (Time)</label>
               <input 
                 type="time" 
                 value={lateThreshold} 
                 onChange={e => setLateThreshold(e.target.value)} 
                 className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none" 
               />
             </div>
             <div>
               <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Penalty Amount (₹)</label>
               <input 
                 type="number" 
                 value={latePenalty} 
                 onChange={e => setLatePenalty(Number(e.target.value))} 
                 className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none" 
               />
             </div>
             <button 
               type="submit" 
               disabled={isSavingSettings}
               className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-600/20"
             >
               {isSavingSettings ? "Saving..." : "Save Configuration"}
             </button>
          </form>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
             <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
               Staff checking in after {lateThreshold} will automatically be flagged for a ₹{latePenalty} penalty for admin review.
             </p>
          </div>
        </div>

        {/* PENDING PENALTY APPROVALS */}
        <div className="md:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
             <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Pending Penalty Reviews</h3>
             </div>
             <span className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-black">
               {pendingPenalties.length} ACTION REQUIRED
             </span>
          </div>
          
          <div className="space-y-3 min-h-[300px]">
            {pendingPenalties.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all hover:border-red-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600">
                    {p.staff_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">{p.staff_name}</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                      {p.date} · Check-in at {p.start_time}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs font-black text-red-600 block">₹{p.penalty_amount}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Late Fine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleProcessPenalty(p.id, true)}
                      className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-[10px] font-black uppercase cursor-pointer"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleProcessPenalty(p.id, false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-all text-[10px] font-black uppercase cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {pendingPenalties.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">All penalties reviewed</p>
                <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wide text-center max-w-[200px]">
                  No late check-ins pending administrative review.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADDITIONAL FEATURES PLACEHOLDER */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-indigo-600 rounded-[2rem] text-white space-y-4 shadow-xl shadow-indigo-600/20">
           <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
             <Calendar className="w-6 h-6" />
           </div>
           <div>
             <h4 className="font-black text-lg">Shift Rostering</h4>
             <p className="text-[10px] font-bold opacity-80 uppercase tracking-wide mt-1">Coming Soon</p>
           </div>
           <p className="text-xs font-medium leading-relaxed opacity-90">
             Assign custom shift timings to individual staff members for granular compliance tracking.
           </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-4 shadow-sm">
           <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl flex items-center justify-center">
             <UserCheck className="w-6 h-6" />
           </div>
           <div>
             <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">Leave Management</h4>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Under Development</p>
           </div>
           <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
             Approve leave requests and track staff time-off directly from the attendance dashboard.
           </p>
        </div>

        <div className="p-6 bg-emerald-600 rounded-[2rem] text-white space-y-4 shadow-xl shadow-emerald-600/20">
           <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
             <Sparkles className="w-6 h-6" />
           </div>
           <div>
             <h4 className="font-black text-lg">Smart Insights</h4>
             <p className="text-[10px] font-bold opacity-80 uppercase tracking-wide mt-1">Planned</p>
           </div>
           <p className="text-xs font-medium leading-relaxed opacity-90">
             Get AI-driven reports on staff punctuality and performance trends across routes.
           </p>
        </div>
      </div>
    </div>
  );
}
