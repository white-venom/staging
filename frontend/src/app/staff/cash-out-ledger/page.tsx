"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../utils/api";
import { useAppStore } from "../../utils/store";
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Share2
} from "lucide-react";

const getUtcDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  const s = String(dateStr);
  if (!s.endsWith("Z") && !s.includes("+") && !s.includes("GMT")) {
    return new Date(s + "Z");
  }
  return new Date(s);
};

export default function CashOutLedgerPage() {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal edit states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editDenoms, setEditDenoms] = useState<any>({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0
  });
  const [editRemarks, setEditRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDeposits();
      setDeposits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const numberToWordsIndian = (num: number): string => {
    const absNum = Math.abs(num);
    if (absNum === 0) return "Zero";
    
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    const helper = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
      if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + helper(n % 100) : "");
      if (n < 100000) return helper(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + helper(n % 1000) : "");
      if (n < 10000000) return helper(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + helper(n % 100000) : "");
      return helper(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + helper(n % 10000000) : "");
    };
    
    const words = helper(absNum);
    return (num < 0 ? "Minus " : "") + words;
  };

  const formatShareDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr.replace(" ", "T"));
      if (isNaN(d.getTime())) return dateStr;
      
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      const hoursStr = hours.toString().padStart(2, '0');
      
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = days[d.getDay()];
      
      return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm} ${dayName}`;
    } catch (e) {
      return dateStr;
    }
  };

  const handleShareEntry = async (entry: any) => {
    const den = entry.denominations || {};
    const isRecipient = entry.recipient_staff_id === currentUser?.id && entry.deposit_type === "staff";
    const mult = isRecipient ? 1 : -1; // Deposits/Cash Out are negative, received handovers are positive
    
    const notes = [
      { value: 500, count: Number(den.note_500 || 0) * mult },
      { value: 200, count: Number(den.note_200 || 0) * mult },
      { value: 100, count: Number(den.note_100 || 0) * mult },
      { value: 50, count: Number(den.note_50 || 0) * mult },
      { value: 20, count: Number(den.note_20 || 0) * mult },
      { value: 10, count: Number(den.note_10 || 0) * mult },
    ];

    let lines: string[] = [];
    let totalNotesCount = 0;
    notes.forEach(note => {
      if (note.count !== 0) {
        lines.push(`${note.value} × ${note.count} = ${(note.value * note.count).toLocaleString('en-IN')}`);
        totalNotesCount += note.count;
      }
    });
    if (Number(den.coins || 0) !== 0) {
      const coinsVal = Number(den.coins) * mult;
      lines.push(`Coins = ${coinsVal.toLocaleString('en-IN')}`);
    }
    if (Number(den.online_amount || 0) !== 0) {
      const onlineVal = Number(den.online_amount) * mult;
      lines.push(`UPI/Online = ${onlineVal.toLocaleString('en-IN')}`);
    }

    const totalVal = Number(entry.amount) * mult;
    const totalWords = numberToWordsIndian(totalVal);
    const dateFormatted = entry.created_at ? formatShareDate(getUtcDate(entry.created_at).toLocaleString("sv-SE").substring(0, 19)) : "";
    const collectorName = currentUser?.name || "Mehruddin";

    let headerLines: string[] = [];
    if (entry.deposit_type === "staff") {
      const isRecipient = entry.recipient_staff_id === currentUser?.id;
      headerLines.push(isRecipient ? `Received from: ${entry.staff_name}` : `Staff Handover: ${entry.target_name}`);
    } else if (entry.deposit_type === "portal") {
      headerLines.push(`Store/Portal: ${entry.portal_group_name || entry.target_name}`);
    } else if (entry.deposit_type === "retailer") {
      headerLines.push(`Retailer Payout: ${entry.target_name}`);
    } else if (entry.deposit_type === "virtual") {
      headerLines.push(`Virtual Transfer`);
      if (entry.target_name) headerLines.push(`Retailer: ${entry.target_name}`);
      if (entry.portal_group_name) headerLines.push(`Store: ${entry.portal_group_name}`);
    }
    const headerText = headerLines.length > 0 ? `${headerLines.join("\n")}\n` : "";
    const text = `${headerText}${lines.join("\n")}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄
Total : *₹ ${totalVal.toLocaleString('en-IN')}*  (Note: ${totalNotesCount})

${totalWords} 

