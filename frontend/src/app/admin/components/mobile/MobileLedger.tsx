"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar,
  User,
  History,
  Download,
  FileText,
  Table as TableIcon,
  X,
  Edit2,
  Save,
  Trash2,
  ChevronDown,
  Share2
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { format } from "date-fns";
import MobileFilterDrawer from "./MobileFilterDrawer";
import { api } from "../../../utils/api";
import { numberToWordsIndian, shareCollectionEntry, shareDepositEntry } from "../../../utils/shareHelper";

export default function MobileLedger() {
  const { collections, deposits, retailerDirectory, portalDirectory, fetchData, showToastNotification, userDirectory } = useAdmin();
  const [search, setSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = useState<Record<string, boolean>>({});
  const [expandedLedgerId, setExpandedLedgerId] = useState<string | null>(null);

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);
  const [editingIsDeposit, setEditingIsDeposit] = useState(false);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
  const [selectedNewPortalId, setSelectedNewPortalId] = useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = useState("");
  const [selectedNewAmount, setSelectedNewAmount] = useState(0);
  const [selectedNewDate, setSelectedNewDate] = useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = useState("");
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

  const handleStartEditCollection = (item: any) => {
    const isDeposit = item.depositType != null || item.deposit_type != null;
    setEditingIsDeposit(isDeposit);
    setEditingCollection(item);
    
    setSelectedNewRetailerId(item.retailer_id || "");
    setSelectedNewPortalId(item.portal_id || "");
    setSelectedNewRemarks(item.remarks || "");
    
    if (isDeposit) {
      setSelectedNewDepositType(item.deposit_type || item.depositType || "virtual");
      setSelectedNewPaymentMode(item.payment_mode || item.paymentMode || "online");
      setSelectedNewAmount(Number(item.amount || 0));
      setSelectedNewDate(item.deposit_date ? item.deposit_date : (item.date || "").split(" ")[0]);
      setSelectedNewRefNo(item.reference_no || "");
      setSelectedNewRecipientStaffId(item.recipient_staff_id || "");
      setSelectedNewToOffice(item.to_office === true);
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

  const handleDeleteEntry = async (item: any) => {
    if (!window.confirm("Are you sure you want to delete this ledger entry? This will permanently delete the entry and recalculate all following balances.")) {
      return;
    }
    try {
      const isDeposit = item.depositType != null || item.deposit_type != null;
      if (isDeposit) {
        await api.deleteDeposit(item.id);
      } else {
        await api.deleteCollection(item.id);
      }
      showToastNotification("Entry deleted successfully.");
      await fetchData();
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
      showToastNotification("Entry updated successfully.");
      setIsEditCollectionModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };
  
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    staff: 'all',
    type: 'all',
    party: 'all',
    portal: 'all',
    sortBy: 'date-desc'
  });

  // Get unique lists for filters
  const staffList = useMemo(() => {
    return Array.from(new Set([
      ...(collections || []).map(c => c.staffName),
      ...(deposits || []).map(d => d.staffName)
    ].filter(Boolean))).sort() as string[];
  }, [collections, deposits]);

  const partyList = useMemo(() => {
    return (retailerDirectory || []).map((r: any) => r.name).sort();
  }, [retailerDirectory]);

  const portalList = useMemo(() => {
    return (portalDirectory || []).map((p: any) => p.name).sort();
  }, [portalDirectory]);

  // Combine and Apply ALL Filters
  const filteredLedger = useMemo(() => {
    let combined = [
      ...(collections || []).map(c => ({ 
        ...c, 
        type: 'collection',
        party: c.retailerName,
        portal: c.portalName,
        staff: c.staffName || "Admin"
      })),
      ...(deposits || []).map(d => {
        const isVirtual = d.depositType === 'virtual';
        let party = d.portalGroupId ? `${d.portalGroupName} (${d.targetName})` : d.targetName;
        if (isVirtual && d.retailer_id) {
          const ret = (retailerDirectory || []).find((r: any) => r.id === d.retailer_id);
          party = ret?.name || d.targetName;
        }
        return {
          ...d, 
          type: d.isRefund === true ? 'collection' : 'deposit',
          party,
          portal: isVirtual ? (d.portalGroupName || d.portalName || d.targetName) : d.targetName, 
          staff: d.staffName || "Admin"
        };
      })
    ];

    // Apply Search
    if (search) {
      const q = search.toLowerCase();
      combined = combined.filter(tx => 
        (tx.party || tx.portal || tx.staff || "").toLowerCase().includes(q)
      );
    }

    // Apply Filters
    if (filters.staff !== 'all') combined = combined.filter(tx => tx.staff === filters.staff);
    if (filters.party !== 'all') combined = combined.filter(tx => tx.party === filters.party);
    if (filters.portal !== 'all') combined = combined.filter(tx => tx.portal === filters.portal);
    if (filters.type !== 'all') combined = combined.filter(tx => tx.type === filters.type);

    // Apply Date Range
    if (filters.dateFrom) {
      combined = combined.filter(tx => format(new Date(tx.created_at || tx.date), 'yyyy-MM-dd') >= filters.dateFrom);
    }
    if (filters.dateTo) {
      combined = combined.filter(tx => format(new Date(tx.created_at || tx.date), 'yyyy-MM-dd') <= filters.dateTo);
    }

    // Apply Sorting
    combined.sort((a, b) => {
      if (filters.sortBy === "date-desc") return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
      if (filters.sortBy === "date-asc") return new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime();
      if (filters.sortBy === "amount-desc") return getTxAmount(b) - getTxAmount(a);
      if (filters.sortBy === "amount-asc") return getTxAmount(a) - getTxAmount(b);
      return 0;
    });

    return combined;
  }, [collections, deposits, search, filters]);

  // Helper: get display amount regardless of field name
  const getTxAmount = (tx: any) => tx.totalAmount ?? tx.amount ?? 0;

  const handleExportCSV = () => {
    const headers = ["Date", "Description", "Staff", "Type", "Received"];
    const rows = filteredLedger.map(tx => [
      format(new Date(tx.created_at || tx.date), "yyyy-MM-dd HH:mm"),
      tx.party || 'N/A',
      tx.staff || 'Admin',
      tx.type,
      getTxAmount(tx)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Ledger_Export_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.click();
    setIsExportOpen(false);
  };

  return (
    <div className="space-y-2.5">
      {/* Header Section */}
      <div className="flex items-center justify-between px-1.5">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ledger</h2>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{filteredLedger.length} Records Found</p>
        </div>
        <div className="flex gap-1.5">
          <button 
            onClick={() => setIsExportOpen(true)}
            className="w-7 h-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md flex items-center justify-center text-slate-505 shadow-xs active:scale-90 transition-transform"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-1.5 px-1.5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input autoComplete="one-time-code" 
            type="text" 
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md text-xs font-bold shadow-xs focus:outline-none"
          />
        </div>
        <button 
          onClick={() => setIsFilterOpen(true)}
          className={`p-1.5 rounded-md border transition-all active:scale-90 ${isFilterOpen ? 'bg-blue-650 border-blue-650 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}
        >
          <Filter className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Transaction List (Table Format) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[9.5px] border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-[8px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="py-1.5 px-2 border-r border-slate-100 dark:border-slate-800 w-24">Date & Time</th>
                <th className="py-1.5 px-2 border-r border-slate-100 dark:border-slate-800">Description</th>
                <th className="py-1.5 px-2 border-r border-slate-100 dark:border-slate-800 text-center w-16">Type</th>
                <th className="py-1.5 px-2 border-r border-slate-100 dark:border-slate-800 text-right w-20 bg-slate-100/50 dark:bg-slate-800/50">Received</th>
                <th className="py-1.5 px-2 text-right bg-blue-50/20 dark:bg-blue-950/5 w-20">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLedger.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400 italic font-bold">No matching records</td></tr>
              ) : filteredLedger.map((item: any, idx) => {
                const isExpanded = expandedLedgerId === (item.id || idx);
                const den = item.denominations || {};
                const txAmount = getTxAmount(item);
                return (
                <React.Fragment key={item.id || idx}>
                <tr className={`hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50 dark:bg-slate-900/60' : ''}`} onClick={() => setExpandedLedgerId(prev => prev === (item.id || idx) ? null : (item.id || idx))}>
                  <td className="py-1 px-2 border-r border-slate-50 dark:border-slate-800 font-bold text-slate-400">
                    <div className="flex flex-col">
                      <span className="whitespace-nowrap">{format(new Date(item.created_at || item.date), "dd-MM-yyyy")}</span>
                      <span className="text-[7.5px] font-bold opacity-60">
                        {format(new Date(item.created_at || item.date), "HH:mm")}
                      </span>
                    </div>
                  </td>
                  <td className="py-1 px-2 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-805 dark:text-slate-100 uppercase">
                            {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms")
                              ? `${item.party} - ${item.store_name || "Direct"}`
                              : item.party || 'General Entry'}
                          </span>
                          {item.store_name && !(item.type === 'collection' && item.party?.toLowerCase().startsWith("cms")) && (
                            <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold">({item.store_name})</span>
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
                        <div className="flex items-center gap-1 no-print" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              if (item.type === 'collection') {
                                shareCollectionEntry(item, item.staff || 'Staff');
                              } else {
                                shareDepositEntry(item, item.staff || 'Staff');
                              }
                            }}
                            className="p-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-955/20 dark:text-emerald-400 rounded hover:bg-emerald-100 transition-colors cursor-pointer active:scale-95"
                            title="Share Entry"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleStartEditCollection(item)}
                            className="p-0.5 bg-blue-50 text-blue-600 dark:bg-blue-955/20 dark:text-blue-400 rounded hover:bg-blue-100 transition-colors cursor-pointer active:scale-95 transition-transform"
                            title="Edit Entry"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(item)}
                            className="p-0.5 bg-red-50 text-red-650 dark:bg-red-955/20 dark:text-red-400 rounded hover:bg-red-100 transition-colors cursor-pointer active:scale-95 transition-transform"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {item.type === 'collection' && item.party?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[item.id] && (
                        <div className="mt-0.5 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-200/50 dark:border-slate-800 text-[8px] font-medium text-slate-600 dark:text-slate-400 max-w-[200px] break-words">
                          <span className="text-[7px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                          <span className="italic">{item.remarks || "no remark"}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-1 px-2 border-r border-slate-50 dark:border-slate-800 text-center">
                     <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded-md ${item.type === 'collection' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {item.type === 'collection' ? 'Cash In' : 'Cash Out'}
                     </span>
                  </td>
                  <td className={`py-1 px-2 border-r border-slate-50 dark:border-slate-800 text-right font-black ${item.type === 'collection' ? 'text-emerald-700 bg-emerald-50/10' : 'text-red-700 bg-red-50/10'}`}>
                    {item.type === 'collection' ? '+' : '-'}₹{getTxAmount(item).toLocaleString()}
                  </td>
                  <td className="py-1 px-2 text-right font-bold text-slate-500 uppercase text-[8px]">
                    {item.staff || 'Admin'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${item.id || idx}-exp`} className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800">
                    <td colSpan={5} className="px-3 pb-2 pt-1">
                      <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cash Breakdown</span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8px] font-bold text-slate-600 dark:text-slate-300">
                        {Number(den.note_500) > 0 && <span>₹500 × {den.note_500} = ₹{(Number(den.note_500)*500).toLocaleString()}</span>}
                        {Number(den.note_200) > 0 && <span>₹200 × {den.note_200} = ₹{(Number(den.note_200)*200).toLocaleString()}</span>}
                        {Number(den.note_100) > 0 && <span>₹100 × {den.note_100} = ₹{(Number(den.note_100)*100).toLocaleString()}</span>}
                        {Number(den.note_50) > 0 && <span>₹50 × {den.note_50} = ₹{(Number(den.note_50)*50).toLocaleString()}</span>}
                        {Number(den.note_20) > 0 && <span>₹20 × {den.note_20} = ₹{(Number(den.note_20)*20).toLocaleString()}</span>}
                        {Number(den.note_10) > 0 && <span>₹10 × {den.note_10} = ₹{(Number(den.note_10)*10).toLocaleString()}</span>}
                        {Number(den.coins) > 0 && <span>Coins = ₹{Number(den.coins).toFixed(2)}</span>}
                        {Number(den.online_amount) > 0 && <span>UPI = ₹{Number(den.online_amount).toLocaleString()}</span>}
                      </div>
                      <div className="mt-1 text-[8px] font-bold text-slate-500 italic">{numberToWordsIndian(txAmount)} Rupees</div>
                      {item.remarks && <div className="mt-1 text-[8px] font-bold text-slate-400"><span className="font-black uppercase">Remark: </span>{item.remarks}</div>}
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Drawer */}
      <MobileFilterDrawer 
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        staffList={staffList}
        partyList={partyList}
        portalList={portalList}
        filters={filters}
        setFilters={setFilters}
      />

      {/* Export Options Bottom Sheet */}
      {isExportOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-955/20 backdrop-blur-xs" onClick={() => setIsExportOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-lg p-3 animate-in slide-in-from-bottom-full duration-255">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Export Ledger</h3>
                <button onClick={() => setIsExportOpen(false)} className="w-7 h-7 bg-slate-105 dark:bg-slate-800 rounded-md flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
               <button 
                 onClick={handleExportCSV}
                 className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex flex-col items-center gap-1.5 border border-slate-100 dark:border-slate-700 active:scale-95 transition-transform"
               >
                 <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 rounded-md flex items-center justify-center"><TableIcon className="w-4.5 h-4.5" /></div>
                 <span className="text-[8px] font-black uppercase text-slate-600 dark:text-slate-300">Excel Format</span>
               </button>
               <button 
                 onClick={() => { window.print(); setIsExportOpen(false); }}
                 className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex flex-col items-center gap-1.5 border border-slate-100 dark:border-slate-700 active:scale-95 transition-transform"
               >
                 <div className="w-8 h-8 bg-red-500/10 text-red-600 rounded-md flex items-center justify-center"><FileText className="w-4.5 h-4.5" /></div>
                 <span className="text-[8px] font-black uppercase text-slate-600 dark:text-slate-300">PDF Document</span>
               </button>
            </div>
          </div>
        </div>
      )}

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
                    <select
                      value={selectedNewRetailerId}
                      onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                    >
                      <option value="">No Retailer</option>
                      {retailerDirectory.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Portal Select */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Portal Channel</label>
                    <select
                      value={selectedNewPortalId}
                      onChange={(e) => setSelectedNewPortalId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                    >
                      <option value="">None / Cash</option>
                      {portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.portal_name} ({p.bank_name})</option>
                      ))}
                    </select>
                  </div>

                  {/* Denominations editor for Collection */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                    <span className="text-[8px] text-slate-400 font-black uppercase block">Denominations</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                      {[
                        { label: "₹500 Notes", key: "note_500", factor: 500 },
                        { label: "₹200 Notes", key: "note_200", factor: 200 },
                        { label: "₹100 Notes", key: "note_100", factor: 100 },
                        { label: "₹50 Notes", key: "note_50", factor: 50 },
                        { label: "₹20 Notes", key: "note_20", factor: 20 },
                        { label: "₹10 Notes", key: "note_10", factor: 10 },
                      ].map(item => (
                        <div key={item.key} className="flex flex-col gap-0.5">
                          <label className="text-[8px] font-bold text-slate-400">{item.label}</label>
                          <input autoComplete="one-time-code"
                            type="number"
                            value={selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setSelectedNewDenoms(prev => ({ ...prev, [item.key]: val }));
                            }}
                            className="px-1.5 py-0.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-black"
                          />
                        </div>
                      ))}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[8px] font-bold text-slate-400">Coins Sum</label>
                        <input autoComplete="one-time-code"
                          type="number"
                          step="0.01"
                          value={selectedNewDenoms.coins}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setSelectedNewDenoms(prev => ({ ...prev, coins: val }));
                          }}
                          className="px-1.5 py-0.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-black"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[8px] font-bold text-slate-400">UPI / Online Amount</label>
                        <input autoComplete="one-time-code"
                          type="number"
                          value={selectedNewDenoms.online_amount}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setSelectedNewDenoms(prev => ({ ...prev, online_amount: val }));
                          }}
                          className="px-1.5 py-0.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-black"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated total amount */}
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Total Amount (Calculated)</label>
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
                      className="w-full px-2 py-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black text-slate-800 dark:text-slate-100"
                      readOnly
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
                      value={selectedNewDepositType}
                      onChange={(e) => setSelectedNewDepositType(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                    >
                      <option value="portal">Portal Bank Deposit</option>
                      <option value="retailer">Retailer Payout</option>
                      <option value="staff">Staff/Office Handover</option>
                      <option value="virtual">Virtual Limit Transfer</option>
                    </select>
                  </div>

                  {/* Target Fields depending on deposit type */}
                  {selectedNewDepositType === "portal" && (
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Target Portal</label>
                      <select
                        value={selectedNewPortalId}
                        onChange={(e) => setSelectedNewPortalId(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                      >
                        <option value="">Select Portal Bank Account</option>
                        {portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.portal_name} ({p.bank_name})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedNewDepositType === "retailer" && (
                    <div className="space-y-0.5">
                      <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Target Retailer</label>
                      <select
                        value={selectedNewRetailerId}
                        onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
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
                          <select
                            value={selectedNewRecipientStaffId}
                            onChange={(e) => setSelectedNewRecipientStaffId(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                          >
                            <option value="">Select Staff Member</option>
                            {(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {selectedNewDepositType === "virtual" && (
                    <>
                      <div className="space-y-0.5">
                        <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Source Portal</label>
                        <select
                          value={selectedNewPortalId}
                          onChange={(e) => setSelectedNewPortalId(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                        >
                          <option value="">Select Portal Bank Account</option>
                          {portalDirectory.flatMap((group: any) => group.portals || []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.portal_name} ({p.bank_name})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Target Retailer</label>
                        <select
                          value={selectedNewRetailerId}
                          onChange={(e) => setSelectedNewRetailerId(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
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
                  <div className="space-y-0.5">
                    <label className="text-[8px] text-slate-400 font-black uppercase block ml-0.5">Payment Mode</label>
                    <select
                      value={selectedNewPaymentMode}
                      onChange={(e) => setSelectedNewPaymentMode(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-black focus:outline-none dark:text-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                      <option value="refund">Refund (Virtual only)</option>
                    </select>
                  </div>

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

      <div className="h-2" />
    </div>
  );
}
