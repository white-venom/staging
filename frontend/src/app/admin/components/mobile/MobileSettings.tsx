"use client";

import React from "react";
import { Users, Settings, LogOut, ChevronRight, Moon, Shield } from "lucide-react";
import { useAppStore } from "@/app/utils/store";
import { useRouter } from "next/navigation";

export default function MobileSettings() {
  const { currentUser, resetStore, theme, toggleTheme } = useAppStore();
  const router = useRouter();

  const handleLogout = () => {
    resetStore();
    router.push("/login");
  };

  const menuItems = [
    { label: "User Management", icon: Users, desc: "Manage staff and admins" },
    { label: "System Security", icon: Shield, desc: "Password and permissions" },
    { label: "App Preferences", icon: Settings, desc: "Interface settings" },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="w-16 h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-center text-2xl font-black">
          {currentUser?.name?.[0]}
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white">{currentUser?.name}</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentUser?.role} Account</p>
        </div>
      </div>

      {/* Settings Menu */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
        {menuItems.map((item, idx) => (
          <button 
            key={idx}
            className="w-full flex items-center gap-4 p-5 border-b border-slate-50 dark:border-slate-800/50 active:bg-slate-50 dark:active:bg-slate-800/30 transition-colors"
          >
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center">
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-black text-slate-800 dark:text-white">{item.label}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        ))}
        
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center gap-4 p-5 border-b border-slate-50 dark:border-slate-800/50 active:bg-slate-50 dark:active:bg-slate-800/30 transition-colors"
        >
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center">
            <Moon className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="text-sm font-black text-slate-800 dark:text-white">Dark Mode</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Current: {theme}</p>
          </div>
          <div className={`w-10 h-5 rounded-full p-1 transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-200'}`}>
             <div className={`w-3 h-3 bg-white rounded-full transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
          </div>
        </button>
      </div>

      {/* Logout Button */}
      <button 
        onClick={handleLogout}
        className="w-full py-5 bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-500 rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <LogOut className="w-4 h-4" />
        Log Out Securely
      </button>

      <div className="h-4" />
    </div>
  );
}
