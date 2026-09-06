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
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 select-none">
      <div className="w-full max-w-[420px] flex flex-col gap-4">

        <div className="bg-white dark:bg-slate-900 rounded-sm border border-slate-200 dark:border-slate-800 p-6 text-center">
          <img
            src="/logo.png"
            alt="CrediiFlow Logo"
            className="h-10 w-auto object-contain mx-auto mb-4"
          />

          <div className="mb-4 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-sm text-[9px] font-black uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              <span>Error Code 404</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Page Not Found</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
              We couldn't find the page you are looking for. It may have been moved, deleted, or never existed in the first place.
            </p>
          </div>

          <div className="space-y-2">
            <Link
              href="/"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm text-xs font-black flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = "/";
                }
              }}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-sm text-xs font-black flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>
          </div>

          {/* Support Contacts */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-4 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <a href="mailto:support@crediiflow.in" className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <Mail className="w-3.5 h-3.5" />
              <span>Email Support</span>
            </a>
            <span className="text-slate-200 dark:text-slate-700">|</span>
            <a href="tel:+917900671145" className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Helpline</span>
            </a>
          </div>

        </div>

        <div className="text-center opacity-60">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CrediiFlow Core Infrastructure</p>
        </div>

      </div>
    </div>
  );
}
