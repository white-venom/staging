"use client";

import React from "react";
import { 
  LayoutDashboard, 
  BookOpen, 
  MoreHorizontal, 
  ArrowUpRight, 
  ArrowDownLeft,
  Bell
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
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg flex items-center justify-center font-black text-xs">
            DO
          </div>
          <h1 className="font-black text-slate-900 dark:text-white tracking-tighter uppercase text-sm">Do It Services</h1>
        </div>
        <button className="relative w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />
        </button>
      </header>

      {/* Page Content */}
      <main className="px-6 pt-6 animate-in fade-in duration-500">
        {children}
      </main>

      {/* Premium Bottom Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 z-50">
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
