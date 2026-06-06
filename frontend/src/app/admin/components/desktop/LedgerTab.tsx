"use client";

import React, { useEffect } from "react";
import { useAdmin } from "../../context/AdminContext";

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
      portal: c.portalName,
      staff: c.staffName || "Admin",
      debit: 0,
      credit: c.totalAmount,
      balance_snapshot: c.balance_snapshot,
      type: 'collection',
      depositType: null
    })),
    ...(deposits || []).map(d => {
      const isRef = d.isRefund === true;
      return {
        id: d.id,
        date: d.date,
        partyId: d.portal_id || d.retailer_id,
        party: d.portalGroupId ? `${d.portalGroupName} (${d.targetName})` : d.targetName,
        portal: d.targetName, 
        staff: d.staffName || "Admin",
        debit: isRef ? 0 : d.amount,
        credit: isRef ? d.amount : 0,
        balance_snapshot: d.balance_snapshot,
        type: isRef ? 'collection' : 'deposit',
        depositType: d.depositType
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
      tx.staff.toLowerCase().includes(q)
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
      if (isFilteredView || tx.depositType !== 'virtual') {
        reportRunning += isFilteredView ? (tx.debit - tx.credit) : (tx.credit - tx.debit);
      }
      globalSnapshots.set(tx.id, reportRunning);
    });

    const totalCredit = allTransactions.reduce((s, c) => s + c.credit, 0);
    const totalDebit = allTransactions.reduce((s, d) => s + ((!isFilteredView && d.depositType === 'virtual') ? 0 : d.debit), 0);
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
            <input 
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
            <input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Date To</label>
            <input 
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
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">Do It Services</h1>
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

                return (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
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
                    <div className="flex flex-col">
                        <span className="font-extrabold text-slate-850 dark:text-slate-100 uppercase">{tx.party}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">By {tx.staff}</span>
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
    </div>
  );
}
