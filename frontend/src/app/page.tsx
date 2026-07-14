"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "./utils/store";
import { Eye, EyeOff, Lock, Phone, ArrowRight } from "lucide-react";

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
      router.push("/welcome");
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Incorrect phone number or password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 select-none">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="w-full max-w-[380px] flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-sm border border-slate-200 dark:border-slate-800 p-6">
          <img
            src="/logo.png"
            alt="CrediiFlow Logo"
            className="h-10 w-auto object-contain mx-auto mb-6"
          />

          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase text-center mb-6">User Login</h2>

          <form onSubmit={handleLogin} className="space-y-3">
            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-sm text-[10px] text-center font-black">
                {error}
              </div>
            )}

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                name="username"
                autoComplete="username"
                placeholder="Mobile Number"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-sm border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-500"
              />
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remember me</span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-sm text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Secure Login</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* System Labels Footer */}
        <div className="text-center space-y-0.5">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CrediiFlow Portal v3.0</p>
          <p className="text-[8px] font-bold text-slate-600">Secure AES-256 Encrypted Session</p>
        </div>
      </div>
    </div>
  );
}
