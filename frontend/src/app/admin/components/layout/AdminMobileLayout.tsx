"use client";

import React from "react";
import { 
  LayoutDashboard, 
  BookOpen, 
  MoreHorizontal, 
  ArrowUpRight, 
  ArrowDownLeft
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/app/utils/store";

export default function AdminMobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = useAppStore();

  const navItems = [
    { label: "HOME", icon: LayoutDashboard, href: "/admin" },
    { label: "CASH IN", icon: ArrowUpRight, href: "/admin/collections" },
    { label: "CASH OUT", icon: ArrowDownLeft, href: "/admin/deposits" },
    { label: "LEDGER", icon: BookOpen, href: "/admin/ledger" },
    { label: "MORE", icon: MoreHorizontal, href: "/admin/administration" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          nav, header, button { display: none !important; }
        }
      `}</style>

      {/* Mobile Header with Logo in Premium Coloured Box */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-6 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="relative group">
            {/* The Glow */}
            <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl scale-110" />
            
            {/* The Coloured Box Container */}
            <div className="relative w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg">
              <img 
                src="/logo.png" 
                alt="DOIT Logo" 
                className="w-full h-full object-contain brightness-100 dark:brightness-0"
              />
            </div>
          </div>
          <div>
            <h1 className="font-black text-slate-900 dark:text-white tracking-tighter uppercase text-sm leading-none">Do It Services</h1>
            <p className="text-[8px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Admin Panel</p>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main id="printable-area" className="px-6 pt-6 animate-in fade-in duration-500">
        {children}
      </main>

      {/* Premium Bottom Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 z-50 no-print">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[2rem] px-4 py-3 flex items-center justify-between overflow-hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.label} 
                href={item.href}
                className="flex flex-col items-center gap-1 group relative flex-1"
              >
                <div className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                  ${isActive ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 scale-110' : 'text-slate-400 group-active:scale-90'}
                `}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={`text-[8px] font-black tracking-widest transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 w-1 h-1 bg-slate-900 dark:bg-white rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
