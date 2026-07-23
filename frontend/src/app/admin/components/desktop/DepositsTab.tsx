"use client";

import React from "react";
import { Search, Download, X, CheckCircle2, Edit, Trash2, Save } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import InlineSelect from "../../../components/InlineSelect";
import { getISTDateString } from "../../../utils/dateHelpers";

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

  const { retailerDirectory, portalDirectory, userDirectory } = useAdmin();

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = React.useState(false);
  const [editingCollection, setEditingCollection] = React.useState<any | null>(null);
  
  const [selectedNewRetailerId, setSelectedNewRetailerId] = React.useState("");
  const [selectedNewPortalId, setSelectedNewPortalId] = React.useState("");
  const [selectedNewBankAccountId, setSelectedNewBankAccountId] = React.useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = React.useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = React.useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = React.useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = React.useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = React.useState("");
  const [selectedNewAmount, setSelectedNewAmount] = React.useState(0);
  const [selectedNewDate, setSelectedNewDate] = React.useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = React.useState("");
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

  const handleStartEditDeposit = (item: any) => {
    setEditingCollection(item);
    setSelectedNewRetailerId(item.retailer_id || "");
    setSelectedNewPortalId(""); // re-derived from bank_account_id below via effectiveEditPortalId
    setSelectedNewBankAccountId(item.bank_account_id || "");
    setSelectedNewRemarks(item.remarks || "");
    setSelectedNewDepositType(item.depositType || item.deposit_type || "virtual");
    setSelectedNewPaymentMode(item.paymentMode || item.payment_mode || "online");
    setSelectedNewAmount(Number(item.amount || 0));
    setSelectedNewDate(item.deposit_date ? item.deposit_date : (item.date ? item.date.split(" ")[0] : getISTDateString()));
    setSelectedNewRefNo(item.reference_no || item.referenceNo || "");
    setSelectedNewRecipientStaffId(item.recipient_staff_id || item.recipientStaffId || "");
    setSelectedNewToOffice(item.to_office === true);
    const hasStaff = !!(item.recipient_staff_id || item.recipientStaffId);
    setSelectedNewVirtualTargetType(hasStaff ? "staff" : "retailer");
    
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
    setSelectedDepositId(null);
  };

  const handleSaveDepositEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    setIsSavingCollection(true);
    
    try {
      const bankAccountId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewBankAccountId : null;
      const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
      const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
      const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

      await api.updateDeposit(editingCollection.id, {
        deposit_type: selectedNewDepositType,
        bank_account_id: bankAccountId || null,
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
      
      if (showToastNotification) showToastNotification("Cash Out updated successfully.");
      setIsEditCollectionModalOpen(false);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

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
      (d.bankAccountName || "").toLowerCase().includes(q) ||
      (d.remarks || "").toLowerCase().includes(q) ||
      (d.referenceNo || d.reference_no || "").toLowerCase().includes(q) ||
      (d.staff || "").toLowerCase().includes(q) ||
      String(d.amount || "").includes(q)
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

  const grandTotal = filtered.filter(d => d.depositType !== 'virtual').reduce((s, d) => s + d.amount, 0);

  // Edit modal's portal selector: once the user picks one, use it. Before
  // that -- e.g. right when the modal opens pre-filled from an existing
  // deposit -- derive it from whichever portal actually owns the already
  // selected bank account, so editing an entry doesn't force a re-selection.
  const effectiveEditPortalId = selectedNewPortalId
    || (portalDirectory || []).find((g: any) => (g.bankAccounts || []).some((ba: any) => ba.id === selectedNewBankAccountId))?.id
    || "";

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Search</label>
            <input autoComplete="one-time-code" 
              type="text" 
              placeholder="Search target or staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Filter By Bank/Target</label>
            <InlineSelect 
              value={targetFilter}
              onChange={setTargetFilter}
              options={[
                { value: "all", label: "All Targets" },
                ...targetList.map(t => ({ value: t, label: t }))
              ]}
              placeholder="All Targets"
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
             <div className="px-3 py-1 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-sm">
                <span className="text-[9px] uppercase font-black text-red-500 block">Total Cash Out</span>
                <span className="text-sm font-black text-red-600 font-mono tabular-nums">₹{grandTotal.toLocaleString()}.00</span>
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-sm flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Audit Drawer/Modal */}
      {selectedDepositId && currentSelection && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm p-6 space-y-4 select-none">
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
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Target (Bank/BankAccount)</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.targetName}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Staff</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.staffName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Amount</span>
                  <span className="text-sm font-black text-red-600 font-mono tabular-nums">₹{currentSelection.amount.toLocaleString()}.00</span>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Reference No</label>
                    <input autoComplete="one-time-code" 
                      type="text" 
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-sm text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-sm text-xs font-bold">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      handleStartEditDeposit(currentSelection);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-sm text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" /> Edit Entry
                  </button>
                  <button 
                    onClick={handleDelete}
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
          <p className="text-xs font-bold text-slate-500 mt-1">Official Cash Out Statement</p>
          <div className="flex items-center justify-center gap-10 mt-8 border-y py-6">
             <div className="text-center">
                <span className="text-[10px] block uppercase text-slate-400 font-black mb-1">Total Cash Out</span>
                <span className="text-xl font-black text-red-600 font-mono tabular-nums">₹{grandTotal.toLocaleString()}.00</span>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="p-2 border-r border-slate-100 dark:border-slate-800">Date</th>
                <th className="p-2 border-r border-slate-100 dark:border-slate-800">Target (Bank/BankAccount)</th>
                <th className="p-2 border-r border-slate-100 dark:border-slate-800">Type/Mode</th>
                <th className="p-2 border-r border-slate-100 dark:border-slate-800">Staff</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-center no-print">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold italic">No Cash Out entries match your criteria.</td></tr>
              ) : filtered.map(dep => (
                <tr key={dep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-2 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-400">{dep.date.split(" ")[0].split("-").reverse().join("-")}</span>
                      <span className="text-[9px] opacity-60">
                        {(() => {
                          const timePart = dep.date.split(" ")[1];
                          if (!timePart) return "";
                          const [hour, min] = timePart.split(":").map(Number);
                          return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-50 dark:border-slate-800 font-black text-slate-900 dark:text-white uppercase">{dep.targetName}</td>
                  <td className="p-2 border-r border-slate-50 dark:border-slate-800">
                    <div className="flex flex-col">
                       <span className="capitalize">{dep.depositType}</span>
                       <span className="text-[9px] opacity-60 uppercase">{dep.paymentMode}</span>
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-50 dark:border-slate-800 text-[10px] font-black uppercase text-slate-600">{dep.staff}</td>
                  <td className="p-2 text-right font-black text-red-600 font-mono tabular-nums">₹{dep.amount.toLocaleString()}.00</td>
                  <td className="p-2 text-center no-print">
                    <button 
                      onClick={() => setSelectedDepositId(dep.id)} 
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-600 hover:text-white text-slate-600 dark:text-slate-400 text-[9px] font-black rounded-sm transition-colors"
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
                  <td colSpan={4} className="p-2 text-right uppercase tracking-wide text-slate-400 text-[10px]">Total Cash Out</td>
                  <td className="p-2 text-right text-red-600 font-mono tabular-nums">₹{grandTotal.toLocaleString()}.00</td>
                  <td className="no-print" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {/* Edit Deposit Modal */}
      {isEditCollectionModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                Edit Cash Out (Deposit) Entry
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveDepositEdit} className="space-y-4">
              
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
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
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
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target BankAccount</label>
                    <InlineSelect
                      value={selectedNewBankAccountId}
                      onChange={setSelectedNewBankAccountId}
                      options={[
                        { value: "", label: "Select Bank Account" },
                        ...portalDirectory.flatMap((group: any) =>
                          (group.bankAccounts || []).map((ba: any) => ({
                            value: String(ba.id),
                            label: `${group.name} — ${ba.bank_account_name}`,
                          }))
                        )
                      ]}
                      placeholder="Select Bank Account"
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
                        className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="editToOfficeCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-400">Handover to Main Office Cashier</label>
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
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Destination Portal" : "Source Portal"}
                        </label>
                        <InlineSelect
                          value={effectiveEditPortalId}
                          onChange={(val) => { setSelectedNewPortalId(val); setSelectedNewBankAccountId(""); }}
                          options={portalDirectory.map((group: any) => ({ value: String(group.id), label: group.name }))}
                          placeholder="Select Portal"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Destination BankAccount" : "Source BankAccount"}
                        </label>
                        <InlineSelect
                          value={selectedNewBankAccountId}
                          onChange={setSelectedNewBankAccountId}
                          disabled={!effectiveEditPortalId}
                          options={
                            (portalDirectory.find((group: any) => String(group.id) === effectiveEditPortalId)?.bankAccounts || [])
                              .map((ba: any) => ({ value: String(ba.id), label: ba.bank_account_name }))
                          }
                          placeholder={effectiveEditPortalId ? "Select Bank Account" : "Select a portal first"}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                        {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                      </label>
                      <select
                        value={selectedNewVirtualTargetType}
                        onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
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
                    inputMode="decimal"
                    value={selectedNewAmount}
                    onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
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
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
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
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                    placeholder="Optional"
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                  <textarea
                    value={selectedNewRemarks}
                    onChange={(e) => setSelectedNewRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
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
