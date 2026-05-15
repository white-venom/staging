"use client";

import React from "react";
import { Search, Download, X, CheckCircle2, Edit, Trash2 } from "lucide-react";
import { api } from "../../utils/api";

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
  
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [staffFilter, setStaffFilter] = React.useState("all");
  const [retailerFilter, setRetailerFilter] = React.useState("all");
  const [portalFilter, setPortalFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("date-desc");

  // Get unique lists
  const staffList = Array.from(new Set((collections || []).map(c => c.staffName).filter(Boolean))).sort();
  const retailerList = Array.from(new Set((collections || []).map(c => c.retailerName).filter(Boolean))).sort();
  const portalList = Array.from(new Set((collections || []).map(c => c.portalName).filter(Boolean))).sort();

  // Apply Filter Logic
  let filtered = (collections || []).map(c => ({
    ...c,
    staff: c.staffName || "Admin"
  }));

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      (c.retailerName || "").toLowerCase().includes(q) || 
      (c.portalName || "").toLowerCase().includes(q) ||
      (c.staff || "").toLowerCase().includes(q)
    );
  }

  if (staffFilter !== "all") filtered = filtered.filter(c => c.staff === staffFilter);
  if (retailerFilter !== "all") filtered = filtered.filter(c => c.retailerName === retailerFilter);
  if (portalFilter !== "all") filtered = filtered.filter(c => c.portalName === portalFilter);

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
    <div className="space-y-4 animate-fade-in select-none">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Search</label>
            <input 
              type="text" 
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Retailer</label>
            <select 
              value={retailerFilter}
              onChange={(e) => setRetailerFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
            >
              <option value="all">All Retailers</option>
              {retailerList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Portal</label>
            <select 
              value={portalFilter}
              onChange={(e) => setPortalFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
            >
              <option value="all">All Portals</option>
              {portalList.map(p => <option key={p} value={p}>{p}</option>)}
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
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
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Sort By</label>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
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
             <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                <span className="text-[9px] uppercase font-black text-blue-500 block">Total Cash In</span>
                <span className="text-sm font-black text-blue-600">₹{grandTotal.toLocaleString()}.00</span>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black rounded-lg hover:bg-slate-900 transition-all shadow-lg shadow-slate-900/20"
            >
              PDF Report
            </button>
            <button 
              onClick={() => {
                const headers = ["Date", "Retailer", "Store", "Remarks", "Staff", "Amount"];
                const rows = filtered.map(c => [
                  c.date, `"${c.retailerName}"`, `"${c.store_name || 'Direct'}"`, `"${c.remarks || ''}"`, `"${c.staff}"`, c.totalAmount
                ]);
                rows.push(["TOTAL", "", "", "", "", grandTotal]);
                const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(csvContent));
                link.setAttribute("download", `CashIn_${Date.now()}.csv`);
                link.click();
              }} 
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg shadow-lg shadow-emerald-900/10 flex items-center gap-2 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Audit Drawer/Modal */}
      {selectedCollectionId && currentSelection && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 select-none animate-slide-up shadow-2xl">
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
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
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
                  <span className="text-sm font-black text-blue-600">₹{currentSelection.totalAmount.toLocaleString()}.00</span>
                </div>
              </div>

              {isEditMode ? (
                <form onSubmit={handleEdit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Correction Amount (₹)</label>
                    <input 
                      type="number" 
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Correction Remarks</label>
                    <textarea 
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none h-20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  {currentSelection.status === "pending" && (
                    <button 
                      onClick={handleVerify}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Verify Cash In Entry
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setEditAmount(currentSelection.totalAmount);
                      setEditRemarks(currentSelection.remarks || "");
                      setIsEditMode(true);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
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
                    className="w-full py-3 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Entry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm print-area">
        <div className="hidden print:block p-8 text-center border-b border-slate-100">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">Do It Services</h1>
          <p className="text-xs font-bold text-slate-500 mt-1">Official Cash In Statement</p>
          <div className="flex items-center justify-center gap-10 mt-8 border-y py-6">
             <div className="text-center">
                <span className="text-[10px] block uppercase text-slate-400 font-black mb-1">Total Cash In</span>
                <span className="text-xl font-black text-blue-600">₹{grandTotal.toLocaleString()}.00</span>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                 <th className="p-4 border-r border-slate-100 dark:border-slate-800">Date</th>
                 <th className="p-4 border-r border-slate-100 dark:border-slate-800">Retailer</th>
                 <th className="p-4 border-r border-slate-100 dark:border-slate-800">Store</th>
                 <th className="p-4 border-r border-slate-100 dark:border-slate-800">Remarks</th>
                 <th className="p-4 border-r border-slate-100 dark:border-slate-800">Staff</th>
                 <th className="p-4 text-right">Amount</th>
                 <th className="p-4 text-center no-print">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
              {filtered.length === 0 ? (
                 <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold italic">No Cash In entries match your criteria.</td></tr>
              ) : filtered.map(col => (
                <tr key={col.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-400">{col.date.split(" ")[0].split("-").reverse().join("-")}</span>
                      <span className="text-[9px] opacity-60">
                        {(() => {
                          const timePart = col.date.split(" ")[1];
                          if (!timePart) return "";
                          let [hour, min] = timePart.split(":").map(Number);
                          const ampm = hour >= 12 ? 'PM' : 'AM';
                          hour = hour % 12 || 12;
                          return `${hour}:${min.toString().padStart(2, '0')} ${ampm}`;
                        })()}
                      </span>
                    </div>
                  </td>
                   <td className="p-4 border-r border-slate-50 dark:border-slate-800 font-black text-slate-900 dark:text-white uppercase">{col.retailerName}</td>
                   <td className="p-4 border-r border-slate-50 dark:border-slate-800 text-slate-500 text-[9px] uppercase font-bold">{col.store_name || "Direct"}</td>
                   <td className="p-4 border-r border-slate-50 dark:border-slate-800 text-slate-400 italic text-[9px] line-clamp-1 max-w-[120px]">{col.remarks || "-"}</td>
                   <td className="p-4 border-r border-slate-50 dark:border-slate-800 text-[10px] font-black uppercase text-slate-600">{col.staff}</td>
                   <td className="p-4 text-right font-black text-blue-600">₹{col.totalAmount.toLocaleString()}.00</td>
                   <td className="p-4 text-center no-print">
                     <button 
                       onClick={() => setSelectedCollectionId(col.id)} 
                       className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-400 text-[9px] font-black rounded-lg transition-all"
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
                   <td colSpan={5} className="p-4 text-right uppercase tracking-wide text-slate-400 text-[10px]">Total Cash In</td>
                   <td className="p-4 text-right text-blue-600">₹{grandTotal.toLocaleString()}.00</td>
                   <td className="no-print" />
                 </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
