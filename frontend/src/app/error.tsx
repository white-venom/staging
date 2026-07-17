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

    // Automatically recover from ChunkLoadErrors by reloading the page
    if (
      error &&
      (error.message?.includes("Failed to load chunk") ||
        error.message?.includes("ChunkLoadError") ||
        error.name === "ChunkLoadError")
    ) {
      const lastReload = sessionStorage.getItem("last_chunk_error_reload");
      const now = Date.now();
      // Only reload if we haven't reloaded in the last 10 seconds to prevent infinite loops
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("last_chunk_error_reload", now.toString());
        console.warn("Chunk load error detected. Reloading page for recovery...");
        window.location.reload();
      } else {
        console.error("Chunk load error recurred within 10 seconds. Reload aborted to prevent loop.");
      }
    }
  }, [error]);

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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-sm text-[9px] font-black uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Runtime Critical Exception</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Something Went Wrong</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
              An unexpected error occurred while executing this action. The database state remains secure and active.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => reset()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm text-xs font-black flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Attempt Recovery</span>
            </button>

            <Link
              href="/"
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-sm text-xs font-black flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider text-center transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>

          {/* Developer Details Panel */}
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-left select-text">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[10px] font-black uppercase tracking-wider py-1 cursor-pointer"
            >
              <span>Developer Details</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDetails && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm max-h-[150px] overflow-auto text-[10px] font-mono text-slate-600 dark:text-slate-400 leading-normal break-all">
                <p className="font-bold text-red-600 dark:text-red-400 mb-1">Message: {error.message || "Unknown runtime exception"}</p>
                {error.digest && <p className="text-slate-400">Digest: {error.digest}</p>}
              </div>
            )}
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
