"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../../context/AdminContext";
import { Edit2, X, Save, Trash2, ChevronDown, Share2 } from "lucide-react";
import { api } from "../../../utils/api";
import { numberToWordsIndian, shareCollectionEntry, shareDepositEntry } from "../../../utils/shareHelper";

function getExportFilename() {
  return `Ledger_${Date.now()}.csv`;
}

interface LedgerTabProps {
  collections?: any[];
  deposits?: any[];
  retailerDirectory?: any[];
  portalDirectory?: any[];
}

export default function LedgerTab({
  collections = [],
  deposits = [],
  retailerDirectory: propsRetailerDir,
  portalDirectory: propsPortalDir
}: LedgerTabProps) {
  const adminContext = useAdmin();
  const retailerDirectory = propsRetailerDir || adminContext.retailerDirectory;
  const portalDirectory = propsPortalDir || adminContext.portalDirectory;
  const { ledgerSearchTerm, setLedgerSearchTerm } = adminContext;
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [staffFilter, setStaffFilter] = React.useState("all");
  const [partyFilter, setPartyFilter] = React.useState("all");
  const [portalFilter, setPortalFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("date-desc");

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = React.useState(false);
  const [editingCollection, setEditingCollection] = React.useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = React.useState(false);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = React.useState("");
  const [selectedNewPortalId, setSelectedNewPortalId] = React.useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = React.useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = React.useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = React.useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = React.useState("");
  const [selectedNewAmount, setSelectedNewAmount] = React.useState(0);
  const [selectedNewDate, setSelectedNewDate] = React.useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = React.useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = React.useState("");
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
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = React.useState<Record<string, boolean>>({});
  const [expandedTxId, setExpandedTxId] = React.useState<string | null>(null);;

  const handleStartEditCollection = (tx: any) => {
    const raw = tx.rawRecord;
    const isDeposit = tx.depositType != null;
    setEditingIsDeposit(isDeposit);
    setEditingCollection(raw);
    
    setSelectedNewRetailerId(raw.retailer_id || "");
    setSelectedNewPortalId(raw.portal_id || "");
    setSelectedNewRemarks(raw.remarks || "");
    
    if (isDeposit) {
      setSelectedNewDepositType(raw.deposit_type || raw.depositType || "virtual");
      setSelectedNewPaymentMode(raw.payment_mode || raw.paymentMode || "online");
      setSelectedNewAmount(Number(raw.amount || 0));
      setSelectedNewDate(raw.deposit_date ? raw.deposit_date : (raw.date || "").split(" ")[0]);
      setSelectedNewRefNo(raw.reference_no || "");
      setSelectedNewRecipientStaffId(raw.recipient_staff_id || "");
      setSelectedNewToOffice(raw.to_office === true);
    }
    
    const den = raw.denominations || {};
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

  const handleDeleteEntry = async (tx: any) => {
    if (!window.confirm("Are you sure you want to delete this ledger entry? This will permanently delete the entry and recalculate all following balances.")) {
      return;
    }
    try {
      const isDeposit = tx.depositType != null;
      if (isDeposit) {
        await api.deleteDeposit(tx.id);
      } else {
        await api.deleteCollection(tx.id);
      }
      adminContext.showToastNotification("Entry deleted successfully.");
      await adminContext.fetchData();
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const handleSaveCollectionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    setIsSavingCollection(true);
    
    try {
      if (editingIsDeposit) {
        const portalId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewPortalId : null;
        const retailerId = selectedNewDepositType === "retailer" || selectedNewDepositType === "virtual" ? selectedNewRetailerId : null;
        const recipientStaffId = selectedNewDepositType === "staff" && !selectedNewToOffice ? selectedNewRecipientStaffId : null;
        const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

        await api.updateDeposit(editingCollection.id, {
          deposit_type: selectedNewDepositType,
          portal_id: portalId || null,
          retailer_id: retailerId || null,
          recipient_staff_id: recipientStaffId || null,
          to_office: toOffice,
          payment_mode: selectedNewPaymentMode,
          amount: Number(selectedNewAmount),
          deposit_date: selectedNewDate || new Date().toISOString().split("T")[0],
          reference_no: selectedNewRefNo || null,
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
          store_id: editingCollection.store_id || null,
          total_amount: computedCollectionTotal,
          remarks: selectedNewRemarks || "",
          denominations: selectedNewDenoms
        });
      }
      adminContext.showToastNotification("Entry updated successfully.");
      setIsEditCollectionModalOpen(false);
      await adminContext.fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

  useEffect(() => {
    if (ledgerSearchTerm && ledgerSearchTerm !== searchQuery) {
      const timer = setTimeout(() => {
        setSearchQuery(ledgerSearchTerm);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [ledgerSearchTerm, searchQuery]);

  // Get unique lists
  const staffList = Array.from(new Set([
    ...(collections || []).map(c => c.staffName),
    ...(deposits || []).map(d => d.staffName)
  ].filter(Boolean))).sort();

  const partyList = Array.from(new Set([
    ...(collections || []).map(c => c.retailerName),
    ...(deposits || []).map(d => d.targetName)
  ].filter(Boolean))).sort();

  const portalList = Array.from(new Set([
    ...(collections || []).map(c => c.portalName),
    ...(deposits || []).map(d => d.targetName)
  ].filter(Boolean))).sort();

  // Merge and Filter all transactions
  let allTransactions = [
    ...(collections || []).map(c => ({
      id: c.id,
      date: c.date,
      partyId: c.retailer_id,
      party: c.retailerName,
      store_name: c.store_name || null,
      portal: c.portalName,
      staff: c.staffName || "Admin",
      debit: 0,
      credit: c.totalAmount,
      balance_snapshot: c.balance_snapshot,
      type: 'collection',
      depositType: null,
      rawRecord: c
    })),
    ...(deposits || []).map(d => {
      const isRef = d.isRefund === true;
      const isVirtual = d.depositType === 'virtual';
      
      // For virtual deposits targeting a retailer, use the retailer as party
      // so balance calculations and filtering work correctly
      let partyId = d.portal_id || d.retailer_id;
      let party = d.portalGroupId ? `${d.portalGroupName} (${d.targetName})` : d.targetName;
      
      if (isVirtual && d.retailer_id) {
        partyId = d.retailer_id;
        const ret = (retailerDirectory || []).find((r: any) => r.id === d.retailer_id);
        party = ret?.name || d.targetName;
      }
      
      return {
        id: d.id,
        date: d.date,
        partyId,
        party,
        store_name: null,
        portal: isVirtual ? (d.portalGroupName || d.portalName || d.targetName) : d.targetName, 
        staff: d.staffName || "Admin",
        debit: isRef ? 0 : d.amount,
        credit: isRef ? d.amount : 0,
        balance_snapshot: d.balance_snapshot,
        type: isRef ? 'collection' : 'deposit',
        depositType: d.depositType,
        rawRecord: d
      };
    })
  ];

  // Calculate Initial Balance for Summary Section (starts with opening_to_take, no netting/subtraction)
  let initialBalance = 0;
  if (partyFilter !== "all") {
    const ret = (retailerDirectory || []).find(r => r.name === partyFilter);
    if (ret) initialBalance = (ret.opening_to_take || 0);
    else {
        const port = (portalDirectory || []).find(p => p.name === partyFilter);
        if (port) initialBalance = (port.opening_to_take || 0);
    }
  } else if (portalFilter !== "all") {
      const port = (portalDirectory || []).find(p => p.name === portalFilter);
      if (port) initialBalance = (port.opening_to_take || 0);
  }

  // Apply Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    allTransactions = allTransactions.filter(tx => 
      tx.party.toLowerCase().includes(q) || 
      tx.staff.toLowerCase().includes(q) ||
      (tx.rawRecord?.remarks && tx.rawRecord.remarks.toLowerCase().includes(q)) ||
      (tx.rawRecord?.reference_no && tx.rawRecord.reference_no.toLowerCase().includes(q)) ||
      (tx.rawRecord?.referenceNo && tx.rawRecord.referenceNo.toLowerCase().includes(q))
    );
  }

  // Apply Filters
  if (typeFilter !== "all") allTransactions = allTransactions.filter(tx => tx.type === typeFilter);
  if (staffFilter !== "all") allTransactions = allTransactions.filter(tx => tx.staff === staffFilter);
  if (partyFilter !== "all") allTransactions = allTransactions.filter(tx => tx.party === partyFilter);
  if (portalFilter !== "all") allTransactions = allTransactions.filter(tx => tx.portal === portalFilter);

  // Apply Date Filter
  if (dateFrom) allTransactions = allTransactions.filter(tx => tx.date >= dateFrom);
  if (dateTo) allTransactions = allTransactions.filter(tx => tx.date.split(' ')[0] <= dateTo);

  // Apply Sorting
  allTransactions.sort((a, b) => {
    if (sortBy === "date-desc") return new Date(b.date.replace(" ", "T")).getTime() - new Date(a.date.replace(" ", "T")).getTime();
    if (sortBy === "date-asc") return new Date(a.date.replace(" ", "T")).getTime() - new Date(b.date.replace(" ", "T")).getTime();
    if (sortBy === "amount-desc") return (b.debit + b.credit) - (a.debit + a.credit);
    if (sortBy === "amount-asc") return (a.debit + a.credit) - (b.debit + b.credit);
    return 0;
  });

    // 1. Map of ALL Opening Balances (Use IDs for accuracy)
    const partyOpeningBalances = new Map<string, number>();
    (retailerDirectory || []).forEach(r => {
        partyOpeningBalances.set(r.id, (r.opening_to_take || 0));
    });
    (portalDirectory || []).forEach(p => {
        partyOpeningBalances.set(p.id, (p.opening_to_take || 0));
    });

    // 2. Per-Party Snapshots (Accurate even if mixed)
    const chronological = [...allTransactions].sort((a, b) => new Date(a.date.replace(" ", "T")).getTime() - new Date(b.date.replace(" ", "T")).getTime());
    const partyRunningBalances = new Map<string, number>(partyOpeningBalances);
    const snapshots = new Map();
    
    chronological.forEach(tx => {
      const currentPartyBal = partyRunningBalances.get(tx.partyId) || 0;
      const old = currentPartyBal;
      const newVal = old + (tx.debit - tx.credit);
      partyRunningBalances.set(tx.partyId, newVal);
      snapshots.set(tx.id, { old, new: newVal });
    });

    // 3. Report-level Running Balance (Global column)
    let totalInitial = 0;
    if (partyFilter !== "all" || portalFilter !== "all") {
        totalInitial = initialBalance;
    } else {
        // For 'All' view, start from 0 to track "Cash in Hand" (Inflow - Outflow)
        totalInitial = 0;
    }

    const isFilteredView = partyFilter !== "all" || portalFilter !== "all";
    let reportRunning = totalInitial; 
    const globalSnapshots = new Map<string, number>();
    chronological.forEach(tx => {
      reportRunning += isFilteredView ? (tx.debit - tx.credit) : (tx.credit - tx.debit);
      globalSnapshots.set(tx.id, reportRunning);
    });

    const totalCredit = allTransactions.reduce((s, c) => s + c.credit, 0);
    const totalDebit = allTransactions.reduce((s, d) => s + d.debit, 0);
    const netBalance = isFilteredView 
      ? (totalInitial + totalDebit - totalCredit) 
      : (totalCredit - totalDebit); 

  return (
    <div className="space-y-4 animate-fade-in pt-2">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm no-print space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Search</label>
            <input autoComplete="one-time-code" 
              type="text" 
              placeholder="Search party or staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Filter By Retailer/Bank</label>
            <select 
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
            >
              <option value="all">All Parties</option>
              {partyList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Filter By Portal</label>
            <select 
              value={portalFilter}
              onChange={(e) => setPortalFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
            >
              <option value="all">All Portals</option>
              {portalList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Transaction Type</label>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
            >
              <option value="all">All Types</option>
               <option value="collection">Cash In Only</option>
               <option value="deposit">Cash Out Only</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Staff</label>
            <select 
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
            >
              <option value="all">All Staff</option>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Date From</label>
            <input autoComplete="one-time-code" 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Date To</label>
            <input autoComplete="one-time-code" 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold outline-none"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Amount: High to Low</option>
            <option value="amount-asc">Amount: Low to High</option>
          </select>
          
          <div className="flex gap-2">
            <button 
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-slate-800 text-white text-[10px] font-black rounded-lg hover:bg-slate-900 transition-all"
            >
              PDF Report
            </button>
            <button 
              onClick={() => {
                const headers = ["Date Time", "Description", "Staff", "Opening Balance", "Received", "Balance"];
                const rows = allTransactions.map(tx => {
                    const snap = snapshots.get(tx.id) || { old: 0, new: 0 };
                    return [`"${tx.date}"`, `"${tx.party}"`, `"${tx.staff}"`, snap.old, tx.credit || -tx.debit, snap.new];
                });
                rows.push(["TOTAL", "", "", "", "", netBalance]);
                const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(csvContent));
                link.setAttribute("download", getExportFilename());
                link.click();
              }}
              className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-all"
            >
              Excel Export
            </button>
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm no-print space-y-4">
        {partyFilter !== "all" || portalFilter !== "all" ? (
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-2">
            <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">{partyFilter !== "all" ? partyFilter : portalFilter}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Account Statement Summary</p>
            </div>
            <div className="text-right flex gap-6">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block text-left">Opening To Take</span>
                <span className="text-xs font-black text-red-650 dark:text-red-400">
                  ₹{(() => {
                    const ret = (retailerDirectory || []).find(r => r.name === (partyFilter !== "all" ? partyFilter : portalFilter));
                    if (ret) return (ret.opening_to_take || 0);
                    const port = (portalDirectory || []).find(p => p.name === (partyFilter !== "all" ? partyFilter : portalFilter));
                    return port ? (port.opening_to_take || 0) : 0;
                  })().toLocaleString()}.00
                </span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block text-left">Opening To Give</span>
                <span className="text-xs font-black text-emerald-650 dark:text-emerald-500">
                  ₹{(() => {
                    const ret = (retailerDirectory || []).find(r => r.name === (partyFilter !== "all" ? partyFilter : portalFilter));
                    if (ret) return (ret.opening_to_give || 0);
                    const port = (portalDirectory || []).find(p => p.name === (partyFilter !== "all" ? partyFilter : portalFilter));
                    return port ? (port.opening_to_give || 0) : 0;
                  })().toLocaleString()}.00
                </span>
              </div>
            </div>
          </div>
        ) : null}
        
        <div className="grid grid-cols-3 gap-0 divide-x divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/50 text-center">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Total Debit(-)</span>
            <span className="text-sm font-black text-red-600">₹{totalDebit.toLocaleString()}.00</span>
          </div>
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/50 text-center">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Total Credit(+)</span>
            <span className="text-sm font-black text-emerald-600">₹{totalCredit.toLocaleString()}.00</span>
          </div>
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/50 text-center">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Net Balance</span>
            <span className={`text-sm font-black ${netBalance >= 0 ? "text-blue-600" : "text-emerald-600"}`}>
              ₹{Math.abs(netBalance).toLocaleString()}.00 {netBalance >= 0 ? "Dr" : "Cr"}
            </span>
          </div>
        </div>
      </div>

      {/* Khatabook Style Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm print-area">
        <div className="hidden print:block p-8 text-center border-b border-slate-100">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">CrediiFlow</h1>
          <p className="text-xs font-bold text-slate-500 mt-1">Official Account Statement</p>
          <div className="flex items-center justify-center gap-10 mt-8 border-y py-6">
             <div className="text-center">
                <span className="text-[10px] block uppercase text-slate-400 font-black mb-1">Total Debit</span>
                <span className="text-xl font-black text-red-600">₹{totalDebit.toLocaleString()}.00</span>
             </div>
             <div className="text-center border-x px-10">
                <span className="text-[10px] block uppercase text-slate-400 font-black mb-1">Total Credit</span>
                <span className="text-xl font-black text-emerald-600">₹{totalCredit.toLocaleString()}.00</span>
             </div>
             <div className="text-center">
                <span className="text-[10px] block uppercase text-slate-400 font-black mb-1">Net Balance</span>
                <span className={`text-xl font-black ${netBalance >= 0 ? "text-blue-600" : "text-emerald-600"}`}>
                  ₹{Math.abs(netBalance).toLocaleString()}.00 {netBalance >= 0 ? "Dr" : "Cr"}
                </span>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-tight text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 border-r border-slate-100 dark:border-slate-800 w-32">Date & Time</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800">Description</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800 text-right w-24">Opening Balance</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800 text-right bg-slate-100/50 dark:bg-slate-800/50 w-24">Received</th>
                <th className="p-4 text-right bg-blue-50/20 dark:bg-blue-950/5 w-24">Party Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {allTransactions.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic font-bold">No entries match your filters.</td></tr>
              ) : allTransactions.map((tx) => {
                const txNew = tx.balance_snapshot !== undefined ? tx.balance_snapshot : (snapshots.get(tx.id)?.new || 0);
                const txOld = tx.balance_snapshot !== undefined 
                    ? (tx.type === 'collection' ? Number(txNew) + Number(tx.credit) : Number(txNew) - Number(tx.debit)) 
                    : (snapshots.get(tx.id)?.old || 0);

                const isExpanded = expandedTxId === tx.id;
                const den = tx.rawRecord?.denominations || {};
                const txAmount = tx.credit || tx.debit || 0;
                return (
                <React.Fragment key={tx.id}>
                <tr className={`hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50 dark:bg-slate-900/60' : ''}`} onClick={() => setExpandedTxId(prev => prev === tx.id ? null : tx.id)}>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800 font-bold text-slate-400">
                    <div className="flex flex-col">
                      <span className="whitespace-nowrap">{tx.date.split(" ")[0].split("-").reverse().join("-")}</span>
                      <span className="text-[9px] font-medium opacity-60">
                        {(() => {
                          const timePart = tx.date.split(" ")[1];
                          if (!timePart) return "";
                          const parts = timePart.split(":");
                          let hour = Number(parts[0]);
                          const min = Number(parts[1]);
                          const ampm = hour >= 12 ? 'PM' : 'AM';
                          hour = hour % 12 || 12;
                          return `${hour}:${min.toString().padStart(2, '0')} ${ampm}`;
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-850 dark:text-slate-100 uppercase">
                              {tx.type === 'collection' && tx.party?.toLowerCase().startsWith("cms")
                                ? `${tx.party} - ${tx.store_name || "Direct"}`
                                : tx.party}
                            </span>
                            {tx.store_name && !tx.party?.toLowerCase().startsWith("cms") && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">({tx.store_name})</span>
                            )}
                            {tx.depositType === 'virtual' && (
                              <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 uppercase tracking-wider">Virtual</span>
                            )}
                            {tx.type === 'collection' && tx.party?.toLowerCase().startsWith("cms") && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setCmsRemarksExpanded(prev => ({ ...prev, [tx.id]: !prev[tx.id] })); }}
                                className="p-0.5 bg-slate-50 dark:bg-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                                title="View Remark"
                              >
                                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[tx.id] ? 'rotate-180 text-indigo-500' : ''}`} />
                              </button>
                            )}
                          </div>
                          {tx.type === 'collection' && tx.party?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[tx.id] && (
                            <div className="mt-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-200/50 dark:border-slate-800 text-[9px] font-medium text-slate-605 dark:text-slate-400 max-w-[250px] break-words">
                              <span className="text-[7.5px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                              <span className="italic">{tx.rawRecord?.remarks || "no remark"}</span>
                            </div>
                          )}
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">By {tx.staff}</span>
                      </div>
                      <div className="flex items-center gap-1.5 no-print" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (tx.type === 'collection') {
                              shareCollectionEntry(tx.rawRecord, tx.staff || 'Staff');
                            } else {
                              shareDepositEntry(tx.rawRecord, tx.staff || 'Staff');
                            }
                          }}
                          className="p-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded hover:bg-emerald-100 transition-colors cursor-pointer active:scale-95"
                          title="Share Entry"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStartEditCollection(tx)}
                          className="p-1 bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 rounded hover:bg-blue-100 transition-colors cursor-pointer active:scale-95 transition-transform"
                          title="Edit Entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(tx)}
                          className="p-1 bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 rounded hover:bg-red-100 transition-colors cursor-pointer active:scale-95 transition-transform"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </td>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800 text-right font-bold text-slate-500">
                    ₹{txOld.toLocaleString()}
                  </td>
                  <td className={`p-4 border-r border-slate-50 dark:border-slate-800 text-right font-black ${tx.type === 'collection' ? 'text-emerald-700 bg-emerald-50/10' : 'text-red-700 bg-red-50/10'}`}>
                    {tx.type === 'collection' ? '+' : '-'}₹{(tx.credit || tx.debit).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-black text-blue-700 bg-blue-50/10 dark:bg-blue-950/5">
                    ₹{txNew.toLocaleString()}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${tx.id}-expand`} className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800">
                    <td colSpan={5} className="px-6 pb-4 pt-2">
                      <div className="flex flex-wrap gap-4 items-start">
                        <div>
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cash Breakdown</span>
                          <div className="grid grid-cols-3 gap-x-6 gap-y-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {Number(den.note_500) > 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                            {Number(den.note_200) > 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                            {Number(den.note_100) > 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                            {Number(den.note_50) > 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                            {Number(den.note_20) > 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                            {Number(den.note_10) > 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                            {Number(den.coins) > 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                            {Number(den.online_amount) > 0 && <span>UPI/Online = ₹{Number(den.online_amount).toLocaleString()}</span>}
                            {!den.note_500 && !den.note_200 && !den.note_100 && !den.note_50 && !den.note_20 && !den.note_10 && !den.coins && !den.online_amount && <span className="text-slate-400 italic">No breakdown available</span>}
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">Amount in Words</span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 italic">{numberToWordsIndian(txAmount)} Rupees</span>
                        </div>
                      </div>
                      {tx.rawRecord?.remarks && (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500">
                          <span className="text-[8px] uppercase font-black text-slate-400 mr-2">Remarks:</span>
                          <span className="italic">{tx.rawRecord.remarks}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
            {allTransactions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-800">
                  <td colSpan={3} className="p-4 text-right text-slate-500 uppercase tracking-wide text-[10px]">Grand Total</td>
                  <td className="p-4 text-right border-r border-slate-200 dark:border-slate-800 bg-slate-100/50">
                    <div className="flex flex-col items-end gap-1 text-[11px] whitespace-nowrap">
                      {totalCredit > 0 && (
                        <div className="flex justify-between w-full max-w-[120px]">
                          <span className="text-slate-500 font-normal">Total In:</span>
                          <span className="text-emerald-700 ml-2 font-bold">+₹{totalCredit.toLocaleString()}</span>
                        </div>
                      )}
                      {totalDebit > 0 && (
                        <div className="flex justify-between w-full max-w-[120px]">
                          <span className="text-slate-500 font-normal">Total Out:</span>
                          <span className="text-red-700 ml-2 font-bold">-₹{totalDebit.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right text-slate-900 dark:text-white bg-slate-200/50">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Final Net</span>
                      <span className={`text-sm font-black ${netBalance >= 0 ? "text-blue-700" : "text-emerald-700"}`}>
                        ₹{Math.abs(netBalance).toLocaleString()}.00 {netBalance >= 0 ? "Dr" : "Cr"}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {isEditCollectionModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                    <select
                      value={selectedNewRetailerId}
                      onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                    >
                      <option value="">No Retailer</option>
                      {retailerDirectory.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Portal Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Portal Channel</label>
                    <select
                      value={selectedNewPortalId}
                      onChange={(e) => setSelectedNewPortalId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                    >
                      <option value="">None / Cash</option>
                      {portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.portal_name} ({p.bank_name})</option>
                      ))}
                    </select>
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
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setSelectedNewDenoms(prev => ({ ...prev, [item.key]: val }));
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
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
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setSelectedNewDenoms(prev => ({ ...prev, coins: val }));
                          }}
                          className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400">UPI / Online Amount</label>
                        <input autoComplete="one-time-code"
                          type="number"
                          value={selectedNewDenoms.online_amount}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setSelectedNewDenoms(prev => ({ ...prev, online_amount: val }));
                          }}
                          className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
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

                  {/* Remarks */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                    <textarea
                      value={selectedNewRemarks}
                      onChange={(e) => setSelectedNewRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
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
                      value={selectedNewDepositType}
                      onChange={(e) => setSelectedNewDepositType(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                    >
                      <option value="portal">Portal Bank Deposit</option>
                      <option value="retailer">Retailer Payout</option>
                      <option value="staff">Staff/Office Handover</option>
                      <option value="virtual">Virtual Limit Transfer</option>
                    </select>
                  </div>

                  {/* Target Fields depending on deposit type */}
                  {selectedNewDepositType === "portal" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Portal</label>
                      <select
                        value={selectedNewPortalId}
                        onChange={(e) => setSelectedNewPortalId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      >
                        <option value="">Select Portal Bank Account</option>
                        {portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.portal_name} ({p.bank_name})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedNewDepositType === "retailer" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Retailer</label>
                      <select
                        value={selectedNewRetailerId}
                        onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      >
                        <option value="">Select Retailer</option>
                        {retailerDirectory.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
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
                          <select
                            value={selectedNewRecipientStaffId}
                            onChange={(e) => setSelectedNewRecipientStaffId(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                          >
                            <option value="">Select Staff Member</option>
                            {(adminContext.userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {selectedNewDepositType === "virtual" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Source Portal</label>
                        <select
                          value={selectedNewPortalId}
                          onChange={(e) => setSelectedNewPortalId(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                        >
                          <option value="">Select Portal Bank Account</option>
                          {portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.portal_name} ({p.bank_name})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Retailer</label>
                        <select
                          value={selectedNewRetailerId}
                          onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                        >
                          <option value="">Select Retailer</option>
                          {retailerDirectory.map((r: any) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Payment Mode */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Payment Mode</label>
                    <select
                      value={selectedNewPaymentMode}
                      onChange={(e) => setSelectedNewPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                      <option value="refund">Refund (Virtual only)</option>
                    </select>
                  </div>

                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Amount</label>
                    <input autoComplete="one-time-code"
                      type="number"
                      value={selectedNewAmount}
                      onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold focus:outline-none dark:text-white"
                      placeholder="Optional"
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
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingCollection ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
