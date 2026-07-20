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
  User,
  ClipboardList,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/app/utils/store";
import { api } from "@/app/utils/api";
import { usePWAInstall } from "@/app/hooks/usePWAInstall";
import PWAInstallModal from "@/app/components/PWAInstallModal";
import { useAdmin } from "../../context/AdminContext";

export default function AdminMobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, resetStore, setCurrentUser } = useAppStore();
  const { showToast, toastMessage, setShowToast } = useAdmin();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Profile Edit States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const { isStandalone, isIOS, installable, triggerInstall } = usePWAInstall();

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

  const handleDeleteAccount = async () => {
    if (!currentUser?.id) return;
    if (!confirm("Are you sure you want to delete your account? This action is irreversible.")) return;
    if (!confirm("Please confirm once more: Do you really want to delete your account? You will be logged out immediately.")) return;
    
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
      
      await api.deleteUser(userId);
      resetStore();
      router.push("/");
    } catch (err: any) {
      alert("Failed to delete account: " + err.message);
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
    { label: "LEDGER", icon: BookOpen, href: "/admin/ledger" },
    { label: "VIRTUAL MONEY TRANSFER", icon: CreditCard, href: "/admin/wallet-transfer" },
    { label: "VIRTUAL LEDGER", icon: ClipboardList, href: "/admin/virtual-ledger" },
    { label: "STAFF", icon: Users, href: "/admin/staff" },
    { label: "RETAILERS", icon: Building, href: "/admin/retailers" },
    { label: "PORTALS", icon: Globe, href: "/admin/bankAccounts" },
    { label: "ATTENDANCE", icon: Clock, href: "/admin/attendance" },
    { label: "ADMINISTRATION", icon: Settings, href: "/admin/administration" },
    { label: "REPORTS", icon: BarChart2, href: "/admin/reports" },
  ];

  const handleLogout = () => {
    resetStore();
    router.push("/");
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
      <header className="sticky top-0 z-40 bg-[#0d1b3e] border-b border-blue-900/40 px-3 py-2 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="CrediiFlow Logo" 
            className="h-6.5 w-auto object-contain"
          />
          <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest mt-0.5">Admin Panel</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Hamburger Button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="w-8 h-8 bg-white/5 border border-white/10 rounded-sm flex items-center justify-center text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main id="printable-area" className="px-2 pt-2.5">
        {children}
      </main>

      {/* Hamburger Drawer/Sidebar Navigation Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 no-print flex">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative ml-auto w-56 max-w-[80vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between">
            <div className="flex flex-col flex-1 min-h-0">
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-3 bg-[#0d1b3e] border border-blue-900/40 rounded-sm mb-3 text-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="CrediiFlow Logo" className="h-6.5 w-auto object-contain" />
                  <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest">Admin</span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-7 h-7 bg-white/5 border border-white/10 rounded-md flex items-center justify-center text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Navigation Items list */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 pb-2 custom-scrollbar">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`
                        w-full p-2 rounded-sm flex items-center gap-2.5 transition-colors
                        ${isActive ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-bold'}
                      `}
                    >
                      <div className="flex-shrink-0">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] tracking-wider uppercase">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer with current account details and logout button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2 flex-shrink-0">
              <div>
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Logged in as</p>
                <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 mt-0.5 truncate">{currentUser?.name || "Administrator"}</p>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{currentUser?.role || "Admin"}</p>
              </div>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowProfileModal(true);
                }}
                className="w-full py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-sm font-black uppercase tracking-widest text-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <User className="w-3 h-3" />
                Edit Profile
              </button>
              {/* PWA Download Button - always shown if not already installed */}
              {!isStandalone && (
                <button
                  onClick={async () => {
                    setIsMenuOpen(false);
                    if (isIOS) { setShowIOSModal(true); return; }
                    const result = await triggerInstall();
                    if (result === "show-ios-modal") setShowIOSModal(true);
                    else if (result === "dismissed") alert("To install: tap the browser 3-dot menu → Install App.");
                  }}
                  className="w-full py-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-sm font-black uppercase tracking-widest text-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-blue-100 dark:border-blue-900/30"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download App
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full py-1.5 bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-500 rounded-sm font-black uppercase tracking-widest text-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                Log Out
              </button>

              <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 text-center">
                <a href="https://xcplllp.com" target="_blank" rel="noopener noreferrer" className="inline-flex flex-col items-center gap-1 text-slate-400 hover:opacity-80 transition-opacity">
                  <span className="text-[8px] font-semibold">Developed and managed by</span>
                  <span className="inline-flex items-center gap-1">
                    <img src="/logo-xc.png" alt="Xenelasia Group Logo" className="h-3 w-auto object-contain align-middle" />
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Xenelasia</span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE UPDATE DIALOG */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Edit My Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-2 text-[10px] font-bold">
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Full Name</label>
                <input autoComplete="one-time-code" type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-sm focus:outline-none dark:text-white" required />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Phone Number</label>
                <input autoComplete="one-time-code" type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-sm focus:outline-none dark:text-white" required />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-1">New Password</label>
                <input autoComplete="new-password" type="password" placeholder="••••••••" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-sm focus:outline-none dark:text-white" />
                <p className="text-[8px] text-slate-400 font-bold ml-1 mt-0.5">Leave blank to keep current</p>
              </div>
              <button type="submit" disabled={isUpdatingProfile} className="w-full py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-sm font-black hover:bg-slate-800 transition-colors uppercase tracking-wider text-[9px] cursor-pointer disabled:opacity-50">{isUpdatingProfile ? "Updating..." : "Save Changes"}</button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="w-full py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-500 rounded-sm font-black uppercase tracking-widest text-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                Delete My Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* iOS PWA Install Instructions Modal */}
      {showIOSModal && <PWAInstallModal onClose={() => setShowIOSModal(false)} />}

      {/* Global Toast */}
      {showToast && (
        <div className="fixed top-4 left-4 right-4 z-[9999]">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-green-500/10 text-green-600 rounded-sm flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">System Notification</p>
                <p className="text-[10px] font-bold text-slate-800 dark:text-white mt-0.5 break-words">{toastMessage}</p>
              </div>
            </div>
            <button onClick={() => setShowToast(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm text-slate-400 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
