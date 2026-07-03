"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAppStore } from "../../utils/store";
import { api } from "../../utils/api";

interface AdminContextType {
  isLoading: boolean;
  error: string | null;
  collections: any[];
  deposits: any[];
  retailerDirectory: any[];
  portalDirectory: any[];
  userDirectory: any[];
  staffComplianceLogs: any[];
  businessSettings: any;
  fetchData: (showLoading?: boolean) => Promise<void>;
  showToastNotification: (msg: string) => void;
  toastMessage: string;
  showToast: boolean;
  setShowToast: (val: boolean) => void;
  showRetailerDrawer: boolean;
  setShowRetailerDrawer: (val: boolean) => void;
  showPortalDrawer: boolean;
  setShowPortalDrawer: (val: boolean) => void;
  ledgerSearchTerm: string;
  setLedgerSearchTerm: (val: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, setCollections, setDeposits } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [retailerDirectory, setRetailerDirectory] = useState<any[]>([]);
  const [portalDirectory, setPortalDirectory] = useState<any[]>([]);
  const [userDirectory, setUserDirectory] = useState<any[]>([]);
  const [staffComplianceLogs, setStaffComplianceLogs] = useState<any[]>([]);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showRetailerDrawer, setShowRetailerDrawer] = useState(false);
  const [showPortalDrawer, setShowPortalDrawer] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");

  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const fetchData = useCallback(async (showLoading = true) => {
    const token = currentUser?.token;
    if (!token) return;

    if (showLoading) setIsLoading(true);
    try {
      const [cols, deps, rets, fetchedUsers, pGroups, attendanceLogs, settings] = await Promise.all([
        api.getCollections().catch((e) => { console.error("Cols err:", e); return []; }),
        api.getDeposits().catch((e) => { console.error("Deps err:", e); return []; }),
        api.getRetailers().catch((e) => { console.error("Rets err:", e); return []; }),
        api.getUsers().catch((e) => { console.error("Users err:", e); return []; }),
        api.getPortalGroups().catch((e) => { console.error("Portals err:", e); return []; }),
        api.getTodayAttendance().catch((e) => { console.error("Att err:", e); return []; }),
        api.getAdminSettings().catch((e) => { console.error("Settings err:", e); return null; })
      ]);
      
      const mappedCols = cols.map((c: any) => {
        // Build display date: use collection_date for date part + created_at for time part
        let dtStr = "N/A";
        if (c.created_at) {
          const cleanCreatedAt = c.created_at.replace(" ", "T");
          const d = new Date(cleanCreatedAt + (cleanCreatedAt.includes("Z") ? "" : "Z"));
          const timePart = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: 'Asia/Kolkata'
          }).format(d);
          const datePart = c.collection_date || new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata'
          }).format(d);
          dtStr = `${datePart} ${timePart}`;
        }
        return {
          id: c.id,
          retailer_id: c.retailer_id,
          portal_id: c.portal_id,
          store_id: c.store_id,
          from_staff_id: c.from_staff_id,
          staff_id: c.staff_id,
          retailerName: c.retailer_name || "Unknown Retailer",
          store_name: c.store_name || null,
          portalName: c.portal_name || "Standard Channel",
          staffName: c.staff_name || "Unknown Staff",
          totalAmount: parseFloat(c.total_amount),
          balance_snapshot: c.balance_snapshot,
          denominations: c.denominations,
          remarks: c.remarks,
          status: c.status,
          date: dtStr,
          collection_date: c.collection_date,
          created_at: c.created_at
        };
      });

      const mappedDeps = deps.map((d: any) => {
        let dtStr = d.deposit_date || "N/A";
        if (d.created_at) {
          const cleanCreatedAt = d.created_at.replace(" ", "T");
          const dateObj = new Date(cleanCreatedAt + (cleanCreatedAt.includes("Z") ? "" : "Z"));
          dtStr = new Intl.DateTimeFormat('en-GB', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: 'Asia/Kolkata'
          }).format(dateObj).replace(',', '').replace(/\//g, '-');
          const [date, time] = dtStr.split(' ');
          const [day, month, year] = date.split('-');
          dtStr = `${year}-${month}-${day} ${time}`;
        }
        return {
          id: d.id,
          portal_id: d.portal_id,
          retailer_id: d.retailer_id,
          staff_id: d.staff_id,
          recipient_staff_id: d.recipient_staff_id,
          portalGroupId: d.portal_group_id,
          portalGroupName: d.portal_group_name,
          depositType: d.deposit_type,
          targetName: d.target_name || "Direct Deposit",
          portalName: d.portal_name || null,
          bankName: d.bank_name || null,
          amount: parseFloat(d.amount),
          balance_snapshot: d.balance_snapshot,
          paymentMode: d.payment_mode,
          denominations: d.denominations,
          status: d.status,
          staffName: d.staff_name || "System",
          isRefund: d.is_refund === true,
          date: dtStr,
          created_at: d.created_at
        };
      });

      const mappedRets = rets.map((r: any) => ({
        id: r.id,
        name: r.retailer_name,
        phone: r.phone,
        area: r.address,
        balance: parseFloat(r.balance || 0),
        email: r.email,
        opening_to_give: parseFloat(r.opening_to_give || 0),
        opening_to_take: parseFloat(r.opening_to_take || 0),
        ledger_token: r.ledger_token,
        category: r.category
      }));
      
      mappedCols.sort((a: any, b: any) => new Date(b.date.replace(' ', 'T')).getTime() - new Date(a.date.replace(' ', 'T')).getTime());
      mappedDeps.sort((a: any, b: any) => new Date(b.date.replace(' ', 'T')).getTime() - new Date(a.date.replace(' ', 'T')).getTime());
      
      const mappedGroups = pGroups.map((g: any) => {
        const portalsMapped = (g.portals || []).map((p: any) => ({
          id: p.id,
          portal_name: p.portal_name,
          bank_name: p.bank_name,
          bank_account_no: p.bank_account_no,
          ifsc_code: p.ifsc_code,
          show_in_online_payment: !!p.show_in_online_payment,
          opening_to_give: parseFloat(p.opening_to_give || 0),
          opening_to_take: parseFloat(p.opening_to_take || 0),
          balance: parseFloat(p.balance || 0)
        }));
        return {
          id: g.id,
          name: g.name,
          opening_to_give: parseFloat(g.opening_to_give || 0),
          opening_to_take: parseFloat(g.opening_to_take || 0),
          balance: parseFloat(g.balance || 0),
          portals: portalsMapped,
          show_in_online_payment: portalsMapped.some((p: any) => p.show_in_online_payment)
        };
      });
      
      setCollections(mappedCols);
      setDeposits(mappedDeps);
      setRetailerDirectory(mappedRets);
      setUserDirectory(fetchedUsers);
      setPortalDirectory(mappedGroups);
      setBusinessSettings(settings);
      const uniqueAttendanceLogs = Array.from(new Map(attendanceLogs.map((log: any) => [log.id, log])).values());
      
      setStaffComplianceLogs(uniqueAttendanceLogs.map((log: any) => ({
        id: log.id,
        staffId: log.staff_id,
        name: log.staff_name,
        date: "Today",
        startKm: log.start_km,
        endKm: log.end_km,
        startTime: log.start_time,
        endTime: log.end_time,
        duration: log.duration,
        status: log.status?.toLowerCase() === "active" ? "Active Duty" : "Completed",
        startLatitude: log.start_latitude,
        startLongitude: log.start_longitude,
        endLatitude: log.end_latitude,
        endLongitude: log.end_longitude,
        startKmImageUrl: log.start_km_image_url,
        endKmImageUrl: log.end_km_image_url
      })));
    } catch (err: any) {
      console.error("Failed to fetch backend data:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [currentUser, setCollections, setDeposits]);

  useEffect(() => {
    fetchData(true);
    const intervalId = setInterval(() => fetchData(false), 5000);

    // Mobile browsers throttle/suspend setInterval while the tab/app is backgrounded
    // (screen off, app switched away). Without this, a page left open since the
    // morning shows stale data all day until manually reloaded. Force an immediate
    // refetch as soon as the tab/app becomes visible again.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchData(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [fetchData]);

  const { collections: storeCols, deposits: storeDeps } = useAppStore();

  return (
    <AdminContext.Provider value={{
      isLoading,
      error,
      collections: storeCols,
      deposits: storeDeps,
      retailerDirectory,
      portalDirectory,
      userDirectory,
      staffComplianceLogs,
      businessSettings,
      fetchData,
      showToastNotification,
      toastMessage,
      showToast,
      setShowToast,
      showRetailerDrawer,
      setShowRetailerDrawer,
      showPortalDrawer,
      setShowPortalDrawer,
      ledgerSearchTerm,
      setLedgerSearchTerm
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
