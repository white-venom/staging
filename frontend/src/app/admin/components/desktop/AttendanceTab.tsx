"use client";

import React, { useState, useEffect } from "react";
import { Clock, ShieldAlert, Check, X, Settings2, Sparkles, UserCheck, Calendar, MapPin } from "lucide-react";
import { api, API_BASE_URL } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";

interface AttendanceTabProps {
  showToastNotification: (msg: string) => void;
}

function LocationName({ lat, lon }: { lat: number; lon: number }) {
  const [address, setAddress] = useState<string>("Fetching location...");

  useEffect(() => {
    let active = true;
    async function getAddress() {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
          {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "DoItServices/1.0"
            }
          }
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active) {
          const addr = data.address || {};
          const road = addr.road || addr.suburb || addr.neighbourhood || "";
          const city = addr.city || addr.town || addr.village || "";
          const state = addr.state || "";
          
          const parts = [road, city, state].filter(Boolean);
          const cleanAddress = parts.join(", ") || data.display_name || "Location Found";
          setAddress(cleanAddress);
        }
      } catch (err) {
        if (active) {
          setAddress(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
      }
    }
    getAddress();
    return () => {
      active = false;
    };
  }, [lat, lon]);

  return <span className="font-extrabold text-[9px] uppercase tracking-wider truncate max-w-[160px] inline-block">{address}</span>;
}

