"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "./utils/store";
import { Eye, EyeOff, Lock, Phone, ShieldCheck, ArrowRight, Check } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useAppStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedPhone = localStorage.getItem("rememberedPhone");
    if (savedPhone) {
      setPhone(savedPhone);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (mounted && currentUser) {
      router.push("/welcome");
    }
  }, [currentUser, router, mounted]);

  if (!mounted) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) { setError("Enter a valid 10-digit number."); return; }
    if (!password) { setError("Please enter your password."); return; }

    setError("");
    setIsLoading(true);
    try {
      const { api } = await import("./utils/api");
      const response = await api.login({ phone, password });
      
      if (rememberMe) {
        localStorage.setItem("rememberedPhone", phone);
      } else {
        localStorage.removeItem("rememberedPhone");
      }

      setCurrentUser({
        id: response.id,
        name: response.name,
        phone,
        role: response.role,
        token: response.access_token,
      });
      setIsExiting(true);
      setTimeout(() => {
        router.push("/welcome");
      }, 800);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Incorrect phone number or password.");
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden select-none font-sans transition-all duration-1000 ${isExiting ? 'opacity-0 scale-95 blur-lg' : 'opacity-100 scale-100 blur-0'}`}>
      
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
        <div className="absolute inset-0 z-10 pointer-events-none opacity-30">
           {[...Array(20)].map((_, i) => (
             <div 
               key={i}
               className="absolute w-1 h-1 bg-white rounded-full animate-float-particle"
               style={{
                 top: `${Math.random() * 100}%`,
                 left: `${Math.random() * 100}%`,
                 animationDelay: `${Math.random() * 10}s`,
                 animationDuration: `${10 + Math.random() * 20}s`,
                 opacity: Math.random() * 0.4
               }}
             />
           ))}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-20" />
      </div>

      <style>{`
        @keyframes backgroundPan {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.1) translate(-2%, -2%); }
          100% { transform: scale(1) translate(0, 0); }
        }
        @keyframes float-particle {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(50px) scale(0.5); opacity: 0; }
        }
        .animate-background-pan { animation: backgroundPan 40s ease-in-out infinite; }
        .animate-float-particle { animation: float-particle linear infinite; }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(.16,1,.3,1) forwards; }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer { animation: shimmer 2s infinite linear; }
        
        /* Hide number input spinners */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* ── FLOATING PARTICLES (Stardust effect) ── */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[140px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/5 rounded-full blur-[140px]"></div>

      <div className="w-full max-w-[420px] relative z-10 flex flex-col gap-6 animate-scale-in">
        
        {/* ── MAIN LOGIN CARD (Minimal Professional Polish) ── */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.5)] p-10 pt-28 relative border border-white/10 overflow-visible">
          
          {/* Overlapping Dark Circular Logo Card */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 flex items-center justify-center pointer-events-none">
            {/* Pulsating Aura */}
            <div className="absolute inset-0 bg-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
            
            {/* Main Circular Card */}
            <div className="relative w-32 h-32 bg-slate-950 rounded-full shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden flex items-center justify-center p-4">
               {/* Shimmer Effect */}
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
               
               <img 
                 src="/logo.png" 
                 alt="Do It Services Logo" 
                 className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]" 
               />
            </div>
          </div>

          <div className="text-center mb-10">
             <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase opacity-90">User Login</h2>
             <div className="h-0.5 w-8 bg-indigo-500 mx-auto mt-2 rounded-full opacity-50"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] text-center font-black animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-all duration-300">
                  <Phone className="w-5 h-5" />
                </div>
                 <input
                  type="tel"
                  name="username"
                  autoComplete="username"
                  placeholder="Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full pl-14 pr-5 py-5 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500/50 focus:ring-[12px] focus:ring-indigo-500/5 transition-all text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400/70"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-all duration-300">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-12 py-5 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500/50 focus:ring-[12px] focus:ring-indigo-500/5 transition-all text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400/70"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-350 hover:text-indigo-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-start px-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative w-6 h-6 flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="absolute inset-0 opacity-0 z-20 cursor-pointer" 
                  />
                  <div className={`w-full h-full rounded-lg border-2 transition-all duration-300 z-10 flex items-center justify-center ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-700 bg-transparent'}`}>
                    {rememberMe && <Check className="w-4 h-4 text-white stroke-[4]" />}
                  </div>
                </div>
                <span className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-slate-900 hover:bg-slate-950 text-white rounded-2xl text-[12px] font-black shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50 cursor-pointer uppercase tracking-wider border border-white/5"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Secure Login</span>
                  <ArrowRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* System Labels Footer */}
        <div className="text-center space-y-1 opacity-50">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Do It Services Portal v3.0</p>
           <p className="text-[8px] font-bold text-slate-500">Secure AES-256 Encrypted Session</p>
        </div>

      </div>

      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp   { from { opacity:0; transform:translateY(30px); }  to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.95); }        to { opacity:1; transform:scale(1); } }
        @keyframes float    { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-20px); } }
        @keyframes shake    { 0%,100% { transform:translateX(0); } 20%,60% { transform:translateX(-6px); } 40%,80% { transform:translateX(6px); } }
        
        @keyframes backgroundPan {
          0% { transform: translateX(0); }
          50% { transform: translateX(5%); }
          100% { transform: translateX(0); }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-shimmer { animation: shimmer 3s infinite linear; }
        .animate-background-pan { animation: backgroundPan 15s ease-in-out infinite; }
        .animate-slide-down { animation: slideDown 0.6s cubic-bezier(.16,1,.3,1) forwards; }
        .animate-slide-up   { animation: slideUp   0.6s cubic-bezier(.16,1,.3,1) forwards; }
        .animate-scale-in   { animation: scaleIn  0.5s cubic-bezier(.16,1,.3,1) forwards; }
        .animate-float      { animation: float 6s ease-in-out infinite; }
        .animate-shake      { animation: shake 0.4s ease-in-out; }
      `}</style>

    </div>
  );
}
