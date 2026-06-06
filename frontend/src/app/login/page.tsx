"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";
import { LogIn, Phone, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser, theme, toggleTheme } = useAppStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && currentUser) {
      if (currentUser.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    }
  }, [currentUser, router, mounted]);

  if (!mounted) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { api } = await import("../utils/api");
      const response = await api.login({
        phone: phone,
        password: password
      });

      setCurrentUser({
        id: response.id,
        name: response.name,
        phone: phone,
        role: response.role,
        token: response.access_token
      });

      if (response.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || "Invalid phone number or password. Please use the test accounts listed below.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0c] relative overflow-hidden select-none">
      {/* Dynamic Background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-900/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-[400px] bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 transition-all duration-500 hover:shadow-purple-500/10 border border-slate-100 dark:border-slate-800">
        
        {/* Card Header Illustration */}
        <div className="h-56 relative overflow-hidden group">
          <img 
            src="/images/login-bg.png" 
            alt="Login Illustration" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-transparent to-transparent opacity-80"></div>
          
          {/* Logo overlay on image */}
          <div className="absolute bottom-6 left-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-black tracking-tighter text-sm uppercase">Do It Services</span>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="px-10 pb-10 pt-4">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Login</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-[10px] text-center font-bold">
                {error}
              </div>
            )}

            {/* Phone Input */}
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute left-0 top-0 w-11 h-full bg-[#fce4ec] dark:bg-pink-950/30 rounded-2xl flex items-center justify-center transition-colors group-focus-within:bg-pink-100">
                  <Phone className="w-4 h-4 text-[#f06292]" />
                </div>
                <input
                  type="tel"
                  placeholder="Username / Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-14 pr-4 py-3.5 bg-[#fce4ec]/50 dark:bg-pink-950/10 border-none rounded-2xl focus:outline-none transition-all text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-[#f06292]/50"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute left-0 top-0 w-11 h-full bg-[#fce4ec] dark:bg-pink-950/30 rounded-2xl flex items-center justify-center transition-colors group-focus-within:bg-pink-100">
                  <Lock className="w-4 h-4 text-[#f06292]" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-12 py-3.5 bg-[#fce4ec]/50 dark:bg-pink-950/10 border-none rounded-2xl focus:outline-none transition-all text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-[#f06292]/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#f06292]/60 hover:text-[#f06292] focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative transition-colors group-hover:bg-purple-200">
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">remember me</span>
              </label>
              <button type="button" className="text-[10px] font-bold text-slate-500 hover:text-purple-600 transition-colors">
                forgot password
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-[#7e57c2] hover:bg-[#673ab7] text-white rounded-xl text-xs font-black shadow-lg shadow-purple-200 dark:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer uppercase tracking-widest mt-4"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Login"
              )}
            </button>
          </form>

          {/* Create Account Link */}
          <div className="mt-8 text-center">
            <button className="text-[11px] font-black text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider">
              Create Account
            </button>
          </div>

          {/* Testing Credentials (Collapsible/Subtle) */}
          {process.env.NODE_ENV === "development" && (
             <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
                <p className="text-[9px] uppercase font-black text-slate-350 dark:text-slate-600 tracking-widest mb-3">Test System Accounts</p>
                <div className="flex gap-4">
                   <div className="flex-1 text-[9px] text-slate-400">
                      <span className="block font-bold text-slate-500 mb-0.5">STAFF:</span>
                      <span>9917128864 / pass123</span>
                   </div>
                   <div className="flex-1 text-[9px] text-slate-400 border-l border-slate-100 dark:border-slate-800 pl-4">
                      <span className="block font-bold text-slate-500 mb-0.5">ADMIN:</span>
                      <span>7900671145 / pass123</span>
                   </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
