"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, RefreshCw, Mail, PhoneCall, Check } from "lucide-react";

export default function MaintenancePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [progress, setProgress] = useState(65);
  const [currentStep, setCurrentStep] = useState("Rebuilding Database Indexes...");

  useEffect(() => {
    setMounted(true);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          setCurrentStep("Verifying Cache Integrations...");
          return 95;
        }
        if (prev > 80) {
          setCurrentStep("Optimizing Ledger Transactions...");
        }
        return prev + 5;
      });
    }, 8000);

    return () => clearInterval(progressInterval);
  }, []);

  if (!mounted) return null;

  const handleRefreshStatus = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 select-none">
      <div className="w-full max-w-[420px] flex flex-col gap-4">

        <div className="bg-white dark:bg-slate-900 rounded-sm border border-slate-200 dark:border-slate-800 p-6 text-center">
          <img
            src="/logo.png"
            alt="CrediiFlow Logo"
            className="h-10 w-auto object-contain mx-auto mb-4"
          />

          <div className="mb-4 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 rounded-sm text-[9px] font-black uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>System Under Maintenance</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Scheduled Optimization</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed max-w-[300px] mx-auto">
              We are currently optimizing database structures and upgrading security. We will be back online shortly.
            </p>
          </div>

          {/* Progress Bar & Status updates */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-sm space-y-2 mb-4">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
              <span className="text-slate-600 dark:text-slate-300">{currentStep}</span>
              <span className="text-slate-500 font-mono tabular-nums">{progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-emerald-600"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Interactive Check Button */}
          <div className="space-y-2">
            <button
              onClick={handleRefreshStatus}
              disabled={isRefreshing}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 disabled:opacity-50 text-white dark:text-slate-950 rounded-sm text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Checking Status..." : "Check System Status"}</span>
            </button>

            {showNotification && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-sm text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Services are stabilizing, retry in a minute</span>
              </div>
            )}
          </div>

          {/* Support Contacts */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">
            <a href="mailto:support@crediiflow.in" className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <Mail className="w-3.5 h-3.5" />
              <span>Email Support</span>
            </a>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <a href="tel:+917900671145" className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Helpline</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-0.5">
          <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">CrediiFlow Core Infrastructure v3.0</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase">Secure Redundant Service Cluster</p>
        </div>
      </div>
    </div>
  );
}
