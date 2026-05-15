"use client";

import React from "react";
import { Search, Download, X, CheckCircle2, Edit, Trash2 } from "lucide-react";
import { api } from "../../utils/api";

interface DepositsTabProps {
  deposits: any[];
  showToastNotification?: (msg: string) => void;
  fetchData?: () => void;
}

export default function DepositsTab({
  deposits,
  showToastNotification,
  fetchData
}: DepositsTabProps) {
  const [selectedDepositId, setSelectedDepositId] = React.useState<string | null>(null);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editAmount, setEditAmount] = React.useState(0);
  const [editRef, setEditRef] = React.useState("");

  const currentSelection = (deposits || []).find(d => d.id === selectedDepositId);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepositId || !currentSelection) return;
    try {
      await api.updateDeposit(selectedDepositId, {
        ...currentSelection,
        amount: editAmount,
        reference_no: editRef
      });
      if (showToastNotification) showToastNotification("Cash Out updated!");
      setIsEditMode(false);
      setSelectedDepositId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Update failed: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedDepositId) return;
    if (!confirm("Are you sure you want to delete this Cash Out entry? This will fix balances if applicable.")) return;
    try {
      await api.deleteDeposit(selectedDepositId);
      if (showToastNotification) showToastNotification("Cash Out deleted!");
      setSelectedDepositId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [staffFilter, setStaffFilter] = React.useState("all");
  const [targetFilter, setTargetFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("date-desc");

  // Get unique lists
  const staffList = Array.from(new Set((deposits || []).map(d => d.staffName).filter(Boolean))).sort();
  const targetList = Array.from(new Set((deposits || []).map(d => d.targetName).filter(Boolean))).sort();

  // Apply Filter Logic
  let filtered = (deposits || []).map(d => ({
    ...d,
    staff: d.staffName || "Admin"
  }));

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(d => 
      (d.targetName || "").toLowerCase().includes(q) || 
      (d.paymentMode || "").toLowerCase().includes(q) ||
      (d.staff || "").toLowerCase().includes(q)
    );
  }

  if (staffFilter !== "all") filtered = filtered.filter(d => d.staff === staffFilter);
  if (targetFilter !== "all") filtered = filtered.filter(d => d.targetName === targetFilter);

  if (dateFrom) filtered = filtered.filter(d => d.date >= dateFrom);
  if (dateTo) filtered = filtered.filter(d => d.date.split(' ')[0] <= dateTo);

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === "date-desc") return new Date(b.date.replace(" ", "T")).getTime() - new Date(a.date.replace(" ", "T")).getTime();
    if (sortBy === "date-asc") return new Date(a.date.replace(" ", "T")).getTime() - new Date(b.date.replace(" ", "T")).getTime();
    if (sortBy === "amount-desc") return b.amount - a.amount;
    if (sortBy === "amount-asc") return a.amount - b.amount;
    return 0;
  });

  const grandTotal = filtered.reduce((s, d) => s + d.amount, 0);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Search</label>
            <input 
              type="text" 
              placeholder="Search target or staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Filter By Bank/Target</label>
            <select 
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none"
            >
              <option value="all">All Targets</option>
              {targetList.map(t => <option key={t} value={t}>{t}</option>)}
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
             <div className="px-3 py-1 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                <span className="text-[9px] uppercase font-black text-red-500 block">Total Cash Out</span>
                <span className="text-sm font-black text-red-600">₹{grandTotal.toLocaleString()}.00</span>
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
                const headers = ["Date", "Target", "Type", "Mode", "Staff", "Amount"];
                const rows = filtered.map(d => [
                  d.date, `"${d.targetName}"`, d.depositType, d.paymentMode, `"${d.staff}"`, d.amount
                ]);
                rows.push(["TOTAL", "", "", "", "", grandTotal]);
                const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(csvContent));
                link.setAttribute("download", `CashOut_${Date.now()}.csv`);
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
      {selectedDepositId && currentSelection && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 select-none animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Audit Cash Out Entry
              </h3>
              <button
                onClick={() => {
                  setSelectedDepositId(null);
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
                  <span className="text-[10px] font-black text-slate-400 uppercase">Target (Bank/Portal)</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.targetName}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Staff</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.staffName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Amount</span>
                  <span className="text-sm font-black text-red-600">₹{currentSelection.amount.toLocaleString()}.00</span>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Reference No</label>
                    <input 
                      type="text" 
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      setEditAmount(currentSelection.amount);
                      setEditRef(currentSelection.reference_no || "");
                      setIsEditMode(true);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" /> Edit Entry
                  </button>
                  <button 
                    onClick={handleDelete}
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
          <p className="text-xs font-bold text-slate-500 mt-1">Official Cash Out Statement</p>
          <div className="flex items-center justify-center gap-10 mt-8 border-y py-6">
             <div className="text-center">
                <span className="text-[10px] block uppercase text-slate-400 font-black mb-1">Total Cash Out</span>
                <span className="text-xl font-black text-red-600">₹{grandTotal.toLocaleString()}.00</span>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="p-4 border-r border-slate-100 dark:border-slate-800">Date</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800">Target (Bank/Portal)</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800">Type/Mode</th>
                <th className="p-4 border-r border-slate-100 dark:border-slate-800">Staff</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center no-print">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold italic">No Cash Out entries match your criteria.</td></tr>
              ) : filtered.map(dep => (
                <tr key={dep.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-400">{dep.date.split(" ")[0].split("-").reverse().join("-")}</span>
                      <span className="text-[9px] opacity-60">
                        {(() => {
                          const timePart = dep.date.split(" ")[1];
                          if (!timePart) return "";
                          let [hour, min] = timePart.split(":").map(Number);
                          const ampm = hour >= 12 ? 'PM' : 'AM';
                          hour = hour % 12 || 12;
                          return `${hour}:${min.toString().padStart(2, '0')} ${ampm}`;
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800 font-black text-slate-900 dark:text-white uppercase">{dep.targetName}</td>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col">
                       <span className="capitalize">{dep.depositType}</span>
                       <span className="text-[9px] opacity-60 uppercase">{dep.paymentMode}</span>
                    </div>
                  </td>
                  <td className="p-4 border-r border-slate-50 dark:border-slate-800 text-[10px] font-black uppercase text-slate-600">{dep.staff}</td>
                  <td className="p-4 text-right font-black text-red-600">₹{dep.amount.toLocaleString()}.00</td>
                  <td className="p-4 text-center no-print">
                    <button 
                      onClick={() => setSelectedDepositId(dep.id)} 
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-600 hover:text-white text-slate-600 dark:text-slate-400 text-[9px] font-black rounded-lg transition-all"
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
                  <td colSpan={4} className="p-4 text-right uppercase tracking-wide text-slate-400 text-[10px]">Total Cash Out</td>
                  <td className="p-4 text-right text-red-600">₹{grandTotal.toLocaleString()}.00</td>
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
