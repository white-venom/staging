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
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden select-none font-sans text-white">
      
      {/* ── DYNAMIC LIVING BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center animate-background-pan"
          style={{ 
            backgroundImage: "url('/images/silk-bg.png')",
            filter: 'brightness(0.4) contrast(1.3)',
            width: '120%',
            height: '120%',
            top: '-10%',
            left: '-10%'
          }}
        />
        
        {/* Floating Particles Overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-30">
           {[...Array(15)].map((_, i) => (
             <div 
               key={i}
               className="absolute w-1 h-1 bg-indigo-400 rounded-full animate-float-particle"
               style={{
                 top: `${Math.random() * 100}%`,
                 left: `${Math.random() * 100}%`,
                 animationDelay: `${Math.random() * 8}s`,
                 animationDuration: `${12 + Math.random() * 18}s`,
                 opacity: Math.random() * 0.4
               }}
             />
           ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent z-20" />
      </div>

      <style>{`
        @keyframes backgroundPan {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.08) translate(-1.5%, -1.5%); }
          100% { transform: scale(1) translate(0, 0); }
        }
        @keyframes float-particle {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          25% { opacity: 0.6; }
          75% { opacity: 0.6; }
          100% { transform: translateY(-80vh) translateX(40px) scale(0.6); opacity: 0; }
        }
        .animate-background-pan { animation: backgroundPan 30s ease-in-out infinite; }
        .animate-float-particle { animation: float-particle linear infinite; }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(.16,1,.3,1) forwards; }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer { animation: shimmer 2.5s infinite linear; }
      `}</style>

      {/* Decorative Aura Blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px]"></div>

      {/* Main Card */}
      <div className="w-full max-w-[450px] relative z-10 flex flex-col gap-6 animate-scale-in">
        
        {/* Glassmorphic Container */}
        <div className="bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] p-10 pt-24 relative border border-white/10 overflow-visible text-center">
          
          {/* Pulsing Logo Sphere */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 flex items-center justify-center pointer-events-none">
            {/* Glowing Aura */}
            <div className="absolute inset-0 bg-indigo-600/25 rounded-full blur-2xl animate-pulse"></div>
            
            {/* Main Circle Logo Container */}
            <div className="relative w-28 h-28 bg-slate-950 rounded-full shadow-[0_15px_45px_rgba(0,0,0,0.7)] border border-white/10 overflow-hidden flex items-center justify-center p-3">
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
               <img 
                 src="/logo.png" 
                 alt="CrediiFlow Logo" 
                 className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] animate-pulse" 
               />
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-wider mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>SYSTEM UNDER MAINTENANCE</span>
            </div>
            <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Scheduled Optimization</h2>
            <p className="text-xs text-slate-450 font-bold leading-relaxed max-w-[300px] mx-auto text-slate-400">
              We are currently optimizing database structures and upgrading security. We will be back online shortly.
            </p>
          </div>

          {/* Progress Bar & Status updates */}
          <div className="bg-slate-950/60 border border-white/5 p-5 rounded-2xl space-y-3 mb-6">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-450">
              <span className="text-indigo-400">{currentStep}</span>
              <span className="text-slate-300">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Interactive Check Button */}
          <div className="space-y-4">
            <button
              onClick={handleRefreshStatus}
              disabled={isRefreshing}
              className="w-full py-4.5 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-950/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer border border-white/10 uppercase tracking-wider"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Checking Status..." : "Check System Status"}</span>
            </button>
            
            {showNotification && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 animate-scale-in">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Services are stabilizing, retry in a minute</span>
              </div>
            )}
          </div>

          {/* Support Contacts */}
          <div className="mt-8 pt-6 border-t border-white/5 flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">
            <a href="mailto:support@crediiflow.in" className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
              <Mail className="w-4 h-4" />
              <span>Email Support</span>
            </a>
            <span className="text-white/10">|</span>
            <a href="tel:+917900671145" className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
              <PhoneCall className="w-4 h-4" />
              <span>Call Helpline</span>
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center opacity-40 space-y-1">
          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">CrediiFlow Core Infrastructure v3.0</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase">Secure Redundant Service Cluster</p>
        </div>

      </div>

    </div>
  );
}
