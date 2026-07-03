
"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  FileText,
  Share2,
  Edit2,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { numberToWordsIndian, shareCollectionEntry, shareDepositEntry } from "../utils/shareHelper";
import { usePWAInstall } from "../hooks/usePWAInstall";
import PWAInstallModal from "../components/PWAInstallModal";

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
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = useState<Record<string, boolean>>({});
  const [expandedHomeId, setExpandedHomeId] = useState<string | null>(null);
  const [homeEditingEntry, setHomeEditingEntry] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [showIOSModal, setShowIOSModal] = useState(false);
  const { isStandalone, isIOS, installable, triggerInstall } = usePWAInstall();

  // In-place edit modal states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editDenoms, setEditDenoms] = useState<any>({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0
  });
  const [editRemarks, setEditRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editWindow, setEditWindow] = useState<number>(5);
  const [deleteWindow, setDeleteWindow] = useState<number>(5);

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isSidebarOpen]);

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
    
    // Auto-restore / sync attendance status with backend database if online
    const autoRestore = async () => {
      if (!isOnline) return;
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
      } catch (err: any) {
        // If the API explicitly says "No active shift found", reset the local Checked In state
        if (err?.message === "No active shift found." || err?.message?.includes("not found")) {
          restoreAttendance({
            isCheckedIn: false,
            startKm: 0,
          });
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
  const syncWithAPI = useCallback(async () => {
    if (!mounted || !currentUser || !isOnline) return;
    try {
      const [apiCols, apiDeps, settings] = await Promise.all([
        api.getCollections(),
        api.getDeposits(),
        api.getAdminSettings().catch(() => ({ edit_window_minutes: 5, delete_window_minutes: 5 }))
      ]);
      
      const ew = settings.edit_window_minutes ?? 5;
      const dw = settings.delete_window_minutes ?? 5;
      setEditWindow(ew);
      setDeleteWindow(dw);
      
      // Map collections
      const mappedCollections = apiCols.map((c: any) => ({
        id: c.id,
        retailer_id: c.retailer_id,
        store_id: c.store_id,
        store_name: c.store_name,
        retailerName: c.retailer_name || "Unknown Retailer",
        portalName: c.portal_name || "Cash",
        portalGroupName: c.portal_group_name || undefined,
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
        date: getUtcDate(c.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
        retailer_ledger_token: c.retailer_ledger_token,
        created_at: c.created_at,
      }));

      // Map deposits (filtering out received handovers to avoid duplication with collections if a matching collection exists)
      const mappedDeposits = apiDeps
        .filter((d: any) => {
          if (d.recipient_staff_id === currentUser.id && d.deposit_type === "staff") {
            const hasMatchingCollection = apiCols.some((c: any) => 
              c.from_staff_id === d.staff_id && 
              Number(c.total_amount) === Number(d.amount)
            );
            return !hasMatchingCollection;
          }
          return true;
        })
        .map((d: any) => ({
        id: d.id,
        portal_id: d.portal_id,
        retailer_id: d.retailer_id,
        recipient_staff_id: d.recipient_staff_id,
        depositType: d.deposit_type,
        targetName: (d.deposit_type === "portal" && d.portal_group_name) ? d.portal_group_name : (d.target_name || "Super Distributor"),
        amount: Number(d.amount),
        paymentMode: (d.payment_mode === "cash" ? "cash" : "online") as "cash" | "online",
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
        remarks: d.remarks,
        portalName: d.portal_name || undefined,
        date: getUtcDate(d.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
        retailer_ledger_token: d.retailer_ledger_token,
        created_at: d.created_at,
      }));

      const { setCollections, setDeposits } = useAppStore.getState();
      setCollections(mappedCollections);
      setDeposits(mappedDeposits);
    } catch (err) {
      console.error("Failed to sync store with API:", err);
    }
  }, [mounted, currentUser, isOnline]);

  useEffect(() => {
    syncWithAPI();
  }, [syncWithAPI]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSaving(true);

    const totalCash = (
      editDenoms.note_500 * 500 +
      editDenoms.note_200 * 200 +
      editDenoms.note_100 * 100 +
      editDenoms.note_50 * 50 +
      editDenoms.note_20 * 20 +
      editDenoms.note_10 * 10 +
      editDenoms.coins
    );
    const totalAmount = totalCash + editDenoms.online_amount;

    const isCollection = editingItem.type === "collection";
    if (isCollection) {
      if (totalAmount === 0) {
        alert("Collection total cannot be zero.");
        setIsSaving(false);
        return;
      }
    } else {
      if (totalAmount <= 0) {
        alert("Deposit total must be greater than zero.");
        setIsSaving(false);
        return;
      }
    }

    try {
      const isCollection = editingItem.type === "collection";
      if (isCollection) {
        const payload: any = {
          total_amount: totalAmount,
          remarks: editRemarks,
          denominations: editDenoms,
          retailer_id: editingItem.retailer_id,
          store_id: editingItem.store_id,
          portal_id: editingItem.portal_id,
          from_staff_id: editingItem.from_staff_id,
          from_office: editingItem.from_office,
        };

        const updated = await api.updateCollection(editingItem.id, payload);

        // Update Zustand store
        const store = useAppStore.getState();
        const mappedUpdated = {
          id: updated.id,
          retailer_id: updated.retailer_id,
          store_id: updated.store_id,
          retailerName: updated.retailer_name || "Unknown Retailer",
          portalName: updated.portal_name || "Cash",
          portalGroupName: updated.portal_group_name || undefined,
          staffName: updated.staff_name,
          totalAmount: Number(updated.total_amount),
          denominations: {
            note_500: Number(updated.denominations?.note_500 || 0),
            note_200: Number(updated.denominations?.note_200 || 0),
            note_100: Number(updated.denominations?.note_100 || 0),
            note_50: Number(updated.denominations?.note_50 || 0),
            note_20: Number(updated.denominations?.note_20 || 0),
            note_10: Number(updated.denominations?.note_10 || 0),
            coins: Number(updated.denominations?.coins || 0),
            online_amount: Number(updated.denominations?.online_amount || 0),
            online_portal_id: updated.denominations?.online_portal_id,
          },
          status: updated.status,
          remarks: updated.remarks,
          date: getUtcDate(updated.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
          created_at: updated.created_at,
        };
        store.setCollections(store.collections.map(col => col.id === editingItem.id ? mappedUpdated : col));
      } else {
        const payload: any = {
          amount: totalAmount,
          remarks: editRemarks,
          denominations: editDenoms,
          deposit_type: editingItem.depositType || editingItem.deposit_type,
          portal_id: editingItem.portal_id,
          retailer_id: editingItem.retailer_id,
          recipient_staff_id: editingItem.recipient_staff_id,
          to_office: editingItem.to_office,
          payment_mode: editingItem.paymentMode || editingItem.payment_mode,
        };

        const updated = await api.updateDeposit(editingItem.id, payload);

        // Update Zustand store
        const store = useAppStore.getState();
        const mappedUpdated = {
          id: updated.id,
          portal_id: updated.portal_id,
          retailer_id: updated.retailer_id,
          recipient_staff_id: updated.recipient_staff_id,
          depositType: updated.deposit_type,
          targetName: (updated.deposit_type === "portal" && updated.portal_group_name) ? updated.portal_group_name : (updated.target_name || "Super Distributor"),
          amount: Number(updated.amount),
          paymentMode: (updated.payment_mode === "cash" ? "cash" : "online") as "cash" | "online",
          denominations: updated.denominations ? {
            note_500: Number(updated.denominations.note_500 || 0),
            note_200: Number(updated.denominations.note_200 || 0),
            note_100: Number(updated.denominations.note_100 || 0),
            note_50: Number(updated.denominations.note_50 || 0),
            note_20: Number(updated.denominations.note_20 || 0),
            note_10: Number(updated.denominations.note_10 || 0),
            coins: Number(updated.denominations.coins || 0),
            online_amount: Number(updated.denominations.online_amount || 0),
            online_portal_id: updated.denominations.online_portal_id,
          } : undefined,
          status: updated.status,
          remarks: updated.remarks,
          portalName: updated.portal_name || undefined,
          date: getUtcDate(updated.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
          created_at: updated.created_at,
        };
        store.setDeposits(store.deposits.map(dep => dep.id === editingItem.id ? mappedUpdated : dep));
      }
      setEditingItem(null);
      await syncWithAPI();
    } catch (err: any) {
      alert("Failed to update: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted || !currentUser) return null;

  // ─── Today vs Previous Day split (IST) ───────────────────────────────────
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  // Today's collections (exclude handovers received from staff for split — included in old/today logic consistently)
  const todayCollections = collections.filter(c => c.date?.startsWith(todayIST));
  const prevCollections  = collections.filter(c => !c.date?.startsWith(todayIST));

  const todayOutDeposits = deposits.filter(d =>
    d.date?.startsWith(todayIST) &&
    d.depositType !== 'virtual' &&
    !(d.recipient_staff_id === currentUser.id && d.depositType === 'staff')
  );
  const prevOutDeposits = deposits.filter(d =>
    !d.date?.startsWith(todayIST) &&
    d.depositType !== 'virtual' &&
    !(d.recipient_staff_id === currentUser.id && d.depositType === 'staff')
  );

  // Handovers received split
  const todayHandoversRcvd = deposits
    .filter(d => d.recipient_staff_id === currentUser.id && d.depositType === 'staff' && d.date?.startsWith(todayIST))
    .reduce((s, d) => s + (d.amount || 0), 0);
  const prevHandoversRcvd = deposits
    .filter(d => d.recipient_staff_id === currentUser.id && d.depositType === 'staff' && !d.date?.startsWith(todayIST))
    .reduce((s, d) => s + (d.amount || 0), 0);

  const todayIn  = todayCollections.reduce((s, c) => s + (c.totalAmount || 0), 0) + todayHandoversRcvd;
  const todayOut = todayOutDeposits.reduce((s, d) => s + (d.amount || 0), 0);
  const oldBalance = prevCollections.reduce((s, c) => s + (c.totalAmount || 0), 0) + prevHandoversRcvd - prevOutDeposits.reduce((s, d) => s + (d.amount || 0), 0);
  const netBalance = oldBalance + todayIn - todayOut;

  // Calculators
  let prevNote500 = 0;
  let prevNote200 = 0;
  let prevNote100 = 0;
  let prevNote50 = 0;
  let prevNote20 = 0;
  let prevNote10 = 0;
  let prevCoins = 0;
  let prevOnlineIn = 0;
  let prevOnlineOut = 0;

  prevCollections.forEach((c) => {
    if (c.denominations) {
      prevNote500 += Number(c.denominations.note_500) || 0;
      prevNote200 += Number(c.denominations.note_200) || 0;
      prevNote100 += Number(c.denominations.note_100) || 0;
      prevNote50 += Number(c.denominations.note_50) || 0;
      prevNote20 += Number(c.denominations.note_20) || 0;
      prevNote10 += Number(c.denominations.note_10) || 0;
      prevCoins += Number(c.denominations.coins) || 0;
      prevOnlineIn += Number(c.denominations.online_amount) || 0;
    }
  });

  const prevHandoversRcvdObjects = deposits.filter(d => d.recipient_staff_id === currentUser.id && d.depositType === 'staff' && !d.date?.startsWith(todayIST));
  prevHandoversRcvdObjects.forEach((d) => {
    if (d.denominations) {
      prevNote500 += Number(d.denominations.note_500) || 0;
      prevNote200 += Number(d.denominations.note_200) || 0;
      prevNote100 += Number(d.denominations.note_100) || 0;
      prevNote50 += Number(d.denominations.note_50) || 0;
      prevNote20 += Number(d.denominations.note_20) || 0;
      prevNote10 += Number(d.denominations.note_10) || 0;
      prevCoins += Number(d.denominations.coins) || 0;
      prevOnlineIn += Number(d.denominations.online_amount) || 0;
    }
  });

  prevOutDeposits.forEach((d) => {
    if (d.denominations) {
      prevNote500 -= Number(d.denominations.note_500) || 0;
      prevNote200 -= Number(d.denominations.note_200) || 0;
      prevNote100 -= Number(d.denominations.note_100) || 0;
      prevNote50 -= Number(d.denominations.note_50) || 0;
      prevNote20 -= Number(d.denominations.note_20) || 0;
      prevNote10 -= Number(d.denominations.note_10) || 0;
      prevCoins -= Number(d.denominations.coins) || 0;
      prevOnlineOut += Number(d.denominations.online_amount) || 0;
    }
  });

  const prevOnline = Math.max(0, prevOnlineIn - prevOnlineOut);
  const prevCashNotes = oldBalance - prevOnline;

  // Reconcile previous days' denominations greedily
  if (prevCashNotes > 0) {
    const prevNotesSum = 
      prevNote500 * 500 +
      prevNote200 * 200 +
      prevNote100 * 100 +
      prevNote50 * 50 +
      prevNote20 * 20 +
      prevNote10 * 10 +
      prevCoins;
    
    let prevMismatch = prevNotesSum - prevCashNotes;
    if (prevMismatch > 0) {
      const deduct500 = Math.min(Math.max(0, prevNote500), Math.floor(prevMismatch / 500));
      prevNote500 -= deduct500;
      prevMismatch -= deduct500 * 500;
      
      const deduct200 = Math.min(Math.max(0, prevNote200), Math.floor(prevMismatch / 200));
      prevNote200 -= deduct200;
      prevMismatch -= deduct200 * 200;
      
      const deduct100 = Math.min(Math.max(0, prevNote100), Math.floor(prevMismatch / 100));
      prevNote100 -= deduct100;
      prevMismatch -= deduct100 * 100;
      
      const deduct50 = Math.min(Math.max(0, prevNote50), Math.floor(prevMismatch / 50));
      prevNote50 -= deduct50;
      prevMismatch -= deduct50 * 50;
      
      const deduct20 = Math.min(Math.max(0, prevNote20), Math.floor(prevMismatch / 20));
      prevNote20 -= deduct20;
      prevMismatch -= deduct20 * 20;
      
      const deduct10 = Math.min(Math.max(0, prevNote10), Math.floor(prevMismatch / 10));
      prevNote10 -= deduct10;
      prevMismatch -= deduct10 * 10;
      
      if (prevMismatch > 0) {
        prevCoins = Math.max(0, prevCoins - prevMismatch);
      }
    }
  }

  // Now, calculate today's final denominations by adding today's counts to the reconciled previous day counts
  let note500 = prevNote500;
  let note200 = prevNote200;
  let note100 = prevNote100;
  let note50 = prevNote50;
  let note20 = prevNote20;
  let note10 = prevNote10;
  let coins = prevCoins;

  todayCollections.forEach((c) => {
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

  const todayHandoversRcvdObjects = deposits.filter(d => d.recipient_staff_id === currentUser.id && d.depositType === 'staff' && d.date?.startsWith(todayIST));
  todayHandoversRcvdObjects.forEach((d) => {
    if (d.denominations) {
      note500 += Number(d.denominations.note_500) || 0;
      note200 += Number(d.denominations.note_200) || 0;
      note100 += Number(d.denominations.note_100) || 0;
      note50 += Number(d.denominations.note_50) || 0;
      note20 += Number(d.denominations.note_20) || 0;
      note10 += Number(d.denominations.note_10) || 0;
      coins += Number(d.denominations.coins) || 0;
    }
  });

  todayOutDeposits.forEach((d) => {
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

  const totalHandoversReceived = deposits
    .filter(d => d.recipient_staff_id === currentUser.id && d.depositType === "staff")
    .reduce((s, d) => s + (d.amount || 0), 0);

  const totalCollected = collections.reduce((s, c) => s + (c.totalAmount || 0), 0) + totalHandoversReceived;
  
  const totalDeposited = deposits
    .filter(d => d.depositType !== "virtual" && !(d.recipient_staff_id === currentUser.id && d.depositType === "staff"))
    .reduce((s, d) => s + (d.amount || 0), 0);
  
  const netPortfolio = totalCollected - totalDeposited;

  const onlineIn = collections.reduce((s, c) => s + Number(c.denominations?.online_amount || 0), 0) +
                   deposits
                     .filter(d => d.recipient_staff_id === currentUser.id && d.depositType === "staff")
                     .reduce((s, d) => s + Number(d.denominations?.online_amount || 0), 0);

  const onlineOut = deposits
                      .filter(d => d.depositType !== "virtual" && !(d.recipient_staff_id === currentUser.id && d.depositType === "staff"))
                      .reduce((s, d) => s + Number(d.denominations?.online_amount || 0), 0);

  const totalOnline = Math.max(0, onlineIn - onlineOut);
  
  const totalCashNotes = netPortfolio - totalOnline;

  // Run final pass reconciliation to clean up any new mismatches created today
  if (totalCashNotes > 0) {
    const netDenSum = 
      note500 * 500 +
      note200 * 200 +
      note100 * 100 +
      note50 * 50 +
      note20 * 20 +
      note10 * 10 +
      coins;
    
    let finalMismatch = netDenSum - totalCashNotes;
    if (finalMismatch > 0) {
      const deduct500 = Math.min(Math.max(0, note500), Math.floor(finalMismatch / 500));
      note500 -= deduct500;
      finalMismatch -= deduct500 * 500;
      
      const deduct200 = Math.min(Math.max(0, note200), Math.floor(finalMismatch / 200));
      note200 -= deduct200;
      finalMismatch -= deduct200 * 200;
      
      const deduct100 = Math.min(Math.max(0, note100), Math.floor(finalMismatch / 100));
      note100 -= deduct100;
      finalMismatch -= deduct100 * 100;
      
      const deduct50 = Math.min(Math.max(0, note50), Math.floor(finalMismatch / 50));
      note50 -= deduct50;
      finalMismatch -= deduct50 * 50;
      
      const deduct20 = Math.min(Math.max(0, note20), Math.floor(finalMismatch / 20));
      note20 -= deduct20;
      finalMismatch -= deduct20 * 20;
      
      const deduct10 = Math.min(Math.max(0, note10), Math.floor(finalMismatch / 10));
      note10 -= deduct10;
      finalMismatch -= deduct10 * 10;
      
      if (finalMismatch > 0) {
        coins = Math.max(0, coins - finalMismatch);
      }
    }
  }

  // Net denomination breakdown (all in - all out across all time)
  const combinedLedger = [
    ...collections.map(c => ({ ...c, type: 'collection' })),
    ...deposits.map(d => {
      const isRecipient = d.recipient_staff_id === currentUser.id && d.depositType === "staff";
      return { 
        ...d, 
        type: isRecipient ? 'collection' : 'deposit', 
        totalAmount: d.amount 
      };
    })
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
          ctx.fillText("CREDIITFLOW", width - 30, height - barHeight / 2);
          
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
        <header className="bg-[#0d1b3e] border border-blue-900/40 rounded-[1.5rem] p-3 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="CrediiFlow Logo" 
              className="h-8 w-auto object-contain"
            />
            <div className="flex items-center gap-1.5 ml-1">
              {isOnline ? (
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" title="Online"></div>
              ) : (
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" title="Offline"></div>
              )}
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Staff Panel</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-blue-300 active:scale-90 transition-transform cursor-pointer hover:bg-white/10"
                title="Admin Dashboard"
              >
                <ArrowUpRight className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => router.push("/staff/daily-report")}
              className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-blue-300 active:scale-90 transition-transform cursor-pointer hover:bg-white/10"
              title="Daily Report"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-200 active:scale-90 transition-transform cursor-pointer hover:bg-white/10"
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
                <div className="flex items-center justify-between p-3.5 bg-[#0d1b3e] border border-blue-900/40 rounded-2xl mb-6 text-white shadow-md">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="CrediiFlow Logo" className="h-7 w-auto object-contain" />
                    <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Staff Panel</span>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
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
                      router.push("/staff/ledger");
                    }}
                    className="w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-[0.98] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-bold"
                  >
                    <div className="flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs tracking-wider uppercase">Ledger</span>
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
                {/* PWA Download Button */}
                {!isStandalone && (
                  <button
                    onClick={async () => {
                      setIsSidebarOpen(false);
                      if (isIOS) { setShowIOSModal(true); return; }
                      const result = await triggerInstall();
                      if (result === "show-ios-modal") setShowIOSModal(true);
                      else if (result === "dismissed") alert("To install: tap the browser 3-dot menu → Add to Home Screen.");
                    }}
                    className="w-full py-3.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer border border-blue-100 dark:border-blue-900/30"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download App
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full py-4 bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out Securely
                </button>
              </div>
            </div>
          </div>
        )}

        {/* iOS PWA Install Instructions Modal */}
        {showIOSModal && <PWAInstallModal onClose={() => setShowIOSModal(false)} />}

        {/* MAIN DASHBOARD CONTENT */}
        <SummaryBlocks
          oldBalance={oldBalance}
          todayIn={todayIn}
          todayOut={todayOut}
          netBalance={netBalance}
          totalCashNotes={totalCashNotes}
          totalOnline={totalOnline}
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

        <div className="mt-4 mb-2">
          <NavigationGrid isCheckedIn={attendance.isCheckedIn} router={router} onClickLink={() => {}} />
        </div>

        {/* Offline Queues */}
        {(offlineCollections.length > 0 || offlineDeposits.length > 0) && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CloudLightning className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Waiting List ({offlineCollections.length + offlineDeposits.length})
                </span>
              </div>
              <span className="text-[8px] uppercase font-bold text-amber-600 dark:text-amber-500 animate-pulse flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Waiting...
              </span>
            </div>

            <div className="space-y-1.5">
              {offlineCollections.map((col, index) => (
                <div key={index} className="py-1.5 px-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-950/40 text-[11px] flex items-center justify-between shadow-sm">
                  <div>
                    <span className="font-black text-slate-800 dark:text-slate-200">{col.retailerName}</span>
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 block mt-0.5 font-bold uppercase tracking-wider">Cash In • {col.date}</span>
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-100">₹{col.totalAmount.toLocaleString()}</span>
                </div>
              ))}

              {offlineDeposits.map((dep, index) => (
                <div key={index} className="py-1.5 px-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-950/40 text-[11px] flex items-center justify-between shadow-sm">
                  <div>
                    <span className="font-black text-slate-800 dark:text-slate-200">{dep.targetName}</span>
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 block mt-0.5 font-bold uppercase tracking-wider">Cash Out • {dep.date}</span>
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-100">₹{dep.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREMIUM HISTORY LEDGER */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Recent Cash Ledger
              </h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider focus:outline-none cursor-pointer"
              >
                <option value="date-desc">LATEST FIRST</option>
                <option value="date-asc">OLDEST FIRST</option>
                <option value="amount-desc">AMOUNT: HIGH-LOW</option>
                <option value="amount-asc">AMOUNT: LOW-HIGH</option>
              </select>
            </div>
            <button
              onClick={() => router.push("/staff/ledger")}
              className="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-900/30 shadow-sm"
            >
              View All <ArrowUpRight className="w-2.5 h-2.5" />
            </button>
          </div>
          <div className="space-y-1.5">
             {(() => {
               const sorted = [...combinedLedger].sort((a, b) => {
                 const timeA = new Date(a.date.replace(' ', 'T')).getTime();
                 const timeB = new Date(b.date.replace(' ', 'T')).getTime();
                 if (sortBy === "date-desc") return timeB - timeA;
                 if (sortBy === "date-asc") return timeA - timeB;
                 if (sortBy === "amount-desc") return b.totalAmount - a.totalAmount;
                 if (sortBy === "amount-asc") return a.totalAmount - b.totalAmount;
                 return 0;
               });
               return sorted.slice(0, 8);
             })().map((c: any) => {
               const snapshots = ledgerSnapshots.get(c.id) || { prev: 0, next: 0 };
               const isExpanded = expandedHomeId === c.id;
               const den = c.denominations || {};
               const txAmount = c.totalAmount || 0;
               // Edit and Delete window checks
               const createdMs = c.created_at ? new Date(c.created_at).getTime() : (c.date ? new Date(c.date.replace(' ', 'T') + 'Z').getTime() : 0);
               const elapsedMin = (Date.now() - createdMs) / 60000;
               const canEdit = editWindow === -1 || elapsedMin <= editWindow;
               const canDelete = deleteWindow === -1 || elapsedMin <= deleteWindow;
               return (
                 <div
                   key={c.id}
                   className={`rounded-lg border flex flex-col shadow-sm transition-all ${isExpanded ? 'bg-slate-50 dark:bg-slate-900/80 border-blue-200/60 dark:border-blue-900/30' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:shadow-md cursor-pointer'}`}
                   onClick={() => setExpandedHomeId(prev => prev === c.id ? null : c.id)}
                 >
                   {/* Main row */}
                   <div className="p-2 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <div className={`w-7 h-7 rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center transition-colors shadow-inner flex-shrink-0 ${c.type === 'collection' ? 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20' : 'group-hover:bg-red-50 dark:group-hover:bg-red-900/20'}`}>
                         {c.type === 'collection' ? (
                           <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                         ) : (
                           <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                         )}
                       </div>
                       <div>
                         <div className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1">
                           <span>
                             {c.type === 'collection'
                               ? `${c.retailerName || c.targetName}${c.store_name && c.store_name !== "Cash" ? ` (${c.store_name})` : ''}`
                               : `${c.targetName || 'Deposit'}${c.store_name && c.store_name !== "Cash" ? ` (${c.store_name})` : ''}`}
                           </span>
                           {c.remarks && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setCmsRemarksExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }));
                               }}
                               className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer inline-flex items-center justify-center"
                               title="View Remark"
                             >
                               <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[c.id] ? 'rotate-180 text-indigo-500' : ''}`} />
                             </button>
                           )}
                         </div>
                         {c.remarks && cmsRemarksExpanded[c.id] && (
                           <div className="mt-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-955/40 rounded border border-slate-200/50 dark:border-slate-800 text-[9px] font-medium text-slate-605 dark:text-slate-400">
                             <span className="text-[7.5px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                             <span className="italic">{c.remarks || "no remark"}</span>
                           </div>
                         )}
                         <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                           <span className="text-blue-500">{c.type === 'collection' ? (c.portalName || "Handover") : (c.depositType || 'Deposit')}</span>
                           <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                           <span>{c.date}</span>
                         </div>
                       </div>
                     </div>
                     <div className="text-right flex-shrink-0 ml-2 flex items-center gap-1.5">
                       <span className={`text-xs font-black tracking-tight block ${c.type === 'collection' ? 'text-emerald-600' : 'text-red-600'}`}>
                         {c.type === 'collection' ? '+' : '-'}₹{c.totalAmount.toLocaleString()}
                       </span>
                       <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                     </div>
                   </div>

                   {/* Balance row */}
                   <div className="grid grid-cols-2 gap-1 bg-slate-50/50 dark:bg-slate-950/50 mx-2 mb-2 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/50">
                     <div className="flex flex-col">
                       <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest">Opening</span>
                       <span className="text-[9px] font-bold text-slate-500">₹{snapshots.prev.toLocaleString()}</span>
                     </div>
                     <div className="flex flex-col text-right">
                       <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest">Closing</span>
                       <span className="text-[9px] font-black text-slate-800 dark:text-slate-200">₹{snapshots.next.toLocaleString()}</span>
                     </div>
                   </div>

                   {/* Expanded panel */}
                   {isExpanded && (
                     <div className="border-t border-slate-100 dark:border-slate-800 mx-2 mb-2 pt-2" onClick={e => e.stopPropagation()}>
                       {/* Denomination breakdown */}
                       <div className="mb-1.5">
                         <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cash Breakdown</span>
                         <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                           {Number(den.note_500 || 0) !== 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                           {Number(den.note_200 || 0) !== 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                           {Number(den.note_100 || 0) !== 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                           {Number(den.note_50 || 0) !== 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                           {Number(den.note_20 || 0) !== 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                           {Number(den.note_10 || 0) !== 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                           {Number(den.coins || 0) !== 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                           {Number(den.online_amount || 0) !== 0 && <span>UPI = ₹{Number(den.online_amount).toLocaleString()}</span>}
                           {!Number(den.note_500) && !Number(den.note_200) && !Number(den.note_100) && !Number(den.note_50) && !Number(den.note_20) && !Number(den.note_10) && !Number(den.coins) && !Number(den.online_amount) && <span className="text-slate-400 italic text-[8px]">No breakdown</span>}
                         </div>
                         <div className="mt-1 text-[9px] font-bold text-slate-500 italic">{numberToWordsIndian(txAmount)} Rupees</div>
                       </div>
                       {/* Action buttons */}
                       <div className="flex gap-1.5 mt-1.5">
                         <button
                           onClick={() => {
                             if (c.type === 'collection') {
                               shareCollectionEntry({ retailer_name: c.retailerName, portal_name: c.portalName, portal_group_name: c.portalGroupName, store_name: c.store_name, total_amount: c.totalAmount, denominations: c.denominations, created_at: c.created_at || c.date, remarks: c.remarks }, currentUser.name);
                             } else {
                               shareDepositEntry({ deposit_type: c.depositType, target_name: c.targetName, portal_name: c.portalName, amount: c.totalAmount, denominations: c.denominations, created_at: c.created_at || c.date, remarks: c.remarks }, currentUser.name, currentUser.id);
                             }
                           }}
                           className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/30 active:scale-95 transition-transform"
                         >
                           <Share2 className="w-2.5 h-2.5" /> Share
                         </button>
                         {canEdit || canDelete ? (
                           <>
                             {canEdit ? (
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   // Edit uses the same full entry form as creating a new one
                                   // (with retailer, date, etc.) instead of the old quick-edit
                                   // popup, so the two windows match.
                                   router.push(c.type === "collection" ? `/collection?editId=${c.id}` : `/deposit?editId=${c.id}`);
                                 }}
                                 className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-blue-50 dark:bg-blue-955/20 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider border border-blue-100 dark:border-blue-900/30 active:scale-95 transition-transform"
                               >
                                 <Edit2 className="w-2.5 h-2.5" /> Edit
                               </button>
                             ) : (
                               <div className="flex-1 text-center text-[7.5px] font-bold text-slate-400 py-1 bg-slate-50/50 dark:bg-slate-800/20 rounded-md border border-slate-100/10">
                                 Edit expired
                               </div>
                             )}
                             {canDelete ? (
                               <button
                                 onClick={async (e) => {
                                   e.stopPropagation();
                                   if (!confirm('Delete this entry?')) return;
                                   try {
                                     if (c.type === 'collection') {
                                       await api.deleteCollection(c.id);
                                     } else {
                                       await api.deleteDeposit(c.id);
                                     }
                                     // Refresh data
                                     const [apiCols, apiDeps] = await Promise.all([api.getCollections(), api.getDeposits()]);
                                     const { setCollections, setDeposits } = useAppStore.getState();
                                     setCollections(apiCols.map((col: any) => ({ id: col.id, retailer_id: col.retailer_id, store_id: col.store_id, store_name: col.store_name, retailerName: col.retailer_name || 'Unknown', portalName: col.portal_name || 'Cash', portalGroupName: col.portal_group_name || undefined, staffName: col.staff_name, totalAmount: Number(col.total_amount), denominations: col.denominations, status: col.status, remarks: col.remarks, date: getUtcDate(col.created_at).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).substring(0, 16), retailer_ledger_token: col.retailer_ledger_token, created_at: col.created_at })));
                                     setDeposits(apiDeps.filter((d: any) => !(d.recipient_staff_id === currentUser.id && d.deposit_type === 'staff')).map((d: any) => ({ id: d.id, portal_id: d.portal_id, retailer_id: d.retailer_id, recipient_staff_id: d.recipient_staff_id, depositType: d.deposit_type, targetName: (d.deposit_type === 'portal' && d.portal_group_name) ? d.portal_group_name : (d.target_name || 'Super Distributor'), amount: Number(d.amount), paymentMode: d.payment_mode === 'cash' ? 'cash' : 'online', denominations: d.denominations, status: d.status, remarks: d.remarks, portalName: d.portal_name || undefined, date: getUtcDate(d.created_at).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).substring(0, 16), retailer_ledger_token: d.retailer_ledger_token, created_at: d.created_at })));
                                     setExpandedHomeId(null);
                                   } catch (err: any) {
                                     alert('Delete failed: ' + err.message);
                                   }
                                 }}
                                 className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[8px] font-black uppercase tracking-wider border border-red-100 dark:border-red-900/30 active:scale-95 transition-transform"
                               >
                                 <Trash2 className="w-2.5 h-2.5" /> Delete
                               </button>
                             ) : (
                               <div className="flex-1 text-center text-[7.5px] font-bold text-slate-400 py-1 bg-slate-50/50 dark:bg-slate-800/20 rounded-md border border-slate-100/10">
                                 Delete expired
                               </div>
                             )}
                           </>
                         ) : (
                           <div className="flex-1 text-center text-[7.5px] font-bold text-slate-400 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-100 dark:border-slate-800">
                             Action window expired
                           </div>
                         )}
                       </div>
                     </div>
                   )}
                 </div>
               );
             })}
             {combinedLedger.length === 0 && (
               <div className="text-center py-5 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                 <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">No recent entries</p>
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
      
      {/* In-place Edit Modal */}
      {editingItem && (() => {
        const isCol = editingItem.type === "collection";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
              className="absolute inset-0"
              onClick={() => setEditingItem(null)}
            />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xs max-h-[85vh] overflow-y-auto p-4 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3 text-slate-800 dark:text-slate-100">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider">
                  {isCol ? "Edit Cash In Entry" : "Edit Cash Out Entry"}
                </h3>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Update counts and remarks</p>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {[
                    { label: "₹500 Notes", key: "note_500", val: 500 },
                    { label: "₹200 Notes", key: "note_200", val: 200 },
                    { label: "₹100 Notes", key: "note_100", val: 100 },
                    { label: "₹50 Notes", key: "note_50", val: 50 },
                    { label: "₹20 Notes", key: "note_20", val: 20 },
                    { label: "₹10 Notes", key: "note_10", val: 10 },
                  ].map(note => (
                    <div key={note.key} className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500">{note.label}</span>
                      <div className="flex items-center gap-2.5">
                        <input autoComplete="one-time-code"
                          type="number"
                          value={editDenoms[note.key] === 0 ? "" : editDenoms[note.key]}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                            setEditDenoms((prev: any) => ({ ...prev, [note.key]: isNaN(v) ? 0 : v }));
                          }}
                          className="w-14 px-1.5 py-0.5 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
                          placeholder="0"
                        />
                        <span className={`w-14 text-right font-bold ${(editDenoms[note.key] || 0) < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                          ₹{((editDenoms[note.key] || 0) * note.val).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500">Coins Sum</span>
                    <div className="flex items-center gap-2.5">
                      <input autoComplete="one-time-code"
                        type="number"
                        step="0.01"
                        value={editDenoms.coins || ""}
                        onChange={(e) => {
                          let v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          setEditDenoms((prev: any) => ({ ...prev, coins: isNaN(v) ? 0 : v }));
                        }}
                        className="w-14 px-1.5 py-0.5 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200/80 rounded text-xs font-bold"
                      />
                      <span className="w-14 text-right text-slate-500 font-bold">₹{Number(editDenoms.coins || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500">UPI Online</span>
                    <div className="flex items-center gap-2.5">
                      <input autoComplete="one-time-code"
                        type="number"
                        value={editDenoms.online_amount || ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                          setEditDenoms((prev: any) => ({ ...prev, online_amount: isNaN(v) ? 0 : v }));
                        }}
                        className="w-14 px-1.5 py-0.5 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200/80 rounded text-xs font-bold"
                        min="0"
                      />
                      <span className="w-14 text-right text-slate-500 font-bold">₹{Number(editDenoms.online_amount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-black text-slate-400">Remarks</label>
                  <textarea
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-slate-400 font-bold"
                    rows={2}
                    placeholder="Enter remarks..."
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[7.5px] font-black uppercase text-slate-400 tracking-wider">Total Amount</span>
                    {isCol && (() => {
                      const tot = editDenoms.note_500 * 500 + editDenoms.note_200 * 200 + editDenoms.note_100 * 100 + editDenoms.note_50 * 50 + editDenoms.note_20 * 20 + editDenoms.note_10 * 10 + editDenoms.coins + editDenoms.online_amount;
                      if (tot < 0) return (
                        <div className="flex items-center gap-1 mt-0.5 text-amber-500">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <p className="text-[8px] font-bold">Negative total — note exchange mode</p>
                        </div>
                      );
                      return null;
                    })()}
                  </div>
                  <span className={`text-sm font-black ${isCol && (editDenoms.note_500 * 500 + editDenoms.note_200 * 200 + editDenoms.note_100 * 100 + editDenoms.note_50 * 50 + editDenoms.note_20 * 20 + editDenoms.note_10 * 10 + editDenoms.coins + editDenoms.online_amount) < 0 ? 'text-red-500' : ''}`}>
                    ₹{(
                      editDenoms.note_500 * 500 +
                      editDenoms.note_200 * 200 +
                      editDenoms.note_100 * 100 +
                      editDenoms.note_50 * 50 +
                      editDenoms.note_20 * 20 +
                      editDenoms.note_10 * 10 +
                      editDenoms.coins +
                      editDenoms.online_amount
                    ).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-xs font-bold rounded-lg active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold rounded-lg active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
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
              <input autoComplete="one-time-code"
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
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-300 border border-white/5 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>Watermark Overlay Succeeded</span>
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
                    <span className="flex items-center gap-1 justify-center"><svg className="w-3.5 h-3.5 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>GPS Locked:</span></span> {locationError}
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
              <input autoComplete="one-time-code"
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
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-300 border border-white/5 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>Watermark Overlay Succeeded</span>
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
                    <span className="flex items-center gap-1 justify-center"><svg className="w-3.5 h-3.5 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>GPS Locked:</span></span> {locationError}
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

function SummaryBlocks({
  oldBalance,
  todayIn,
  todayOut,
  netBalance,
  totalCashNotes,
  totalOnline,
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
    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-md relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />

      <div className="flex items-center gap-2 mb-3 relative z-10">
        <div className="p-1 bg-emerald-50 dark:bg-emerald-950/50 rounded-md border border-emerald-100 dark:border-emerald-900/30">
          <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Cash Summary</span>
      </div>

      {/* 4-column formula grid */}
      <div className="grid grid-cols-4 gap-1.5 relative z-10">
        {/* Old Balance */}
        <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg flex flex-col">
          <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest">Old Bal</span>
          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 mt-0.5">₹{oldBalance.toLocaleString()}</span>
        </div>
        {/* Today In */}
        <div className="p-2 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg flex flex-col">
          <span className="text-[6.5px] font-black text-emerald-600 uppercase tracking-widest">+ Today In</span>
          <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 mt-0.5">₹{todayIn.toLocaleString()}</span>
        </div>
        {/* Today Out */}
        <div className="p-2 bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg flex flex-col">
          <span className="text-[6.5px] font-black text-red-600 uppercase tracking-widest">- Today Out</span>
          <span className="text-[10px] font-black text-red-700 dark:text-red-400 mt-0.5">₹{todayOut.toLocaleString()}</span>
        </div>
        {/* Net */}
        <div className={`p-2 rounded-lg flex flex-col border ${
          netBalance < 0
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'
            : 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30'
        }`}>
          <span className={`text-[6.5px] font-black uppercase tracking-widest ${
            netBalance < 0 ? 'text-red-600' : 'text-blue-600'
          }`}>
            = Net
          </span>
          <span className={`text-[10px] font-black mt-0.5 ${
            netBalance < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
          }`}>
            ₹{netBalance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Cash / Online split */}
      <div className="grid grid-cols-2 gap-1.5 mt-2 relative z-10">
        <div className="flex flex-col px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Cash Notes</span>
          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 mt-0.5">₹{totalCashNotes.toLocaleString()}</span>
        </div>
        <div className="flex flex-col px-2 py-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20">
          <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Online / UPI</span>
          <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 mt-0.5">₹{totalOnline.toLocaleString()}</span>
        </div>
      </div>

      {/* Denomination Breakdown toggle */}
      <div className="pt-2 relative z-10">
        <button
          onClick={() => setShowNotesBreakdown(!showNotesBreakdown)}
          className="w-full flex items-center justify-between text-xs font-black text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none transition-colors"
        >
          <span className="uppercase tracking-[0.15em] text-[8px]">Denomination Breakdown</span>
          {showNotesBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showNotesBreakdown && (
          <div className="grid grid-cols-2 gap-1.5 mt-2 text-[11px] font-medium">
            {[
              { value: "500", count: note500 },
              { value: "200", count: note200 },
              { value: "100", count: note100 },
              { value: "50",  count: note50 },
              { value: "20",  count: note20 },
              { value: "10",  count: note10 },
            ].filter(n => n.count !== 0).map((note) => (
              <div key={note.value} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 py-1.5 px-2 rounded-lg border border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400 font-bold">₹{note.value}</span>
                <span className="font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-800">{note.count}</span>
              </div>
            ))}
            {coins !== 0 && (
              <div className="col-span-2 flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/60 mt-0.5">
                <span className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Coins</span>
                <span className="font-black text-slate-800 dark:text-slate-200 text-xs">₹{coins.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NavigationGrid({ isCheckedIn, router, onClickLink }: any) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => {
          if (!isCheckedIn) {
            alert("Shift is locked! Please start shift attendance mileage first.");
            return;
          }
          if (onClickLink) onClickLink();
          router.push("/collection");
        }}
        className={`relative overflow-hidden p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/50 hover:shadow-md text-left transition-all duration-300 group shadow-sm flex items-center gap-2 ${!isCheckedIn ? "opacity-40 grayscale cursor-not-allowed" : ""}`}
      >
        <div className="w-8 h-8 rounded bg-[#00a86b] dark:bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white shadow-sm">
          <PlusCircle className="w-4.5 h-4.5" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-wide">Cash In</h3>
          <p className="text-[9px] font-bold text-slate-400">Record collection</p>
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
        className={`relative overflow-hidden p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/50 hover:shadow-md text-left transition-all duration-300 group shadow-sm flex items-center gap-2 ${!isCheckedIn ? "opacity-40 grayscale cursor-not-allowed" : ""}`}
      >
        <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 text-red-500 dark:text-red-400">
          <ArrowUpRight className="w-4.5 h-4.5" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-wide">Cash Out</h3>
          <p className="text-[9px] font-bold text-slate-400">Process payout</p>
        </div>
      </button>
    </div>
  );
}

