"use client";

import React from "react";
import { Search, Download, X, CheckCircle2, Edit, Trash2, ChevronDown, Save } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import InlineSelect from "../../../components/InlineSelect";

interface CollectionsTabProps {
  collections: any[];
  showToastNotification?: (msg: string) => void;
  fetchData?: () => void;
}

export default function CollectionsTab({
  collections,
  showToastNotification,
  fetchData
}: CollectionsTabProps) {
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<string | null>(null);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editAmount, setEditAmount] = React.useState(0);
  const [editRemarks, setEditRemarks] = React.useState("");
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = React.useState<Record<string, boolean>>({});
  
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [staffFilter, setStaffFilter] = React.useState("all");
  const [retailerFilter, setRetailerFilter] = React.useState("all");
  const [bankAccountFilter, setBankAccountFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("date-desc");

  const { retailerDirectory, portalDirectory, userDirectory } = useAdmin();

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = React.useState(false);
  const [editingCollection, setEditingCollection] = React.useState<any | null>(null);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = React.useState("");
  const [selectedNewStoreId, setSelectedNewStoreId] = React.useState("");
  const [availableStores, setAvailableStores] = React.useState<any[]>([]);
  const [selectedNewBankAccountId, setSelectedNewBankAccountId] = React.useState("");
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
    setEditingCollection(item);
    setSelectedNewRetailerId(item.retailer_id || item.retailerId || "");
    setSelectedNewStoreId(item.store_id || item.storeId || "");
    setSelectedNewBankAccountId(item.bank_account_id || item.bankAccountId || "");
    setSelectedNewRemarks(item.remarks || "");
    
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
    setSelectedCollectionId(null);
  };

  const handleSaveCollectionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    setIsSavingCollection(true);
    
    try {
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
        bank_account_id: selectedNewBankAccountId || null,
        store_id: selectedNewStoreId || null,
        total_amount: computedCollectionTotal,
        remarks: selectedNewRemarks || "",
        denominations: selectedNewDenoms
      });
      if (showToastNotification) showToastNotification("Cash In updated successfully.");
      setIsEditCollectionModalOpen(false);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

  // Get unique lists
  const staffList = Array.from(new Set((collections || []).map(c => c.staffName).filter(Boolean))).sort();
  const retailerList = Array.from(new Set((collections || []).map(c => c.retailerName).filter(Boolean))).sort();
  const bankAccountList = Array.from(new Set((collections || []).map(c => c.bankAccountName).filter(Boolean))).sort();

  // Apply Filter Logic
  let filtered = (collections || []).map(c => ({
    ...c,
    staff: c.staffName || "Admin"
  }));

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      (c.retailerName || "").toLowerCase().includes(q) || 
      (c.bankAccountName || "").toLowerCase().includes(q) ||
      (c.store_name || "").toLowerCase().includes(q) ||
      (c.remarks || "").toLowerCase().includes(q) ||
      (c.staff || "").toLowerCase().includes(q) ||
      String(c.totalAmount || "").includes(q)
    );
  }

  if (staffFilter !== "all") filtered = filtered.filter(c => c.staff === staffFilter);
  if (retailerFilter !== "all") filtered = filtered.filter(c => c.retailerName === retailerFilter);
  if (bankAccountFilter !== "all") filtered = filtered.filter(c => c.bankAccountName === bankAccountFilter);

  if (dateFrom) filtered = filtered.filter(c => c.date >= dateFrom);
  if (dateTo) filtered = filtered.filter(c => c.date.split(' ')[0] <= dateTo);

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === "date-desc") return new Date(b.date.replace(" ", "T")).getTime() - new Date(a.date.replace(" ", "T")).getTime();
    if (sortBy === "date-asc") return new Date(a.date.replace(" ", "T")).getTime() - new Date(b.date.replace(" ", "T")).getTime();
    if (sortBy === "amount-desc") return b.totalAmount - a.totalAmount;
    if (sortBy === "amount-asc") return a.totalAmount - b.totalAmount;
    return 0;
  });

  const grandTotal = filtered.reduce((s, c) => s + c.totalAmount, 0);
  const currentSelection = (collections || []).find(c => c.id === selectedCollectionId);

  const handleVerify = async () => {
    if (!selectedCollectionId) return;
    try {
      await api.verifyCollection(selectedCollectionId);
      if (showToastNotification) showToastNotification("Cash In verified!");
      setSelectedCollectionId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Verification failed: " + err.message);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollectionId || !currentSelection) return;
    try {
      // Need to structure denominations correctly for the backend
      const updatedDenoms = {
        ...(currentSelection.denominations || {}),
        online_amount: editAmount // We'll put the edited amount here if they just changed the total
      };

      await api.updateCollection(selectedCollectionId, {
        total_amount: editAmount,
        remarks: editRemarks,
        retailer_id: currentSelection.retailer_id,
        denominations: updatedDenoms
      });
      if (showToastNotification) showToastNotification("Cash In updated!");
      setIsEditMode(false);
      setSelectedCollectionId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Update failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4 select-none">
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-4 no-print space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Search</label>
            <input autoComplete="one-time-code" 
              type="text" 
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Retailer</label>
            <InlineSelect 
              value={retailerFilter}
              onChange={setRetailerFilter}
              options={[
                { value: "all", label: "All Retailers" },
                ...retailerList.map(r => ({ value: r, label: r }))
              ]}
              placeholder="All Retailers"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">BankAccount</label>
            <InlineSelect 
              value={bankAccountFilter}
              onChange={setBankAccountFilter}
              options={[
                { value: "all", label: "All Portals" },
                ...bankAccountList.map(p => ({ value: p, label: p }))
              ]}
              placeholder="All Portals"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Staff</label>
            <InlineSelect 
              value={staffFilter}
              onChange={setStaffFilter}
              options={[
                { value: "all", label: "All Staff" },
                ...staffList.map(s => ({ value: s, label: s }))
              ]}
              placeholder="All Staff"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
           <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Date From</label>
            <input autoComplete="one-time-code" 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-[10px] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Date To</label>
            <input autoComplete="one-time-code" 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-[10px] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Sort By</label>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs outline-none"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex gap-4">
             <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-sm">
                <span className="text-[9px] uppercase font-black text-blue-500 block">Total Cash In</span>
                <span className="text-sm font-black text-blue-600 font-mono tabular-nums">₹{grandTotal.toLocaleString()}.00</span>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black rounded-sm hover:bg-slate-900 transition-colors"
            >
              PDF Report
            </button>
            <button 
              onClick={() => {
                const headers = ["Date", "Retailer", "Store", "Remarks", "Staff", "Amount"];
                const rows = filtered.map(c => [
                  c.date, `"${c.retailerName}"`, `"${c.store_name || 'Cash'}"`, `"${c.remarks || ''}"`, `"${c.staff}"`, c.totalAmount
                ]);
                rows.push(["TOTAL", "", "", "", "", grandTotal]);
                const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(csvContent));
                link.setAttribute("download", `CashIn_${Date.now()}.csv`);
                link.click();
              }} 
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-sm flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Audit Drawer/Modal */}
      {selectedCollectionId && currentSelection && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm p-6 space-y-4 select-none">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Audit Cash In Entry
              </h3>
              <button
                onClick={() => {
                  setSelectedCollectionId(null);
                  setIsEditMode(false);
                }}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Retailer Store</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.retailerName}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Collected By</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.staffName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Total Amount</span>
                  <span className="text-sm font-black text-blue-600 font-mono tabular-nums">₹{currentSelection.totalAmount.toLocaleString()}.00</span>
                </div>
              </div>

              {isEditMode ? (
                <form onSubmit={handleEdit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Correction Amount (₹)</label>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold outline-none focus:border-slate-500 dark:focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Correction Remarks</label>
                    <textarea 
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold outline-none h-20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-sm text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-sm text-xs font-bold">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  {currentSelection.status === "pending" && (
                    <button 
                      onClick={handleVerify}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-sm text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Verify Cash In Entry
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      handleStartEditCollection(currentSelection);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-sm text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" /> Edit Entry
                  </button>
                  <button 
                    onClick={async () => {
                      if(confirm("Delete this Cash In entry? This will fix the retailer's balance.")) {
                        try {
                          await api.deleteCollection(currentSelection.id);
                          if(showToastNotification) showToastNotification("Cash In deleted!");
                          setSelectedCollectionId(null);
                          if(fetchData) fetchData();
                        } catch(err: any) {
                          alert("Delete failed: " + err.message);
                        }
                      }
                    }}
                    className="w-full py-3 border border-red-200 text-red-600 rounded-sm text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Entry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden print-area">
        <div className="hidden print:block p-8 text-center border-b border-slate-100">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">CrediiFlow</h1>
          <p className="text-xs font-bold text-slate-500 mt-1">Official Cash In Statement</p>
          <div className="flex items-center justify-center gap-10 mt-8 border-y py-6">
             <div className="text-center">
                <span className="text-[10px] block uppercase text-slate-400 font-black mb-1">Total Cash In</span>
                <span className="text-xl font-black text-blue-600 font-mono tabular-nums">₹{grandTotal.toLocaleString()}.00</span>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                 <th className="p-2 border-r border-slate-100 dark:border-slate-800">Date</th>
                 <th className="p-2 border-r border-slate-100 dark:border-slate-800">Retailer</th>
                 <th className="p-2 border-r border-slate-100 dark:border-slate-800">Store</th>
                 <th className="p-2 border-r border-slate-100 dark:border-slate-800">Remarks</th>
                 <th className="p-2 border-r border-slate-100 dark:border-slate-800">Staff</th>
                 <th className="p-2 text-right">Amount</th>
                 <th className="p-2 text-center no-print">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
              {filtered.length === 0 ? (
                 <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold italic">No Cash In entries match your criteria.</td></tr>
              ) : filtered.map(col => (
                <tr key={col.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-2 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-400">{col.date.split(" ")[0].split("-").reverse().join("-")}</span>
                      <span className="text-[9px] opacity-60">
                        {(() => {
                          const timePart = col.date.split(" ")[1];
                          if (!timePart) return "";
                          const [hour, min] = timePart.split(":").map(Number);
                          return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                        })()}
                      </span>
                    </div>
                  </td>
                   <td className="p-2 border-r border-slate-50 dark:border-slate-800 font-black text-slate-900 dark:text-white uppercase">
                     {col.retailerName?.toLowerCase().startsWith("cms") 
                       ? `${col.retailerName} - ${col.store_name || "Cash"}` 
                       : col.retailerName}
                   </td>
                   <td className="p-2 border-r border-slate-50 dark:border-slate-800 text-slate-500 text-[9px] uppercase font-bold">{col.store_name || "Cash"}</td>
                   <td className="p-2 border-r border-slate-50 dark:border-slate-800 text-slate-400 italic text-[9px]">
                     {col.retailerName?.toLowerCase().startsWith("cms") ? (
                       <div className="flex flex-col gap-1 items-start">
                         <button
                           type="button"
                           onClick={() => setCmsRemarksExpanded(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                           className="flex items-center gap-1 text-[8px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer"
                         >
                           <span>View Remark</span>
                           <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${cmsRemarksExpanded[col.id] ? 'rotate-180' : ''}`} />
                         </button>
                         {cmsRemarksExpanded[col.id] && (
                           <span className="text-[9px] text-slate-600 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-950/60 p-1.5 rounded border border-slate-200/50 mt-1 max-w-[150px] inline-block whitespace-normal break-words">
                             {col.remarks || "no remark"}
                           </span>
                         )}
                       </div>
                     ) : (
                       col.remarks || "-"
                     )}
                   </td>
                   <td className="p-2 border-r border-slate-50 dark:border-slate-800 text-[10px] font-black uppercase text-slate-600">{col.staff}</td>
                   <td className="p-2 text-right font-black text-blue-600 font-mono tabular-nums">₹{col.totalAmount.toLocaleString()}.00</td>
                   <td className="p-2 text-center no-print">
                     <button 
                       onClick={() => setSelectedCollectionId(col.id)} 
                       className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-400 text-[9px] font-black rounded-sm transition-colors"
                     >
                       AUDIT
                     </button>
                   </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                 <tr className="bg-slate-50 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-800 text-xs">
                   <td colSpan={5} className="p-2 text-right uppercase tracking-wide text-slate-400 text-[10px]">Total Cash In</td>
                   <td className="p-2 text-right text-blue-600 font-mono tabular-nums">₹{grandTotal.toLocaleString()}.00</td>
                   <td className="no-print" />
                 </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {/* Edit Collection Modal */}
      {isEditCollectionModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                Edit Cash In (Collection) Entry
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCollectionEdit} className="space-y-4">
              
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

                {(availableStores.length > 0 || editingCollection?.store_name) && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block">Parent Store (Shop/Branch)</label>
                      {editingCollection?.store_name && (
                        <span className="text-[9px] text-amber-500 font-bold">
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
                      <div className="text-[11px] text-slate-400 italic px-3 py-2 bg-slate-50 dark:bg-slate-950/40 rounded-sm border border-dashed border-slate-200 dark:border-slate-800">
                        No stores available for this retailer
                      </div>
                    )}
                  </div>
                )}

                {/* Online Payment Portal Select -- Portal only (balance is Portal-level);
                    resolves to that portal's first online-eligible BankAccount internally. */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Online Payment Portal</label>
                  <InlineSelect
                    value={
                      portalDirectory.find((group: any) =>
                        (group.bankAccounts || []).some((ba: any) => String(ba.id) === selectedNewBankAccountId)
                      )?.id || ""
                    }
                    onChange={(portalId) => {
                      const account = portalDirectory
                        .find((group: any) => String(group.id) === String(portalId))
                        ?.bankAccounts?.find((ba: any) => ba.show_in_online_payment);
                      setSelectedNewBankAccountId(account ? String(account.id) : "");
                    }}
                    options={[
                      { value: "", label: "None / Cash" },
                      ...portalDirectory
                        .filter((group: any) => (group.bankAccounts || []).some((ba: any) => ba.show_in_online_payment))
                        .map((group: any) => ({ value: String(group.id), label: group.name }))
                    ]}
                    placeholder="None / Cash"
                  />
                </div>

                {/* Denominations editor for Collection */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-sm">
                  <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Counting Details (Notes)</span>
                  </div>
                  {[
                    { label: "₹500 Notes", key: "note_500", factor: 500 },
                    { label: "₹200 Notes", key: "note_200", factor: 200 },
                    { label: "₹100 Notes", key: "note_100", factor: 100 },
                    { label: "₹50 Notes", key: "note_50", factor: 50 },
                    { label: "₹20 Notes", key: "note_20", factor: 20 },
                    { label: "₹10 Notes", key: "note_10", factor: 10 },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2 justify-between px-2 py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">{item.label}</span>
                      <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">&times;</span>
                      <input autoComplete="one-time-code"
                        type="number"
                        inputMode="numeric"
                        value={selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setSelectedNewDenoms(prev => ({ ...prev, [item.key]: val }));
                        }}
                        className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                      />
                      <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>
                      <span className="text-xs font-black text-right w-16 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        ₹{(Number(selectedNewDenoms[item.key as keyof typeof selectedNewDenoms] || 0) * item.factor).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 justify-between px-2 py-0.5 border-b border-slate-100 dark:border-slate-800/40">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">Coins</span>
                    <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">&times;</span>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={selectedNewDenoms.coins}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSelectedNewDenoms(prev => ({ ...prev, coins: val }));
                      }}
                      className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                    />
                    <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>
                    <span className="text-xs font-black text-right w-16 font-mono tabular-nums text-slate-700 dark:text-slate-300">₹{Number(selectedNewDenoms.coins || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-between px-2 py-0.5">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">Online</span>
                    <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">+</span>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      value={selectedNewDenoms.online_amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSelectedNewDenoms(prev => ({ ...prev, online_amount: val }));
                      }}
                      className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-extrabold focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                    />
                    <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>
                    <span className="text-xs font-black text-right w-16 font-mono tabular-nums text-slate-700 dark:text-slate-300">₹{Number(selectedNewDenoms.online_amount || 0).toLocaleString()}</span>
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
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-right font-mono tabular-nums text-xs font-black text-slate-800 dark:text-slate-100"
                    readOnly
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                  <textarea
                    value={selectedNewRemarks}
                    onChange={(e) => setSelectedNewRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold focus:outline-none dark:text-white"
                    rows={2}
                    placeholder="Remarks..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditCollectionModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-sm text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCollection}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
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
