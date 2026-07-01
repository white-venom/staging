"use client";

import React from "react";
import { 
  TrendingUp, 
  FileText, 
  CheckCircle2, 
  BarChart2,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Edit,
  Users,
  Store,
  Clock,
  X,
  MapPin,
  Camera,
  ChevronDown,
  Share2,
  Save,
  Calendar,
  ArrowRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../../utils/api";
import { numberToWordsIndian, shareCollectionEntry, shareDepositEntry } from "../../../utils/shareHelper";
import { useAdmin } from "../../context/AdminContext";
import { getISTDateString } from "../../../utils/dateHelpers";
import InlineSelect from "../../../components/InlineSelect";

interface VisitedStore {
  id: string;
  retailerName: string;
  store_name?: string;
  portalName?: string;
  remarks?: string;
  time: string;
  amount: number;
  status: string;
  denominations?: any;
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

interface OverviewTabProps {
  collections: any[];
  deposits: any[];
  totalCollectedAmount: number;
  totalDepositedAmount: number;
  netCashBalance: number;
  totalToTake: number;
  totalToGive: number;
  fetchData: () => void;
  todayCount?: number;
  userDirectory?: any[];
  staffComplianceLogs?: any[];
}

export default function OverviewTab({
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
}: OverviewTabProps) {
  const router = useRouter();
  const safeCollections = collections || [];
  const safeDeposits = deposits || [];

  // Filter for field staff
  const staffUsers = React.useMemo(() => {
    return (userDirectory || []).filter((u: { role: string }) => u.role === "field_staff" || u.role === "staff");
  }, [userDirectory]);

  const [expandedStaffNames, setExpandedStaffNames] = React.useState<Record<string, boolean>>({});
  const [expandedVisitedStoreId, setExpandedVisitedStoreId] = React.useState<string | null>(null);

  const toggleStaffExpanded = (name: string) => {
    setExpandedStaffNames(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // State for active modal visited stores
  const [activeModalStaff, setActiveModalStaff] = React.useState<{ name: string; visitedStores: VisitedStore[] } | null>(null);
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = React.useState<Record<string, boolean>>({});
  const [expandedCollectionId, setExpandedCollectionId] = React.useState<string | null>(null);
  const [expandedDepositId, setExpandedDepositId] = React.useState<string | null>(null);
  const [expandedLedgerRowId, setExpandedLedgerRowId] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [isStaffTrackingExpanded, setIsStaffTrackingExpanded] = React.useState(false);
  const [isRecentLedgerExpanded, setIsRecentLedgerExpanded] = React.useState(true);

  // Date range modal state
  const [isRangeModalOpen, setIsRangeModalOpen] = React.useState(false);
  const [rangeStartDate, setRangeStartDate] = React.useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [rangeEndDate, setRangeEndDate] = React.useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );

  const filteredCollections = React.useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return [];
    return safeCollections.filter(c => {
      const cDate = c.date?.split(' ')[0];
      return cDate >= rangeStartDate && cDate <= rangeEndDate;
    });
  }, [safeCollections, rangeStartDate, rangeEndDate]);

  const filteredDeposits = React.useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return [];
    return safeDeposits.filter(d => {
      const dDate = d.date?.split(' ')[0];
      const isNotVirtual = d.depositType?.toLowerCase() !== 'virtual';
      return isNotVirtual && dDate >= rangeStartDate && dDate <= rangeEndDate;
    });
  }, [safeDeposits, rangeStartDate, rangeEndDate]);

  const rangeCashIn = React.useMemo(() => {
    return filteredCollections.reduce((s, c) => s + (c.totalAmount || 0), 0);
  }, [filteredCollections]);

  const rangeCashOut = React.useMemo(() => {
    return filteredDeposits.reduce((s, d) => s + (d.amount || 0), 0);
  }, [filteredDeposits]);

  const rangeNet = rangeCashIn - rangeCashOut;

  const rangeEntries = React.useMemo(() => {
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

  const { retailerDirectory, portalDirectory, showToastNotification } = useAdmin();

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = React.useState(false);
  const [editingCollection, setEditingCollection] = React.useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = React.useState(false);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = React.useState("");
  const [selectedNewStoreId, setSelectedNewStoreId] = React.useState("");
  const [availableStores, setAvailableStores] = React.useState<any[]>([]);
  const [selectedNewPortalId, setSelectedNewPortalId] = React.useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = React.useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = React.useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = React.useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = React.useState("");
  const [selectedNewAmount, setSelectedNewAmount] = React.useState(0);
  const [selectedNewDate, setSelectedNewDate] = React.useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = React.useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = React.useState("");
  const [selectedNewVirtualTargetType, setSelectedNewVirtualTargetType] = React.useState("retailer");
  const [isSavingCollection, setIsSavingCollection] = React.useState(false);
  
  const [selectedNewDenoms, setSelectedNewDenoms] = React.useState({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0,
  });

  React.useEffect(() => {
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
    const isDeposit = item.type === "deposit" || item.depositType != null || item.deposit_type != null;
    setEditingIsDeposit(isDeposit);
    setEditingCollection(item);
    
    setSelectedNewRetailerId(item.retailer_id || item.retailerId || "");
    setSelectedNewStoreId(item.store_id || item.storeId || "");
    setSelectedNewPortalId(item.portal_id || item.portalId || "");
    setSelectedNewRemarks(item.remarks || "");
    
    if (isDeposit) {
      setSelectedNewDepositType(item.deposit_type || item.depositType || "virtual");
      setSelectedNewPaymentMode(item.paymentMode || item.payment_mode || "online");
      setSelectedNewAmount(Number(item.amount || item.totalAmount || item.total_amount || 0));
      setSelectedNewDate(item.deposit_date ? item.deposit_date : (item.date ? item.date.split(" ")[0] : getISTDateString()));
      setSelectedNewRefNo(item.reference_no || item.referenceNo || "");
      setSelectedNewRecipientStaffId(item.recipient_staff_id || item.recipientStaffId || "");
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
          remarks: selectedNewRemarks || null,
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

  // Precalculate daily metrics for all active field staff
  const staffListData = React.useMemo<StaffListData[]>(() => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    return (staffUsers || []).map((user: { id: string; name: string }) => {
      const name = user.name;

      // Today's collections & deposits
      const staffColsToday = safeCollections.filter(
        (c) => c.staffName === name && c.date?.startsWith(todayStr)
      );
      const staffDepsToday = safeDeposits.filter(
        (d) => d.staffName === name && d.date?.startsWith(todayStr) && d.depositType?.toLowerCase() !== 'virtual'
      );

      // Previous days' collections & deposits
      const staffColsPrev = safeCollections.filter(
        (c) => c.staffName === name && !c.date?.startsWith(todayStr)
      );
      const staffDepsPrev = safeDeposits.filter(
        (d) => d.staffName === name && !d.date?.startsWith(todayStr) && d.depositType?.toLowerCase() !== 'virtual'
      );

      // Received handovers (deposit_type === "staff" and recipient_staff_id === user.id)
      // Filter out received handovers that have matching collection to avoid double-counting
      const receivedDepsToday = safeDeposits.filter(d => 
        d.recipient_staff_id === user.id && 
        d.depositType === 'staff' && 
        d.date?.startsWith(todayStr) &&
        !safeCollections.some(c => c.from_staff_id === d.staff_id && Number(c.totalAmount) === Number(d.amount))
      );
      
      const receivedDepsPrev = safeDeposits.filter(d => 
        d.recipient_staff_id === user.id && 
        d.depositType === 'staff' && 
        !d.date?.startsWith(todayStr) &&
        !safeCollections.some(c => c.from_staff_id === d.staff_id && Number(c.totalAmount) === Number(d.amount))
      );

      const collectedToday = staffColsToday.reduce((s, c) => s + (c.totalAmount || 0), 0) + receivedDepsToday.reduce((s, d) => s + (d.amount || 0), 0);
      const depositedToday = staffDepsToday.reduce((s, d) => s + (d.amount || 0), 0);
      const oldBalance = staffColsPrev.reduce((s, c) => s + (c.totalAmount || 0), 0) + receivedDepsPrev.reduce((s, d) => s + (d.amount || 0), 0) - staffDepsPrev.reduce((s, d) => s + (d.amount || 0), 0);
      const netBalance = oldBalance + collectedToday - depositedToday;

      // Net denomination breakdown across ALL time (collections + received handovers minus deposits)
      const allCols = [...staffColsToday, ...staffColsPrev];
      const allDeps = [...staffDepsToday, ...staffDepsPrev];
      const allReceived = [...receivedDepsToday, ...receivedDepsPrev];
      const netDen = { note_500: 0, note_200: 0, note_100: 0, note_50: 0, note_20: 0, note_10: 0, coins: 0, online: 0 };
      allCols.forEach(c => {
        netDen.note_500 += Number(c.denominations?.note_500 || 0);
        netDen.note_200 += Number(c.denominations?.note_200 || 0);
        netDen.note_100 += Number(c.denominations?.note_100 || 0);
        netDen.note_50  += Number(c.denominations?.note_50  || 0);
        netDen.note_20  += Number(c.denominations?.note_20  || 0);
        netDen.note_10  += Number(c.denominations?.note_10  || 0);
        netDen.coins    += Number(c.denominations?.coins     || 0);
        netDen.online   += Number(c.denominations?.online_amount || 0);
      });
      allReceived.forEach(r => {
        netDen.note_500 += Number(r.denominations?.note_500 || 0);
        netDen.note_200 += Number(r.denominations?.note_200 || 0);
        netDen.note_100 += Number(r.denominations?.note_100 || 0);
        netDen.note_50  += Number(r.denominations?.note_50  || 0);
        netDen.note_20  += Number(r.denominations?.note_20  || 0);
        netDen.note_10  += Number(r.denominations?.note_10  || 0);
        netDen.coins    += Number(r.denominations?.coins     || 0);
        netDen.online   += Number(r.denominations?.online_amount || 0);
      });
      allDeps.forEach(d => {
        netDen.note_500 -= Number(d.denominations?.note_500 || 0);
        netDen.note_200 -= Number(d.denominations?.note_200 || 0);
        netDen.note_100 -= Number(d.denominations?.note_100 || 0);
        netDen.note_50  -= Number(d.denominations?.note_50  || 0);
        netDen.note_20  -= Number(d.denominations?.note_20  || 0);
        netDen.note_10  -= Number(d.denominations?.note_10  || 0);
        netDen.coins    -= Number(d.denominations?.coins     || 0);
        netDen.online   -= Number(d.denominations?.online_amount || 0);
      });

      // Get visited stores today
      const visitedStores = staffColsToday.map((c) => ({
        id: c.id,
        retailerName: c.retailerName,
        store_name: c.store_name || null,
        portalName: c.portalName || null,
        remarks: c.remarks || null,
        time: c.date ? c.date.split(" ")[1] : "N/A",
        amount: c.totalAmount,
        status: c.status || "verified",
        denominations: c.denominations || null,
      }));

      // Get compliance/attendance log
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
        remainingToday: collectedToday - depositedToday,
        oldBalance,
        netBalance,
        netDen,
        visitedStores,
        compliance,
      };
    });
  }, [staffUsers, safeCollections, safeDeposits, staffComplianceLogs]);

  const sortedStaffListData = React.useMemo(() => {
    return [...staffListData].sort((a, b) => {
      const aActive = a.compliance?.status === "Active Duty" ? 1 : 0;
      const bActive = b.compliance?.status === "Active Duty" ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return a.name.localeCompare(b.name);
    });
  }, [staffListData]);

  // Pre-calculate running balances for all transactions (excluding virtual deposits)
  const combinedTimeline = [
    ...safeCollections.map(c => ({ ...c, type: 'collection', amt: c.totalAmount })),
    ...safeDeposits.filter(d => d.depositType?.toLowerCase() !== 'virtual').map(d => ({ ...d, type: 'deposit', amt: d.amount }))
  ].filter(item => item.date)
   .sort((a, b) => new Date(a.date.replace(' ', 'T')).getTime() - new Date(b.date.replace(' ', 'T')).getTime());

  let runningBal = 0;
  const balanceSnapshots = new Map();
  combinedTimeline.forEach(item => {
    const prev = runningBal;
    if (item.type === 'collection') runningBal += item.amt;
    else runningBal -= item.amt;
    balanceSnapshots.set(item.id, { prev, next: runningBal });
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Khatabook Summary Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in flex flex-col justify-between">
          <div className="flex divide-x divide-slate-100 dark:divide-slate-800 flex-1 items-center">
            {/* You will Give (Hum Denge) */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">You will give</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500 tracking-tight">
                ₹{(totalToGive || 0).toLocaleString()}
              </span>
            </div>

            {/* You will Get (Hum Lenge) */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">You will get</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-500 tracking-tight">
                ₹{(totalToTake || 0).toLocaleString()}
              </span>
            </div>
          </div>
          
          {/* Blue Footer Bar */}
          <div 
            onClick={() => router.push('/admin/reports')}
            className="bg-blue-50 dark:bg-blue-900/10 py-3 flex items-center justify-center border-t border-slate-100 dark:border-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase">PDF</div>
              <span className="text-sm font-black text-blue-700 dark:text-blue-400 group-hover:underline">View Reports</span>
            </div>
          </div>
        </div>
        
        {/* Staff Live Status & Cash Tracker Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 animate-fade-in flex flex-col gap-4">
          {/* Header (Clickable to collapse/expand entire list) */}
          <div 
            onClick={() => setIsStaffTrackingExpanded(!isStaffTrackingExpanded)}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-955 text-blue-600 dark:text-blue-400 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">Staff Tracking</span>
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Live field reports</p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${isStaffTrackingExpanded ? 'rotate-180' : ''}`} />
          </div>          {/* List of active field staff */}
          {isStaffTrackingExpanded && (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {sortedStaffListData.length === 0 ? (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic text-center py-4">No staff members found.</p>
              ) : (
                sortedStaffListData.map((staff) => {
                  const isActive = staff.compliance?.status === "Active Duty";
                  const isExpanded = !!expandedStaffNames[staff.name];
                  return (
                    <div key={staff.name} className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/20 dark:bg-slate-900/10 space-y-2.5">
                      {/* Header Row (Clickable to toggle individual collapse) */}
                      <div 
                        onClick={() => toggleStaffExpanded(staff.name)}
                        className="flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350 dark:bg-slate-700'}`} />
                          <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {staff.name}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                            {isActive ? "Active" : "Offline"}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Formula: Old + Today In - Today Out = Net */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-lg flex flex-col">
                          <span className="text-[6px] font-black uppercase text-slate-400 tracking-wide">Old Bal</span>
                          <span className={`text-[9px] font-black mt-0.5 ${(staff as any).oldBalance < 0 ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            ₹{((staff as any).oldBalance || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="p-1.5 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/10 rounded-lg flex flex-col">
                          <span className="text-[6px] font-black uppercase text-emerald-600 tracking-wide">+ Today In</span>
                          <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                            ₹{staff.collectedToday.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-1.5 bg-red-50/30 dark:bg-red-950/10 border border-red-100/40 dark:border-red-900/10 rounded-lg flex flex-col">
                          <span className="text-[6px] font-black uppercase text-red-600 tracking-wide">- Today Out</span>
                          <span className="text-[9px] font-black text-red-700 dark:text-red-400 mt-0.5">
                            ₹{staff.depositedToday.toLocaleString()}
                          </span>
                        </div>
                        <div className={`p-1.5 rounded-lg flex flex-col border ${
                          (staff as any).netBalance < 0
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'
                            : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100/50 dark:border-blue-900/20'
                        }`}>
                          <span className={`text-[6px] font-black uppercase tracking-wide ${
                            (staff as any).netBalance < 0 ? 'text-red-600' : 'text-blue-600'
                          }`}>= Net</span>
                          <span className={`text-[9px] font-black mt-0.5 ${
                            (staff as any).netBalance < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
                          }`}>
                            ₹{((staff as any).netBalance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Collapsible Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5 space-y-2.5 animate-fade-in">
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="font-bold text-slate-400 uppercase tracking-wide">Shift Status</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">
                              {staff.compliance ? (
                                `${staff.compliance.status} ${staff.compliance.startTime ? `(IN: ${staff.compliance.startTime})` : ""}`
                              ) : (
                                "Not Checked In"
                              )}
                            </span>
                          </div>

                          {staff.compliance && (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between text-[9px]">
                                <span className="font-bold text-slate-400 uppercase tracking-wide">Odometer Reading</span>
                                <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                  {staff.compliance.startKm ? `${staff.compliance.startKm} KM` : "0 KM"}
                                  {staff.compliance.endKm ? ` → ${staff.compliance.endKm} KM` : " Started"}
                                </span>
                              </div>

                              {/* Odometer & GPS actions links */}
                              <div className="flex items-center gap-1.5 pt-1">
                                {/* Start Route GPS */}
                                {staff.compliance.startLatitude && staff.compliance.startLongitude && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.startLatitude},${staff.compliance.startLongitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                    title="View starting location on Google Maps"
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
                                    className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    title="View starting odometer photo"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-slate-500" />
                                    <span>Start Photo</span>
                                  </a>
                                )}

                                {/* End Route GPS */}
                                {staff.compliance.endLatitude && staff.compliance.endLongitude && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${staff.compliance.endLatitude},${staff.compliance.endLongitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                    title="View ending location on Google Maps"
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
                                    className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    title="View ending odometer photo"
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
                              <div className="border-t border-slate-100 dark:border-slate-800/40 pt-2">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Cash in Hand Breakdown</span>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                  {denItems.map(d => (
                                    <div key={d.label} className="flex items-center justify-between text-[9px]">
                                      <span className="font-bold text-slate-500 dark:text-slate-400">{d.label} × {d.count}</span>
                                      <span className="font-black text-slate-700 dark:text-slate-300">₹{(d.count * d.val).toLocaleString()}</span>
                                    </div>
                                  ))}
                                  {nd.coins !== 0 && (
                                    <div className="flex items-center justify-between text-[9px]">
                                      <span className="font-bold text-slate-500 dark:text-slate-400">Coins</span>
                                      <span className="font-black text-slate-700 dark:text-slate-300">₹{Number(nd.coins).toFixed(2)}</span>
                                    </div>
                                  )}
                                  {nd.online !== 0 && (
                                    <div className="flex items-center justify-between text-[9px] col-span-2 mt-0.5 pt-1 border-t border-slate-100 dark:border-slate-800/40">
                                      <span className="font-bold text-blue-500">Online / UPI</span>
                                      <span className="font-black text-blue-600 dark:text-blue-400">₹{Number(nd.online).toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null;
                          })()}

                          {/* Stores visited trigger row */}
                          <div className="border-t border-slate-100 dark:border-slate-800/40 pt-2 flex items-center justify-between">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Outings</span>
                            <button
                              onClick={() => staff.visitedStores.length > 0 && setActiveModalStaff({ name: staff.name, visitedStores: staff.visitedStores })}
                              className={`flex items-center gap-1 font-black uppercase tracking-wide text-[9px] px-2 py-1.5 rounded-lg transition-all ${
                                staff.visitedStores.length > 0 
                                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/80 cursor-pointer" 
                                : "text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-900/20 cursor-not-allowed"
                              }`}
                              disabled={staff.visitedStores.length === 0}
                            >
                              <Store className="w-3.5 h-3.5" />
                              <span>Stores Visited: {staff.visitedStores.length}</span>
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
        </div>
      </div>
      
      {/* Stores Visited Modal Popup */}
      {activeModalStaff && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-fade-in relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600 dark:text-blue-450" />
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                    Stores Visited Today
                  </h3>
                  <p className="text-[9px] font-bold text-slate-455 dark:text-slate-555">
                    {activeModalStaff.name.toUpperCase()}&apos;S ACTIVE OUTINGS
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setActiveModalStaff(null); setExpandedVisitedStoreId(null); }}
                className="p-1.5 rounded-lg bg-slate-105 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body: Stores list — click each to expand */}
            <div className="max-h-[60vh] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {activeModalStaff.visitedStores.map((item: VisitedStore, idx: number) => {
                const isExpanded = expandedVisitedStoreId === item.id;
                const den = item.denominations || {};
                const displayName = item.retailerName?.toLowerCase().startsWith("cms")
                  ? `${item.retailerName}${item.store_name ? ` – ${item.store_name}` : ""}`
                  : item.retailerName;
                return (
                  <div
                    key={idx}
                    className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/40 dark:bg-blue-950/10' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20'}`}
                    onClick={() => setExpandedVisitedStoreId(prev => prev === item.id ? null : item.id)}
                  >
                    {/* Row header */}
                    <div className="py-2.5 px-2 flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs truncate">
                          {displayName}
                        </span>
                        {item.store_name && !item.retailerName?.toLowerCase().startsWith("cms") && (
                          <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400">{item.store_name}</span>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{(() => {
                              try {
                                const [rawHour, min] = item.time.split(":").map(Number);
                                const ampm = rawHour >= 12 ? 'PM' : 'AM';
                                const hour = rawHour % 12 || 12;
                                return `${hour}:${min.toString().padStart(2, '0')} ${ampm}`;
                              } catch (e) { return item.time; }
                            })()}</span>
                          </div>
                          {item.portalName && (
                            <span className="text-[7px] font-black text-blue-500 uppercase bg-blue-50 dark:bg-blue-950/20 px-1 py-0.5 rounded border border-blue-100 dark:border-blue-900/20">{item.portalName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className="text-right">
                          <span className="font-black text-emerald-600 dark:text-emerald-450 text-xs block">+₹{item.amount.toLocaleString()}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${
                            item.status === 'verified'
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30'
                            : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-100 dark:border-amber-900/30'
                          }`}>{item.status}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Expanded breakdown */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/60" onClick={e => e.stopPropagation()}>
                        {/* Remarks */}
                        {item.remarks && (
                          <div className="mb-2 px-2 py-1 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Remark</span>
                            <span className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 italic">{item.remarks}</span>
                          </div>
                        )}
                        {/* Denominations */}
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Cash Breakdown</span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                          {Number(den.note_500 || 0) !== 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                          {Number(den.note_200 || 0) !== 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                          {Number(den.note_100 || 0) !== 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                          {Number(den.note_50 || 0)  !== 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                          {Number(den.note_20 || 0)  !== 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                          {Number(den.note_10 || 0)  !== 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                          {Number(den.coins || 0)    !== 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                          {Number(den.online_amount || 0) !== 0 && <span className="col-span-2 text-blue-600 dark:text-blue-400">UPI = ₹{Number(den.online_amount).toLocaleString()}</span>}
                          {!Number(den.note_500) && !Number(den.note_200) && !Number(den.note_100) && !Number(den.note_50) && !Number(den.note_20) && !Number(den.note_10) && !Number(den.coins) && !Number(den.online_amount) && (
                            <span className="text-slate-400 italic text-[8px]">No breakdown recorded</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Total Visited Today</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-350">
                  {activeModalStaff.visitedStores.length} Stores
                </span>
              </div>
              <button
                onClick={() => { setActiveModalStaff(null); setExpandedVisitedStoreId(null); }}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black rounded-xl hover:bg-slate-850 dark:hover:bg-slate-100 transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Activity Heading */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-1 h-4 bg-blue-600 rounded-full" />
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Today&apos;s Activity</h2>
      </div>

      {/* KPI Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        
        {/* Total Collection */}
        <div className="p-5 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-2xl shadow-lg shadow-emerald-900/15 border border-emerald-500/20 hover:scale-[1.03] active:scale-95 transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <div className="flex items-start justify-between w-full">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-inner">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-100" />
            </div>
             <span className="text-[8px] font-black uppercase tracking-wide text-emerald-100/70 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-500/10">
               Today&apos;s Collection
             </span>
          </div>
          <div className="mt-4">
            <span className="text-xl md:text-2xl font-black block tracking-tight text-white">
              ₹{(totalCollectedAmount || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-100/80 font-bold block mt-1 tracking-wide">
              Logged cash receipts
            </span>
          </div>
        </div>

        {/* Total Deposits */}
        <div className="p-5 bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white rounded-2xl shadow-lg shadow-red-950/15 border border-red-500/20 hover:scale-[1.03] active:scale-95 transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <div className="flex items-start justify-between w-full">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-inner">
              <FileText className="w-4.5 h-4.5 text-red-100" />
            </div>
             <span className="text-[8px] font-black uppercase tracking-wide text-red-100/70 bg-red-950/30 px-2 py-0.5 rounded-full border border-red-500/10">
               Today&apos;s Deposits
             </span>
          </div>
          <div className="mt-4">
            <span className="text-xl md:text-2xl font-black block tracking-tight text-white">
              ₹{(totalDepositedAmount || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-red-100/80 font-bold block mt-1 tracking-wide">
              Bank Deposit Logs
            </span>
          </div>
        </div>

        {/* Net Cash */}
        <div 
          onClick={() => setIsRangeModalOpen(true)}
          className="p-5 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-800 text-white rounded-2xl shadow-lg shadow-blue-900/15 border border-blue-500/20 hover:scale-[1.03] active:scale-95 transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px] cursor-pointer group"
        >
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <div className="flex items-start justify-between w-full">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-4.5 h-4.5 text-blue-100" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-wide text-blue-100/70 bg-blue-950/30 px-2 py-0.5 rounded-full border border-blue-500/10 flex items-center gap-1 group-hover:bg-blue-900/60 transition-colors">
              Net Cash <Calendar className="w-2.5 h-2.5" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xl md:text-2xl font-black block tracking-tight text-white">
              ₹{(netCashBalance || 0).toLocaleString()}
            </span>
             <span className="text-[10px] text-blue-100/85 font-bold block mt-1 tracking-wide group-hover:underline">
               {todayCount || 0} Entries Today (Click to filter)
             </span>
          </div>
        </div>
      </div>

      {/* Recent Ledger Activity Calculation */}
      {(() => {
        const recentActivity = [
          ...safeCollections.map(c => ({
            id: c.id,
            date: c.date,
            created_at: c.created_at || c.date,
            party: c.retailerName,
            store_name: c.store_name || null,
            staff: c.staffName || "Admin",
            amount: c.totalAmount,
            type: 'collection',
            balance: c.balance_snapshot,
            remarks: c.remarks,
            denominations: c.denominations,
            retailer_id: c.retailer_id,
            store_id: c.store_id,
            portal_id: c.portal_id,
            rawRecord: c.rawRecord,
            deposit_type: undefined,
            recipient_staff_id: undefined,
            paymentMode: undefined
          })),
          ...safeDeposits.map(d => ({
            id: d.id,
            date: d.date,
            created_at: d.created_at || d.date,
            party: d.portalGroupName ? `${d.portalGroupName} (${d.targetName})` : d.targetName,
            store_name: null,
            staff: d.staffName || "Admin",
            amount: d.amount,
            type: d.isRefund === true ? 'collection' : 'deposit',
            balance: d.balance_snapshot,
            remarks: d.remarks || "",
            denominations: d.denominations,
            deposit_type: d.depositType,
            portal_id: d.portal_id,
            retailer_id: d.retailer_id,
            recipient_staff_id: d.recipient_staff_id,
            paymentMode: d.paymentMode,
            store_id: undefined,
            rawRecord: undefined
          }))
        ].sort((a, b) => {
          const timeA = new Date(a.date.replace(" ", "T")).getTime();
          const timeB = new Date(b.date.replace(" ", "T")).getTime();
          if (sortBy === "date-desc") return timeB - timeA;
          if (sortBy === "date-asc") return timeA - timeB;
          if (sortBy === "amount-desc") return b.amount - a.amount;
          if (sortBy === "amount-asc") return a.amount - b.amount;
          return 0;
        }).slice(0, 10);

        return (
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
            <div 
              onClick={() => setIsRecentLedgerExpanded(!isRecentLedgerExpanded)}
              className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3 cursor-pointer group select-none"
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Recent Ledger Activity</h2>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase outline-none cursor-pointer"
                >
                  <option value="date-desc">LATEST FIRST</option>
                  <option value="date-asc">OLDEST FIRST</option>
                  <option value="amount-desc">AMOUNT: HIGH-LOW</option>
                  <option value="amount-asc">AMOUNT: LOW-HIGH</option>
                </select>
                <span className="text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full font-bold border border-blue-200/60 dark:border-blue-900/40">
                  Latest 10 Entries
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${isRecentLedgerExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {isRecentLedgerExpanded && (
              <div className="overflow-x-auto animate-in fade-in duration-200">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-[9px] font-black uppercase tracking-tight text-slate-400 border-b border-slate-200 dark:border-slate-850">
                    <th className="px-4 py-2.5">Date & Time</th>
                    <th className="px-4 py-2.5">Party / Target Account</th>
                    <th className="px-4 py-2.5">Logged By</th>
                    <th className="px-4 py-2.5 text-right">Transaction Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic font-bold">
                        No recent ledger entries found.
                      </td>
                    </tr>
                  ) : (
                    recentActivity.map((item) => {
                      const isExpanded = expandedLedgerRowId === item.id;
                      const den = item.denominations || {};
                      return (
                        <React.Fragment key={item.id}>
                          <tr 
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/70 dark:bg-slate-950/50' : ''}`}
                            onClick={() => setExpandedLedgerRowId(prev => prev === item.id ? null : item.id)}
                          >
                            <td className="px-4 py-3 font-semibold text-slate-450 dark:text-slate-500 whitespace-nowrap">
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
                            </td>
                            <td className="px-4 py-3 font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                              <div className="flex items-center gap-1.5">
                                <span>
                                  {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms")
                                    ? `${item.party} - ${item.store_name || "Cash"}`
                                    : item.party}
                                  {item.store_name && !item.party?.toLowerCase().startsWith("cms") && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold ml-1">({item.store_name})</span>
                                  )}
                                </span>
                                {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms") && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setCmsRemarksExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] })); }}
                                    className="p-0.5 bg-slate-50 dark:bg-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                                    title="View Remark"
                                  >
                                    <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[item.id] ? 'rotate-180 text-indigo-505' : ''}`} />
                                  </button>
                                )}
                              </div>
                              {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[item.id] && (
                                <div className="mt-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-200/50 dark:border-slate-800 text-[9px] font-medium text-slate-605 dark:text-slate-400 max-w-[250px] break-words block">
                                  <span className="text-[7.5px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                                  <span className="italic">{item.remarks || "no remark"}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {item.staff}
                            </td>
                            <td className={`px-4 py-3 text-right font-black ${item.type === 'collection' ? 'text-emerald-600 bg-emerald-50/5 dark:bg-emerald-950/2' : 'text-red-600 bg-red-50/5 dark:bg-red-950/2'}`}>
                              <div className="flex items-center justify-end gap-1.5">
                                <span>{item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                              {item.balance !== undefined && item.balance !== null && (
                                <div className={`text-[9px] font-bold mt-0.5 uppercase ${
                                  Number(item.balance) < 0 
                                    ? 'text-emerald-600 dark:text-emerald-500' 
                                    : Number(item.balance) > 0 
                                      ? 'text-red-600 dark:text-red-400' 
                                      : 'text-slate-400'
                                }`}>
                                  Due: {Number(item.balance) < 0 ? '-' : ''}₹{Math.abs(Number(item.balance)).toLocaleString()}
                                </div>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50 dark:bg-slate-950/20">
                              <td colSpan={4} className="px-6 py-3 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div>
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cash Breakdown</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
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
                                    <div className="mt-1.5 text-[10px] font-bold text-slate-500 italic">{numberToWordsIndian(item.amount)} Rupees</div>
                                    {item.remarks && <div className="mt-1 text-[9px] text-slate-550 dark:text-slate-400"><span className="font-extrabold uppercase">Remark:</span> {item.remarks}</div>}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-2 md:mt-0">
                                    <button
                                      onClick={() => {
                                        if (item.type === 'collection') {
                                          shareCollectionEntry({ retailer_name: item.party, store_name: item.store_name, total_amount: item.amount, denominations: item.denominations, created_at: item.created_at || item.rawRecord?.created_at || item.date, remarks: item.remarks }, item.staff);
                                        } else {
                                          shareDepositEntry({ deposit_type: item.deposit_type, target_name: item.party, amount: item.amount, denominations: item.denominations, created_at: item.created_at || item.date, remarks: item.remarks, recipient_staff_id: item.recipient_staff_id }, item.staff);
                                        }
                                      }}
                                      className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-lg border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 transition-all cursor-pointer flex items-center gap-1"
                                      title="Share"
                                    >
                                      <Share2 className="w-3.5 h-3.5" /> Share
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditCollection(item);
                                      }}
                                      className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Edit className="w-3.5 h-3.5" /> Edit
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
                                      className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-wider rounded-lg border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        );
      })()}

      {/* Recent Activity Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recent Collections Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1">
            <div className="px-5 py-3 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Recent Collections</h2>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
               {safeCollections.slice(0, 5).map((c, idx) => {
                 const snapshots = balanceSnapshots.get(c.id) || { prev: 0, next: 0 };
                 const isExpanded = expandedCollectionId === c.id;
                 const den = c.denominations || {};
                 return (
                   <div key={idx} className={`flex flex-col gap-2 group border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/70 dark:bg-slate-950/50' : 'hover:bg-slate-50/50 dark:hover:bg-slate-850/10'}`} onClick={() => setExpandedCollectionId(prev => prev === c.id ? null : c.id)}>
                     <div className="p-4 flex flex-col gap-3">
                       <div className="flex items-center justify-between text-[11px]">
                         <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-850 dark:text-slate-100">
                                {c.retailerName?.toLowerCase().startsWith("cms")
                                  ? `${c.retailerName} - ${c.store_name || "Cash"}`
                                  : c.retailerName}
                              </span>
                              {c.retailerName?.toLowerCase().startsWith("cms") && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setCmsRemarksExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] })); }}
                                  className="p-0.5 bg-slate-50 dark:bg-slate-850 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                                  title="View Remark"
                                >
                                  <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[c.id] ? 'rotate-180 text-indigo-500' : ''}`} />
                                </button>
                              )}
                            </div>
                            {c.retailerName?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[c.id] && (
                              <div className="mt-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-200/50 dark:border-slate-800 text-[9px] font-medium text-slate-605 dark:text-slate-400 max-w-[250px] break-words block">
                                <span className="text-[7.5px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                                <span className="italic">{c.remarks || "no remark"}</span>
                              </div>
                            )}
                            <span className="text-[9px] text-slate-400 font-bold uppercase">{c.date}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <span className="font-black text-emerald-600 text-sm">+₹{(c.totalAmount || 0).toLocaleString()}</span>
                           <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                             <button
                               onClick={() => shareCollectionEntry({ retailer_name: c.retailerName, portal_name: c.portalName, store_name: c.store_name, total_amount: c.totalAmount, denominations: c.denominations, created_at: c.rawRecord?.created_at || c.date, remarks: c.remarks }, c.staffName || 'Staff')}
                               className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                               title="Share"
                             >
                               <Share2 className="w-3 h-3" />
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleStartEditCollection(c);
                               }}
                               className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                             >
                               <Edit className="w-3 h-3" />
                             </button>
                             <button 
                               onClick={async () => {
                                 if(confirm("Delete this collection?")) {
                                   try {
                                     await api.deleteCollection(c.id);
                                     fetchData();
                                   } catch (err: any) {
                                     alert("Failed to delete: " + err.message);
                                   }
                                 }
                               }}
                               className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                             >
                               <Trash2 className="w-3 h-3" />
                             </button>
                             <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                           </div>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
                         <div className="flex flex-col">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Opening</span>
                           <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">₹{snapshots.prev.toLocaleString()}</span>
                         </div>
                         <div className="flex flex-col border-x border-slate-200 dark:border-slate-800 px-3">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Collector</span>
                           <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 line-clamp-1">{c.staffName || 'System'}</span>
                         </div>
                         <div className="flex flex-col text-right">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Closing</span>
                           <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">₹{snapshots.next.toLocaleString()}</span>
                         </div>
                       </div>
                     </div>
                     {isExpanded && (
                       <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                         <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1 mt-2">Cash Breakdown</span>
                         <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                           {Number(den.note_500 || 0) !== 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                           {Number(den.note_200 || 0) !== 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                           {Number(den.note_100 || 0) !== 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                           {Number(den.note_50 || 0) !== 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                           {Number(den.note_20 || 0) !== 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                           {Number(den.note_10 || 0) !== 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                           {Number(den.coins || 0) !== 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                           {Number(den.online_amount || 0) !== 0 && <span>UPI = ₹{Number(den.online_amount).toLocaleString()}</span>}
                           {!den.note_500 && !den.note_200 && !den.note_100 && !den.note_50 && !den.note_20 && !den.note_10 && !den.coins && !den.online_amount && <span className="text-slate-400 italic col-span-3">No breakdown</span>}
                         </div>
                         <div className="mt-1 text-[10px] font-bold text-slate-500 italic">{numberToWordsIndian(c.totalAmount || 0)} Rupees</div>
                       </div>
                     )}
                   </div>
                 );
               })}
              {safeCollections.length === 0 && <div className="p-8 text-center text-slate-400 text-[10px] font-bold italic">No collections.</div>}
            </div>
          </div>

          {/* Recent Deposits Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1">
            <div className="px-5 py-3 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Recent Deposits</h2>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {safeDeposits.slice(0, 5).map((d, idx) => {
                 const snapshots = balanceSnapshots.get(d.id) || { prev: 0, next: 0 };
                 const isExpanded = expandedDepositId === d.id;
                 const den = d.denominations || {};
                 return (
                   <div key={idx} className={`flex flex-col group border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/70 dark:bg-slate-950/50' : 'hover:bg-slate-50/50 dark:hover:bg-slate-850/10'}`} onClick={() => setExpandedDepositId(prev => prev === d.id ? null : d.id)}>
                     <div className="p-4 flex flex-col gap-3">
                       <div className="flex items-center justify-between text-[11px]">
                         <div className="flex flex-col">
                           <span className="font-extrabold text-slate-850 dark:text-slate-100">{d.targetName}</span>
                           <span className="text-[9px] text-slate-400 font-bold uppercase">{d.date}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <span className="font-black text-red-600 text-sm">-₹{(d.amount || 0).toLocaleString()}</span>
                           <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                             <button
                               onClick={() => shareDepositEntry({ deposit_type: d.depositType, target_name: d.targetName, portal_group_name: d.portalName, amount: d.amount, denominations: d.denominations, created_at: d.created_at || d.date, remarks: d.remarks, recipient_staff_id: d.recipient_staff_id || d.recipientStaffId }, d.staffName || 'Staff')}
                               className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                               title="Share"
                             >
                               <Share2 className="w-3 h-3" />
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleStartEditCollection(d);
                               }}
                               className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                             >
                               <Edit className="w-3 h-3" />
                             </button>
                             <button 
                               onClick={async () => {
                                 if(confirm("Delete this deposit?")) {
                                   try {
                                     await api.deleteDeposit(d.id);
                                     fetchData();
                                   } catch (err: any) {
                                     alert("Failed to delete: " + err.message);
                                   }
                                 }
                               }}
                               className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                             >
                               <Trash2 className="w-3 h-3" />
                             </button>
                             <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                           </div>
                         </div>
                       </div>
      
                       <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
                         <div className="flex flex-col">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Opening</span>
                           <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">₹{snapshots.prev.toLocaleString()}</span>
                         </div>
                         <div className="flex flex-col border-x border-slate-200 dark:border-slate-800 px-3">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Deposited By</span>
                           <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 line-clamp-1">{d.staffName || 'System'}</span>
                         </div>
                         <div className="flex flex-col text-right">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Closing</span>
                           <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">₹{snapshots.next.toLocaleString()}</span>
                         </div>
                       </div>
                     </div>
                     {isExpanded && (
                       <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                         <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1 mt-2">Cash Breakdown</span>
                         <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                           {Number(den.note_500 || 0) !== 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                           {Number(den.note_200 || 0) !== 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                           {Number(den.note_100 || 0) !== 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                           {Number(den.note_50 || 0) !== 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                           {Number(den.note_20 || 0) !== 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                           {Number(den.note_10 || 0) !== 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                           {Number(den.coins || 0) !== 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                           {Number(den.online_amount || 0) !== 0 && <span>UPI = ₹{Number(den.online_amount).toLocaleString()}</span>}
                           {!den.note_500 && !den.note_200 && !den.note_100 && !den.note_50 && !den.note_20 && !den.note_10 && !den.coins && !den.online_amount && <span className="text-slate-400 italic col-span-3">No breakdown</span>}
                         </div>
                         <div className="mt-1 text-[10px] font-bold text-slate-500 italic">{numberToWordsIndian(d.amount || 0)} Rupees</div>
                       </div>
                     )}
                   </div>
                 );
               })}
              {safeDeposits.length === 0 && <div className="p-8 text-center text-slate-400 text-[10px] font-bold italic">No deposits.</div>}
            </div>
          </div>
        </div>
      {/* Edit Collection/Deposit Modal */}
      {isEditCollectionModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                {editingIsDeposit ? "Edit Cash Out (Deposit) Entry" : "Edit Cash In (Collection) Entry"}
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCollectionEdit} className="space-y-4">
              
              {!editingIsDeposit ? (
                // Collection Form Fields
                <div className="space-y-3">
                  {/* Parent Retailer Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Parent Retailer</label>
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

                  {availableStores.length > 0 && (
                    <div className="space-y-1 animate-in fade-in duration-200">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Parent Store (Shop/Branch)</label>
                      <InlineSelect
                        value={selectedNewStoreId}
                        onChange={setSelectedNewStoreId}
                        options={[
                          { value: "", label: "None / Cash" },
                          ...availableStores.map((s: any) => ({ value: String(s.id), label: s.store_name }))
                        ]}
                        placeholder="None / Cash"
                      />
                    </div>
                  )}

                  {/* Portal Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Portal Channel</label>
                    <InlineSelect
                      value={selectedNewPortalId}
                      onChange={setSelectedNewPortalId}
                      options={[
                        { value: "", label: "None / Cash" },
                        ...portalDirectory
                          .flatMap((group: any) => (group.portals || []).map((p: any) => ({ ...p, groupName: group.name })))
                          .filter((p: any) => p.show_in_online_payment)
                          .map((p: any) => {
                            return { value: String(p.id), label: p.groupName || p.portal_name };
                          })
                      ]}
                      placeholder="None / Cash"
                    />
                  </div>

                  {/* Denominations editor for Collection */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/50 space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Denominations</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: "₹500 Notes", key: "note_500", factor: 500 },
                        { label: "₹200 Notes", key: "note_200", factor: 200 },
                        { label: "₹100 Notes", key: "note_100", factor: 100 },
                        { label: "₹50 Notes", key: "note_50", factor: 50 },
                        { label: "₹20 Notes", key: "note_20", factor: 20 },
                        { label: "₹10 Notes", key: "note_10", factor: 10 },
                      ].map(item => (
                        <div key={item.key} className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-slate-400">{item.label}</label>
                          <input autoComplete="one-time-code"
                            type="number"
                            value={selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setSelectedNewDenoms(prev => ({ ...prev, [item.key]: val }));
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
                          />
                        </div>
                      ))}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400">Coins Sum</label>
                        <input autoComplete="one-time-code"
                          type="number"
                          step="0.01"
                          value={selectedNewDenoms.coins}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSelectedNewDenoms(prev => ({ ...prev, coins: val }));
                          }}
                          className="px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400">UPI / Online Amount</label>
                        <input autoComplete="one-time-code"
                          type="number"
                          value={selectedNewDenoms.online_amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSelectedNewDenoms(prev => ({ ...prev, online_amount: val }));
                          }}
                          className="px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated total amount */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Total Amount (Calculated)</label>
                    <input autoComplete="one-time-code"
                      type="text"
                      value={`₹${(
                        selectedNewDenoms.note_500 * 500 +
                        selectedNewDenoms.note_200 * 200 +
                        selectedNewDenoms.note_100 * 100 +
                        selectedNewDenoms.note_50 * 50 +
                        selectedNewDenoms.note_20 * 20 +
                        selectedNewDenoms.note_10 * 10 +
                        selectedNewDenoms.coins +
                        selectedNewDenoms.online_amount
                      ).toLocaleString()}`}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-slate-800 dark:text-slate-100"
                      readOnly
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Collection Date</label>
                    <input autoComplete="one-time-code"
                      type="date"
                      value={selectedNewDate}
                      onChange={(e) => setSelectedNewDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      rows={2}
                      placeholder="Remarks..."
                    />
                  </div>
                </div>
              ) : (
                // Deposit Form Fields
                <div className="space-y-3">
                  {/* Deposit Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Deposit/Payout Type</label>
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
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
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Portal</label>
                      <InlineSelect
                        value={selectedNewPortalId}
                        onChange={setSelectedNewPortalId}
                        options={[
                          { value: "", label: "Select Portal Bank Account" },
                            ...portalDirectory.flatMap((group: any) => (group.portals || []).map((p: any) => {
                              return { value: String(p.id), label: (group.name || p.portal_name).split(' - ')[0].trim() };
                            }))
                        ]}
                        placeholder="Select Portal Bank Account"
                      />
                    </div>
                  )}

                  {selectedNewDepositType === "retailer" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Retailer</label>
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
                      <div className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id="editToOfficeCheckbox"
                          checked={selectedNewToOffice}
                          onChange={(e) => setSelectedNewToOffice(e.target.checked)}
                          className="w-4 h-4 text-blue-650 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="editToOfficeCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-350">Handover to Main Office Cashier</label>
                      </div>

                      {!selectedNewToOffice && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Recipient Staff</label>
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
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Destination Portal" : "Source Portal"}
                        </label>
                        <InlineSelect
                          value={selectedNewPortalId}
                          onChange={setSelectedNewPortalId}
                          options={[
                            { value: "", label: "Select Portal Bank Account" },
                            ...portalDirectory.flatMap((group: any) => (group.portals || []).map((p: any) => {
                              return { value: String(p.id), label: (group.name || p.portal_name).split(' - ')[0].trim() };
                            }))
                          ]}
                          placeholder="Select Portal Bank Account"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                        </label>
                        <select
                          value={selectedNewVirtualTargetType}
                          onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                        >
                          <option value="retailer">Retailer</option>
                          <option value="staff">Staff Member</option>
                        </select>
                      </div>

                      {selectedNewVirtualTargetType === "retailer" ? (
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                            {selectedNewPaymentMode === "refund" ? "Source Retailer" : "Destination Retailer"}
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
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                            {selectedNewPaymentMode === "refund" ? "Source Staff Member" : "Destination Staff Member"}
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
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Payment Mode</label>
                      <select
                        value={selectedNewPaymentMode}
                        onChange={(e) => setSelectedNewPaymentMode(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="online">Online</option>
                      </select>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Amount</label>
                    <input autoComplete="one-time-code"
                      type="number"
                      value={selectedNewAmount}
                      onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Date</label>
                    <input autoComplete="one-time-code"
                      type="date"
                      value={selectedNewDate}
                      onChange={(e) => setSelectedNewDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      required
                    />
                  </div>

                  {/* Reference No */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Reference No</label>
                    <input autoComplete="one-time-code"
                      type="text"
                      value={selectedNewRefNo}
                      onChange={(e) => setSelectedNewRefNo(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      placeholder="Optional"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      rows={2}
                      placeholder="Remarks..."
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditCollectionModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCollection}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingCollection ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Date Range Cash Flow Report Modal */}
      {isRangeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl animate-fade-in relative flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                    Cash Flow Report
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    Select a date range to filter collections & deposits
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRangeModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Range controls & presets */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
              
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                    setRangeStartDate(today);
                    setRangeEndDate(today);
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[9px] font-black text-slate-650 dark:text-slate-300 uppercase transition-all cursor-pointer"
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
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[9px] font-black text-slate-650 dark:text-slate-300 uppercase transition-all cursor-pointer"
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
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[9px] font-black text-slate-650 dark:text-slate-300 uppercase transition-all cursor-pointer"
                >
                  Last 7 Days
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
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[9px] font-black text-slate-650 dark:text-slate-300 uppercase transition-all cursor-pointer"
                >
                  This Month
                </button>
              </div>

              {/* Date Inputs */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400">From</span>
                  <input
                    type="date"
                    value={rangeStartDate}
                    onChange={(e) => setRangeStartDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10px] font-bold outline-none dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400">To</span>
                  <input
                    type="date"
                    value={rangeEndDate}
                    onChange={(e) => setRangeEndDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10px] font-bold outline-none dark:text-white"
                  />
                </div>
              </div>

            </div>

            {/* Range Cash In / Cash Out Summary Grid */}
            <div className="grid grid-cols-3 gap-4">
              {/* Cash In */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-450 tracking-wider">Cash In (Collections)</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    ₹{rangeCashIn.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-600/80">
                    {filteredCollections.length} entries
                  </span>
                </div>
              </div>

              {/* Cash Out */}
              <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[9px] font-black uppercase text-red-600 dark:text-red-455 tracking-wider">Cash Out (Deposits)</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-red-700 dark:text-red-400">
                    ₹{rangeCashOut.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-bold text-red-650/80">
                    {filteredDeposits.length} entries
                  </span>
                </div>
              </div>

              {/* Net Flow */}
              <div className={`border rounded-xl p-4 flex flex-col justify-between ${
                rangeNet >= 0
                  ? 'bg-blue-50/50 dark:bg-blue-955 border-blue-100 dark:border-blue-900/30'
                  : 'bg-amber-50/50 dark:bg-amber-955 border-amber-100 dark:border-amber-900/30'
              }`}>
                <span className={`text-[9px] font-black uppercase tracking-wider ${rangeNet >= 0 ? 'text-blue-650' : 'text-amber-650'}`}>
                  Net Cash Flow
                </span>
                <div className="mt-2">
                  <span className={`text-lg font-black block ${rangeNet >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {rangeNet >= 0 ? '+' : ''}₹{rangeNet.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Section */}
            <div className="flex-1 flex flex-col min-h-0 pt-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Transaction Entries ({rangeEntries.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 pr-1 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-150 dark:border-slate-800 rounded-xl">
                {rangeEntries.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 italic text-[11px] font-bold">
                    No transaction entries found for this range.
                  </div>
                ) : (
                  rangeEntries.map((item) => (
                    <div key={item.id} className="p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition-colors flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        
                        {/* Flow Description */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            item.type === 'collection'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/30'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100/60 dark:border-red-900/30'
                          }`}>
                            {item.type === 'collection' ? 'Cash In' : 'Cash Out'}
                          </span>

                          <div className="flex items-center gap-1.5 truncate font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                            <span className="truncate max-w-[200px]">{item.from}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-[200px] text-blue-600 dark:text-blue-400">{item.to}</span>
                          </div>
                        </div>

                        {/* Amount */}
                        <span className={`font-black text-xs ${item.type === 'collection' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {item.type === 'collection' ? '+' : '-'}₹{item.amount.toLocaleString()}
                        </span>
                      </div>

                      {/* Meta Footer Row */}
                      <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider">
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
                          <span className="italic text-slate-500 dark:text-slate-400 font-semibold normal-case truncate max-w-[300px]">
                            Remark: {item.remarks}
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