export default function AttendanceTab({ showToastNotification }: AttendanceTabProps) {
  const { userDirectory, fetchData } = useAdmin();
  
  const [selectedUserId, setSelectedUserId] = useState("global");
  const [globalSettings, setGlobalSettings] = useState({
    lateThreshold: "10:00",
    latePenalty: 100,
    autoCheckoutTime: "20:00"
  });

  const [lateThreshold, setLateThreshold] = useState("10:00");
  const [latePenalty, setLatePenalty] = useState<number | "">(100);
  const [autoCheckoutTime, setAutoCheckoutTime] = useState("20:00");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [pendingPenalties, setPendingPenalties] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  const staffMembers = (userDirectory || []).filter((u: any) => u.role === "staff" || u.role === "admin");

  useEffect(() => {
    loadSettings();
    loadPenalties();
    loadTodayAttendance();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getAdminSettings();
      const gs = {
        lateThreshold: data.late_threshold || "10:00",
        latePenalty: data.late_penalty !== undefined ? Number(data.late_penalty) : 100,
        autoCheckoutTime: data.auto_checkout_time || "20:00"
      };
      setGlobalSettings(gs);
      
      // If editing global, sync input states
      if (selectedUserId === "global") {
        setLateThreshold(gs.lateThreshold);
        setLatePenalty(gs.latePenalty);
        setAutoCheckoutTime(gs.autoCheckoutTime);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadPenalties = async () => {
    try {
      const data = await api.getPendingPenalties();
      setPendingPenalties(data);
    } catch (err) {
      console.error("Failed to load penalties:", err);
    }
  };

  const loadTodayAttendance = async () => {
    try {
      const data = await api.getTodayAttendance();
      setTodayAttendance(data);
    } catch (err) {
      console.error("Failed to load today's attendance:", err);
    }
  };

  // Keep input values synced when toggling target or when directory updates
  useEffect(() => {
    if (selectedUserId === "global") {
      setLateThreshold(globalSettings.lateThreshold);
      setLatePenalty(globalSettings.latePenalty);
      setAutoCheckoutTime(globalSettings.autoCheckoutTime);
    } else {
      const user = staffMembers.find((u: any) => u.id === selectedUserId);
      if (user) {
        setLateThreshold(user.late_threshold !== null && user.late_threshold !== undefined ? user.late_threshold : "");
        setLatePenalty(user.late_penalty !== null && user.late_penalty !== undefined ? user.late_penalty : "");
        setAutoCheckoutTime(user.auto_checkout_time !== null && user.auto_checkout_time !== undefined ? user.auto_checkout_time : "");
      }
    }
  }, [selectedUserId, userDirectory, globalSettings]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      if (selectedUserId === "global") {
        await api.updateAdminSettings({
          late_threshold: lateThreshold || "10:00",
          late_penalty: latePenalty === "" ? 100 : Number(latePenalty),
          auto_checkout_time: autoCheckoutTime || "20:00"
        });
        showToastNotification("Global attendance configuration updated!");
      } else {
        const user = staffMembers.find((u: any) => u.id === selectedUserId);
        if (!user) throw new Error("Selected user not found");
        
        await api.updateUser(selectedUserId, {
          name: user.name,
          phone: user.phone,
          role: user.role,
          late_threshold: lateThreshold === "" ? null : lateThreshold,
          late_penalty: latePenalty === "" ? null : Number(latePenalty),
          auto_checkout_time: autoCheckoutTime === "" ? null : autoCheckoutTime
        });
        showToastNotification(`Late policy updated for ${user.name}!`);
      }
      await loadSettings();
      await fetchData();
    } catch (err: any) {
      alert("Failed to update settings: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleProcessPenalty = async (id: string, approve: boolean) => {
    try {
      await api.approvePenalty(id, approve);
      showToastNotification(approve ? "Penalty Approved" : "Penalty Rejected");
      loadPenalties();
    } catch (err: any) {
      alert("Error processing penalty: " + err.message);
    }
  };

  const isInheritedThreshold = selectedUserId !== "global" && (lateThreshold === "" || lateThreshold === null);
  const isInheritedPenalty = selectedUserId !== "global" && (latePenalty === "" || latePenalty === null);
  const isInheritedCheckout = selectedUserId !== "global" && (autoCheckoutTime === "" || autoCheckoutTime === null);

  const activeThreshold = selectedUserId === "global" ? lateThreshold : (lateThreshold || globalSettings.lateThreshold);
  const activePenalty = selectedUserId === "global" ? latePenalty : (latePenalty !== "" ? latePenalty : globalSettings.latePenalty);
  const activeCheckout = selectedUserId === "global" ? autoCheckoutTime : (autoCheckoutTime || globalSettings.autoCheckoutTime);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="grid md:grid-cols-12 gap-6">
        
        {/* LATE PENALTY SETTINGS */}
        <div className="md:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Settings2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Late Policy Config</h3>
          </div>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
             <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Configure Target</label>
                <select 
                  value={selectedUserId} 
                  onChange={e => setSelectedUserId(e.target.value)} 
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none appearance-none cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <option value="global">Global Settings (All Staff)</option>
                  {staffMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
                {selectedUserId !== "global" && (
                  <p className="text-[9px] text-slate-450 dark:text-slate-500 mt-1 font-semibold">
                    * Clear fields to inherit global settings.
                  </p>
                )}
             </div>
             <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Late Threshold (Time)</label>
                <input autoComplete="one-time-code" 
                  type="time" 
                  value={lateThreshold} 
                  onChange={e => setLateThreshold(e.target.value)} 
                  placeholder={globalSettings.lateThreshold}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none" 
                />
                {isInheritedThreshold && (
                  <span className="text-[9px] text-emerald-600 font-bold block mt-1">
                    Inheriting global: {globalSettings.lateThreshold}
                  </span>
                )}
             </div>
             <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Penalty Amount (₹)</label>
                <input autoComplete="one-time-code" 
                  type="number" 
                  value={latePenalty} 
                  onChange={e => setLatePenalty(e.target.value === "" ? "" : Number(e.target.value))} 
                  placeholder={String(globalSettings.latePenalty)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none" 
                />
                {isInheritedPenalty && (
                  <span className="text-[9px] text-emerald-600 font-bold block mt-1">
                    Inheriting global: ₹{globalSettings.latePenalty}
                  </span>
                )}
             </div>
             <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Auto Checkout Time</label>
                <input autoComplete="one-time-code" 
                  type="time" 
                  value={autoCheckoutTime} 
                  onChange={e => setAutoCheckoutTime(e.target.value)} 
                  placeholder={globalSettings.autoCheckoutTime}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none" 
                />
                {isInheritedCheckout && (
                  <span className="text-[9px] text-emerald-600 font-bold block mt-1">
                    Inheriting global: {globalSettings.autoCheckoutTime}
                  </span>
                )}
             </div>
             <button 
               type="submit" 
               disabled={isSavingSettings}
               className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-600/20"
             >
               {isSavingSettings ? "Saving..." : "Save Configuration"}
             </button>
          </form>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
             <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
               {selectedUserId === "global" ? "Staff" : "This staff member"} checking in after {activeThreshold} will automatically be flagged for a ₹{activePenalty} penalty for admin review. Staff who forget to check out will be auto checked out at {activeCheckout}.
             </p>
          </div>
        </div>

        {/* PENDING PENALTY APPROVALS */}
        <div className="md:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
             <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Pending Penalty Reviews</h3>
             </div>
             <span className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-black">
               {pendingPenalties.length} ACTION REQUIRED
             </span>
          </div>
          
          <div className="space-y-3 min-h-[300px]">
            {pendingPenalties.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all hover:border-red-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600">
                    {(p.staff_name || "ST").substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">{p.staff_name || "Unknown Staff"}</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                      {p.date} · Check-in at {p.start_time}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs font-black text-red-600 block">₹{p.penalty_amount}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Late Fine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleProcessPenalty(p.id, true)}
                      className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-[10px] font-black uppercase cursor-pointer"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleProcessPenalty(p.id, false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-all text-[10px] font-black uppercase cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {pendingPenalties.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">All penalties reviewed</p>
                <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wide text-center max-w-[200px]">
                  No late check-ins pending administrative review.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TODAY'S SHIFTS & ODOMETER VERIFICATION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Today's Staff Shifts & Odometer Logs</h3>
          </div>
          <span className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
            {todayAttendance.length} Shifts Today
          </span>
        </div>

        <div className="grid gap-4">
          {todayAttendance.map((att) => (
            <div 
              key={att.id} 
              className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col gap-4 shadow-sm hover:border-blue-100 dark:hover:border-blue-900/40 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-xs font-black text-white shadow-inner">
                    {(att.staff_name || "ST").substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">{att.staff_name || "Unknown Staff"}</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 block">
                      Duty Shift · {att.date}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[9px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full border ${
                    att.status === 'active'
                      ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                    {att.status === 'active' ? 'Active Shift' : 'Completed'}
                  </span>
                  <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-slate-200/50 dark:border-slate-700/50">
                    <Clock className="w-3 h-3" /> {att.duration}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* START KM DETAILS */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="space-y-1.5 flex-1">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest block">Check-In Mileage</span>
                    <span className="font-black text-base text-slate-800 dark:text-slate-100 tracking-tight">{(att.start_km || 0).toLocaleString()} <span className="text-[10px] text-slate-400">KM</span></span>
                    <span className="text-[9px] text-slate-500 font-medium block">Time: {att.start_time || 'N/A'}</span>
                    {att.start_latitude && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${att.start_latitude},${att.start_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[9px] font-black text-blue-500 hover:text-blue-600 uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30 shadow-sm transition-colors mt-1 max-w-[200px]"
                        title="Click to view on Google Maps"
                      >
                        <MapPin className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                        <LocationName lat={att.start_latitude} lon={att.start_longitude} />
                      </a>
                    )}
                  </div>
                  {att.start_km_image_url ? (
                    <button 
                      onClick={() => setActiveLightboxImage(`${API_BASE_URL}${att.start_km_image_url}`)}
                      className="w-full sm:w-24 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group relative flex-shrink-0 cursor-pointer shadow-sm active:scale-95 transition-transform"
                    >
                      <img src={`${API_BASE_URL}${att.start_km_image_url}`} alt="Start KM Odometer" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-white uppercase tracking-wider">Inspect</span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full sm:w-24 h-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                      <span className="text-[8px] text-slate-400 font-bold uppercase">No Photo</span>
                    </div>
                  )}
                </div>

                {/* END KM DETAILS */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="space-y-1.5 flex-1">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest block">Check-Out Mileage</span>
                    <span className="font-black text-base text-slate-800 dark:text-slate-100 tracking-tight">
                      {att.end_km ? `${att.end_km.toLocaleString()} KM` : <span className="text-slate-400 italic">Pending</span>}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium block">Time: {att.end_time || 'N/A'}</span>
                    {att.end_latitude ? (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${att.end_latitude},${att.end_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[9px] font-black text-blue-500 hover:text-blue-600 uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30 shadow-sm transition-colors mt-1 max-w-[200px]"
                        title="Click to view on Google Maps"
                      >
                        <MapPin className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                        <LocationName lat={att.end_latitude} lon={att.end_longitude} />
                      </a>
                    ) : (
                      att.status === 'active' && <span className="text-[8px] text-slate-400 italic font-bold block uppercase tracking-wider mt-1">Pending Check-Out</span>
                    )}
                  </div>
                  {att.end_km_image_url ? (
                    <button 
                      onClick={() => setActiveLightboxImage(`${API_BASE_URL}${att.end_km_image_url}`)}
                      className="w-full sm:w-24 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group relative flex-shrink-0 cursor-pointer shadow-sm active:scale-95 transition-transform"
                    >
                      <img src={`${API_BASE_URL}${att.end_km_image_url}`} alt="End KM Odometer" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-white uppercase tracking-wider">Inspect</span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full sm:w-24 h-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                      <span className="text-[8px] text-slate-400 font-bold uppercase">{att.status === 'active' ? 'Pending' : 'No Photo'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {todayAttendance.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">No shifts today</p>
              <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wide text-center">
                Staff have not started shift logs yet today.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX VERIFICATION DIALOG */}
      {activeLightboxImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => setActiveLightboxImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={activeLightboxImage} alt="Odometer Verification" className="w-full h-full object-contain" />
            <button 
              onClick={() => setActiveLightboxImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur-sm cursor-pointer shadow-lg active:scale-95 transition-transform"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ADDITIONAL FEATURES PLACEHOLDER */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-indigo-600 rounded-[2rem] text-white space-y-4 shadow-xl shadow-indigo-600/20">
           <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
             <Calendar className="w-6 h-6" />
           </div>
           <div>
             <h4 className="font-black text-lg">Shift Rostering</h4>
             <p className="text-[10px] font-bold opacity-80 uppercase tracking-wide mt-1">Coming Soon</p>
           </div>
           <p className="text-xs font-medium leading-relaxed opacity-90">
             Assign custom shift timings to individual staff members for granular compliance tracking.
           </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-4 shadow-sm">
           <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl flex items-center justify-center">
             <UserCheck className="w-6 h-6" />
           </div>
           <div>
             <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">Leave Management</h4>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Under Development</p>
           </div>
           <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
             Approve leave requests and track staff time-off directly from the attendance dashboard.
           </p>
        </div>

        <div className="p-6 bg-emerald-600 rounded-[2rem] text-white space-y-4 shadow-xl shadow-emerald-600/20">
           <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
             <Sparkles className="w-6 h-6" />
           </div>
           <div>
             <h4 className="font-black text-lg">Smart Insights</h4>
             <p className="text-[10px] font-bold opacity-80 uppercase tracking-wide mt-1">Planned</p>
           </div>
           <p className="text-xs font-medium leading-relaxed opacity-90">
             Get AI-driven reports on staff punctuality and performance trends across routes.
           </p>
        </div>
      </div>
    </div>
  );
}
