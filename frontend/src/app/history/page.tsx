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
  Moon,
  Share2
} from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();
  const { collections, currentUser } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

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

    const totalVal = entry.totalAmount * mult;
    const totalWords = numberToWordsIndian(totalVal);
    const dateFormatted = formatShareDate(entry.date);
    const collectorName = currentUser?.name || "Mehruddin";

    const text = `${lines.join("\n")}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄
Total : *₹ ${totalVal.toLocaleString('en-IN')}*  (Note: ${totalNotesCount})

${totalWords} 

${collectorName} 
${dateFormatted} 
📲 Install App : goo.gl/uVSDgA`;

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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareEntry(c);
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
