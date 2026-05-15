"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/app/utils/store";
import { 
  LayoutGrid, 
  ClipboardList, 
  BookOpen, 
  Menu,
  Bell,
  Search
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";

export default function AdminMobileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, theme } = useAppStore();
  const { showToast, toastMessage, setShowToast } = useAdmin();
  
  const activeTab = pathname.split("/").pop() || "overview";

  const navLinks = [
    { id: "overview", label: "Home", icon: LayoutGrid, path: "/admin" },
    { id: "collections", label: "Cash", icon: ClipboardList, path: "/admin/collections" },
    { id: "ledger", label: "Ledger", icon: BookOpen, path: "/admin/ledger" },
    { id: "more", label: "More", icon: Menu, path: "/admin/administration" },
  ];

  return (
    <div className={`min-h-screen pb-24 ${theme === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight">Admin Portal</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{activeTab === "admin" ? "Overview" : activeTab}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-500">
            <Search className="w-4.5 h-4.5" />
          </button>
          <button className="p-2 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-500">
            <Bell className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-5">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-[2rem] shadow-2xl shadow-black/20 p-2 flex items-center justify-around">
          {navLinks.map((lnk) => {
            const isActive = (activeTab === lnk.id || (lnk.id === "overview" && activeTab === "admin"));
            return (
              <button
                key={lnk.id}
                onClick={() => router.push(lnk.path)}
                className={`flex flex-col items-center gap-1 py-2 px-4 rounded-2xl transition-all ${
                  isActive 
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 scale-105" 
                    : "text-slate-400"
                }`}
              >
                <lnk.icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
                <span className="text-[10px] font-black uppercase tracking-tighter">{lnk.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 left-5 right-5 z-[60] animate-slide-up">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between">
            <p className="text-xs font-bold">{toastMessage}</p>
            <button onClick={() => setShowToast(false)} className="text-[10px] font-black uppercase tracking-widest text-white/50">Dismiss</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}
