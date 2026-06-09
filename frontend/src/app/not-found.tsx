"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Compass, Home, Mail, PhoneCall, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
              className="absolute w-1 h-1 bg-indigo-500 rounded-full animate-float-particle"
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
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px]"></div>

      {/* Main Card */}
      <div className="w-full max-w-[450px] relative z-10 flex flex-col gap-6 animate-scale-in">
        
        {/* Glassmorphic Container */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(15,23,42,0.08)] p-10 pt-24 relative border border-slate-200/80 overflow-visible text-center">
          
          {/* Pulsing Logo Rectangle */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-24 flex items-center justify-center pointer-events-none">
            {/* Glowing Aura */}
            <div className="absolute inset-0 bg-indigo-600/15 rounded-3xl blur-2xl animate-pulse"></div>
            
            {/* Main Rectangular Logo Container */}
            <div className="relative w-40 h-16 bg-white rounded-2xl shadow-[0_15px_45px_rgba(15,23,42,0.08)] border border-slate-200/60 overflow-hidden flex items-center justify-center p-2">
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/5 to-transparent -translate-x-full animate-shimmer"></div>
               <img 
                 src="/logo.png" 
                 alt="CrediiFlow Logo" 
                 className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.05)]" 
               />
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-wider mb-2">
              <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
              <span>ERROR CODE 404</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Page Not Found</h2>
            <p className="text-xs text-slate-500 font-bold leading-relaxed max-w-[300px] mx-auto">
              We couldn't find the page you are looking for. It may have been moved, deleted, or never existed in the first place.
            </p>
          </div>

          {/* Interactive Navigation */}
          <div className="space-y-4">
            <Link
              href="/"
              className="w-full py-4.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/15 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer border border-transparent uppercase tracking-wider"
            >
              <Home className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
            
            <Link
              href="/"
              className="w-full py-4 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-2xl text-xs font-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer border border-slate-200/40 uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </Link>
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
