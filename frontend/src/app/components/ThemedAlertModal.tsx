"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  X, 
  Copy, 
  Check 
} from "lucide-react";
import { useAlertModalStore, setupAlertInterceptor, AlertType } from "../utils/alertModal";

export default function ThemedAlertModal() {
  const { currentAlert, closeAlert } = useAlertModalStore();
  const [copied, setCopied] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  // Initialize global alert interceptor
  useEffect(() => {
    const cleanup = setupAlertInterceptor();
    return cleanup;
  }, []);

  // Lock body scroll and focus confirm button when alert opens
  useEffect(() => {
    if (currentAlert) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      setCopied(false);

      // Focus confirm button for immediate keyboard responsiveness
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          closeAlert();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
        clearTimeout(timer);
      };
    }
  }, [currentAlert, closeAlert]);

  if (!currentAlert) return null;

  const type: AlertType = currentAlert.type || "info";

  // Configuration for icons and accent colors based on alert type
  const config = {
    error: {
      icon: AlertCircle,
      accentColor: "bg-rose-500",
      badgeClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-900/40",
      typeLabel: "Error Notice",
      primaryButtonClass: "bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600 dark:hover:bg-rose-500",
    },
    warning: {
      icon: AlertTriangle,
      accentColor: "bg-amber-500",
      badgeClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-900/40",
      typeLabel: "Attention Required",
      primaryButtonClass: "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-500",
    },
    success: {
      icon: CheckCircle2,
      accentColor: "bg-emerald-500",
      badgeClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-900/40",
      typeLabel: "Success",
      primaryButtonClass: "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500",
    },
    info: {
      icon: Info,
      accentColor: "bg-blue-500",
      badgeClass: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/80 dark:border-blue-900/40",
      typeLabel: "Information",
      primaryButtonClass: "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100",
    },
  }[type];

  const Icon = config.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentAlert.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  const isLongMessage = currentAlert.message.length > 80 || currentAlert.message.includes("\n");

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-150 select-none"
      onClick={closeAlert}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top colored indicator line */}
        <div className={`h-1.5 w-full ${config.accentColor}`} />

        {/* Modal Header */}
        <div className="p-5 pb-3 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs flex-shrink-0 ${config.badgeClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  CrediiFlow
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  type === 'error' ? 'text-rose-600 dark:text-rose-400' :
                  type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                  type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {config.typeLabel}
                </span>
              </div>
              <h3 
                id="alert-modal-title"
                className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight mt-0.5 tracking-tight"
              >
                {currentAlert.title || config.typeLabel}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAlert}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 pt-4 space-y-4">
          <div className="max-h-[50vh] overflow-y-auto pr-1 text-slate-700 dark:text-slate-300">
            <p className="text-sm font-semibold leading-relaxed break-words whitespace-pre-line select-text">
              {currentAlert.message}
            </p>
          </div>

          {/* Optional Copy button for long or technical error details */}
          {isLongMessage && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={closeAlert}
              className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all duration-150 active:scale-[0.99] cursor-pointer ${config.primaryButtonClass}`}
            >
              {currentAlert.confirmText || "Got It"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
