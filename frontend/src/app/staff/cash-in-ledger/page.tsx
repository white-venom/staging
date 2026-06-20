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
  Share2,
  AlertTriangle
} from "lucide-react";
import { numberToWordsIndian, formatShareDate } from "../../utils/shareHelper";

const getUtcDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  let s = String(dateStr).trim();
  if (s.includes(" ") && !s.includes("GMT") && !s.includes("+")) {
    s = s.replace(" ", "T");
  }
  if (!s.endsWith("Z") && !s.includes("+") && !s.includes("GMT")) {
    return new Date(s + "Z");
  }
  return new Date(s);
};

export default function CashInLedgerPage() {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cmsRemarksExpanded, setCmsRemarksExpanded] = useState<Record<string, boolean>>({});
  const [editWindow, setEditWindow] = useState<number>(5);
  const [deleteWindow, setDeleteWindow] = useState<number>(5);

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
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const [data, settings] = await Promise.all([
        api.getCollections(),
        api.getAdminSettings().catch(() => ({ edit_window_minutes: 5, delete_window_minutes: 5 }))
      ]);
      setCollections(data);
      const ew = settings.edit_window_minutes ?? 5;
      const dw = settings.delete_window_minutes ?? 5;
      setEditWindow(ew);
      setDeleteWindow(dw);

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get("edit");
        if (editId) {
          const item = data.find((c: any) => String(c.id) === editId);
          if (item) {
            const diffMinutes = (new Date().getTime() - getUtcDate(item.created_at).getTime()) / 60000;
            const canEdit = ew === -1 || diffMinutes <= ew;
            if (canEdit) {
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
            } else {
              alert(`Edit window (${ew === -1 ? 'unlimited' : `${ew} min`}) has expired for this entry.`);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };


  const handleShareEntry = async (entry: any) => {
    const den = entry.denominations || {};
    const mult = 1; // Collections are always Cash In
    
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

    const totalVal = Number(entry.total_amount) * mult;
    const totalWords = numberToWordsIndian(totalVal);
    const dateFormatted = entry.created_at ? formatShareDate(entry.created_at) : "";
    const collectorName = currentUser?.name || "Mehruddin";

    let headerLines: string[] = [];
    if (entry.retailer_name) {
      if (entry.retailer_name.startsWith("Staff:")) {
        headerLines.push(entry.retailer_name);
      } else if (entry.retailer_name === "Office" || entry.retailer_name === "Unknown Source") {
        headerLines.push(entry.retailer_name);
      } else {
        headerLines.push(`Retailer: ${entry.retailer_name}`);
      }
    }
    if (entry.portal_name && entry.portal_name !== "Cash" && entry.portal_name !== "N/A") {
      headerLines.push(`Store: ${entry.portal_name}`);
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
          title: 'Collection Receipt',
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
    if (!window.confirm("Are you sure you want to delete this collection entry? This will revert balances.")) return;
    try {
      await api.deleteCollection(id);
      setCollections(prev => prev.filter(c => c.id !== id));
      
      // Also update Zustand store
      const store = useAppStore.getState();
      store.setCollections(store.collections.filter(c => c.id !== id));
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

    if (totalAmount === 0) {
      alert("Collection total cannot be zero.");
      setIsSaving(false);
      return;
    }

    try {
      const payload: any = {
        total_amount: totalAmount,
        remarks: editRemarks,
        denominations: editDenoms,
        retailer_id: editingItem.retailer_id,
        store_id: editingItem.store_id,
        portal_id: editingItem.portal_id,
        from_staff_id: editingItem.from_staff_id,
        from_office: editingItem.from_office,
      };

      const updated = await api.updateCollection(editingItem.id, payload);

      // Update local state list
      setCollections(prev => prev.map(c => c.id === editingItem.id ? { ...c, ...updated } : c));

      // Update Zustand store
      const store = useAppStore.getState();
      const mappedUpdated = {
        id: updated.id,
        retailer_id: updated.retailer_id,
        store_id: updated.store_id,
        retailerName: updated.retailer_name || "Unknown Retailer",
        portalName: updated.portal_name || "Cash",
        staffName: updated.staff_name,
        totalAmount: Number(updated.total_amount),
        denominations: {
          note_500: Number(updated.denominations?.note_500 || 0),
          note_200: Number(updated.denominations?.note_200 || 0),
          note_100: Number(updated.denominations?.note_100 || 0),
          note_50: Number(updated.denominations?.note_50 || 0),
          note_20: Number(updated.denominations?.note_20 || 0),
          note_10: Number(updated.denominations?.note_10 || 0),
          coins: Number(updated.denominations?.coins || 0),
          online_amount: Number(updated.denominations?.online_amount || 0),
          online_portal_id: updated.denominations?.online_portal_id,
        },
        status: updated.status,
        remarks: updated.remarks,
        date: getUtcDate(updated.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
        created_at: updated.created_at,
      };
      store.setCollections(store.collections.map(c => c.id === editingItem.id ? mappedUpdated : c));

      setEditingItem(null);
    } catch (err: any) {
      alert("Failed to update: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCollections = collections.filter(c => {
    const retailerMatch = c.retailer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const portalMatch = c.portal_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    if (searchQuery && !retailerMatch && !portalMatch) return false;

    if (c.created_at) {
      const dateOnlyStr = getUtcDate(c.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 10);
      if (dateFrom && dateOnlyStr < dateFrom) return false;
      if (dateTo && dateOnlyStr > dateTo) return false;
    }
    return true;
  });

  // Group by date
  const groupedCollections: Record<string, any[]> = {};
  filteredCollections.forEach(c => {
    const dateStr = c.created_at ? getUtcDate(c.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "Unknown Date";
    if (!groupedCollections[dateStr]) {
      groupedCollections[dateStr] = [];
    }
    groupedCollections[dateStr].push(c);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="flex-1 w-full max-w-md mx-auto px-2 py-3 flex flex-col gap-2.5 select-none pb-24">
        
        {/* Navigation Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/staff")}
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Cash In Ledger</h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Your historical cash collections</p>
            </div>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <input autoComplete="one-time-code"
            type="text"
            placeholder="Filter by retailer or portal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg focus:outline-none text-[11px] text-slate-800 dark:text-slate-200 placeholder-slate-400 font-bold shadow-sm"
          />
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[7.5px] text-slate-400 font-black uppercase">Date From</span>
              <input autoComplete="one-time-code"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer p-0 h-4 min-h-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[7.5px] text-slate-400 font-black uppercase">Date To</span>
              <input autoComplete="one-time-code"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer p-0 h-4 min-h-0"
              />
            </div>
          </div>
        </div>

        {/* Collections historical records */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center p-6">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : Object.keys(groupedCollections).length === 0 ? (
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-[10px] text-slate-400 dark:text-slate-500 font-bold">
              <Calendar className="w-4 h-4 text-slate-350 mx-auto mb-1" />
              No matching collection records found.
            </div>
          ) : (
            Object.entries(groupedCollections).map(([date, items]) => (
              <div key={date} className="space-y-1.5">
                <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 border-b border-slate-200 dark:border-slate-800 pb-0.5 mt-1">
                  {date}
                </h2>
                {items.map((c: any) => {
                  const isExpanded = expandedId === c.id;
                  const denoms = c.denominations || {};
                  return (
                    <div
                      key={c.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm transition-all"
                    >
                      <div
                        onClick={() => toggleExpand(c.id)}
                        className="p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-955/40 transition-colors"
                      >
                         <div>
                          <div className="flex items-center gap-1">
                            <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-200">
                              {c.retailer_name?.toLowerCase().startsWith("cms")
                                ? `${c.retailer_name} - ${c.store_name || "Cash"}`
                                : c.retailer_name}
                            </h3>
                            {c.retailer_name?.toLowerCase().startsWith("cms") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCmsRemarksExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }));
                                }}
                                className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer inline-flex items-center justify-center"
                                title="View Remark"
                              >
                                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${cmsRemarksExpanded[c.id] ? 'rotate-180 text-indigo-500' : ''}`} />
                              </button>
                            )}
                          </div>
                          {c.retailer_name?.toLowerCase().startsWith("cms") && cmsRemarksExpanded[c.id] && (
                            <div className="mt-1 px-1.5 py-0.5 bg-slate-55/40 dark:bg-slate-955/40 rounded border border-slate-200/50 dark:border-slate-800 text-[10px] font-medium text-slate-605 dark:text-slate-400">
                              <span className="text-[8.5px] uppercase font-bold text-slate-400 block mb-0.5">Remark:</span>
                              <span className="italic">{c.remarks || "no remark"}</span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5 font-bold">
                            <span>{c.portal_name || "N/A"}</span>
                            <span>•</span>
                            <span>{getUtcDate(c.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-500 block">
                              +₹{c.total_amount?.toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareEntry(c);
                            }}
                            className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                            title="Share Entry"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                      </div>

                      {/* Expanded notes structures summary */}
                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-2 text-[10px] font-bold text-slate-650 dark:text-slate-400">
                          <div>
                            <span className="text-[8px] uppercase font-black text-slate-400 block mb-0.5">Cash Breakdown:</span>
                            <div className="grid grid-cols-2 gap-1 text-slate-700 dark:text-slate-300">
                              {denoms.note_500 > 0 && <div>₹500 Notes: <span className="font-extrabold">{denoms.note_500}</span></div>}
                              {denoms.note_200 > 0 && <div>₹200 Notes: <span className="font-extrabold">{denoms.note_200}</span></div>}
                              {denoms.note_100 > 0 && <div>₹100 Notes: <span className="font-extrabold">{denoms.note_100}</span></div>}
                              {denoms.note_50 > 0 && <div>₹50 Notes: <span className="font-extrabold">{denoms.note_50}</span></div>}
                              {denoms.note_20 > 0 && <div>₹20 Notes: <span className="font-extrabold">{denoms.note_20}</span></div>}
                              {denoms.note_10 > 0 && <div>₹10 Notes: <span className="font-extrabold">{denoms.note_10}</span></div>}
                              {Number(denoms.coins) > 0 && <div>Coins: <span className="font-extrabold">₹{Number(denoms.coins).toFixed(2)}</span></div>}
                              {Number(denoms.online_amount) > 0 && <div>UPI Online: <span className="font-extrabold">₹{Number(denoms.online_amount).toLocaleString()}</span></div>}
                            </div>
                          </div>

                          {c.remarks && (
                            <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5 flex items-start gap-1">
                              <FileText className="w-3 h-3 text-slate-400 mt-0.5" />
                              <div>
                                <span className="text-[7.5px] uppercase font-black text-slate-400 block mb-0.5">Remarks:</span>
                                <span className="text-slate-700 dark:text-slate-300 font-bold text-[9.5px]">{c.remarks}</span>
                              </div>
                            </div>
                          )}

                          {/* Edit/Delete Actions */}
                          {(() => {
                            const diffMinutes = c.created_at ? (new Date().getTime() - getUtcDate(c.created_at).getTime()) / 60000 : 999999;
                            const canEdit = editWindow === -1 || diffMinutes <= editWindow;
                            const canDelete = deleteWindow === -1 || diffMinutes <= deleteWindow;
                            if (!canEdit && !canDelete) return null;
                            return (
                              <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-2 flex items-center justify-end gap-1.5">
                                {canEdit && (
                                  <button
                                    onClick={(e) => handleEdit(c, e)}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-[9px] font-bold"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Edit
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={(e) => handleDelete(c.id, e)}
                                    className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-650 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-[9px] font-bold"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </button>
                                )}
                              </div>
                            );
                          })()}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="absolute inset-0"
            onClick={() => setEditingItem(null)}
          />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xs max-h-[85vh] overflow-y-auto p-4 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3 text-slate-800 dark:text-slate-100">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider">Edit Cash In Entry</h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Update counts and remarks</p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {[
                  { label: "₹500 Notes", key: "note_500", val: 500 },
                  { label: "₹200 Notes", key: "note_200", val: 200 },
                  { label: "₹100 Notes", key: "note_100", val: 100 },
                  { label: "₹50 Notes", key: "note_50", val: 50 },
                  { label: "₹20 Notes", key: "note_20", val: 20 },
                  { label: "₹10 Notes", key: "note_10", val: 10 },
                ].map(note => (
                  <div key={note.key} className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500">{note.label}</span>
                    <div className="flex items-center gap-2.5">
                      <input autoComplete="one-time-code"
                        type="number"
                        value={editDenoms[note.key] === 0 ? "" : editDenoms[note.key]}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                          setEditDenoms((prev: any) => ({ ...prev, [note.key]: isNaN(v) ? 0 : v }));
                        }}
                        className="w-14 px-1.5 py-0.5 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold"
                        placeholder="0"
                      />
                      <span className={`w-14 text-right font-bold ${ (editDenoms[note.key] || 0) < 0 ? 'text-red-500' : 'text-slate-500'}`}>₹{((editDenoms[note.key] || 0) * note.val).toLocaleString()}</span>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-500">Coins Sum</span>
                  <div className="flex items-center gap-2.5">
                    <input autoComplete="one-time-code"
                      type="number"
                      step="0.01"
                      value={editDenoms.coins || ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                        setEditDenoms((prev: any) => ({ ...prev, coins: isNaN(v) ? 0 : v }));
                      }}
                      className="w-14 px-1.5 py-0.5 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200/80 rounded text-xs font-bold"
                      min="0"
                    />
                    <span className="w-14 text-right text-slate-500 font-bold">₹{Number(editDenoms.coins || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-500">UPI Online</span>
                  <div className="flex items-center gap-2.5">
                    <input autoComplete="one-time-code"
                      type="number"
                      value={editDenoms.online_amount || ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                        setEditDenoms((prev: any) => ({ ...prev, online_amount: isNaN(v) ? 0 : v }));
                      }}
                      className="w-14 px-1.5 py-0.5 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200/80 rounded text-xs font-bold"
                      min="0"
                    />
                    <span className="w-14 text-right text-slate-500 font-bold">₹{Number(editDenoms.online_amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] uppercase font-black text-slate-400">Remarks</label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-slate-400 font-bold"
                  rows={2}
                  placeholder="Enter remarks..."
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[7.5px] font-black uppercase text-slate-400 tracking-wider">Total Amount</span>
                  {(() => {
                    const tot = editDenoms.note_500 * 500 + editDenoms.note_200 * 200 + editDenoms.note_100 * 100 + editDenoms.note_50 * 50 + editDenoms.note_20 * 20 + editDenoms.note_10 * 10 + editDenoms.coins + editDenoms.online_amount;
                    if (tot < 0) return (
                      <div className="flex items-center gap-1 mt-0.5 text-amber-500">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <p className="text-[8px] font-bold">Negative total — note exchange mode</p>
                      </div>
                    );
                    return null;
                  })()}
                </div>
                <span className={`text-sm font-black ${ (editDenoms.note_500 * 500 + editDenoms.note_200 * 200 + editDenoms.note_100 * 100 + editDenoms.note_50 * 50 + editDenoms.note_20 * 20 + editDenoms.note_10 * 10 + editDenoms.coins + editDenoms.online_amount) < 0 ? 'text-red-500' : '' }`}>
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

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-xs font-bold rounded-lg active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold rounded-lg active:scale-[0.98] transition-all cursor-pointer"
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
