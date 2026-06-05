
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";
import { api } from "../utils/api";
import { db, OfflineCollection, OfflineDeposit } from "../utils/db";
import { initializeSyncEngine } from "../utils/sync";
import {
  PlusCircle,
  ArrowUpRight,
  LogOut,
  Coins,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  CloudLightning,
  RefreshCw,
  Sparkles,
  Camera,
  MapPin,
  Menu,
  X,
  FileText
} from "lucide-react";

const getUtcDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  const s = String(dateStr);
  if (!s.endsWith("Z") && !s.includes("+") && !s.includes("GMT")) {
    return new Date(s + "Z");
  }
  return new Date(s);
};

export default function StaffDashboard() {
  const router = useRouter();
  const { currentUser, attendance, collections, deposits, theme, toggleTheme, checkIn, checkOut, restoreAttendance, resetStore } = useAppStore();

  // Real-time network & Dexie state
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCollections, setOfflineCollections] = useState<OfflineCollection[]>([]);
  const [offlineDeposits, setOfflineDeposits] = useState<OfflineDeposit[]>([]);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAttendanceBox, setShowAttendanceBox] = useState(false);

  const [startKmInput, setStartKmInput] = useState("");
  const [endKmInput, setEndKmInput] = useState("");
  const [kmError, setKmError] = useState("");
  const [showNotesBreakdown, setShowNotesBreakdown] = useState(true);

  // New Odometer Upload & GPS Watermark States
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);

  // Read local Dexie databases on mount and monitor status
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Request location access proactively on mount to check if allowed
  useEffect(() => {
    if (!mounted) return;
    if (typeof window !== "undefined" && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationError("");
          setIsLocating(false);
        },
        (err) => {
          let errMsg = "Location access denied. GPS tracking is strictly required for shifts.";
          if (err.code === err.POSITION_UNAVAILABLE) {
            errMsg = "GPS location information is unavailable.";
          } else if (err.code === err.TIMEOUT) {
            errMsg = "Location request timed out. Please try again.";
          }
          setLocationError(errMsg);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, [mounted]);

  // Read local Dexie databases on mount and monitor status
  useEffect(() => {
    if (!mounted) return;
    if (!currentUser) {
      router.push("/");
      return;
    }

    // Read offline files
    const loadOfflineQueues = async () => {
      const col = await db.collections.where("synced").equals(0).toArray();
      const dep = await db.deposits.where("synced").equals(0).toArray();
      setOfflineCollections(col);
      setOfflineDeposits(dep);
    };

    loadOfflineQueues();
    
    // Auto-restore attendance status if not already checked in locally
    const autoRestore = async () => {
      if (!attendance.isCheckedIn) {
        try {
          const status = await api.getMyAttendanceStatus();
          if (status && status.status === "active") {
            // Restore with original backend data to keep time consistent
            restoreAttendance({
              isCheckedIn: true,
              startKm: status.start_km,
              checkInTime: status.start_time.replace("T", " ").substring(0, 16),
            });
          }
        } catch (err) {
          // 404 is expected if no active shift exists
        }
      }
    };
    autoRestore();

    // Hook up background sync listener
    const cleanupSync = initializeSyncEngine(
      (online) => {
        setIsOnline(online);
        loadOfflineQueues();
      },
      (msg) => {
        setSyncStatusMsg(msg);
        loadOfflineQueues();
        setTimeout(() => setSyncStatusMsg(""), 5000);
      }
    );

    return () => cleanupSync();
  }, [currentUser, router, collections, deposits, mounted]);

  // Sync Zustand store with backend data on mount or online status change
  useEffect(() => {
    if (!mounted || !currentUser || !isOnline) return;
    const syncWithAPI = async () => {
      try {
        const [apiCols, apiDeps] = await Promise.all([
          api.getCollections(),
          api.getDeposits()
        ]);
        
        // Map collections
        const mappedCollections = apiCols.map((c: any) => ({
          id: c.id,
          retailer_id: c.retailer_id,
          store_id: c.store_id,
          retailerName: c.retailer_name || "Unknown Retailer",
          portalName: c.portal_name || "Cash",
          staffName: c.staff_name,
          totalAmount: Number(c.total_amount),
          denominations: {
            note_500: Number(c.denominations?.note_500 || 0),
            note_200: Number(c.denominations?.note_200 || 0),
            note_100: Number(c.denominations?.note_100 || 0),
            note_50: Number(c.denominations?.note_50 || 0),
            note_20: Number(c.denominations?.note_20 || 0),
            note_10: Number(c.denominations?.note_10 || 0),
            coins: Number(c.denominations?.coins || 0),
            online_amount: Number(c.denominations?.online_amount || 0),
            online_portal_id: c.denominations?.online_portal_id,
          },
          status: c.status,
          remarks: c.remarks,
          date: getUtcDate(c.created_at).toLocaleString("sv-SE").substring(0, 16),
        }));

        // Map deposits
        const mappedDeposits = apiDeps.map((d: any) => ({
          id: d.id,
          portal_id: d.portal_id,
          retailer_id: d.retailer_id,
          recipient_staff_id: d.recipient_staff_id,
          depositType: d.deposit_type,
          targetName: d.target_name || "Main Office",
          amount: Number(d.amount),
          paymentMode: d.payment_mode === "cash" ? "cash" : "online",
          denominations: d.denominations ? {
            note_500: Number(d.denominations.note_500 || 0),
            note_200: Number(d.denominations.note_200 || 0),
            note_100: Number(d.denominations.note_100 || 0),
            note_50: Number(d.denominations.note_50 || 0),
            note_20: Number(d.denominations.note_20 || 0),
            note_10: Number(d.denominations.note_10 || 0),
            coins: Number(d.denominations.coins || 0),
            online_amount: Number(d.denominations.online_amount || 0),
            online_portal_id: d.denominations.online_portal_id,
          } : undefined,
          status: d.status,
          date: getUtcDate(d.created_at).toLocaleString("sv-SE").substring(0, 16),
        }));

        const { setCollections, setDeposits } = useAppStore.getState();
        setCollections(mappedCollections);
        setDeposits(mappedDeposits);
      } catch (err) {
        console.error("Failed to sync store with API:", err);
      }
    };
    syncWithAPI();
  }, [mounted, currentUser, isOnline]);

  if (!mounted || !currentUser) return null;

  // Calculators
  let note500 = 0;
  let note200 = 0;
  let note100 = 0;
  let note50 = 0;
  let note20 = 0;
  let note10 = 0;
  let coins = 0;

  collections.forEach((c) => {
    if (c.denominations) {
      note500 += Number(c.denominations.note_500) || 0;
      note200 += Number(c.denominations.note_200) || 0;
      note100 += Number(c.denominations.note_100) || 0;
      note50 += Number(c.denominations.note_50) || 0;
      note20 += Number(c.denominations.note_20) || 0;
      note10 += Number(c.denominations.note_10) || 0;
      coins += Number(c.denominations.coins) || 0;
    }
  });

  deposits.forEach((d) => {
    if (d.denominations) {
      note500 -= Number(d.denominations.note_500) || 0;
      note200 -= Number(d.denominations.note_200) || 0;
      note100 -= Number(d.denominations.note_100) || 0;
      note50 -= Number(d.denominations.note_50) || 0;
      note20 -= Number(d.denominations.note_20) || 0;
      note10 -= Number(d.denominations.note_10) || 0;
      coins -= Number(d.denominations.coins) || 0;
    }
  });

  const totalCollected = collections.reduce((s, c) => s + (c.totalAmount || 0), 0);
  const totalDeposited = deposits.filter(d => d.depositType !== "virtual").reduce((s, d) => s + (d.amount || 0), 0);
  
  const netPortfolio = totalCollected - totalDeposited;

  const totalOnline = collections.reduce((s, c) => s + Number(c.denominations?.online_amount || 0), 0) - 
                      deposits.filter(d => d.depositType !== "virtual").reduce((s, d) => s + Number(d.denominations?.online_amount || 0), 0);
  
  const totalCashNotes = netPortfolio - totalOnline;
 
  // Calculate running balances for the ledger
  const combinedLedger = [
    ...collections.map(c => ({ ...c, type: 'collection' })),
    ...deposits.map(d => ({ ...d, type: 'deposit', totalAmount: d.amount }))
  ].filter(item => item.date)
   .sort((a, b) => new Date(a.date.replace(' ', 'T')).getTime() - new Date(b.date.replace(' ', 'T')).getTime());

  let ledgerRunningBal = 0;
  const ledgerSnapshots = new Map();
  combinedLedger.forEach(item => {
    const prev = ledgerRunningBal;
    if (item.type === 'collection') ledgerRunningBal += item.totalAmount;
    else ledgerRunningBal -= item.totalAmount;
    ledgerSnapshots.set(item.id, { prev, next: ledgerRunningBal });
  });

  const fetchLiveGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        const err = new Error("Geolocation is not supported by your browser.");
        setLocationError(err.message);
        reject(err);
        return;
      }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setGpsCoords(coords);
          setLocationError("");
          setIsLocating(false);
          resolve(coords);
        },
        (err) => {
          let errMsg = "Location access denied. Location is strictly required to proceed.";
          if (err.code === err.POSITION_UNAVAILABLE) {
            errMsg = "GPS signal lost or unavailable.";
          } else if (err.code === err.TIMEOUT) {
            errMsg = "Location fetch timed out. Please retry.";
          }
          setLocationError(errMsg);
          setGpsCoords(null);
          setIsLocating(false);
          reject(new Error(errMsg));
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  const processImageWithLocation = async (file: File) => {
    try {
      // 1. Fetch fresh live GPS coordinates first (strict enforcement)
      const coords = await fetchLiveGPS();
      
      // 2. Read image as Data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // 3. Scale image to max dimension of 1200px
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            alert("Canvas 2D context not available");
            return;
          }
          
          // Draw original image scaled
          ctx.drawImage(img, 0, 0, width, height);
          
          // 4. Draw watermarking bar at bottom
          const barHeight = Math.max(70, Math.round(height * 0.08));
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)"; // Slate 900 with high opacity for readability
          ctx.fillRect(0, height - barHeight, width, barHeight);
          
          // Draw a small decorative indicator dot at bottom left (emerald if coordinates are active)
          ctx.fillStyle = "#10b981"; // Emerald green
          const dotRadius = Math.max(6, Math.round(barHeight * 0.08));
          ctx.beginPath();
          ctx.arc(30, height - barHeight / 2, dotRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Setup text typography
          const fontSize = Math.max(12, Math.round(barHeight * 0.22));
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          
          // GPS Line text
          const gpsText = `GPS: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${coords.accuracy.toFixed(1)}m)`;
          const textX = 30 + dotRadius * 2;
          ctx.fillText(gpsText, textX, height - barHeight * 0.65);
          
          // Time line text
          const istTimeStr = new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "medium",
          });
          const timeText = `IST: ${istTimeStr} IST`;
          ctx.fillStyle = "#94a3b8"; // Slate 400 for subtext
          ctx.font = `${fontSize - 2}px sans-serif`;
          ctx.fillText(timeText, textX, height - barHeight * 0.35);
          
          // On the far right, draw a small branding note
          ctx.textAlign = "right";
          ctx.fillStyle = "#60a5fa"; // Blue 400
          ctx.font = `bold ${fontSize - 1}px sans-serif`;
          ctx.fillText("DO IT SERVICES", width - 30, height - barHeight / 2);
          
          // 5. Output compressed jpeg base64
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setUploadedImageBase64(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("Verification Failed: " + err.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageWithLocation(file);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedImageBase64 || !gpsCoords) {
      alert("Odometer image and live GPS location are strictly required!");
      return;
    }
    const km = parseInt(startKmInput);
    if (!isNaN(km) && km > 0) {
      try {
        await api.checkIn(km, uploadedImageBase64, gpsCoords.latitude, gpsCoords.longitude);
        checkIn(km);
        setStartKmInput("");
        setUploadedImageBase64(null);
        setGpsCoords(null);
      } catch (err: any) {
        alert("Failed to check-in: " + err.message);
      }
    }
  };

  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKmError("");
    if (!uploadedImageBase64 || !gpsCoords) {
      alert("Odometer image and live GPS location are strictly required!");
      return;
    }
    const end = parseInt(endKmInput);
    if (isNaN(end)) return;

    if (end <= attendance.startKm) {
      setKmError(`Ending KM must be greater than starting KM (${attendance.startKm}).`);
      return;
    }

    try {
      await api.checkOut(end, uploadedImageBase64, gpsCoords.latitude, gpsCoords.longitude);
      checkOut(end);
      setEndKmInput("");
      setUploadedImageBase64(null);
      setGpsCoords(null);
    } catch (err: any) {
      alert("Failed to check-out: " + err.message);
    }
  };

  const handleLogout = () => {
    resetStore();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-black transition-colors duration-200">
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col gap-6 select-none pb-24">

        {/* Sync Success notification toast */}
        {syncStatusMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center gap-2 animate-pulse shadow-sm">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span className="uppercase tracking-wider">{syncStatusMsg}</span>
          </div>
        )}

        {/* REPLICATED ADMIN HEADER */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-100 dark:border-slate-800 rounded-[1.5rem] p-3 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl scale-110" />
              <div className="relative w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg">
                <img 
                  src="/logo.png" 
                  alt="DOIT Logo" 
                  className="w-full h-full object-contain brightness-100 dark:brightness-0"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-slate-900 dark:text-white tracking-tighter uppercase text-sm leading-none">Do It Services</h1>
                {isOnline ? (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" title="Online"></div>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" title="Offline"></div>
                )}
              </div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Staff Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-center text-blue-500 active:scale-90 transition-transform cursor-pointer"
                title="Admin Dashboard"
              >
                <ArrowUpRight className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => router.push("/staff/daily-report")}
              className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-center text-blue-500 active:scale-90 transition-transform cursor-pointer"
              title="Daily Report"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="w-10 h-10 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center justify-center text-red-500 active:scale-90 transition-transform cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-transform cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* SIDEBAR OVERLAY AND DRAWER MATCHING ADMIN PANEL */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop overlay */}
            <div 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setIsSidebarOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative ml-auto w-64 max-w-[80vw] h-full bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.3)] p-6 flex flex-col justify-between animate-in slide-in-from-right duration-300">
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 mb-6">
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Do-It-Services</span>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Staff Panel</span>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Navigation Items list */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      router.push("/attendance");
                    }}
                    className="w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-[0.98] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-bold"
                  >
                    <div className="flex-shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-xs tracking-wider uppercase">{attendance.isCheckedIn ? "Check Out" : "Check In"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      router.push("/staff/cash-in-ledger");
                    }}
                    className="w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-[0.98] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-bold"
                  >
                    <div className="flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs tracking-wider uppercase">Cash In Ledger</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      router.push("/staff/cash-out-ledger");
                    }}
                    className="w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-[0.98] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-bold"
                  >
                    <div className="flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs tracking-wider uppercase">Cash Out Ledger</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      router.push("/staff/daily-report");
                    }}
                    className="w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-[0.98] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-bold"
                  >
                    <div className="flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs tracking-wider uppercase">Daily Report</span>
                  </button>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logged in as</p>
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-1 truncate">{currentUser?.name || "Staff Member"}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Staff</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN DASHBOARD CONTENT */}
        <SummaryBlocks totalCollected={totalCollected} totalDeposited={totalDeposited} netPortfolio={netPortfolio} />

        <div className="mt-4 mb-2">
          <NavigationGrid isCheckedIn={attendance.isCheckedIn} router={router} onClickLink={() => {}} />
        </div>

        <WalletCard
          totalCollected={totalCollected}
          totalDeposited={totalDeposited}
          totalCashNotes={totalCashNotes}
          totalOnline={totalOnline}
          netPortfolio={netPortfolio}
          showNotesBreakdown={showNotesBreakdown}
          setShowNotesBreakdown={setShowNotesBreakdown}
          note500={note500}
          note200={note200}
          note100={note100}
          note50={note50}
          note20={note20}
          note10={note10}
          coins={coins}
        />

        {/* Offline Queues */}
        {(offlineCollections.length > 0 || offlineDeposits.length > 0) && (
          <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudLightning className="w-4 h-4 text-amber-500 animate-bounce" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Waiting List ({offlineCollections.length + offlineDeposits.length})
                </span>
              </div>
              <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-500 animate-pulse flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                <RefreshCw className="w-3 h-3 animate-spin" /> Waiting...
              </span>
            </div>

            <div className="space-y-2">
              {offlineCollections.map((col, index) => (
                <div key={index} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-950/40 text-[11px] flex items-center justify-between shadow-sm">
                  <div>
                    <span className="font-black text-slate-800 dark:text-slate-200">{col.retailerName}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5 font-bold uppercase tracking-wider">Cash In • {col.date}</span>
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-100">₹{col.totalAmount.toLocaleString()}</span>
                </div>
              ))}

              {offlineDeposits.map((dep, index) => (
                <div key={index} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-950/40 text-[11px] flex items-center justify-between shadow-sm">
                  <div>
                    <span className="font-black text-slate-800 dark:text-slate-200">{dep.targetName}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5 font-bold uppercase tracking-wider">Cash Out • {dep.date}</span>
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-100">₹{dep.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREMIUM HISTORY LEDGER */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Recent Cash Ledger
            </h3>
            <button
              onClick={() => router.push("/history")}
              className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/30 shadow-sm"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
             {combinedLedger.slice().reverse().slice(0, 8).map((c: any) => {
               const snapshots = ledgerSnapshots.get(c.id) || { prev: 0, next: 0 };
               return (
                 <div
                   key={c.id}
                   className="p-4 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group cursor-default"
                 >
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3.5">
                       <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-700/50 transition-colors shadow-inner flex-shrink-0 ${c.type === 'collection' ? 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20' : 'group-hover:bg-red-50 dark:group-hover:bg-red-900/20'}`}>
                         {c.type === 'collection' ? (
                           <CheckCircle className="w-4 h-4 text-emerald-500" />
                         ) : (
                           <ArrowUpRight className="w-4 h-4 text-red-500" />
                         )}
                       </div>
                       <div>
                         <div className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">
                           {c.type === 'collection' ? c.retailerName : c.targetName}
                         </div>
                         <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                           <span className="text-blue-500">{c.type === 'collection' ? c.portalName : (c.depositType || 'Deposit')}</span>
                           <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                           <span>{c.date}</span>
                         </div>
                       </div>
                     </div>
                     <div className="text-right flex-shrink-0 ml-2">
                       <span className={`text-sm font-black tracking-tight block ${c.type === 'collection' ? 'text-emerald-600' : 'text-red-600'}`}>
                         {c.type === 'collection' ? '+' : '-'}₹{c.totalAmount.toLocaleString()}
                       </span>
                     </div>
                   </div>

                   <div className="grid grid-cols-3 gap-2 bg-slate-50/50 dark:bg-slate-950/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                     <div className="flex flex-col">
                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Opening</span>
                       <span className="text-[9px] font-bold text-slate-500">₹{snapshots.prev.toLocaleString()}</span>
                     </div>
                     <div className="flex flex-col border-x border-slate-200 dark:border-slate-800 px-3">
                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Collector</span>
                       <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 line-clamp-1">{currentUser.name}</span>
                     </div>
                     <div className="flex flex-col text-right">
                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Closing</span>
                       <span className="text-[9px] font-black text-slate-800 dark:text-slate-200">₹{snapshots.next.toLocaleString()}</span>
                     </div>
                   </div>
                 </div>
               );
             })}
             {combinedLedger.length === 0 && (
               <div className="text-center py-10 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No recent entries</p>
               </div>
             )}
          </div>
        </div>
      </div>
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}

function AttendanceCard({
  attendance,
  handleCheckInSubmit,
  handleCheckOutSubmit,
  startKmInput,
  setStartKmInput,
  endKmInput,
  setEndKmInput,
  kmError,
  uploadedImageBase64,
  setUploadedImageBase64,
  gpsCoords,
  isLocating,
  locationError,
  handleFileChange,
  fetchLiveGPS
}: any) {
  const isSubmitDisabled = !uploadedImageBase64 || !gpsCoords || isLocating;

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] shadow-xl p-6 text-white border border-slate-700/50 transition-all duration-500 ${attendance.isCheckedIn ? "opacity-90" : "ring-2 ring-blue-500/50 shadow-blue-500/10"}`}>
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md shadow-inner border border-white/5">
              <Clock className="w-4 h-4 text-blue-300" />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-wider text-white/80">
              Duty Status (Attendance)
            </h2>
          </div>
          <span className={`text-[9px] uppercase tracking-wide font-black px-3 py-1.5 rounded-full backdrop-blur-md border ${attendance.isCheckedIn
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-white/10 text-slate-300 border-white/20"
            }`}>
            {attendance.isCheckedIn ? "Checked In" : "Checked Out"}
          </span>
        </div>

        {attendance.isCheckedIn ? (
          <form onSubmit={handleCheckOutSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
              <div>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Started At</span>
                <span className="font-black text-lg text-white tracking-tight">{attendance.startKm} <span className="text-[10px] text-slate-500">KM</span></span>
              </div>
              <div className="text-right">
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Check-in Time</span>
                <span className="font-black text-sm text-white">{attendance.checkInTime}</span>
              </div>
            </div>

            {kmError && (
              <p className="text-[10px] text-red-200 bg-red-950/80 px-4 py-2 rounded-xl border border-red-500/30 text-center font-bold">
                {kmError}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <input
                type="number"
                placeholder="Enter Ending KM"
                value={endKmInput}
                onChange={(e) => setEndKmInput(e.target.value)}
                className="w-full px-4 py-3.5 bg-black/30 border border-white/10 focus:border-blue-500/50 rounded-xl focus:outline-none text-sm text-white font-bold placeholder-slate-600 transition-colors shadow-inner"
                required
              />

              {/* Upload image capture element */}
              {!uploadedImageBase64 ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 bg-black/20 hover:bg-black/30 p-5 rounded-2xl cursor-pointer transition-all duration-300 group">
                  <Camera className="w-8 h-8 text-slate-400 group-hover:text-blue-400 mb-2 transition-colors" />
                  <span className="text-[10px] font-black tracking-widest text-slate-400 group-hover:text-blue-300 uppercase select-none">Capture Ending Odometer</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                </label>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 group">
                  <img src={uploadedImageBase64} alt="Meter Preview" className="w-full h-36 object-cover" />
                  <button
                    type="button"
                    onClick={() => setUploadedImageBase64(null)}
                    className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-lg shadow-lg text-[9px] font-black uppercase tracking-wider px-3 backdrop-blur-md border border-red-500/20 active:scale-95 transition-transform"
                  >
                    Retake
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-300 border border-white/5">
                    ✓ Watermark Overlay Succeeded
                  </div>
                </div>
              )}

              {/* Geolocation status and strict warning warnings */}
              {isLocating && (
                <div className="flex items-center justify-center gap-2 p-3 bg-blue-950/40 border border-blue-900/40 text-[9px] font-black uppercase tracking-wider text-blue-400 rounded-2xl animate-pulse">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                  <span>Fetching High Accuracy live GPS...</span>
                </div>
              )}

              {locationError && (
                <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-2xl text-center">
                  <p className="text-[9px] text-red-400 font-black uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                    <span>⚠️ GPS Locked:</span> {locationError}
                  </p>
                  <button
                    type="button"
                    onClick={fetchLiveGPS}
                    className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 tracking-wider bg-blue-950/20 border border-blue-900/30 px-3.5 py-1.5 rounded-xl transition-all active:scale-95"
                  >
                    Retry Fetching Location
                  </button>
                </div>
              )}

              {gpsCoords && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/20 border border-emerald-900/30 text-[9px] font-black uppercase tracking-wider text-emerald-400 rounded-2xl">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="leading-tight">
                    GPS Logged: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} (±{gpsCoords.accuracy.toFixed(1)}m)
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className={`w-full py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg border border-white/10 ${
                  isSubmitDisabled
                    ? "bg-slate-800 text-slate-500 border-slate-700/40 cursor-not-allowed opacity-50"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {isSubmitDisabled ? "Verify Image & GPS to Check Out" : "End Shift & Log Out"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCheckInSubmit} className="space-y-4">
            <p className="text-[11px] text-slate-400 leading-relaxed font-bold mb-2 opacity-70">
              Enter starting odometer KM, snap meter photo, and allow GPS access.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="number"
                placeholder="Current Odometer KM"
                value={startKmInput}
                onChange={(e) => setStartKmInput(e.target.value)}
                className="w-full px-4 py-3.5 bg-black/30 border border-white/10 focus:border-blue-500/50 rounded-xl focus:outline-none text-sm text-white font-bold placeholder-slate-600 transition-colors shadow-inner"
                required
              />

              {/* Upload image capture element */}
              {!uploadedImageBase64 ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 bg-black/20 hover:bg-black/30 p-5 rounded-2xl cursor-pointer transition-all duration-300 group">
                  <Camera className="w-8 h-8 text-slate-400 group-hover:text-blue-400 mb-2 transition-colors" />
                  <span className="text-[10px] font-black tracking-widest text-slate-400 group-hover:text-blue-300 uppercase select-none">Capture Starting Odometer</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                </label>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 group">
                  <img src={uploadedImageBase64} alt="Meter Preview" className="w-full h-36 object-cover" />
                  <button
                    type="button"
                    onClick={() => setUploadedImageBase64(null)}
                    className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-lg shadow-lg text-[9px] font-black uppercase tracking-wider px-3 backdrop-blur-md border border-red-500/20 active:scale-95 transition-transform"
                  >
                    Retake
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-300 border border-white/5">
                    ✓ Watermark Overlay Succeeded
                  </div>
                </div>
              )}

              {/* Geolocation status and warnings */}
              {isLocating && (
                <div className="flex items-center justify-center gap-2 p-3 bg-blue-950/40 border border-blue-900/40 text-[9px] font-black uppercase tracking-wider text-blue-400 rounded-2xl animate-pulse">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                  <span>Fetching High Accuracy live GPS...</span>
                </div>
              )}

              {locationError && (
                <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-2xl text-center">
                  <p className="text-[9px] text-red-400 font-black uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                    <span>⚠️ GPS Locked:</span> {locationError}
                  </p>
                  <button
                    type="button"
                    onClick={fetchLiveGPS}
                    className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 tracking-wider bg-blue-950/20 border border-blue-900/30 px-3.5 py-1.5 rounded-xl transition-all active:scale-95"
                  >
                    Retry Fetching Location
                  </button>
                </div>
              )}

              {gpsCoords && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/20 border border-emerald-900/30 text-[9px] font-black uppercase tracking-wider text-emerald-400 rounded-2xl">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="leading-tight">
                    GPS Logged: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} (±{gpsCoords.accuracy.toFixed(1)}m)
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className={`w-full py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg border border-white/10 ${
                  isSubmitDisabled
                    ? "bg-slate-800 text-slate-500 border-slate-700/40 cursor-not-allowed opacity-50"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {isSubmitDisabled ? "Verify Image & GPS to Check In" : "Start Shift"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SummaryBlocks({ totalCollected, totalDeposited, netPortfolio }: any) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cash In</span>
        <span className="text-xs font-black text-emerald-600 tracking-tight">₹{totalCollected.toLocaleString()}</span>
      </div>
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cash Out</span>
        <span className="text-xs font-black text-red-600 tracking-tight">₹{totalDeposited.toLocaleString()}</span>
      </div>
      <div className="bg-slate-900 dark:bg-slate-100 p-3 rounded-2xl border border-slate-800 dark:border-white shadow-lg">
        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Total Cash</span>
        <span className="text-xs font-black text-white dark:text-slate-950 tracking-tight">₹{netPortfolio.toLocaleString()}</span>
      </div>
    </div>
  );
}

function WalletCard({
  totalCollected,
  totalDeposited,
  totalCashNotes,
  totalOnline,
  netPortfolio,
  showNotesBreakdown,
  setShowNotesBreakdown,
  note500,
  note200,
  note100,
  note50,
  note20,
  note10,
  coins
}: any) {
  return (
    <div className="space-y-4">
      <div className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
              Cash Summary
            </span>
          </div>
        </div>

        {/* Notes breakdowns */}
        <div className="pt-2 relative z-10">
          <button
            onClick={() => setShowNotesBreakdown(!showNotesBreakdown)}
            className="w-full flex items-center justify-between text-xs font-black text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none transition-colors"
          >
            <span className="uppercase tracking-[0.15em] text-[9px]">Notes Details</span>
            {showNotesBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showNotesBreakdown && (
            <div className="grid grid-cols-2 gap-3 mt-5 text-xs font-medium">
              {[
                { value: "500", count: note500 },
                { value: "200", count: note200 },
                { value: "100", count: note100 },
                { value: "50", count: note50 },
                { value: "20", count: note20 },
                { value: "10", count: note10 },
              ].map((note) => (
                <div key={note.value} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400 font-bold tracking-wider">₹{note.value}</span>
                  <span className="font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-800">{note.count}</span>
                </div>
              ))}
              <div className="col-span-2 flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-4 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 mt-1">
                <span className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Coins</span>
                <span className="font-black text-slate-800 dark:text-slate-200 text-sm">₹{coins.toFixed(2)}</span>
              </div>
              
              <div className="col-span-2 flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 mt-1">
                <span className="text-emerald-600 dark:text-emerald-500 font-black uppercase tracking-widest text-[9px]">Cash (In Hand)</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">₹{totalCashNotes.toLocaleString()}</span>
              </div>
              
              <div className="col-span-2 flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 px-4 py-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/30 mt-1">
                <span className="text-blue-600 dark:text-blue-500 font-black uppercase tracking-widest text-[9px]">Online Balance</span>
                <span className="font-black text-blue-700 dark:text-blue-400 text-sm">₹{totalOnline.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavigationGrid({ isCheckedIn, router, onClickLink }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        onClick={() => {
          if (!isCheckedIn) {
            alert("Shift is locked! Please start shift attendance mileage first.");
            return;
          }
          if (onClickLink) onClickLink();
          router.push("/collection");
        }}
        className={`relative overflow-hidden p-5 pt-6 pb-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/50 hover:shadow-lg text-left transition-all duration-300 group shadow-sm flex flex-col gap-4 ${!isCheckedIn ? "opacity-40 grayscale cursor-not-allowed" : ""}`}
      >
        <div className="w-12 h-12 rounded-[1.2rem] bg-[#00a86b] dark:bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white shadow-md">
          <PlusCircle className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-wide mb-1">Cash In Entry</h3>
          <p className="text-[10px] font-bold text-slate-400">Record retailer payments</p>
        </div>
      </button>

      <button
        onClick={() => {
          if (!isCheckedIn) {
            alert("Shift is locked! Please start shift attendance mileage first.");
            return;
          }
          if (onClickLink) onClickLink();
          router.push("/deposit");
        }}
        className={`relative overflow-hidden p-5 pt-6 pb-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-lg text-left transition-all duration-300 group shadow-sm flex flex-col gap-4 ${!isCheckedIn ? "opacity-40 grayscale cursor-not-allowed" : ""}`}
      >
        <div className="w-12 h-12 rounded-[1.2rem] bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 text-red-500 dark:text-red-400">
          <ArrowUpRight className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-wide mb-1">Cash Out Entry</h3>
          <p className="text-[10px] font-bold text-slate-400">Process payouts</p>
        </div>
      </button>
    </div>
  );
}

