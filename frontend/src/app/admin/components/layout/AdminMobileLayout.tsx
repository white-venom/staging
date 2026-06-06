"use client";

import React, { useState } from "react";
import { 
  LayoutDashboard, 
  BookOpen, 
  ArrowUpRight, 
  ArrowDownLeft,
  Menu,
  X,
  Users,
  Building,
  Globe,
  LogOut,
  CreditCard,
  Clock,
  Settings,
  BarChart2,
  User
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/app/utils/store";
import { api } from "@/app/utils/api";

export default function AdminMobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, resetStore, setCurrentUser } = useAppStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Profile Edit States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  React.useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
      setProfilePhone(currentUser.phone);
    }
  }, [currentUser, showProfileModal]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setIsUpdatingProfile(true);
    try {
      let userId = currentUser.id;
      if (userId.startsWith("user-")) {
        const allUsers = await api.getUsers();
        const matched = allUsers.find((u: any) => u.phone === currentUser.phone);
        if (matched) {
          userId = matched.id;
        } else {
          throw new Error("Unable to resolve admin profile ID from database.");
        }
      }

      const payload: any = {
        name: profileName,
        phone: profilePhone,
        role: currentUser.role
      };
      if (profilePassword) {
        payload.password = profilePassword;
      }
      const updatedUser = await api.updateUser(userId, payload);
      setCurrentUser({
        ...currentUser,
        id: userId,
        name: updatedUser.name,
        phone: updatedUser.phone
      });
      alert("Profile updated successfully!");
      setShowProfileModal(false);
      setProfilePassword("");
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  React.useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  const navItems = [
    { label: "HOME", icon: LayoutDashboard, href: "/admin" },
    { label: "CASH IN", icon: ArrowUpRight, href: "/admin/collections" },
    { label: "CASH OUT", icon: ArrowDownLeft, href: "/admin/deposits" },
    { label: "LEDGER", icon: BookOpen, href: "/admin/ledger" },
    { label: "VIRTUAL MONEY TRANSFER", icon: CreditCard, href: "/admin/wallet-transfer" },
    { label: "STAFF MGMT", icon: Users, href: "/admin/staff" },
    { label: "RETAILER MGMT", icon: Building, href: "/admin/retailers" },
    { label: "PORTAL MGMT", icon: Globe, href: "/admin/portals" },
    { label: "ATTENDANCE", icon: Clock, href: "/admin/attendance" },
    { label: "ADMINISTRATION", icon: Settings, href: "/admin/administration" },
    { label: "REPORTS", icon: BarChart2, href: "/admin/reports" },
  ];

  const handleLogout = () => {
    resetStore();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          nav, header, button { display: none !important; }
        }
      `}</style>

      {/* Mobile Header with Logo and Hamburger Button */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between no-print">
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
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Admin Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hamburger Button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="w-10 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-transform cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main id="printable-area" className="px-6 pt-6 animate-in fade-in duration-500">
        {children}
      </main>

      {/* Hamburger Drawer/Sidebar Navigation Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 no-print flex">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative ml-auto w-64 max-w-[80vw] h-full bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.3)] p-5 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div className="flex flex-col flex-1 min-h-0">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4 flex-shrink-0">
                <div className="flex flex-col">
                  <span className="text-lg font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Do-It-Services</span>
                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">Admin Panel</span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items list */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 pb-4 custom-scrollbar">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`
                        w-full p-3.5 rounded-2xl flex items-center gap-3.5 transition-all duration-200 active:scale-[0.98]
                        ${isActive ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-bold'}
                      `}
                    >
                      <div className="flex-shrink-0">
                        <item.icon className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-[11px] tracking-wider uppercase">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer with current account details and logout button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 flex-shrink-0">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Logged in as</p>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-0.5 truncate">{currentUser?.name || "Administrator"}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{currentUser?.role || "Admin"}</p>
              </div>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowProfileModal(true);
                }}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                Edit Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-red-50 text-red-650 dark:bg-red-900/10 dark:text-red-500 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log Out Securely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE UPDATE DIALOG */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Edit My Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name</label>
                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg focus:outline-none dark:text-white" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Phone Number</label>
                <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg focus:outline-none dark:text-white" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">New Password</label>
                <input type="password" placeholder="••••••••" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg focus:outline-none dark:text-white" />
                <p className="text-[9px] text-slate-400 font-bold ml-1 mt-0.5">Leave blank to keep current password (min 6 chars)</p>
              </div>
              <button type="submit" disabled={isUpdatingProfile} className="w-full py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl font-bold hover:bg-slate-800 transition-colors uppercase tracking-wider text-[10px] cursor-pointer disabled:opacity-50">{isUpdatingProfile ? "Updating..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
