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
  CheckCircle2,
  CreditCard,
  User
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { api } from "@/app/utils/api";

export default function AdminDesktopLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, resetStore, theme, setCurrentUser } = useAppStore();
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
  const [retailerToGive, setRetailerToGive] = useState<string>("");
  const [retailerToTake, setRetailerToTake] = useState<string>("");
  const [pGroupName, setPGroupName] = useState("");
  const [pGroupBalance, setPGroupBalance] = useState<string>("");
  const [pGroupOnline, setPGroupOnline] = useState(false);

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
      showToastNotification("Profile updated successfully!");
      setShowProfileModal(false);
      setProfilePassword("");
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const activeTab = pathname.split("/").pop() || "overview";

  const handleAddRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRetailer({
        retailer_name: retailerName,
        phone: retailerPhone,
        address: retailerArea,
        email: retailerEmail,
        opening_to_give: parseFloat(retailerToGive || "0"),
        opening_to_take: parseFloat(retailerToTake || "0")
      });
      showToastNotification(`Store "${retailerName}" registered successfully!`);
      setShowRetailerDrawer(false);
      setRetailerName("");
      setRetailerPhone("");
      setRetailerArea("");
      setRetailerEmail("");
      setRetailerToGive("");
      setRetailerToTake("");
      fetchData();
    } catch (err: any) {
      alert("Failed to register store: " + err.message);
    }
  };

  const handleCreatePortalGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const val = parseFloat(pGroupBalance || "0");
      await api.createPortalGroup({ 
        name: pGroupName,
        opening_to_give: val < 0 ? Math.abs(val) : 0,
        opening_to_take: val > 0 ? val : 0
      });

      showToastNotification(`Portal Group "${pGroupName}" registered!`);
      setShowPortalDrawer(false);
      setPGroupName("");
      setPGroupBalance("");
      setPGroupOnline(false);
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
    { id: "wallet-transfer", label: "Virtual Money Transfer", icon: CreditCard, path: "/admin/wallet-transfer" },
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
          <div className="w-full h-18 bg-slate-950 rounded-xl flex items-center justify-center shadow-2xl shadow-black/40 p-3 border border-white/5 relative overflow-hidden group">
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

        <div className="border-t border-slate-150 dark:border-slate-800 pt-5 flex flex-col gap-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 text-slate-500 hover:text-slate-850 dark:hover:text-slate-100 text-sm font-extrabold transition-all px-2 py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg w-fit"
          >
            <User className="w-4.5 h-4.5 text-slate-400" />
            Edit Profile
          </button>
          <button
            onClick={() => { resetStore(); router.push("/"); }}
            className="flex items-center gap-2.5 text-red-600 hover:text-red-700 text-sm font-extrabold transition-all px-2 py-1 cursor-pointer hover:bg-red-50/50 rounded-lg w-fit"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-6 min-h-screen">
        <header className="flex items-center justify-between mb-6">
          <div>
             <h2 className="text-xl font-black text-slate-900 dark:text-white capitalize">{activeTab === "admin" ? "Dashboard" : activeTab === "wallet-transfer" ? "Virtual Money Transfer" : activeTab}</h2>
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
              <input autoComplete="one-time-code" type="text" placeholder="Store Name" value={retailerName} onChange={(e) => setRetailerName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" required />
              <input autoComplete="one-time-code" type="tel" placeholder="Phone" value={retailerPhone} onChange={(e) => setRetailerPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" required />
              <input autoComplete="one-time-code" type="text" placeholder="Area" value={retailerArea} onChange={(e) => setRetailerArea(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" />
              <input autoComplete="one-time-code" type="email" placeholder="Retailer Email" value={retailerEmail} onChange={(e) => setRetailerEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-red-500 uppercase ml-1">To Take</label>
                  <input autoComplete="one-time-code" 
                    type="number" 
                    placeholder="Enter Amount" 
                    value={retailerToTake} 
                    onChange={(e) => setRetailerToTake(e.target.value)} 
                    onFocus={e => {
                      if (Number(e.target.value) === 0) setRetailerToTake("");
                      e.target.select();
                    }}
                    className="w-full px-3 py-2 border border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10 rounded-lg font-bold text-red-600 focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-500 uppercase ml-1">To Give</label>
                  <input autoComplete="one-time-code" 
                    type="number" 
                    placeholder="Enter Amount" 
                    value={retailerToGive} 
                    onChange={(e) => setRetailerToGive(e.target.value)} 
                    onFocus={e => {
                      if (Number(e.target.value) === 0) setRetailerToGive("");
                      e.target.select();
                    }}
                    className="w-full px-3 py-2 border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg font-bold text-emerald-600 focus:outline-none" 
                  />
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
                  <input autoComplete="one-time-code" type="text" placeholder="e.g. RevaPay" value={pGroupName} onChange={(e) => setPGroupName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Opening Balance (₹)</label>
                  <input autoComplete="one-time-code" 
                    type="number" 
                    placeholder="Enter Opening Balance (negative if To Give)" 
                    value={pGroupBalance} 
                    onChange={(e) => setPGroupBalance(e.target.value)} 
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold focus:outline-none" 
                  />
                </div>
                <div className="flex items-center gap-2 px-1 py-1">
                  <input 
                    type="checkbox" 
                    id="pGroupOnline"
                    checked={pGroupOnline} 
                    onChange={(e) => setPGroupOnline(e.target.checked)} 
                    className="w-4 h-4 rounded text-blue-650 focus:ring-blue-500 border-slate-300 dark:border-slate-800 dark:bg-slate-955 cursor-pointer"
                  />
                  <label htmlFor="pGroupOnline" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                    Online
                  </label>
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
                <input autoComplete="one-time-code" type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg focus:outline-none dark:text-white" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Phone Number</label>
                <input autoComplete="one-time-code" type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg focus:outline-none dark:text-white" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">New Password</label>
                <input autoComplete="new-password" type="password" placeholder="••••••••" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg focus:outline-none dark:text-white" />
                <p className="text-[9px] text-slate-400 font-bold ml-1 mt-0.5">Leave blank to keep current password (min 6 chars)</p>
              </div>
              <button type="submit" disabled={isUpdatingProfile} className="w-full py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl font-bold hover:bg-slate-800 transition-colors uppercase tracking-wider text-[10px] cursor-pointer disabled:opacity-50">{isUpdatingProfile ? "Updating..." : "Save Changes"}</button>
            </form>
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
