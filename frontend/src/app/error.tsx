"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RefreshCw, Home, Mail, PhoneCall, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  const [mounted, setMounted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.error("System runtime error:", error);
  }, [error]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden select-none font-sans text-slate-800">
      
      {/* ── DYNAMIC BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center animate-background-pan"
          style={{ 
            backgroundImage: "url('/images/silk-bg.png')",
            filter: 'brightness(1.05) contrast(0.95) opacity-40',
            width: '120%',
            height: '120%',
            top: '-10%',
            left: '-10%'
          }}
        />
        
        {/* Floating Particles Overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-30">
          {[...Array(10)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-1 h-1 bg-red-400 rounded-full animate-float-particle"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${15 + Math.random() * 15}s`,
                opacity: Math.random() * 0.4
              }}
            />
          ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/40 to-transparent z-20" />
      </div>

      <style>{`
        @keyframes backgroundPan {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.05) translate(-1%, -1%); }
          100% { transform: scale(1) translate(0, 0); }
        }
        @keyframes float-particle {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          25% { opacity: 0.6; }
          75% { opacity: 0.6; }
          100% { transform: translateY(-80vh) translateX(30px) scale(0.6); opacity: 0; }
        }
        .animate-background-pan { animation: backgroundPan 25s ease-in-out infinite; }
        .animate-float-particle { animation: float-particle linear infinite; }
        .animate-scale-in { animation: scaleIn 0.6s cubic-bezier(.16,1,.3,1) forwards; }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer { animation: shimmer 2.5s infinite linear; }
      `}</style>

      {/* Decorative Aura Blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/5 rounded-full blur-[120px]"></div>

      {/* Main Card */}
      <div className="w-full max-w-[450px] relative z-10 flex flex-col gap-6 animate-scale-in">
        
        {/* Glassmorphic Container */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(15,23,42,0.08)] p-10 pt-24 relative border border-slate-200/80 overflow-visible text-center">
          
          {/* Pulsing Logo Rectangle */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-24 flex items-center justify-center pointer-events-none">
            {/* Glowing Aura */}
            <div className="absolute inset-0 bg-red-600/10 rounded-3xl blur-2xl animate-pulse"></div>
            
            {/* Main Rectangular Logo Container */}
            <div className="relative w-40 h-16 bg-white rounded-2xl shadow-[0_15px_45px_rgba(15,23,42,0.08)] border border-slate-200/60 overflow-hidden flex items-center justify-center p-2">
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/5 to-transparent -translate-x-full animate-shimmer"></div>
               <img 
                 src="/logo.png" 
                 alt="CrediiFlow Logo" 
                 className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.05)] animate-pulse" 
                 style={{ animationDuration: '4s' }}
               />
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-[9px] font-black uppercase tracking-wider mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>RUNTIME CRITICAL EXCEPTION</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Something Went Wrong</h2>
            <p className="text-xs text-slate-500 font-bold leading-relaxed max-w-[300px] mx-auto">
              An unexpected error occurred while executing this action. The database state remains secure and active.
            </p>
          </div>

          {/* Interactive Navigation */}
          <div className="space-y-4">
            <button
              onClick={() => reset()}
              className="w-full py-4.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/15 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer border border-transparent uppercase tracking-wider"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Attempt Recovery</span>
            </button>
            
            <Link
              href="/"
              className="w-full py-4 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-2xl text-xs font-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer border border-slate-200/40 uppercase tracking-wider text-center"
            >
              <Home className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>

          {/* Developer Details Panel */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-left select-text">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-wider py-1 cursor-pointer"
            >
              <span>Developer Details</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            
            {showDetails && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-xl max-h-[150px] overflow-auto text-[10px] font-mono text-slate-600 leading-normal break-all">
                <p className="font-bold text-red-650 mb-1">Message: {error.message || "Unknown runtime exception"}</p>
                {error.digest && <p className="text-slate-400">Digest: {error.digest}</p>}
              </div>
            )}
          </div>

          {/* Support Contacts */}
          <div className="mt-8 pt-6 border-t border-slate-200/80 flex justify-center gap-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">
            <a href="mailto:support@crediiflow.in" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
              <Mail className="w-4 h-4 text-slate-500" />
              <span>Email Support</span>
            </a>
            <span className="text-slate-200">|</span>
            <a href="tel:+917900671145" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
              <PhoneCall className="w-4 h-4 text-slate-500" />
              <span>Call Helpline</span>
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center opacity-65 space-y-1">
          <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">CrediiFlow Core Infrastructure v3.0</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase">Secure Redundant Service Cluster</p>
        </div>

      </div>

    </div>
  );
}