${collectorName} 
${dateFormatted}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Deposit Slip',
          text: text,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert('Receipt details copied to clipboard!');
      } catch (err) {
        alert('Could not copy to clipboard.');
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this deposit entry? This will revert balances.")) return;
    try {
      await api.deleteDeposit(id);
      setDeposits(prev => prev.filter(d => d.id !== id));
      
      // Also update Zustand store
      const store = useAppStore.getState();
      store.setDeposits(store.deposits.filter(d => d.id !== id));
    } catch (err: any) {
      alert("Failed to delete: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleEdit = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setEditDenoms({
      note_500: Number(item.denominations?.note_500 || 0),
      note_200: Number(item.denominations?.note_200 || 0),
      note_100: Number(item.denominations?.note_100 || 0),
      note_50: Number(item.denominations?.note_50 || 0),
      note_20: Number(item.denominations?.note_20 || 0),
      note_10: Number(item.denominations?.note_10 || 0),
      coins: Number(item.denominations?.coins || 0),
      online_amount: Number(item.denominations?.online_amount || 0),
    });
    setEditRemarks(item.remarks || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSaving(true);

    const totalCash = (
      editDenoms.note_500 * 500 +
      editDenoms.note_200 * 200 +
      editDenoms.note_100 * 100 +
      editDenoms.note_50 * 50 +
      editDenoms.note_20 * 20 +
      editDenoms.note_10 * 10 +
      editDenoms.coins
    );
    const totalAmount = totalCash + editDenoms.online_amount;

    if (totalAmount <= 0) {
      alert("Deposit total must be greater than zero.");
      setIsSaving(false);
      return;
    }

    try {
      const payload: any = {
        amount: totalAmount,
        remarks: editRemarks,
        denominations: editDenoms,
        deposit_type: editingItem.deposit_type || editingItem.depositType,
        portal_id: editingItem.portal_id,
        retailer_id: editingItem.retailer_id,
        recipient_staff_id: editingItem.recipient_staff_id,
        to_office: editingItem.to_office,
        payment_mode: editingItem.payment_mode || editingItem.paymentMode,
      };

      const { api } = await import("../../utils/api");
      const updated = await api.updateDeposit(editingItem.id, payload);

      // Update local state list
      setDeposits(prev => prev.map(d => d.id === editingItem.id ? { ...d, ...updated } : d));

      // Update Zustand store
      const store = useAppStore.getState();
      const mappedUpdated = {
        id: updated.id,
        portal_id: updated.portal_id,
        retailer_id: updated.retailer_id,
        recipient_staff_id: updated.recipient_staff_id,
        depositType: updated.deposit_type,
        targetName: (updated.deposit_type === "portal" && updated.portal_group_name) ? updated.portal_group_name : (updated.target_name || "Super Distributor"),
        amount: Number(updated.amount),
        paymentMode: (updated.payment_mode === "cash" ? "cash" : "online") as "cash" | "online",
        denominations: updated.denominations ? {
          note_500: Number(updated.denominations.note_500 || 0),
          note_200: Number(updated.denominations.note_200 || 0),
          note_100: Number(updated.denominations.note_100 || 0),
          note_50: Number(updated.denominations.note_50 || 0),
          note_20: Number(updated.denominations.note_20 || 0),
          note_10: Number(updated.denominations.note_10 || 0),
          coins: Number(updated.denominations.coins || 0),
          online_amount: Number(updated.denominations.online_amount || 0),
          online_portal_id: updated.denominations.online_portal_id,
        } : undefined,
        status: updated.status,
        date: getUtcDate(updated.created_at).toLocaleString("sv-SE").substring(0, 16),
      };
      store.setDeposits(store.deposits.map(d => d.id === editingItem.id ? mappedUpdated : d));

      setEditingItem(null);
    } catch (err: any) {
      alert("Failed to update: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDeposits = deposits.filter(d => {
    const displayName = (d.deposit_type === "portal" && d.portal_group_name) ? d.portal_group_name : d.target_name;
    const targetMatch = displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    return targetMatch;
  });

  // Group by date
  const groupedDeposits: Record<string, any[]> = {};
  filteredDeposits.forEach(d => {
    const dateStr = d.created_at ? getUtcDate(d.created_at).toLocaleDateString() : "Unknown Date";
    if (!groupedDeposits[dateStr]) {
      groupedDeposits[dateStr] = [];
    }
    groupedDeposits[dateStr].push(d);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col gap-5 select-none pb-24">
        
        {/* Navigation Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/staff")}
              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Cash Out Ledger</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Your historical cash deposits</p>
            </div>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Filter by target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-semibold shadow-sm"
          />
        </div>

        {/* Deposits historical records */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : Object.keys(groupedDeposits).length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400 dark:text-slate-500">
              <Calendar className="w-5 h-5 text-slate-350 mx-auto mb-2" />
              No matching deposit records found.
            </div>
          ) : (
            Object.entries(groupedDeposits).map(([date, items]) => (
              <div key={date} className="space-y-3">
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 border-b border-slate-200 dark:border-slate-800 pb-1">
                  {date}
                </h2>
                {items.map((d: any) => {
                  const isExpanded = expandedId === d.id;
                  const denoms = d.denominations || {};
                  return (
                    <div
                      key={d.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all"
                    >
                      <div
                        onClick={() => toggleExpand(d.id)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
                      >
                        <div>
                          <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                             {d.deposit_type === "portal" && d.portal_group_name ? d.portal_group_name : d.target_name}
                           </h3>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-2 font-medium">
                            <span className="capitalize">{d.deposit_type}</span>
                            <span>•</span>
                            <span>{getUtcDate(d.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            {d.recipient_staff_id === currentUser?.id && d.deposit_type === "staff" ? (
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-500 block">
                                +₹{d.amount?.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-xs font-black text-red-650 dark:text-red-500 block">
                                -₹{d.amount?.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareEntry(d);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                            title="Share Entry"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {/* Expanded notes structures summary */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Cash Breakdown Counters:</span>
                            <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                              {denoms.note_500 > 0 && <div>₹500 Notes: <span className="font-extrabold">{denoms.note_500}</span></div>}
                              {denoms.note_200 > 0 && <div>₹200 Notes: <span className="font-extrabold">{denoms.note_200}</span></div>}
                              {denoms.note_100 > 0 && <div>₹100 Notes: <span className="font-extrabold">{denoms.note_100}</span></div>}
                              {denoms.note_50 > 0 && <div>₹50 Notes: <span className="font-extrabold">{denoms.note_50}</span></div>}
                              {denoms.note_20 > 0 && <div>₹20 Notes: <span className="font-extrabold">{denoms.note_20}</span></div>}
                              {denoms.note_10 > 0 && <div>₹10 Notes: <span className="font-extrabold">{denoms.note_10}</span></div>}
                              {Number(denoms.coins) > 0 && <div>Coins Sum: <span className="font-extrabold">₹{Number(denoms.coins).toFixed(2)}</span></div>}
                              {Number(denoms.online_amount) > 0 && <div>UPI Online Scan: <span className="font-extrabold">₹{Number(denoms.online_amount).toLocaleString()}</span></div>}
                            </div>
                          </div>

                          {d.remarks && (
                            <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-2 flex items-start gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                              <div>
                                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Operative remarks:</span>
                                <span className="text-slate-700 dark:text-slate-300 font-medium">{d.remarks}</span>
                              </div>
                            </div>
                          )}

                          {/* Edit/Delete Actions */}
                          {d.staff_id === currentUser?.id && (new Date().getTime() - getUtcDate(d.created_at).getTime()) < 5 * 60 * 1000 && (
                            <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-3 flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => handleEdit(d, e)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={(e) => handleDelete(d.id, e)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="absolute inset-0"
            onClick={() => setEditingItem(null)}
          />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 text-slate-800 dark:text-slate-100">
            <div>
              <h3 className="text-sm font-extrabold">Edit Cash Out Entry</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Update counts and remarks</p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {[
                  { label: "₹500 Notes", key: "note_500", val: 500 },
                  { label: "₹200 Notes", key: "note_200", val: 200 },
                  { label: "₹100 Notes", key: "note_100", val: 100 },
                  { label: "₹50 Notes", key: "note_50", val: 50 },
                  { label: "₹20 Notes", key: "note_20", val: 20 },
                  { label: "₹10 Notes", key: "note_10", val: 10 },
                ].map(note => (
                  <div key={note.key} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">{note.label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editDenoms[note.key] || ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                          setEditDenoms((prev: any) => ({ ...prev, [note.key]: isNaN(v) ? 0 : v }));
                        }}
                        className="w-16 px-2 py-1 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        min="0"
                      />
                      <span className="w-16 text-right text-slate-500 font-bold">₹{((editDenoms[note.key] || 0) * note.val).toLocaleString()}</span>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">Coins Sum</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editDenoms.coins || ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                        setEditDenoms((prev: any) => ({ ...prev, coins: isNaN(v) ? 0 : v }));
                      }}
                      className="w-16 px-2 py-1 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      min="0"
                    />
                    <span className="w-16 text-right text-slate-500 font-bold">₹{Number(editDenoms.coins || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">UPI Online Scan</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editDenoms.online_amount || ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                        setEditDenoms((prev: any) => ({ ...prev, online_amount: isNaN(v) ? 0 : v }));
                      }}
                      className="w-16 px-2 py-1 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                      min="0"
                    />
                    <span className="w-16 text-right text-slate-500 font-bold">₹{Number(editDenoms.online_amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Remarks</label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-slate-400"
                  rows={2}
                  placeholder="Enter remarks..."
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Total Amount</span>
                  <div className="text-[9px] text-slate-500 mt-0.5">Calculated</div>
                </div>
                <span className="text-base font-black">
                  ₹{(
                    editDenoms.note_500 * 500 +
                    editDenoms.note_200 * 200 +
                    editDenoms.note_100 * 100 +
                    editDenoms.note_50 * 50 +
                    editDenoms.note_20 * 20 +
                    editDenoms.note_10 * 10 +
                    editDenoms.coins +
                    editDenoms.online_amount
                  ).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
