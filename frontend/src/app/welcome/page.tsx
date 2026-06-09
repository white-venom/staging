"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!currentUser) {
      router.push("/");
      return;
    }

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        router.push(currentUser.role === "admin" ? "/admin" : "/staff");
      }, 800); // Wait for exit animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentUser, router]);

  if (!mounted || !currentUser) return null;

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden select-none font-sans transition-all duration-1000 ${isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
      
      {/* ── DYNAMIC LIVING BACKGROUND (Fluid Silk + Particles) ── */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center animate-background-pan"
          style={{ 
            backgroundImage: "url('/images/silk-bg.png')",
            filter: 'brightness(0.5) contrast(1.2)',
            width: '120%',
            height: '120%',
            top: '-10%',
            left: '-10%'
          }}
        />
        
        {/* Floating Particles Overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-40">
           {[...Array(20)].map((_, i) => (
             <div 
               key={i}
               className="absolute w-1 h-1 bg-white rounded-full animate-float-particle"
               style={{
                 top: `${Math.random() * 100}%`,
                 left: `${Math.random() * 100}%`,
                 animationDelay: `${Math.random() * 10}s`,
                 animationDuration: `${10 + Math.random() * 20}s`,
                 opacity: Math.random() * 0.5
               }}
             />
           ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-20" />
      </div>

      <div className={`w-full max-w-[800px] relative z-10 text-center space-y-12 transition-all duration-1000 ${isExiting ? 'opacity-0 -translate-y-10 blur-xl' : 'opacity-100 translate-y-0 blur-0'}`}>
        
        {/* Overlapping Dark Rectangular Logo Card (Matching Login Page) */}
        <div className="flex flex-col items-center gap-12 animate-fade-in-down">
          <div className="relative w-56 h-28 flex items-center justify-center">
            {/* Pulsating Aura */}
            <div className="absolute inset-0 bg-indigo-600/20 rounded-3xl blur-3xl animate-pulse"></div>
            <div className="absolute inset-4 bg-emerald-500/10 rounded-3xl blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            {/* Main Rectangular Card */}
            <div className="relative w-48 h-20 bg-slate-900 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden flex items-center justify-center p-4">
               {/* Shimmer Effect */}
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
               
               <img 
                 src="/logo.png" 
                 alt="Logo" 
                 className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" 
               />
            </div>
          </div>
        </div>

        <div className="space-y-6 animate-fade-in-up">
          <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter leading-none">
            Welcome,<br />
            <span className="text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]">
               {currentUser.name.split('(')[0].trim()}
            </span>
          </h1>
        </div>

        {/* Minimal Progress */}
        <div className="relative max-w-[280px] mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
             <div className="h-full bg-white/60 animate-progress-fill"></div>
          </div>
          
          <div className="mt-10 flex flex-col items-center gap-2">
             <div className="flex items-center gap-3 text-[11px] font-black text-white/40 uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                <span>Getting Started...</span>
             </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes backgroundPan {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.1) translate(-2%, -2%); }
          100% { transform: scale(1) translate(0, 0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-30px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes progressFill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes float-particle {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(50px) scale(0.5); opacity: 0; }
        }
        
        .animate-background-pan { animation: backgroundPan 40s ease-in-out infinite; }
        .animate-fade-in-up { animation: fadeInUp 1.2s cubic-bezier(.16,1,.3,1) forwards; }
        .animate-fade-in-down { animation: fadeInDown 1.2s cubic-bezier(.16,1,.3,1) forwards; }
        .animate-progress-fill { animation: progressFill 3s cubic-bezier(.65,0,.35,1) forwards; }
        .animate-shimmer { animation: shimmer 3s infinite linear; }
        .animate-float-particle { animation: float-particle linear infinite; }
      `}</style>

    </div>
  );
}
