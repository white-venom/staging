"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/app/utils/store";
import { 
  LayoutGrid, 
  ClipboardList, 
  TrendingUp, 
  BookOpen, 
  Globe, 
  Home, 
  Users, 
  Settings, 
  BarChart2, 
  Clock,
  LogOut,
  X,
  CheckCircle2
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { api } from "@/app/utils/api";

export default function AdminDesktopLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, resetStore, theme } = useAppStore();
  const { 
    showToast, 
    toastMessage, 
    setShowToast, 
    fetchData, 
    showToastNotification,
    showRetailerDrawer,
    setShowRetailerDrawer,
    showPortalDrawer,
    setShowPortalDrawer
  } = useAdmin();
  
  // States for new entries
  const [retailerName, setRetailerName] = useState("");
  const [retailerPhone, setRetailerPhone] = useState("");
  const [retailerArea, setRetailerArea] = useState("");
  const [retailerEmail, setRetailerEmail] = useState("");
  const [retailerToGive, setRetailerToGive] = useState(0);
  const [retailerToTake, setRetailerToTake] = useState(0);
  const [pGroupName, setPGroupName] = useState("");
  const [pGroupToGive, setPGroupToGive] = useState(0);
  const [pGroupToTake, setPGroupToTake] = useState(0);

  const activeTab = pathname.split("/").pop() || "overview";

  const handleAddRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRetailer({
        retailer_name: retailerName,
        phone: retailerPhone,
        address: retailerArea,
        email: retailerEmail,
        opening_to_give: retailerToGive,
        opening_to_take: retailerToTake
      });
      showToastNotification(`Store "${retailerName}" registered successfully!`);
      setShowRetailerDrawer(false);
      setRetailerName("");
      setRetailerPhone("");
      setRetailerArea("");
      setRetailerEmail("");
      setRetailerToGive(0);
      setRetailerToTake(0);
      fetchData();
    } catch (err: any) {
      alert("Failed to register store: " + err.message);
    }
  };

  const handleCreatePortalGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPortalGroup({ 
        name: pGroupName,
        opening_to_give: pGroupToGive,
        opening_to_take: pGroupToTake
      });

      showToastNotification(`Portal Group "${pGroupName}" registered!`);
      setShowPortalDrawer(false);
      setPGroupName("");
      setPGroupToGive(0);
      setPGroupToTake(0);
      fetchData();
    } catch (err: any) {
      alert("Failed to register portal: " + err.message);
    }
  };

  const navLinks = [
    { id: "overview", label: "Dashboard", icon: LayoutGrid, path: "/admin" },
    { id: "collections", label: "Cash In", icon: ClipboardList, path: "/admin/collections" },
    { id: "deposits", label: "Cash Out", icon: TrendingUp, path: "/admin/deposits" },
    { id: "ledger", label: "Ledger", icon: BookOpen, path: "/admin/ledger" },
    { id: "portals", label: "Portals", icon: Globe, path: "/admin/portals" },
    { id: "retailers", label: "Retailers", icon: Home, path: "/admin/retailers" },
    { id: "staff", label: "Staff", icon: Users, path: "/admin/staff" },
    { id: "attendance", label: "Attendance", icon: Clock, path: "/admin/attendance" },
    { id: "administration", label: "Administration", icon: Settings, path: "/admin/administration" },
    { id: "reports", label: "Reports", icon: BarChart2, path: "/admin/reports" },
  ];

  return (
    <div className={`flex min-h-screen ${theme === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-900"}`}>
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-150 dark:border-slate-800 p-6 flex flex-col fixed h-full z-20 transition-all shadow-sm">
        <div className="mb-6">
          <div className="w-full aspect-square bg-slate-950 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-black/40 p-4 border border-white/5 relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-transform duration-500 group-hover:scale-110" />
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
          {navLinks.map((lnk) => (
            <button
              key={lnk.id}
              onClick={() => router.push(lnk.path)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-extrabold transition-all text-left cursor-pointer ${
                (activeTab === lnk.id || (lnk.id === "overview" && activeTab === "admin"))
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-slate-50" 
                  : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-950/40"
              }`}
            >
              <lnk.icon className={`w-4.5 h-4.5 ${(activeTab === lnk.id || (lnk.id === "overview" && activeTab === "admin")) ? "text-[#1e40af] dark:text-blue-400" : "text-slate-400"}`} />
              {lnk.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-150 dark:border-slate-800 pt-5">
          <button
            onClick={() => { resetStore(); router.push("/login"); }}
            className="flex items-center gap-2.5 text-red-600 hover:text-red-700 text-sm font-black transition-all px-2 py-1 cursor-pointer hover:bg-red-50/50 rounded-lg w-fit"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-6 min-h-screen">
        <header className="flex items-center justify-between mb-6">
          <div>
             <h2 className="text-xl font-black text-slate-900 dark:text-white capitalize">{activeTab === "admin" ? "Dashboard" : activeTab}</h2>
             <p className="text-xs text-slate-400 font-semibold mt-1">Welcome back, {currentUser?.name}</p>
          </div>
        </header>
        {children}
      </main>

      {/* RETAILER REGISTER DRAWER */}
      {showRetailerDrawer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Register New Retailer Store</h3>
              <button onClick={() => setShowRetailerDrawer(false)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddRetailer} className="space-y-4 text-xs font-semibold">
              <input type="text" placeholder="Store Name" value={retailerName} onChange={(e) => setRetailerName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" required />
              <input type="tel" placeholder="Phone" value={retailerPhone} onChange={(e) => setRetailerPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" required />
              <input type="text" placeholder="Area" value={retailerArea} onChange={(e) => setRetailerArea(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" />
              <input type="email" placeholder="Retailer Email" value={retailerEmail} onChange={(e) => setRetailerEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-red-500 uppercase ml-1">To Take</label>
                  <input type="number" placeholder="Enter Amount" value={retailerToTake || ""} onChange={(e) => setRetailerToTake(e.target.value ? Number(e.target.value) : 0)} className="w-full px-3 py-2 border border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10 rounded-lg font-bold text-red-600 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-500 uppercase ml-1">To Give</label>
                  <input type="number" placeholder="Enter Amount" value={retailerToGive || ""} onChange={(e) => setRetailerToGive(e.target.value ? Number(e.target.value) : 0)} className="w-full px-3 py-2 border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg font-bold text-emerald-600 focus:outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl font-bold">Create Store</button>
            </form>
          </div>
        </div>
      )}

      {/* PORTAL REGISTER DRAWER */}
      {showPortalDrawer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Register Portal</h3>
              <button onClick={() => setShowPortalDrawer(false)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePortalGroup} className="space-y-6 text-xs font-semibold">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Portal Name</label>
                  <input type="text" placeholder="e.g. RevaPay" value={pGroupName} onChange={(e) => setPGroupName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-red-500 uppercase ml-1">To Take</label>
                    <input type="number" placeholder="To Take" value={pGroupToTake || ""} onChange={(e) => setPGroupToTake(e.target.value ? Number(e.target.value) : 0)} className="w-full px-3 py-2 border border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10 rounded-lg font-bold text-red-600 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-500 uppercase ml-1">To Give</label>
                    <input type="number" placeholder="To Give" value={pGroupToGive || ""} onChange={(e) => setPGroupToGive(e.target.value ? Number(e.target.value) : 0)} className="w-full px-3 py-2 border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg font-bold text-emerald-600 focus:outline-none" />
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-xs uppercase tracking-wider">Register Portal</button>
            </form>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[60] animate-slide-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Notification</p>
              <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">{toastMessage}</p>
            </div>
            <button onClick={() => setShowToast(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
               <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 3s infinite linear; }
        @keyframes slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}
