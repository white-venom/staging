"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  CheckCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Search,
  Sun,
  Moon
} from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();
  const { collections, theme, toggleTheme } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // Filter history
  const filteredCollections = collections.filter(c => 
    c.retailerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.portalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Ledger Sheets History</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Verify your historical field submissions.</p>
            </div>
          </div>


        </div>

        {/* Filter Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Filter by retailer or portal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-semibold shadow-sm"
          />
        </div>

        {/* Collections historical records */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Chrono Logs List ({filteredCollections.length})
          </h2>

          {filteredCollections.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400 dark:text-slate-500">
              <Calendar className="w-5 h-5 text-slate-350 mx-auto mb-2" />
              No matching submission records found.
            </div>
          ) : (
            filteredCollections.map((c) => {
              const isExpanded = expandedId === c.id;
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all"
                >
                  <div
                    onClick={() => toggleExpand(c.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
                  >
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{c.retailerName}</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-2 font-medium">
                        <span>{c.portalName}</span>
                        <span>•</span>
                        <span>{c.date}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                          ₹{c.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded notes structures summary */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Cash Breakdown Counters:</span>
                        <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                          {c.denominations.note_500 > 0 && <div>₹500 Notes: <span className="font-extrabold">{c.denominations.note_500}</span></div>}
                          {c.denominations.note_200 > 0 && <div>₹200 Notes: <span className="font-extrabold">{c.denominations.note_200}</span></div>}
                          {c.denominations.note_100 > 0 && <div>₹100 Notes: <span className="font-extrabold">{c.denominations.note_100}</span></div>}
                          {c.denominations.note_50 > 0 && <div>₹50 Notes: <span className="font-extrabold">{c.denominations.note_50}</span></div>}
                          {c.denominations.note_20 > 0 && <div>₹20 Notes: <span className="font-extrabold">{c.denominations.note_20}</span></div>}
                          {c.denominations.note_10 > 0 && <div>₹10 Notes: <span className="font-extrabold">{c.denominations.note_10}</span></div>}
                          {c.denominations.coins > 0 && <div>Coins Sum: <span className="font-extrabold">₹{c.denominations.coins.toFixed(2)}</span></div>}
                          {c.denominations.online_amount > 0 && <div>UPI Online Scan: <span className="font-extrabold">₹{c.denominations.online_amount.toLocaleString()}</span></div>}
                        </div>
                      </div>

                      {c.remarks && (
                        <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-2 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Operative remarks:</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{c.remarks}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
