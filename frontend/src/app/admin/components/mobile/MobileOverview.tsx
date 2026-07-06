"use client";

import React, { useMemo, useState, useEffect } from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  History,
  Users,
  Store,
  Clock,
  X,
  MapPin,
  Camera,
  ChevronDown,
  Share2,
  Edit2,
  Trash2,
  Save,
  Calendar,
  ArrowRight
} from "lucide-react";
import { format, subDays, isSameDay } from "date-fns";
import Link from "next/link";
import { useAdmin } from "../../context/AdminContext";
import { numberToWordsIndian, shareCollectionEntry, shareDepositEntry } from "../../../utils/shareHelper";
import { api } from "../../../utils/api";
import { getISTDateString } from "../../../utils/dateHelpers";
import InlineSelect from "@/app/components/InlineSelect";

interface VisitedStore {
  id: string;
  retailerName: string;
  time: string;
  amount: number;
  status: string;
}

interface StaffCompliance {
  status?: string;
  startTime?: string;
  startKm?: string | number;
  endKm?: string | number;
  startLatitude?: number;
  startLongitude?: number;
  startKmImageUrl?: string;
  endLatitude?: number;
  endLongitude?: number;
  endKmImageUrl?: string;
}

interface StaffListData {
  name: string;
  collectedToday: number;
  depositedToday: number;
  remainingToday: number;
  visitedStores: VisitedStore[];
  compliance?: StaffCompliance;
}

interface MobileOverviewProps {
  collections: any[];
  deposits: any[];
  totalCollectedAmount: number;
  totalDepositedAmount: number;
  netCashBalance: number;
  totalToTake: number;
  totalToGive: number;
  fetchData: () => void;
  todayCount: number;
  userDirectory: any[];
  staffComplianceLogs: any[];
}

