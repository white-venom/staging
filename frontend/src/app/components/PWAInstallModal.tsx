"use client";

import React from "react";
import { X, Share, Plus } from "lucide-react";

interface PWAInstallModalProps {
  onClose: () => void;
}

export default function PWAInstallModal({ onClose }: PWAInstallModalProps) {
  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-sm flex items-center justify-center">
              <img src="/favicon.ico" alt="App Icon" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Install App</p>
              <h3 className="text-sm font-black text-white">Add to Home Screen</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 transition-colors rounded-sm flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Steps */}
        <div className="p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
            Follow these steps in Safari
          </p>

          {/* Step 1 */}
          <div className="flex items-start gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 bg-slate-800 dark:bg-slate-700 rounded-sm flex items-center justify-center text-white text-xs font-black flex-shrink-0">1</div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">Tap the Share button</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                At the bottom of the Safari browser, tap the{" "}
                <span className="inline-flex items-center gap-0.5 text-slate-700 dark:text-slate-300 font-black">
                  <Share className="w-3 h-3" /> Share
                </span>{" "}
                icon.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 bg-slate-800 dark:bg-slate-700 rounded-sm flex items-center justify-center text-white text-xs font-black flex-shrink-0">2</div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">Select "Add to Home Screen"</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                Scroll down in the share menu and tap{" "}
                <span className="inline-flex items-center gap-0.5 text-slate-700 dark:text-slate-300 font-black">
                  <Plus className="w-3 h-3" /> Add to Home Screen
                </span>.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 bg-slate-800 dark:bg-slate-700 rounded-sm flex items-center justify-center text-white text-xs font-black flex-shrink-0">3</div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">Tap "Add" to confirm</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                In the top-right corner of the dialog, tap <span className="text-slate-700 dark:text-slate-300 font-black">Add</span> to install the app icon on your Home Screen.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-sm font-black text-xs uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}
