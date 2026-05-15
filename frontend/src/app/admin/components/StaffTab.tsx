"use client";

import React from "react";
import { CheckCircle, Clock } from "lucide-react";

interface StaffTabProps {
  staffComplianceLogs: any[];
}

export default function StaffTab({ staffComplianceLogs }: StaffTabProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Field Compliance Log</h3>
            <p className="text-[9px] text-slate-400 font-medium">Real-time monitoring of staff shift activity.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {(staffComplianceLogs || []).map((log) => {
          const totalKmTravelled = log.endKm ? (log.endKm - log.startKm) : 0;
          return (
            <div
              key={log.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${log.status === "Active Duty" ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`} />
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">{log.name}</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{log.date}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-1">
                <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <span className="text-[8px] uppercase text-slate-400 font-bold block">Start KM</span>
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{log.startKm} km</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <span className="text-[8px] uppercase text-slate-400 font-bold block">End KM</span>
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{log.endKm || "Active..."} km</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <span className="text-[8px] uppercase text-slate-400 font-bold block">Distance Travelled</span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 block mt-1">
                    {totalKmTravelled ? `${totalKmTravelled} km` : "Running..."}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-3 gap-4 items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Started At</span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <Clock className="w-3 h-3 text-blue-500" /> {log.startTime}
                  </div>
                </div>
                
                <div className="flex flex-col gap-1 border-x border-slate-100 dark:border-slate-800 px-4">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ended At</span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <Clock className="w-3 h-3 text-red-400" /> {log.endTime || "Active..."}
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Shift Duration</span>
                  <div className={`text-[10px] font-black ${log.status === "Active Duty" ? "text-emerald-600" : "text-slate-500"}`}>
                    {log.duration}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-900">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Compliance Status</span>
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${log.status === "Active Duty" ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"}`}>
                  {log.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {(staffComplianceLogs || []).length === 0 && (
        <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 border-dashed dark:border-slate-800">
           <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
           <p className="text-sm font-bold text-slate-500">No Staff Activity Found</p>
           <p className="text-[10px] text-slate-400 mt-1">Attendance logs will appear once staff members check-in.</p>
        </div>
      )}
    </div>
  );
}