export default function MobileOverview({
  collections,
  deposits,
  totalCollectedAmount,
  totalDepositedAmount,
  netCashBalance,
  totalToTake,
  totalToGive,
  fetchData,
  todayCount,
  userDirectory,
  staffComplianceLogs
}: MobileOverviewProps) {
  const { retailerDirectory, portalDirectory, showToastNotification } = useAdmin();
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [isStaffTrackingExpanded, setIsStaffTrackingExpanded] = useState(false);
  const [isRecentLedgerExpanded, setIsRecentLedgerExpanded] = useState(true);

  // Date range modal state
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [rangeEndDate, setRangeEndDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );

  const safeCollections = collections || [];
  const safeDeposits = deposits || [];

  const filteredCollections = useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return [];
    return safeCollections.filter(c => {
      const cDate = c.date?.split(' ')[0];
      return cDate >= rangeStartDate && cDate <= rangeEndDate;
    });
  }, [safeCollections, rangeStartDate, rangeEndDate]);

  const filteredDeposits = useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return [];
    return safeDeposits.filter(d => {
      const dDate = d.date?.split(' ')[0];
      const isNotVirtual = d.depositType?.toLowerCase() !== 'virtual';
      return isNotVirtual && dDate >= rangeStartDate && dDate <= rangeEndDate;
    });
  }, [safeDeposits, rangeStartDate, rangeEndDate]);

  const rangeCashIn = useMemo(() => {
    return filteredCollections.reduce((s, c) => s + (c.totalAmount || 0), 0);
  }, [filteredCollections]);

  const rangeCashOut = useMemo(() => {
    return filteredDeposits.reduce((s, d) => s + (d.amount || 0), 0);
  }, [filteredDeposits]);

  const rangeNet = rangeCashIn - rangeCashOut;

  const rangeEntries = useMemo(() => {
    const combined = [
      ...filteredCollections.map(c => ({
        id: c.id,
        date: c.date,
        type: 'collection',
        amount: c.totalAmount,
        remarks: c.remarks || '',
        from: c.retailerName?.toLowerCase().startsWith("cms")
          ? `${c.retailerName}${c.store_name ? ` - ${c.store_name}` : ''}`
          : `${c.retailerName}${c.store_name ? ` (${c.store_name})` : ''}`,
        to: c.staffName || 'Admin'
      })),
      ...filteredDeposits.map(d => {
        let toLabel = d.targetName;
        if (d.depositType === 'staff') {
          toLabel = d.to_office ? 'Office' : (d.recipient_staff_name || d.targetName);
        }
        return {
          id: d.id,
          date: d.date,
          type: 'deposit',
          amount: d.amount,
          remarks: d.remarks || '',
          from: d.staffName || 'Admin',
          to: toLabel
        };
      })
    ];
    return combined.sort((a, b) => new Date(b.date.replace(' ', 'T')).getTime() - new Date(a.date.replace(' ', 'T')).getTime());
  }, [filteredCollections, filteredDeposits]);
  
  // Calculate 7-day trend data
  const trendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
    
    return last7Days.map(day => {
      const targetDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(day);
      const dayCollections = collections
        .filter(c => c.date.split(" ")[0] === targetDateStr)
        .reduce((sum, c) => sum + (c.totalAmount || 0), 0);
        
      const dayDeposits = deposits
        .filter(d => d.date.split(" ")[0] === targetDateStr && d.depositType?.toLowerCase() !== 'virtual')
        .reduce((sum, d) => sum + (d.amount || 0), 0);
        
      return {
        label: format(day, "EEE"),
        net: dayCollections - dayDeposits,
        date: format(day, "MMM d")
      };
    });
  }, [collections, deposits]);

  // Combine and sort recent transactions using the unified ledger properties
  const recentActivity = useMemo(() => {
    const combined = [
      ...(collections || []).map(c => ({
        id: c.id,
        date: c.date,
        created_at: c.created_at || c.date,
        party: c.retailerName,
        store_name: c.store_name || null,
        remarks: c.remarks || "",
        staff: c.staffName || "Admin",
        amount: c.totalAmount,
        type: 'collection',
        balance: c.balance_snapshot,
        denominations: c.denominations,
        retailer_id: c.retailer_id,
        store_id: c.store_id,
        portal_id: c.portal_id
      })),
      ...(deposits || []).map(d => ({
        id: d.id,
        date: d.date,
        created_at: d.created_at || d.date,
        party: d.portalGroupName ? `${d.portalGroupName} (${d.targetName})` : d.targetName,
        store_name: null,
        remarks: d.remarks || "",
        staff: d.staffName || "Admin",
        amount: d.amount,
        type: 'deposit',
        balance: d.balance_snapshot,
        denominations: d.denominations,
        deposit_type: d.depositType,
        portal_id: d.portal_id,
        retailer_id: d.retailer_id,
        recipient_staff_id: d.recipient_staff_id,
        paymentMode: d.paymentMode
      }))
    ];
    return combined
      .sort((a, b) => {
        const timeA = new Date(a.date.replace(" ", "T")).getTime();
        const timeB = new Date(b.date.replace(" ", "T")).getTime();
        if (sortBy === "date-desc") return timeB - timeA;
        if (sortBy === "date-asc") return timeA - timeB;
        if (sortBy === "amount-desc") return b.amount - a.amount;
        if (sortBy === "amount-asc") return a.amount - b.amount;
        return 0;
      })
      .slice(0, 10);
  }, [collections, deposits, sortBy]);

  const maxNet = Math.max(...trendData.map(d => Math.abs(d.net)), 1000);

  // Filter for field staff
  const staffUsers = useMemo(() => {
    return (userDirectory || []).filter((u: { role: string }) => u.role === "field_staff" || u.role === "staff");
  }, [userDirectory]);

  // State to track which staff cards are expanded
  const [expandedStaffNames, setExpandedStaffNames] = useState<Record<string, boolean>>({});
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = useState<Record<string, boolean>>({});
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = useState(false);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
  const [selectedNewStoreId, setSelectedNewStoreId] = useState("");
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = useState("");
  const [selectedNewAmount, setSelectedNewAmount] = useState(0);
  const [selectedNewDate, setSelectedNewDate] = useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = useState("");
  const [selectedNewVirtualTargetType, setSelectedNewVirtualTargetType] = useState("retailer");
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  
  const [selectedNewDenoms, setSelectedNewDenoms] = useState({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0,
  });

  useEffect(() => {
    const fetchStores = async () => {
      if (selectedNewRetailerId) {
        try {
          const stores = await api.getRetailerStores(selectedNewRetailerId);
          setAvailableStores(stores || []);
          if (editingCollection && (editingCollection.retailer_id === selectedNewRetailerId || editingCollection.retailerId === selectedNewRetailerId)) {
            setSelectedNewStoreId(editingCollection.store_id || editingCollection.storeId || "");
          } else {
            setSelectedNewStoreId("");
          }
        } catch (err) {
          console.error("Failed to fetch stores in edit modal:", err);
          setAvailableStores([]);
          setSelectedNewStoreId("");
        }
      } else {
        setAvailableStores([]);
        setSelectedNewStoreId("");
      }
    };
    fetchStores();
  }, [selectedNewRetailerId, editingCollection]);

  const handleStartEditCollection = (item: any) => {
    const isDeposit = item.type === "deposit";
    setEditingIsDeposit(isDeposit);
    setEditingCollection(item);
    
    setSelectedNewRetailerId(item.retailer_id || item.retailerId || "");
    setSelectedNewStoreId(item.store_id || item.storeId || "");
    setSelectedNewPortalId(item.portal_id || item.portalId || "");
    setSelectedNewRemarks(item.remarks || "");
    
    if (isDeposit) {
      setSelectedNewDepositType(item.deposit_type || "virtual");
      setSelectedNewPaymentMode(item.paymentMode || item.payment_mode || "online");
      setSelectedNewAmount(Number(item.amount || 0));
      setSelectedNewDate(item.date ? item.date.split(" ")[0] : getISTDateString());
      setSelectedNewRefNo(item.reference_no || "");
      setSelectedNewRecipientStaffId(item.recipient_staff_id || "");
      setSelectedNewToOffice(item.to_office === true);
      const hasStaff = !!(item.recipient_staff_id || item.recipientStaffId);
      setSelectedNewVirtualTargetType(hasStaff ? "staff" : "retailer");
    } else {
      setSelectedNewDate(item.collection_date || (item.date ? item.date.split(" ")[0] : getISTDateString()));
    }
    
    const den = item.denominations || {};
    setSelectedNewDenoms({
      note_500: Number(den.note_500 || 0),
      note_200: Number(den.note_200 || 0),
      note_100: Number(den.note_100 || 0),
      note_50: Number(den.note_50 || 0),
      note_20: Number(den.note_20 || 0),
      note_10: Number(den.note_10 || 0),
      coins: Number(den.coins || 0),
      online_amount: Number(den.online_amount || 0),
    });
    
    setIsEditCollectionModalOpen(true);
  };

  const handleSaveCollectionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    setIsSavingCollection(true);
    
    try {
      if (editingIsDeposit) {
        const portalId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewPortalId : null;
        const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
        const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
        const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

        await api.updateDeposit(editingCollection.id, {
          deposit_type: selectedNewDepositType,
          portal_id: portalId || null,
          retailer_id: retailerId || null,
          recipient_staff_id: recipientStaffId || null,
          to_office: toOffice,
          payment_mode: selectedNewPaymentMode,
          amount: Number(selectedNewAmount),
          deposit_date: selectedNewDate || getISTDateString(),
          reference_no: selectedNewRefNo || null,
          remarks: selectedNewRemarks || "",
          denominations: selectedNewPaymentMode === "cash" ? selectedNewDenoms : null
        });
      } else {
        const computedCollectionTotal = (
          selectedNewDenoms.note_500 * 500 +
          selectedNewDenoms.note_200 * 200 +
          selectedNewDenoms.note_100 * 100 +
          selectedNewDenoms.note_50 * 50 +
          selectedNewDenoms.note_20 * 20 +
          selectedNewDenoms.note_10 * 10 +
          selectedNewDenoms.coins +
          selectedNewDenoms.online_amount
        );

        await api.updateCollection(editingCollection.id, {
          retailer_id: selectedNewRetailerId || null,
          portal_id: selectedNewPortalId || null,
          store_id: selectedNewStoreId || null,
          total_amount: computedCollectionTotal,
          collection_date: selectedNewDate || getISTDateString(),
          remarks: selectedNewRemarks || "",
          denominations: selectedNewDenoms
        });
      }
      showToastNotification("Entry updated successfully.");
      setIsEditCollectionModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

  const toggleStaffExpanded = (name: string) => {
    setExpandedStaffNames(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // State for active modal visited stores
  const [activeModalStaff, setActiveModalStaff] = useState<{ name: string; visitedStores: VisitedStore[] } | null>(null);

  // Precalculate daily metrics for all active field staff
  const staffListData = useMemo<StaffListData[]>(() => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    return (staffUsers || []).map((user: { id: string; name: string }) => {
      const name = user.name;

      // Today's collections & deposits
      const staffColsToday = (collections || []).filter(
        (c) => c.staffName === name && c.date?.startsWith(todayStr)
      );
      const staffDepsToday = (deposits || []).filter(
        (d) => d.staffName === name && d.date?.startsWith(todayStr) && d.depositType?.toLowerCase() !== 'virtual'
      );

      // Previous days' collections & deposits
      const staffColsPrev = (collections || []).filter(
        (c) => c.staffName === name && !c.date?.startsWith(todayStr)
      );
      const staffDepsPrev = (deposits || []).filter(
        (d) => d.staffName === name && !d.date?.startsWith(todayStr) && d.depositType?.toLowerCase() !== 'virtual'
      );

      // Received handovers (deposit_type === "staff" and recipient_staff_id === user.id)
      // Filter out received handovers that have matching collection to avoid double-counting
      const receivedDepsToday = (deposits || []).filter(d => 
        d.recipient_staff_id === user.id && 
        d.depositType === 'staff' && 
        d.date?.startsWith(todayStr) &&
        !(collections || []).some(c => c.from_staff_id === d.staff_id && Number(c.totalAmount) === Number(d.amount))
      );
      
      const receivedDepsPrev = (deposits || []).filter(d => 
        d.recipient_staff_id === user.id && 
        d.depositType === 'staff' && 
        !d.date?.startsWith(todayStr) &&
        !(collections || []).some(c => c.from_staff_id === d.staff_id && Number(c.totalAmount) === Number(d.amount))
      );

      const collectedToday = staffColsToday.reduce((s, c) => s + (c.totalAmount || 0), 0) + receivedDepsToday.reduce((s, d) => s + (d.amount || 0), 0);
      const depositedToday = staffDepsToday.reduce((s, d) => s + (d.amount || 0), 0);
      const oldBalance = staffColsPrev.reduce((s, c) => s + (c.totalAmount || 0), 0) + receivedDepsPrev.reduce((s, d) => s + (d.amount || 0), 0)
                       - staffDepsPrev.reduce((s, d) => s + (d.amount || 0), 0);
      const netBalance = oldBalance + collectedToday - depositedToday;
      const remainingToday = collectedToday - depositedToday;

      // ─── Pocket Denominations Calculation (latest-first reconstruction) ────────
      // netBalance above is a pure dollar total, so it's always correct. To show a
      // real note breakdown for that amount, walk cash-IN events (collections +
      // received handovers) newest-first and take their *actual recorded* notes
      // until the target is covered — assuming the most recently collected cash
      // is what's still physically in hand, since older cash has most likely
      // already been deposited out. This is deliberately NOT a full-lifetime sum:
      // summing every denomination ever recorded drifts away from netBalance
      // because staff exchange/consolidate physical notes at deposit time in ways
      // the ledger never tracks note-for-note.
      const netDen = { note_500: 0, note_200: 0, note_100: 0, note_50: 0, note_20: 0, note_10: 0, coins: 0, online: 0 };
      let onlineIn = 0, onlineOut = 0;

      const allStaffCols = [...staffColsPrev, ...staffColsToday];
      const allReceivedDeps = [...receivedDepsPrev, ...receivedDepsToday];
      const allStaffDeps = [...staffDepsPrev, ...staffDepsToday];

      allStaffCols.forEach(c => { onlineIn += Number(c.denominations?.online_amount || 0); });
      allReceivedDeps.forEach(r => { onlineIn += Number(r.denominations?.online_amount || 0); });
      allStaffDeps.forEach(d => { onlineOut += Number(d.denominations?.online_amount || 0); });

      netDen.online = Math.max(0, onlineIn - onlineOut);

      let remaining = Math.max(0, netBalance - netDen.online);
      const cashInEvents = [...allStaffCols, ...allReceivedDeps]
        .filter(e => e.denominations)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      for (const event of cashInEvents) {
        if (remaining <= 0) break;
        const den = event.denominations;
        if (!den) continue;
        const d500 = Number(den.note_500) || 0, d200 = Number(den.note_200) || 0, d100 = Number(den.note_100) || 0;
        const d50  = Number(den.note_50)  || 0, d20  = Number(den.note_20)  || 0, d10  = Number(den.note_10)  || 0;
        const dCoins = Number(den.coins) || 0;
        const eventValue = d500 * 500 + d200 * 200 + d100 * 100 + d50 * 50 + d20 * 20 + d10 * 10 + dCoins;

        if (eventValue === 0) {
          // Net-zero cash value with nonzero note fields (e.g. note_500: +2,
          // note_50: -20) is a recorded note exchange, not noise — apply it in
          // full regardless of `remaining` since it doesn't change the pocket's
          // total value, only its composition.
          if (d500 || d200 || d100 || d50 || d20 || d10 || dCoins) {
            netDen.note_500 += d500; netDen.note_200 += d200; netDen.note_100 += d100;
            netDen.note_50  += d50;  netDen.note_20  += d20;  netDen.note_10  += d10; netDen.coins += dCoins;
          }
          continue;
        }
        if (eventValue < 0) continue; // shouldn't happen for a cash-in event; skip defensively

        // Take whatever fits from this transaction's own notes (largest
        // denomination first, coins last). Any uncovered remainder rolls over
        // to the next (older) transaction instead of being discarded. Coins
        // are trusted as recorded — taking cash in coin form is normal
        // practice here.
        const take500 = Math.min(d500, Math.floor(remaining / 500)); remaining -= take500 * 500;
        const take200 = Math.min(d200, Math.floor(remaining / 200)); remaining -= take200 * 200;
        const take100 = Math.min(d100, Math.floor(remaining / 100)); remaining -= take100 * 100;
        const take50  = Math.min(d50,  Math.floor(remaining / 50));  remaining -= take50  * 50;
        const take20  = Math.min(d20,  Math.floor(remaining / 20));  remaining -= take20  * 20;
        const take10  = Math.min(d10,  Math.floor(remaining / 10));  remaining -= take10  * 10;
        const takeCoins = Math.min(dCoins, remaining); remaining -= takeCoins;

        netDen.note_500 += take500; netDen.note_200 += take200; netDen.note_100 += take100;
        netDen.note_50  += take50;  netDen.note_20  += take20;  netDen.note_10  += take10; netDen.coins += takeCoins;
      }

      if (remaining > 0) {
        netDen.note_500 += Math.floor(remaining / 500); remaining %= 500;
        netDen.note_200 += Math.floor(remaining / 200); remaining %= 200;
        netDen.note_100 += Math.floor(remaining / 100); remaining %= 100;
        netDen.note_50  += Math.floor(remaining / 50);  remaining %= 50;
        netDen.note_20  += Math.floor(remaining / 20);  remaining %= 20;
        netDen.note_10  += Math.floor(remaining / 10);  remaining %= 10;
        netDen.coins    += remaining;
      }

      // Safety clamp for display — a stray negative correction record should
      // never render as a negative note count
      netDen.note_500 = Math.max(0, netDen.note_500); netDen.note_200 = Math.max(0, netDen.note_200);
      netDen.note_100 = Math.max(0, netDen.note_100); netDen.note_50  = Math.max(0, netDen.note_50);
      netDen.note_20  = Math.max(0, netDen.note_20);  netDen.note_10  = Math.max(0, netDen.note_10);
      netDen.coins = Math.round(Math.max(0, netDen.coins) * 100) / 100;

      // Visited stores today
      const visitedStores = staffColsToday.map((c) => ({
        id: c.id,
        retailerName: c.retailerName,
        time: c.date ? c.date.split(" ")[1] : "N/A",
        amount: c.totalAmount,
        status: c.status || "verified",
      }));

      // Compliance/attendance log
      const compliance = (staffComplianceLogs || [])
        .filter((log) => log.name?.trim().toLowerCase() === name.trim().toLowerCase())
        .sort((a, b) => {
          if (a.status === "Active Duty" && b.status !== "Active Duty") return -1;
          if (a.status !== "Active Duty" && b.status === "Active Duty") return 1;
          return 0;
        })[0];

      return {
        name,
        collectedToday,
        depositedToday,
        remainingToday,
        oldBalance,
        netBalance,
        netDen,
        visitedStores,
        compliance,
      };
    });
  }, [staffUsers, collections, deposits, staffComplianceLogs]);

  const sortedStaffListData = useMemo(() => {
    return [...staffListData].sort((a, b) => {
      const aActive = a.compliance?.status === "Active Duty" ? 1 : 0;
      const bActive = b.compliance?.status === "Active Duty" ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return a.name.localeCompare(b.name);
    });
  }, [staffListData]);

  return (
    <div className="space-y-3.5">
      {/* Premium Summary Card */}
      <div 
        onClick={() => setIsRangeModalOpen(true)}
        className="relative overflow-hidden bg-slate-900 dark:bg-white rounded-lg p-3 text-white dark:text-slate-955 shadow-md active:scale-[0.98] transition-all cursor-pointer group"
      >
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Wallet className="w-16 h-16 rotate-12" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
              Net Cash in Hand <Calendar className="w-2.5 h-2.5 text-blue-455 dark:text-blue-600" />
            </p>
            <h2 className="text-xl font-black mt-0.5">₹{netCashBalance.toLocaleString()}</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-white/10 dark:bg-slate-100 px-2 py-1 rounded-md backdrop-blur-md">
              <p className="text-[7px] font-black uppercase opacity-60">Cash In</p>
              <p className="text-[10px] font-black mt-0.5">₹{totalCollectedAmount.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 dark:bg-slate-100 px-2 py-1 rounded-md backdrop-blur-md">
              <p className="text-[7px] font-black uppercase opacity-60">Cash Out</p>
              <p className="text-[10px] font-black mt-0.5">₹{totalDepositedAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff live Status & Cash Tracker Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-sm flex flex-col gap-2 animate-fade-in">
        {/* Header (Clickable to collapse/expand entire list) */}
        <div 
          onClick={() => setIsStaffTrackingExpanded(!isStaffTrackingExpanded)}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-md">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Staff Tracking</span>
              <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase">Live field reports</p>
            </div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transform transition-transform duration-200 ${isStaffTrackingExpanded ? 'rotate-180' : ''}`} />
        </div>

        {/* List of active field staff */}
        {isStaffTrackingExpanded && (
          <div>
            {sortedStaffListData.length === 0 ? (
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold italic text-center py-2">No staff members found.</p>
            ) : (
              <div className="space-y-1.5">
                {sortedStaffListData.map((staff) => {
                  const isActive = staff.compliance?.status === "Active Duty";
                  const isExpanded = !!expandedStaffNames[staff.name];
                  return (
                    <div key={staff.name} className="border border-slate-100 dark:border-slate-800 rounded-md p-1.5 bg-slate-50/20 dark:bg-slate-800/10 space-y-1.5">
                      {/* Card Header (Clickable to expand/collapse details) */}
                      <div 
                        onClick={() => toggleStaffExpanded(staff.name)}
                        className="flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
                          <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {staff.name}
                          </span>
                          <span className="text-[7px] font-extrabold text-slate-400 dark:text-slate-500 uppercase">
                            {isActive ? "Active" : "Offline"}
                          </span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Summary Stats Row — Old Bal | +Today In | -Today Out | =Net */}
                      <div className="grid grid-cols-4 gap-1">
                        <div className="p-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-md flex flex-col">
                          <span className="text-[5.5px] font-black uppercase text-slate-400 tracking-wide">Old Bal</span>
                          <span className={`text-[8px] font-black mt-0.5 ${(staff as any).oldBalance < 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                            ₹{((staff as any).oldBalance || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="p-1 bg-emerald-50/25 dark:bg-emerald-950/5 border border-emerald-100/30 dark:border-emerald-900/10 rounded-md flex flex-col">
                          <span className="text-[5.5px] font-black uppercase text-emerald-600 tracking-wide">+Today In</span>
                          <span className="text-[8px] font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                            ₹{staff.collectedToday.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-1 bg-red-50/25 dark:bg-red-950/5 border border-red-100/30 dark:border-red-900/10 rounded-md flex flex-col">
                          <span className="text-[5.5px] font-black uppercase text-red-600 tracking-wide">-Today Out</span>
                          <span className="text-[8px] font-black text-red-700 dark:text-red-400 mt-0.5">
                            ₹{staff.depositedToday.toLocaleString()}
                          </span>
                        </div>
                        <div className={`p-1 rounded-md flex flex-col border ${
                          (staff as any).netBalance < 0
                            ? 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900/20'
                            : 'bg-blue-50/25 dark:bg-blue-950/5 border-blue-100/30 dark:border-blue-900/10'
                        }`}>
                          <span className={`text-[5.5px] font-black uppercase tracking-wide ${
                            (staff as any).netBalance < 0 ? 'text-red-600' : 'text-blue-600'
                          }`}>=Net</span>
                          <span className={`text-[8px] font-black mt-0.5 ${
                            (staff as any).netBalance < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
                          }`}>
                            ₹{((staff as any).netBalance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Collapsible Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-1.5 space-y-1.5 animate-fade-in">
                          {/* Check-in info */}
                          <div className="flex items-center justify-between text-[8px]">
                            <span className="font-bold text-slate-400 uppercase tracking-wide">Shift Status</span>
                            <span className="font-black text-slate-700 dark:text-slate-350">
                              {staff.compliance ? (
                                `${staff.compliance.status} ${staff.compliance.startTime ? `(IN: ${staff.compliance.startTime})` : ""}`
                              ) : (
                                "Not Checked In"
                              )}
                            </span>
                          </div>

                          {staff.compliance && (
                            <div className="flex flex-col gap-1">
                              {/* Odometer mileage */}
                              <div className="flex items-center justify-between text-[8px]">
                                <span className="font-bold text-slate-400 uppercase tracking-wide">Odometer</span>
                                <span className="font-black text-slate-700 dark:text-slate-300">
                                  {staff.compliance.startKm ? `${staff.compliance.startKm} KM` : "0 KM"}
                                  {staff.compliance.endKm ? ` → ${staff.compliance.endKm} KM` : " Started"}
                                </span>
                              </div>

                              {/* Action Buttons for GPS Coordinates & photos */}
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {/* Start Coordinates Link */}
                                {staff.compliance.startLatitude && staff.compliance.startLongitude && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.startLatitude},${staff.compliance.startLongitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                  >
                                    <MapPin className="w-2.5 h-2.5 text-blue-500" />
                                    <span>Start Route</span>
                                  </a>
                                )}

                                {/* Start Odometer Photo */}
                                {staff.compliance.startKmImageUrl && (
                                  <a
                                    href={staff.compliance.startKmImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-slate-500" />
                                    <span>Start Photo</span>
                                  </a>
                                )}

                                {/* End Coordinates Link */}
                                {staff.compliance.endLatitude && staff.compliance.endLongitude && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.endLatitude},${staff.compliance.endLongitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                  >
                                    <MapPin className="w-2.5 h-2.5 text-indigo-500" />
                                    <span>End Route</span>
                                  </a>
                                )}

                                {/* End Odometer Photo */}
                                {staff.compliance.endKmImageUrl && (
                                  <a
                                    href={staff.compliance.endKmImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-slate-500" />
                                    <span>End Photo</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Denomination Breakdown */}
                          {(() => {
                            const nd = (staff as any).netDen || {};
                            const denItems = [
                              { label: '₹500', count: nd.note_500, val: 500 },
                              { label: '₹200', count: nd.note_200, val: 200 },
                              { label: '₹100', count: nd.note_100, val: 100 },
                              { label: '₹50',  count: nd.note_50,  val: 50  },
                              { label: '₹20',  count: nd.note_20,  val: 20  },
                              { label: '₹10',  count: nd.note_10,  val: 10  },
                            ].filter(d => d.count !== 0);
                            const hasAny = denItems.length > 0 || nd.coins !== 0 || nd.online !== 0;
                            return hasAny ? (
                              <div className="border-t border-slate-100 dark:border-slate-800/40 pt-1.5">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cash in Hand Breakdown</span>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                  {denItems.map(d => (
                                    <div key={d.label} className="flex items-center justify-between text-[8px]">
                                      <span className="font-bold text-slate-500 dark:text-slate-400">{d.label} × {d.count}</span>
                                      <span className="font-black text-slate-700 dark:text-slate-300">₹{(d.count * d.val).toLocaleString()}</span>
                                    </div>
                                  ))}
                                  {nd.coins !== 0 && (
                                    <div className="flex items-center justify-between text-[8px]">
                                      <span className="font-bold text-slate-500 dark:text-slate-400">Coins</span>
                                      <span className="font-black text-slate-700 dark:text-slate-300">₹{Number(nd.coins).toFixed(2)}</span>
                                    </div>
                                  )}
                                  {nd.online !== 0 && (
                                    <div className="flex items-center justify-between text-[8px] col-span-2 mt-0.5 pt-1 border-t border-slate-100 dark:border-slate-800/40">
                                      <span className="font-bold text-blue-500">Online / UPI</span>
                                      <span className="font-black text-blue-600 dark:text-blue-400">₹{Number(nd.online).toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null;
                          })()}

                          {/* Visited stores button inside collapsed card details */}
                          <div className="border-t border-slate-100 dark:border-slate-800/40 pt-1.5 flex items-center justify-between">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Outings</span>
                            <button
                              onClick={() => staff.visitedStores.length > 0 && setActiveModalStaff({ name: staff.name, visitedStores: staff.visitedStores })}
                              className={`flex items-center gap-1 font-black uppercase tracking-wider text-[7px] px-1.5 py-0.5 rounded transition-all ${
                                staff.visitedStores.length > 0 
                                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/80 cursor-pointer shadow-xs" 
                                : "text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-900/20 cursor-not-allowed"
                              }`}
                              disabled={staff.visitedStores.length === 0}
                            >
                              <Store className="w-2.5 h-2.5" />
                              <span>Stores: {staff.visitedStores.length}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-16">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To Take</p>
          <p className="text-sm font-black text-red-500">₹{totalToTake.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-16">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To Give</p>
          <p className="text-sm font-black text-emerald-500">₹{totalToGive.toLocaleString()}</p>
        </div>
      </div>

      {/* Recent Ledger Activity */}
      <section className="space-y-2 pb-4">
        <div 
          onClick={() => setIsRecentLedgerExpanded(!isRecentLedgerExpanded)}
          className="flex items-center justify-between px-1.5 cursor-pointer group select-none"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Recent Ledger
            </h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-none text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider focus:outline-none cursor-pointer"
            >
              <option value="date-desc">LATEST FIRST</option>
              <option value="date-asc">OLDEST FIRST</option>
              <option value="amount-desc">AMOUNT: HIGH-LOW</option>
              <option value="amount-asc">AMOUNT: LOW-HIGH</option>
            </select>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Link href="/admin/ledger" className="text-[8px] font-black text-blue-600 uppercase">View All</Link>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transform transition-transform duration-200 ${isRecentLedgerExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {isRecentLedgerExpanded && (
          <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xs mb-4 animate-in fade-in duration-200">
          {recentActivity.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-[9px] font-black uppercase tracking-widest">
              No recent activity
            </div>
          ) : (
            recentActivity.map((item: any, idx) => {
              const isExpanded = expandedActivityId === item.id;
              const den = item.denominations || {};
              return (
              <div key={idx} className={`border-b border-slate-50 dark:border-slate-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/80 dark:bg-slate-800/20' : 'active:bg-slate-50 dark:active:bg-slate-800/30'}`} onClick={() => setExpandedActivityId(prev => prev === item.id ? null : item.id)}>
                <div className="flex items-center gap-2 py-1.5 px-2.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${item.type === 'collection' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                    {item.type === 'collection' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black text-slate-800 dark:text-white truncate block">
                        {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms")
                          ? `${item.party} - ${item.store_name || "Cash"}`
                          : item.party}
                      </span>
                      {item.store_name && !(item.type === 'collection' && item.party?.toLowerCase().startsWith("cms")) && (
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">({item.store_name})</span>
                      )}
                      {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms") && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCmsRemarksExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] })); }}
                          className="p-0.5 bg-slate-50 dark:bg-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                          title="View Remark"
                        >
                          <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[item.id] ? 'rotate-180 text-indigo-505' : ''}`} />
                        </button>
                      )}
                    </div>
                    {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[item.id] && (
                      <div className="mt-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-200/50 dark:border-slate-800 text-[8px] font-medium text-slate-605 dark:text-slate-400 max-w-[200px] break-words">
                        <span className="text-[7px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                        <span className="italic">{item.remarks || "no remark"}</span>
                      </div>
                    )}
                    <p className="text-[8px] font-bold text-slate-400 uppercase truncate mt-0.5">
                      {(() => {
                        if (!item.date) return "N/A";
                        try {
                          const [datePart, timePart] = item.date.split(" ");
                          const [year, month, day] = datePart.split("-");
                          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                          const formattedMonth = months[parseInt(month, 10) - 1] || month;
                          return `${formattedMonth} ${parseInt(day, 10)}, ${timePart}`;
                        } catch (e) {
                          return item.date;
                        }
                      })()} • {item.staff}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-1">
                    <div>
                      <p className={`text-[11px] font-black ${item.type === 'collection' ? 'text-blue-600' : 'text-red-600'}`}>
                        {item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}
                      </p>
                      {item.balance !== undefined && item.balance !== null && (
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Due: ₹{Number(item.balance).toLocaleString()}</p>
                      )}
                    </div>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-2 pt-1 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                    <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cash Breakdown</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8.5px] font-bold text-slate-600 dark:text-slate-300">
                      {Number(den.note_500 || 0) !== 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                      {Number(den.note_200 || 0) !== 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                      {Number(den.note_100 || 0) !== 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                      {Number(den.note_50 || 0) !== 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                      {Number(den.note_20 || 0) !== 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                      {Number(den.note_10 || 0) !== 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                      {Number(den.coins || 0) !== 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                      {Number(den.online_amount || 0) !== 0 && <span>UPI = ₹{Number(den.online_amount).toLocaleString()}</span>}
                      {!Number(den.note_500) && !Number(den.note_200) && !Number(den.note_100) && !Number(den.note_50) && !Number(den.note_20) && !Number(den.note_10) && !Number(den.coins) && !Number(den.online_amount) && <span className="text-slate-400 italic">No breakdown</span>}
                    </div>
                    <div className="mt-1 text-[8.5px] font-bold text-slate-500 italic">{numberToWordsIndian(item.amount)} Rupees</div>
                    <div className="flex gap-1.5 mt-1.5 w-full">
                      <button
                        onClick={() => {
                          if (item.type === 'collection') {
                            shareCollectionEntry({ retailer_name: item.party, store_name: item.store_name, total_amount: item.amount, denominations: item.denominations, created_at: item.created_at || item.date, remarks: item.remarks }, item.staff);
                          } else {
                            shareDepositEntry({ deposit_type: item.deposit_type, target_name: item.party, amount: item.amount, denominations: item.denominations, created_at: item.created_at || item.date, remarks: item.remarks, recipient_staff_id: item.recipient_staff_id }, item.staff);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/30 active:scale-95 transition-transform"
                      >
                        <Share2 className="w-2.5 h-2.5" /> Share
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditCollection(item);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-blue-50 dark:bg-blue-955/30 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider border border-blue-100 dark:border-blue-900/30 active:scale-95 transition-transform"
                      >
                        <Edit2 className="w-2.5 h-2.5" /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          const confirmText = item.type === 'collection' ? "Delete this collection?" : "Delete this deposit?";
                          if (confirm(confirmText)) {
                            try {
                              if (item.type === 'collection') {
                                await api.deleteCollection(item.id);
                              } else {
                                await api.deleteDeposit(item.id);
                              }
                              fetchData();
                            } catch (err: any) {
                              alert("Failed to delete: " + err.message);
                            }
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[8px] font-black uppercase tracking-wider border border-red-100 dark:border-red-900/30 active:scale-95 transition-transform"
                      >
                        <Trash2 className="w-2.5 h-2.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
        )}
      </section>

      {/* Stores Visited Mobile Sliding Overlay Modal */}
      {activeModalStaff && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-205 dark:border-slate-800 rounded-t-lg sm:rounded-lg w-full max-w-md p-3 pb-4 space-y-2.5 shadow-2xl animate-slide-up relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-md">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Visited Stores
                  </h3>
                  <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase mt-0.5">
                    {activeModalStaff.name}&apos;s Outings Today
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalStaff(null)}
                className="p-1 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body: Stores list */}
            <div className="max-h-[40vh] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-850">
              {activeModalStaff.visitedStores.map((item: VisitedStore, idx: number) => (
                <div key={idx} className="py-1.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/10 px-1 rounded-md transition-all">
                  <div className="flex flex-col min-w-0 flex-1 pr-1.5">
                    <span className="font-black text-slate-800 dark:text-slate-205 uppercase tracking-tight truncate text-[11px]">
                      {item.retailerName}
                    </span>
                    <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{(() => {
                        try {
                          const [rawHour, min] = item.time.split(":").map(Number);
                          const ampm = rawHour >= 12 ? 'PM' : 'AM';
                          const hour = rawHour % 12 || 12;
                          return `${hour}:${min.toString().padStart(2, '0')} ${ampm}`;
                        } catch (e) {
                          return item.time;
                        }
                      })()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-[11px]">
                      +₹{item.amount.toLocaleString()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${
                      item.status === 'verified'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30'
                      : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-100 dark:border-amber-900/30'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wide">Total Visited Today</span>
                <span className="text-[10px] font-black text-slate-705 dark:text-slate-350">
                  {activeModalStaff.visitedStores.length} Stores
                </span>
              </div>
              <button
                onClick={() => setActiveModalStaff(null)}
                className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[9px] font-black rounded-lg hover:bg-slate-850 dark:hover:bg-slate-100 transition-all cursor-pointer shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Collection/Deposit Modal */}
      {isEditCollectionModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-xs z-[120] flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-md p-3 space-y-2.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                {editingIsDeposit ? "Edit Cash Out Entry" : "Edit Cash In Entry"}
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleSaveCollectionEdit} className="space-y-2.5">
              
              {!editingIsDeposit ? (
                // Collection Form Fields
                <div className="space-y-2">
                  {/* Parent Retailer Select */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Parent Retailer</label>
                    <InlineSelect
                      value={selectedNewRetailerId}
                      onChange={setSelectedNewRetailerId}
                      options={[
                        { value: "", label: "No Retailer" },
                        ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                      ]}
                      placeholder="No Retailer"
                    />
                  </div>

                  {(availableStores.length > 0 || editingCollection?.store_name) && (
                    <div className="space-y-0.5 animate-in fade-in duration-200">
                      <div className="flex justify-between items-center px-0.5">
                        <label className="text-[8px] text-slate-400 font-black uppercase block">Parent Store (Shop/Branch)</label>
                        {editingCollection?.store_name && (
                          <span className="text-[8px] text-amber-505 font-black">
                            (Original: {editingCollection.store_name})
                          </span>
                        )}
                      </div>
                      {availableStores.length > 0 ? (
                        <InlineSelect
                          value={selectedNewStoreId}
                          onChange={setSelectedNewStoreId}
                          options={[
                            { value: "", label: "None / Cash" },
                            ...availableStores.map((s: any) => ({ value: String(s.id), label: s.store_name }))
                          ]}
                          placeholder="None / Cash"
                        />
                      ) : (
                        <div className="text-[10px] text-slate-400 italic px-2 py-1.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-dashed border-slate-200 dark:border-slate-800">
                          No stores available
                        </div>
                      )}
                    </div>
                  )}

                  {/* Portal Select */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Portal Channel</label>
                    <InlineSelect
                      value={selectedNewPortalId}
                      onChange={setSelectedNewPortalId}
                      options={[
                        { value: "", label: "None / Cash" },
                        ...portalDirectory
                          .flatMap((group: any) => {
                            const firstOnlinePortal = (group.portals || []).find((p: any) => p.show_in_online_payment);
                            if (!firstOnlinePortal) return [];
                            return [{ value: String(firstOnlinePortal.id), label: group.name }];
                          })
                      ]}
                      placeholder="None / Cash"
                    />
                  </div>

                  {/* Denominations editor for Collection – staff-style full-row layout */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                    <span className="text-[8px] text-slate-400 font-black uppercase block mb-1">Counting Details (Notes)</span>
                    <div className="space-y-1">
                      {[
                        { label: "₹500 Notes", key: "note_500", factor: 500 },
                        { label: "₹200 Notes", key: "note_200", factor: 200 },
                        { label: "₹100 Notes", key: "note_100", factor: 100 },
                        { label: "₹50 Notes",  key: "note_50",  factor: 50  },
                        { label: "₹20 Notes",  key: "note_20",  factor: 20  },
                        { label: "₹10 Notes",  key: "note_10",  factor: 10  },
                        { label: "Coins / ₹1", key: "coins",    factor: 1   },
                      ].map(item => (
                        <div key={item.key} className="flex items-center gap-2 justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 w-20 shrink-0">{item.label}</span>
                          <span className="text-slate-350 dark:text-slate-600 text-xs font-bold">&times;</span>
                          <input autoComplete="one-time-code"
                            type="number"
                            value={selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || ""}
                            onChange={(e) => {
                              const val = item.key === "coins" ? (parseFloat(e.target.value) || 0) : (parseInt(e.target.value) || 0);
                              setSelectedNewDenoms(prev => ({ ...prev, [item.key]: val }));
                            }}
                            className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-center text-xs font-black outline-none focus:border-slate-400"
                          />
                          <span className="text-slate-300 dark:text-slate-600 text-[9px] font-bold">＝</span>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right w-14 shrink-0">
                            ₹{(Number(selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0) * item.factor).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {/* UPI / Online Amount row */}
                      <div className="flex items-center gap-2 justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 w-20 shrink-0">UPI / Online</span>
                        <span className="text-slate-350 dark:text-slate-600 text-xs font-bold">+</span>
                        <input autoComplete="one-time-code"
                          type="number"
                          value={selectedNewDenoms.online_amount || ""}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setSelectedNewDenoms(prev => ({ ...prev, online_amount: val }));
                          }}
                          className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-center text-xs font-black outline-none focus:border-slate-400"
                        />
                        <span className="text-slate-300 dark:text-slate-600 text-[9px] font-bold">＝</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right w-14 shrink-0">
                          ₹{Number(selectedNewDenoms.online_amount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* Live total */}
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[8px] uppercase font-black tracking-wider text-slate-400">Total Amount</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">₹{(
                        selectedNewDenoms.note_500 * 500 +
                        selectedNewDenoms.note_200 * 200 +
                        selectedNewDenoms.note_100 * 100 +
                        selectedNewDenoms.note_50 * 50 +
                        selectedNewDenoms.note_20 * 20 +
                        selectedNewDenoms.note_10 * 10 +
                        selectedNewDenoms.coins +
                        selectedNewDenoms.online_amount
                      ).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Collection Date */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Collection Date</label>
                    <input autoComplete="one-time-code"
                      type="date"
                      value={selectedNewDate}
                      onChange={(e) => setSelectedNewDate(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      rows={1.5}
                      placeholder="Remarks..."
                    />
                  </div>
                </div>
              ) : (
                // Deposit Form Fields
                <div className="space-y-2">
                  {/* Deposit Type */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Deposit/Payout Type</label>
                    <select
                      value={selectedNewDepositType === "virtual" ? (selectedNewPaymentMode === "refund" ? "virtual-refund" : "virtual-load") : selectedNewDepositType}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "virtual-load") {
                          setSelectedNewDepositType("virtual");
                          setSelectedNewPaymentMode("online");
                        } else if (val === "virtual-refund") {
                          setSelectedNewDepositType("virtual");
                          setSelectedNewPaymentMode("refund");
                        } else {
                          setSelectedNewDepositType(val);
                          if (val === "portal" || val === "retailer") {
                            setSelectedNewPaymentMode("online");
                          } else if (val === "staff") {
                            setSelectedNewPaymentMode("cash");
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                    >
                      <option value="portal">Cash Out</option>
                      <option value="retailer">Retailer Payout</option>
                      <option value="staff">Direct Handover</option>
                      <option value="virtual-load">Virtual Transfer</option>
                      <option value="virtual-refund">Move to Distributor</option>
                    </select>
                  </div>

                  {/* Target Fields depending on deposit type */}
                  {selectedNewDepositType === "portal" && (
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Target Portal</label>
                      <InlineSelect
                        value={selectedNewPortalId}
                        onChange={setSelectedNewPortalId}
                        options={[
                          { value: "", label: "Select Portal Bank Account" },
                          ...portalDirectory
                            .flatMap((group: any) => {
                              const firstPortal = (group.portals || [])[0];
                              if (!firstPortal) return [];
                              return [{ value: String(firstPortal.id), label: group.name }];
                            })
                        ]}
                        placeholder="Select Portal Bank Account"
                      />
                    </div>
                  )}

                  {selectedNewDepositType === "retailer" && (
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Target Retailer</label>
                      <InlineSelect
                        value={selectedNewRetailerId}
                        onChange={setSelectedNewRetailerId}
                        options={[
                          { value: "", label: "Select Retailer" },
                          ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                        ]}
                        placeholder="Select Retailer"
                      />
                    </div>
                  )}

                  {selectedNewDepositType === "staff" && (
                    <>
                      <div className="flex items-center gap-1.5 py-0.5">
                        <input
                          type="checkbox"
                          id="editToOfficeCheckboxMobile"
                          checked={selectedNewToOffice}
                          onChange={(e) => setSelectedNewToOffice(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-650 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="editToOfficeCheckboxMobile" className="text-[9px] font-black text-slate-700 dark:text-slate-350">Handover to Main Office Cashier</label>
                      </div>

                      {!selectedNewToOffice && (
                        <div className="space-y-0.5">
                          <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Recipient Staff</label>
                          <InlineSelect
                            value={selectedNewRecipientStaffId}
                            onChange={setSelectedNewRecipientStaffId}
                            options={[
                              { value: "", label: "Select Staff Member" },
                              ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                            ]}
                            placeholder="Select Staff Member"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {selectedNewDepositType === "virtual" && (
                    <>
                      <div className="space-y-0.5">
                        <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Source Portal</label>
                        <InlineSelect
                          value={selectedNewPortalId}
                          onChange={setSelectedNewPortalId}
                          options={[
                            { value: "", label: "Select Portal Bank Account" },
                            ...portalDirectory.flatMap((group: any) => {
                              const firstPortal = (group.portals || [])[0];
                              if (!firstPortal) return [];
                              return [{ value: String(firstPortal.id), label: group.name }];
                            })
                          ]}
                          placeholder="Select Portal Bank Account"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Target Type</label>
                        <select
                          value={selectedNewVirtualTargetType}
                          onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                        >
                          <option value="retailer">Retailer</option>
                          <option value="staff">Staff Member</option>
                        </select>
                      </div>

                      {selectedNewVirtualTargetType === "retailer" ? (
                        <div className="space-y-0.5">
                          <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">
                            {selectedNewPaymentMode === "refund" ? "Source Retailer" : "Target Retailer"}
                          </label>
                          <InlineSelect
                            value={selectedNewRetailerId}
                            onChange={setSelectedNewRetailerId}
                            options={[
                              { value: "", label: "Select Retailer" },
                              ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                            ]}
                            placeholder="Select Retailer"
                          />
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">
                            {selectedNewPaymentMode === "refund" ? "Source Staff Member" : "Target Staff Member"}
                          </label>
                          <InlineSelect
                            value={selectedNewRecipientStaffId}
                            onChange={setSelectedNewRecipientStaffId}
                            options={[
                              { value: "", label: "Select Staff Member" },
                              ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                            ]}
                            placeholder="Select Staff Member"
                          />
                        </div>
                      )}
                    </>
                  )}

                   {/* Payment Mode */}
                  {selectedNewDepositType !== "virtual" && (
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Payment Mode</label>
                      <select
                        value={selectedNewPaymentMode}
                        onChange={(e) => setSelectedNewPaymentMode(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="online">Online</option>
                      </select>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Amount</label>
                    <input autoComplete="one-time-code"
                      type="number"
                      value={selectedNewAmount}
                      onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Date</label>
                    <input autoComplete="one-time-code"
                      type="date"
                      value={selectedNewDate}
                      onChange={(e) => setSelectedNewDate(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  {/* Reference No */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Reference No</label>
                    <input autoComplete="one-time-code"
                      type="text"
                      value={selectedNewRefNo}
                      onChange={(e) => setSelectedNewRefNo(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      placeholder="Optional"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      rows={1.5}
                      placeholder="Remarks..."
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditCollectionModalOpen(false)}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-200 rounded-md text-[10px] font-black transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCollection}
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {isSavingCollection ? "Saving..." : "Save Entry"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Mobile Date Range Cash Flow Drawer / Modal */}
      {isRangeModalOpen && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl w-full max-h-[90vh] p-4 flex flex-col gap-4 shadow-2xl animate-slide-up relative text-left">
            
            {/* Handle/Indicator */}
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto self-center -mt-1 mb-1" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                    Cash Flow Filter
                  </h3>
                  <p className="text-[7.5px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    Select a date range
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRangeModalOpen(false)}
                className="p-1 rounded-md bg-slate-105 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Date Selection Control & Presets */}
            <div className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-955 p-3 rounded-lg border border-slate-105 dark:border-slate-850">
              {/* Presets */}
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => {
                    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                    setRangeStartDate(today);
                    setRangeEndDate(today);
                  }}
                  className="py-1 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded text-[8px] font-black text-slate-600 dark:text-slate-300 uppercase cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yestStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterday);
                    setRangeStartDate(yestStr);
                    setRangeEndDate(yestStr);
                  }}
                  className="py-1 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded text-[8px] font-black text-slate-600 dark:text-slate-300 uppercase cursor-pointer"
                >
                  Yesterday
                </button>
                <button
                  onClick={() => {
                    const start = new Date();
                    start.setDate(start.getDate() - 6);
                    const startStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(start);
                    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                    setRangeStartDate(startStr);
                    setRangeEndDate(today);
                  }}
                  className="py-1 bg-white dark:bg-slate-900 border border-slate-255 dark:border-slate-800 rounded text-[8px] font-black text-slate-600 dark:text-slate-300 uppercase cursor-pointer"
                >
                  7 Days
                </button>
                <button
                  onClick={() => {
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    const startMonthStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(startOfMonth);
                    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                    setRangeStartDate(startMonthStr);
                    setRangeEndDate(today);
                  }}
                  className="py-1 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded text-[8px] font-black text-slate-600 dark:text-slate-300 uppercase cursor-pointer"
                >
                  Month
                </button>
              </div>

              {/* Custom Date Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] font-black uppercase text-slate-400">From Date</span>
                  <input
                    type="date"
                    value={rangeStartDate}
                    onChange={(e) => setRangeStartDate(e.target.value)}
                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded text-[9px] font-bold outline-none dark:text-white"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] font-black uppercase text-slate-400">To Date</span>
                  <input
                    type="date"
                    value={rangeEndDate}
                    onChange={(e) => setRangeEndDate(e.target.value)}
                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded text-[9px] font-bold outline-none dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Range Cash In / Cash Out Summary Grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* Cash In */}
              <div className="bg-emerald-50/50 dark:bg-emerald-955 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-[7.5px] font-black uppercase text-emerald-600 dark:text-emerald-450 tracking-wider">Cash In</span>
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
                  ₹{rangeCashIn.toLocaleString()}
                </span>
                <span className="text-[6.5px] font-bold text-slate-400 block mt-0.5">
                  {filteredCollections.length} items
                </span>
              </div>

              {/* Cash Out */}
              <div className="bg-red-50/50 dark:bg-red-955 border border-red-100 dark:border-red-900/30 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-[7.5px] font-black uppercase text-red-600 dark:text-red-455 tracking-wider">Cash Out</span>
                <span className="text-xs font-black text-red-700 dark:text-red-400 mt-1 block">
                  ₹{rangeCashOut.toLocaleString()}
                </span>
                <span className="text-[6.5px] font-bold text-slate-400 block mt-0.5">
                  {filteredDeposits.length} items
                </span>
              </div>

              {/* Net Flow */}
              <div className={`border rounded-lg p-2.5 flex flex-col justify-between ${
                rangeNet >= 0
                  ? 'bg-blue-50/50 dark:bg-blue-955 border-blue-100 dark:border-blue-900/30'
                  : 'bg-amber-50/50 dark:bg-amber-955 border-amber-100 dark:border-amber-900/30'
              }`}>
                <span className={`text-[7.5px] font-black uppercase tracking-wider ${rangeNet >= 0 ? 'text-blue-650' : 'text-amber-650'}`}>
                  Net Flow
                </span>
                <span className={`text-xs font-black mt-1 block ${rangeNet >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {rangeNet >= 0 ? '+' : ''}₹{rangeNet.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Entries Section */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-1.5">
              <div className="flex items-center gap-1">
                <div className="w-1 h-3 bg-blue-600 rounded-full" />
                <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider">
                  Transaction Entries ({rangeEntries.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 min-w-0 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-150 dark:border-slate-800 rounded-lg">
                {rangeEntries.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-[10px] font-bold">
                    No entries for this range.
                  </div>
                ) : (
                  rangeEntries.map((item) => (
                    <div key={item.id} className="p-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition-colors flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px]">
                        
                        {/* Flow Description */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className={`px-1 rounded text-[7px] font-black uppercase tracking-wider flex-shrink-0 ${
                            item.type === 'collection'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/30'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100/60 dark:border-red-900/30'
                          }`}>
                            {item.type === 'collection' ? 'In' : 'Out'}
                          </span>

                          <div className="flex items-center gap-1 truncate font-extrabold text-slate-850 dark:text-slate-150 uppercase tracking-tight text-[9px] min-w-0">
                            <span className="truncate max-w-[90px]">{item.from}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-[90px] text-blue-600 dark:text-blue-400">{item.to}</span>
                          </div>
                        </div>

                        {/* Amount */}
                        <span className={`font-black text-[10px] flex-shrink-0 ml-1 ${item.type === 'collection' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}
                        </span>
                      </div>

                      {/* Meta Footer Row */}
                      <div className="flex items-center justify-between text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>
                          {(() => {
                            if (!item.date) return "N/A";
                            try {
                              const [datePart, timePart] = item.date.split(" ");
                              const [year, month, day] = datePart.split("-");
                              const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                              const formattedMonth = months[parseInt(month, 10) - 1] || month;
                              return `${formattedMonth} ${parseInt(day, 10)}, ${timePart}`;
                            } catch (e) {
                              return item.date;
                            }
                          })()}
                        </span>
                        {item.remarks && (
                          <span className="italic text-slate-500 dark:text-slate-400 font-semibold normal-case truncate max-w-[160px]">
                            {item.remarks}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
