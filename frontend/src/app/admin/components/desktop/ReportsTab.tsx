"use client";

import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Calendar,
  BarChart,
  PieChart,
  TrendingUp,
  Book,
  IndianRupee,
  Activity,
  ArrowLeft,
  FileDown,
  ChevronDown,
  Check,
  X,
  Users,
  Building2,
  CreditCard,
  Share2
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext";
import { getISTDateString, getUtcDate } from "../../../utils/dateHelpers";
import { downloadElementAsPdf } from "../../../utils/downloadElementAsPdf";

interface ReportsTabProps {
  collections: any[];
  deposits: any[];
}

interface MultiSelectDropdownProps {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function MultiSelectDropdown({ label, placeholder, options, selectedIds, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAllSelected = selectedIds.length === 0 || selectedIds.includes("all");
  const isNoneSelected = selectedIds.includes("__none__");

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const toggleOption = (id: string) => {
    if (isAllSelected || isNoneSelected) {
      onChange([id]);
    } else if (selectedIds.includes(id)) {
      const next = selectedIds.filter(item => item !== id);
      onChange(next.length === 0 ? [] : next);
    } else {
      const next = [...selectedIds, id];
      if (next.length === options.length) {
        onChange([]);
      } else {
        onChange(next);
      }
    }
  };

  const selectAll = () => {
    onChange([]);
    setFilterSearch("");
  };

  const clearAll = () => {
    onChange(["__none__"]);
  };

  let displayText = placeholder;
  if (!isAllSelected && !isNoneSelected && selectedIds.length > 0) {
    if (selectedIds.length === 1) {
      const found = options.find(o => String(o.id) === String(selectedIds[0]));
      displayText = found ? found.name : selectedIds[0];
    } else {
      displayText = `${selectedIds.length} Selected (Multi)`;
    }
  } else if (isNoneSelected) {
    displayText = "None Selected";
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-50 dark:bg-slate-950 border ${!isAllSelected && !isNoneSelected ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800'} rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer hover:border-slate-300 transition-colors`}
      >
        <span className="truncate pr-2">
          {displayText}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm shadow-xl z-50 p-2 space-y-2 max-h-64 overflow-y-auto min-w-[200px]">
          {options.length > 4 && (
            <input
              type="text"
              placeholder="Search options..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-2 py-1 text-[10px] font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          )}

          <div className="flex items-center justify-between text-[9px] font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5 px-1">
            <button
              type="button"
              onClick={selectAll}
              className={`hover:text-blue-600 cursor-pointer ${isAllSelected ? 'text-blue-600 font-black' : 'text-slate-500'}`}
            >
              ✓ Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-slate-400 hover:text-red-500 cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="space-y-1">
            {filteredOptions.map((opt) => {
              const isChecked = isAllSelected || selectedIds.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xs cursor-pointer text-[10.5px] font-bold text-slate-700 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(opt.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="truncate">{opt.name}</span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="text-[10px] text-slate-400 italic text-center py-2">No matching items found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsTab({ collections: propCols = [], deposits: propDeps = [] }: ReportsTabProps) {
  const adminCtx = useAdmin();
  
  const collections = adminCtx?.collections || propCols || [];
  const deposits = adminCtx?.deposits || propDeps || [];
  const retailerDirectory = adminCtx?.retailerDirectory || [];
  const portalDirectory = adminCtx?.portalDirectory || [];
  const userDirectory = adminCtx?.userDirectory || [];

  // Active Selected Report View: null = Overview cards, string = report type
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Filters State (Multi-Select & Single-Select Capable)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRetailerIds, setSelectedRetailerIds] = useState<string[]>([]);
  const [selectedPortalIds, setSelectedPortalIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(getISTDateString());
  const [dateTo, setDateTo] = useState(getISTDateString());

  // Virtual Ledger sub-type: 'all' | 'portal_to_portal' | 'portal_to_dist' | 'dist_to_portal'
  const [virtualLedgerSubType, setVirtualLedgerSubType] = useState<string>("all");

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [staffSubReport, setStaffSubReport] = useState<"efficiency" | "daily_cash">("efficiency");

  // Helper date formatter
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return { date: "-", time: "-" };
    try {
      let parseStr = dateStr;
      if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
        parseStr = dateStr.replace(" ", "T") + "Z";
      }
      const d = getUtcDate(parseStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: "-" };

      const datePart = d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata"
      });
      const timePart = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata"
      });

      return { date: datePart, time: timePart };
    } catch {
      return { date: dateStr, time: "-" };
    }
  };

  // Helper UUID checker
  const isUuid = (str: any) => {
    if (typeof str !== "string") return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str) || (str.length > 20 && str.includes("-"));
  };

  // Helper to map any transaction/user object to a clean human-readable Staff Name
  const getStaffName = (item: any): string => {
    if (!item) return "Staff Member";
    
    // Check direct name fields
    const directName = item.staff_name || item.staffName || item.from_staff_name || item.recipient_staff_name || item.name || item.full_name;

    if (directName && typeof directName === "string" && !isUuid(directName) && directName !== "Unknown Staff" && directName !== "System") {
      return directName;
    }

    // Lookup in userDirectory by staff ID
    const targetId = String(item.from_staff_id || item.staff_id || item.staffId || item.recipient_staff_id || item.id || item.user_id || "");
    if (targetId && userDirectory && userDirectory.length > 0) {
      const found = userDirectory.find((u: any) => String(u.id) === targetId || String(u.staff_id) === targetId || String(u.user_id) === targetId);
      if (found && (found.name || found.full_name || found.username)) {
        const uName = found.name || found.full_name || found.username;
        if (!isUuid(uName)) return uName;
      }
    }

    // Fallback if directName exists and is not UUID
    if (directName && typeof directName === "string" && !isUuid(directName)) {
      return directName;
    }

    return "Staff Member";
  };

  // Staff members dropdown list
  const staffList = useMemo(() => {
    const map = new Map<string, string>();
    
    if (userDirectory && userDirectory.length > 0) {
      userDirectory.forEach((u: any) => {
        const name = u.name || u.full_name || u.username;
        if (name && typeof name === "string" && !isUuid(name)) {
          map.set(String(u.id || name), name);
        }
      });
    }

    collections.forEach(c => {
      const name = getStaffName(c);
      const id = String(c.from_staff_id || c.staff_id || name);
      if (name && name !== "Staff Member" && name !== "Unknown Staff") {
        map.set(id, name);
      }
    });

    deposits.forEach(d => {
      const name = getStaffName(d);
      const id = String(d.staff_id || name);
      if (name && name !== "Staff Member" && name !== "Unknown Staff") {
        map.set(id, name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [userDirectory, collections, deposits]);

  // Retailer Directory options
  const retailerOptions = useMemo(() => {
    if (retailerDirectory && retailerDirectory.length > 0) {
      return retailerDirectory;
    }
    const names = new Set<string>();
    collections.forEach(c => { if (c.retailer_name && !isUuid(c.retailer_name)) names.add(c.retailer_name); });
    return Array.from(names).map(n => ({ id: n, name: n }));
  }, [retailerDirectory, collections]);

  // Portal Directory options
  const portalOptions = useMemo(() => {
    if (portalDirectory && portalDirectory.length > 0) {
      return portalDirectory;
    }
    const names = new Set<string>();
    deposits.forEach(d => { if (d.portal_name && !isUuid(d.portal_name)) names.add(d.portal_name); });
    collections.forEach(c => { if (c.portal_name && !isUuid(c.portal_name)) names.add(c.portal_name); });
    return Array.from(names).map(n => ({ id: n, name: n }));
  }, [portalDirectory, deposits, collections]);

  const normalizedRetailerOptions = useMemo(() => {
    return retailerOptions.map((r: any) => ({
      id: String(r.id || r.name || r.retailer_name),
      name: String(r.name || r.retailer_name || r.id)
    }));
  }, [retailerOptions]);

  const normalizedPortalOptions = useMemo(() => {
    return portalOptions.map((p: any) => ({
      id: String(p.id || p.name || p.portal_name),
      name: String(p.name || p.portal_name || p.id)
    }));
  }, [portalOptions]);

  const normalizedStaffOptions = useMemo(() => {
    return staffList.map((s: any) => ({
      id: String(s.id || s.name),
      name: String(s.name || s.id)
    }));
  }, [staffList]);

  // Target Staff for Daily Cash Report
  const targetStaff = useMemo(() => {
    if (selectedStaffIds.length !== 1) return null;
    const idOrName = selectedStaffIds[0];
    if (idOrName === "all" || idOrName === "__none__") return null;
    const found = staffList.find(s => String(s.id) === String(idOrName));
    return found || { id: idOrName, name: idOrName };
  }, [selectedStaffIds, staffList]);

  // All collections for the selected staff member
  const staffCols = useMemo(() => {
    if (!targetStaff) return [];
    return collections.filter((c: any) => {
      const staffName = getStaffName(c);
      return String(c.from_staff_id || c.staff_id || c.staffId) === String(targetStaff.id) ||
             staffName === targetStaff.name ||
             staffName.toLowerCase() === targetStaff.name.toLowerCase();
    });
  }, [collections, targetStaff]);

  // All deposits for the selected staff member (with deduplication filter for staff handovers)
  const staffDeps = useMemo(() => {
    if (!targetStaff) return [];
    const relatedDeps = deposits.filter((d: any) => {
      const isSender = String(d.staff_id || d.staffId) === String(targetStaff.id) ||
                       getStaffName(d) === targetStaff.name ||
                       getStaffName(d).toLowerCase() === targetStaff.name.toLowerCase();
      const isRecipient = String(d.recipient_staff_id || d.recipientStaffId) === String(targetStaff.id) && d.deposit_type === "staff";
      return isSender || isRecipient;
    });

    return relatedDeps.filter((d: any) => {
      const isRecipient = String(d.recipient_staff_id || d.recipientStaffId) === String(targetStaff.id) && d.deposit_type === "staff";
      if (isRecipient) {
        const hasMatchingCollection = collections.some((c: any) => 
          (String(c.staff_id || c.staffId) === String(targetStaff.id)) &&
          (String(c.from_staff_id) === String(d.staff_id)) && 
          Number(c.total_amount || c.totalAmount || 0) === Number(d.amount || 0)
        );
        return !hasMatchingCollection;
      }
      return true;
    });
  }, [deposits, collections, targetStaff]);

  const staffFilteredCollections = useMemo(() => {
    return staffCols.filter(c => {
      const localDateStr = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      return localDateStr === dateFrom;
    });
  }, [staffCols, dateFrom]);

  const staffFilteredDeposits = useMemo(() => {
    return staffDeps.filter(d => {
      const localDateStr = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      return localDateStr === dateFrom;
    });
  }, [staffDeps, dateFrom]);

  const staffReportItems = useMemo(() => {
    if (!targetStaff) return [];
    const items = [
      ...staffFilteredCollections.map(c => ({
        ...c,
        itemType: "collection",
        inAmount: c.total_amount || c.totalAmount || 0,
        outAmount: null,
        detailsText: c.retailer_name || "Unknown Retailer"
      })),
      ...staffFilteredDeposits.map(d => {
        const isRecipient = String(d.recipient_staff_id || d.recipientStaffId) === String(targetStaff.id) && d.deposit_type === "staff";
        const targetDisp = (d.deposit_type === "portal" && d.portal_name) ? d.portal_name : (d.target_name || "Super Distributor");
        return {
          ...d,
          itemType: isRecipient ? "collection" : "deposit",
          inAmount: isRecipient ? d.amount : null,
          outAmount: isRecipient ? null : d.amount,
          detailsText: isRecipient ? `Received from ${getStaffName(d)}` : targetDisp
        };
      })
    ];
    return items.sort((a, b) => getUtcDate(a.created_at).getTime() - getUtcDate(b.created_at).getTime());
  }, [staffFilteredCollections, staffFilteredDeposits, targetStaff]);

  const staffOpeningBalance = useMemo(() => {
    if (!targetStaff) return 0;
    const totalInBefore = staffCols
      .filter(c => {
        const localDateStr = c.collection_date || getISTDateString(getUtcDate(c.created_at));
        return localDateStr < dateFrom;
      })
      .reduce((sum, c) => sum + Number(c.total_amount || c.totalAmount || 0), 0) +
      staffDeps
      .filter(d => {
        const isRecipient = String(d.recipient_staff_id || d.recipientStaffId) === String(targetStaff.id) && d.deposit_type === "staff";
        if (!isRecipient) return false;
        const localDateStr = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
        return localDateStr < dateFrom;
      })
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);

    const totalOutBefore = staffDeps
      .filter(d => {
        const isRecipient = String(d.recipient_staff_id || d.recipientStaffId) === String(targetStaff.id) && d.deposit_type === "staff";
        if (isRecipient) return false;
        const localDateStr = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
        return localDateStr < dateFrom;
      })
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);

    return totalInBefore - totalOutBefore;
  }, [staffCols, staffDeps, dateFrom, targetStaff]);

  const staffTotalInToday = useMemo(() => {
    return staffReportItems.reduce((sum, item) => sum + Number(item.inAmount || 0), 0);
  }, [staffReportItems]);

  const staffTotalOutToday = useMemo(() => {
    return staffReportItems.reduce((sum, item) => sum + Number(item.outAmount || 0), 0);
  }, [staffReportItems]);

  const staffLastBalance = useMemo(() => {
    return staffOpeningBalance + staffTotalInToday - staffTotalOutToday;
  }, [staffOpeningBalance, staffTotalInToday, staffTotalOutToday]);

  const computeStaffDenomBreakdown = (throughDateInclusive: string) => {
    const notes = { note500: 0, note200: 0, note100: 0, note50: 0, note20: 0, note10: 0, coins: 0 };
    if (!targetStaff) return notes;
    
    staffCols.forEach((c) => {
      if (!c.denominations) return;
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (cDate > throughDateInclusive) return;
      notes.note500 += Number(c.denominations.note_500) || 0;
      notes.note200 += Number(c.denominations.note_200) || 0;
      notes.note100 += Number(c.denominations.note_100) || 0;
      notes.note50  += Number(c.denominations.note_50)  || 0;
      notes.note20  += Number(c.denominations.note_20)  || 0;
      notes.note10  += Number(c.denominations.note_10)  || 0;
      notes.coins   += Number(c.denominations.coins)    || 0;
    });
    
    staffDeps.forEach((d) => {
      if (!d.denominations) return;
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dDate > throughDateInclusive) return;
      const isReceivedHandover = String(d.recipient_staff_id || d.recipientStaffId) === String(targetStaff.id) && d.deposit_type === "staff";
      if (!isReceivedHandover && d.deposit_type === "virtual") return;
      const sign = isReceivedHandover ? 1 : -1;
      notes.note500 += sign * (Number(d.denominations.note_500) || 0);
      notes.note200 += sign * (Number(d.denominations.note_200) || 0);
      notes.note100 += sign * (Number(d.denominations.note_100) || 0);
      notes.note50  += sign * (Number(d.denominations.note_50)  || 0);
      notes.note20  += sign * (Number(d.denominations.note_20)  || 0);
      notes.note10  += sign * (Number(d.denominations.note_10)  || 0);
      notes.coins   += sign * (Number(d.denominations.coins)    || 0);
    });
    
    notes.coins = Math.round(notes.coins * 100) / 100;
    return notes;
  };

  const staffOpeningDenom = useMemo(() => {
    if (!targetStaff) return { note500: 0, note200: 0, note100: 0, note50: 0, note20: 0, note10: 0, coins: 0 };
    const dayBefore = (() => {
      const d = new Date(dateFrom + "T00:00:00");
      d.setDate(d.getDate() - 1);
      return getISTDateString(d);
    })();
    return computeStaffDenomBreakdown(dayBefore);
  }, [staffCols, staffDeps, dateFrom, targetStaff]);

  const staffLastDenom = useMemo(() => {
    return computeStaffDenomBreakdown(dateFrom);
  }, [staffCols, staffDeps, dateFrom, targetStaff]);

  const renderNetDenomBreakdown = (notes: { note500: number; note200: number; note100: number; note50: number; note20: number; note10: number; coins: number }) => {
    const items = [
      { label: "500", count: notes.note500 },
      { label: "200", count: notes.note200 },
      { label: "100", count: notes.note100 },
      { label: "50", count: notes.note50 },
      { label: "20", count: notes.note20 },
      { label: "10", count: notes.note10 },
    ].filter(n => n.count !== 0);

    if (items.length === 0 && notes.coins === 0) {
      return <span className="text-slate-400 font-mono text-[10px]">-</span>;
    }

    return (
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-bold justify-end font-mono tabular-nums">
        {items.map(n => (
          <span key={n.label} className={n.count < 0 ? "text-red-600 font-bold" : "text-slate-700 font-bold"}>
            ₹{n.label}×{n.count}
          </span>
        ))}
        {notes.coins !== 0 && (
          <span className={notes.coins < 0 ? "text-red-600 font-bold" : "text-slate-700 font-bold"}>
            Coins=₹{notes.coins.toFixed(2)}
          </span>
        )}
      </div>
    );
  };

  const renderNotesBreakdown = (item: any) => {
    const denoms = item.denominations || {};

    const noteItems: { label: string; count: number; total: number }[] = [];
    let noteCountSum = 0;
    let cashTotal = 0;

    const notesConfig = [
      { key: "note_500", label: "500" },
      { key: "note_200", label: "200" },
      { key: "note_100", label: "100" },
      { key: "note_50", label: "50" },
      { key: "note_20", label: "20" },
      { key: "note_10", label: "10" }
    ];

    notesConfig.forEach(n => {
      const rawVal = Number(denoms[n.key] || 0);
      const absCount = Math.abs(rawVal);
      if (absCount !== 0) {
        const lineTotal = absCount * Number(n.label);
        noteCountSum += absCount;
        cashTotal += lineTotal;
        noteItems.push({ label: n.label, count: absCount, total: lineTotal });
      }
    });

    const coinsVal = Math.abs(Number(denoms.coins || 0));
    const onlineVal = Math.abs(Number(denoms.online_amount || 0));

    if (noteItems.length === 0 && coinsVal === 0 && onlineVal === 0) {
      return <span className="text-slate-400 font-mono text-[10px]">-</span>;
    }

    return (
      <div className="text-[10px] leading-tight font-medium text-slate-800 space-y-0.5 text-right font-mono tabular-nums bg-slate-50/70 p-1 rounded-sm border border-slate-200/60">
        {noteItems.map(n => (
          <div key={n.label} className="text-slate-700 font-semibold">
            {n.label}×{n.count} = <span className="font-bold text-slate-900">₹{n.total.toLocaleString("en-IN")}</span>
          </div>
        ))}
        {coinsVal > 0 && (
          <div className="text-slate-700 font-semibold">
            Coins = <span className="font-bold text-slate-900">₹{coinsVal.toFixed(2)}</span>
          </div>
        )}
        {onlineVal > 0 && (
          <div className="text-sky-700 font-bold">
            Online = ₹{onlineVal.toLocaleString("en-IN")}
          </div>
        )}
        {noteCountSum > 0 && (
          <div className="text-[9.5px] font-black text-slate-500 border-t border-slate-200/80 pt-0.5 mt-0.5 uppercase tracking-wider">
            Total: {noteCountSum} Notes
          </div>
        )}
      </div>
    );
  };

  // Filtered Daybook Summary Data (Complete Unfiltered Daily Statement for that Day)
  const filteredDaybook = useMemo(() => {
    const combined: any[] = [];

    // Collections = Receipts (Debit Cash / IN)
    collections.forEach((c: any, idx: number) => {
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (dateFrom && cDate < dateFrom) return;
      if (dateTo && cDate > dateTo) return;

      const mainTitle = c.retailer_name || "Cash Collection";
      const subTitle = [c.store_name ? `Store: ${c.store_name}` : null, `Staff: ${getStaffName(c)}`].filter(Boolean).join(" | ");

      combined.push({
        id: c.id || `col_${idx}`,
        created_at: c.created_at,
        cDate: cDate,
        vchType: "Receipt",
        vchNo: c.reference_no || `REC-${idx + 1}`,
        particularsMain: mainTitle,
        particularsSub: subTitle,
        isReceipt: true,
        amount: Number(c.total_amount || c.totalAmount || 0),
        remarks: c.remarks || ""
      });
    });

    // Deposits = Payments (Credit Cash / OUT)
    deposits.forEach((d: any, idx: number) => {
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dateFrom && dDate < dateFrom) return;
      if (dateTo && dDate > dateTo) return;

      let vchType = "Payment";
      if (d.deposit_type === "transfer") vchType = "Journal";
      if (d.deposit_type === "retailer") vchType = "Payment";

      const mainTitle = d.portal_name || d.target_name || "Cash Deposit";
      const subTitle = [d.deposit_type ? `Type: ${d.deposit_type.toUpperCase()}` : null, `Staff: ${getStaffName(d)}`].filter(Boolean).join(" | ");

      combined.push({
        id: d.id || `dep_${idx}`,
        created_at: d.created_at,
        cDate: dDate,
        vchType: vchType,
        vchNo: d.reference_no || `PAY-${idx + 1}`,
        particularsMain: mainTitle,
        particularsSub: subTitle,
        isReceipt: false,
        amount: Number(d.amount || 0),
        remarks: d.remarks || ""
      });
    });

    let result = combined;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.particularsMain.toLowerCase().includes(q) ||
        item.particularsSub.toLowerCase().includes(q) ||
        item.vchType.toLowerCase().includes(q) ||
        item.vchNo.toLowerCase().includes(q) ||
        String(item.amount).includes(q) ||
        item.remarks.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
  }, [collections, deposits, dateFrom, dateTo, searchQuery, userDirectory]);

  // Filtered Cashbook Data (Two-Sided T-Account Receipts Dr / Payments Cr Format)
  const filteredCashbook = useMemo(() => {
    const receipts: any[] = [];
    const payments: any[] = [];

    // Receipts (Dr. Side) - Collections
    collections.forEach((c: any, idx: number) => {
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (dateFrom && cDate < dateFrom) return;
      if (dateTo && cDate > dateTo) return;

      const isBank = (c.payment_mode || c.paymentMode || "").toLowerCase() === "online" || (c.payment_mode || c.paymentMode || "").toLowerCase() === "bank";
      const amt = Number(c.total_amount || c.totalAmount || 0);

      receipts.push({
        id: c.id || `rec_${idx}`,
        created_at: c.created_at,
        particulars: c.retailer_name || "Cash Collection",
        subText: c.store_name ? `Store: ${c.store_name}` : `Staff: ${getStaffName(c)}`,
        cashAmt: isBank ? 0 : amt,
        bankAmt: isBank ? amt : 0,
        remarks: c.remarks || "-",
        isBank
      });
    });

    // Payments (Cr. Side) - Deposits / Handovers
    deposits.forEach((d: any, idx: number) => {
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dateFrom && dDate < dateFrom) return;
      if (dateTo && dDate > dateTo) return;

      const isBank = d.deposit_type === "portal" || d.deposit_type === "virtual" || (d.payment_mode || d.paymentMode || "").toLowerCase() === "online";
      const amt = Number(d.amount || 0);

      payments.push({
        id: d.id || `pay_${idx}`,
        created_at: d.created_at,
        particulars: d.portal_name || d.target_name || "Cash Deposit",
        subText: d.deposit_type ? `Type: ${d.deposit_type.toUpperCase()}` : `Staff: ${getStaffName(d)}`,
        cashAmt: isBank ? 0 : amt,
        bankAmt: isBank ? amt : 0,
        remarks: d.remarks || "-",
        isBank
      });
    });

    receipts.sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
    payments.sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());

    const totalCashReceipts = receipts.reduce((sum, r) => sum + r.cashAmt, 0);
    const totalBankReceipts = receipts.reduce((sum, r) => sum + r.bankAmt, 0);
    const totalCashPayments = payments.reduce((sum, p) => sum + p.cashAmt, 0);
    const totalBankPayments = payments.reduce((sum, p) => sum + p.bankAmt, 0);

    const netCashBalance = totalCashReceipts - totalCashPayments;
    const netBankBalance = totalBankReceipts - totalBankPayments;

    const maxRows = Math.max(receipts.length, payments.length);

    return {
      receipts,
      payments,
      maxRows,
      totalCashReceipts,
      totalBankReceipts,
      totalCashPayments,
      totalBankPayments,
      netCashBalance,
      netBankBalance
    };
  }, [collections, deposits, dateFrom, dateTo, userDirectory]);  // Filtered Retailer Ledger Data
  const filteredRetailerLedger = useMemo(() => {
    return collections.filter((c: any) => {
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (dateFrom && cDate < dateFrom) return false;
      if (dateTo && cDate > dateTo) return false;

      // Multi-Retailer Filter
      if (selectedRetailerIds.length > 0 && !selectedRetailerIds.includes("all")) {
        if (selectedRetailerIds.includes("__none__")) return false;
        const matches = selectedRetailerIds.some(id =>
          String(c.retailer_id) === String(id) ||
          c.retailer_name === id ||
          String(c.id) === String(id)
        );
        if (!matches) return false;
      }

      // Multi-Staff Filter
      if (selectedStaffIds.length > 0 && !selectedStaffIds.includes("all")) {
        if (selectedStaffIds.includes("__none__")) return false;
        const sName = getStaffName(c);
        const matches = selectedStaffIds.some(id =>
          String(c.from_staff_id || c.staff_id) === String(id) ||
          sName === id ||
          sName.toLowerCase() === id.toLowerCase()
        );
        if (!matches) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const retName = (c.retailer_name || "").toLowerCase();
        const storeName = (c.store_name || "").toLowerCase();
        const staffName = getStaffName(c).toLowerCase();
        const amount = String(c.total_amount || c.totalAmount || "");
        const remarks = (c.remarks || "").toLowerCase();
        if (!retName.includes(q) && !storeName.includes(q) && !staffName.includes(q) && !amount.includes(q) && !remarks.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
  }, [collections, dateFrom, dateTo, selectedRetailerIds, selectedStaffIds, searchQuery, userDirectory]);

  // Filtered Portal Ledger Data
  const filteredPortalLedger = useMemo(() => {
    return deposits.filter((d: any) => {
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dateFrom && dDate < dateFrom) return false;
      if (dateTo && dDate > dateTo) return false;

      // Multi-Portal Filter
      if (selectedPortalIds.length > 0 && !selectedPortalIds.includes("all")) {
        if (selectedPortalIds.includes("__none__")) return false;
        const matches = selectedPortalIds.some(id =>
          String(d.portal_id) === String(id) ||
          d.portal_name === id
        );
        if (!matches) return false;
      }

      // Multi-Staff Filter
      if (selectedStaffIds.length > 0 && !selectedStaffIds.includes("all")) {
        if (selectedStaffIds.includes("__none__")) return false;
        const sName = getStaffName(d);
        const matches = selectedStaffIds.some(id =>
          String(d.staff_id) === String(id) ||
          sName === id ||
          sName.toLowerCase() === id.toLowerCase()
        );
        if (!matches) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const portalName = (d.portal_name || "").toLowerCase();
        const targetName = (d.target_name || "").toLowerCase();
        const staffName = getStaffName(d).toLowerCase();
        const amount = String(d.amount || "");
        const remarks = (d.remarks || "").toLowerCase();
        if (!portalName.includes(q) && !targetName.includes(q) && !staffName.includes(q) && !amount.includes(q) && !remarks.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
  }, [deposits, dateFrom, dateTo, selectedPortalIds, selectedStaffIds, searchQuery, userDirectory]);

  // Filtered Staff Collection Efficiency Data
  const staffEfficiencyData = useMemo(() => {
    const map = new Map<string, {
      staffId: string;
      staffName: string;
      collectionsCount: number;
      collectionsTotal: number;
      depositsCount: number;
      depositsTotal: number;
    }>();

    collections.forEach((c: any) => {
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (dateFrom && cDate < dateFrom) return;
      if (dateTo && cDate > dateTo) return;

      const resolvedName = getStaffName(c);
      const staffId = String(c.from_staff_id || c.staff_id || resolvedName);
      const mapKey = resolvedName !== "Staff Member" ? resolvedName : staffId;

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          staffId: staffId,
          staffName: resolvedName,
          collectionsCount: 0,
          collectionsTotal: 0,
          depositsCount: 0,
          depositsTotal: 0
        });
      }
      const entry = map.get(mapKey)!;
      entry.collectionsCount += 1;
      entry.collectionsTotal += Number(c.total_amount || c.totalAmount || 0);
    });

    deposits.forEach((d: any) => {
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dateFrom && dDate < dateFrom) return;
      if (dateTo && dDate > dateTo) return;

      const resolvedName = getStaffName(d);
      const staffId = String(d.staff_id || resolvedName);
      const mapKey = resolvedName !== "Staff Member" ? resolvedName : staffId;

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          staffId: staffId,
          staffName: resolvedName,
          collectionsCount: 0,
          collectionsTotal: 0,
          depositsCount: 0,
          depositsTotal: 0
        });
      }
      const entry = map.get(mapKey)!;
      entry.depositsCount += 1;
      entry.depositsTotal += Number(d.amount || 0);
    });

    let list = Array.from(map.values());

    if (selectedStaffIds.length > 0 && !selectedStaffIds.includes("all")) {
      if (selectedStaffIds.includes("__none__")) {
        list = [];
      } else {
        list = list.filter(item =>
          selectedStaffIds.some(id =>
            item.staffId === String(id) ||
            item.staffName === id ||
            item.staffName.toLowerCase() === id.toLowerCase()
          )
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => item.staffName.toLowerCase().includes(q));
    }

    return list.sort((a, b) => b.collectionsTotal - a.collectionsTotal);
  }, [collections, deposits, dateFrom, dateTo, selectedStaffIds, searchQuery, userDirectory]);

  // Filtered Tally Friendly Import Data (Matching Tally Excel Import Format)
  const filteredTallyImport = useMemo(() => {
    const combined: any[] = [];

    // Collections (Receipt Vouchers)
    collections.forEach((c: any, idx: number) => {
      const cDate = c.collection_date || getISTDateString(getUtcDate(c.created_at));
      if (dateFrom && cDate < dateFrom) return;
      if (dateTo && cDate > dateTo) return;

      const dt = getUtcDate(c.created_at || cDate);
      const dateFormatted = isNaN(dt.getTime())
        ? cDate
        : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" });

      combined.push({
        id: c.id || `col_${idx}`,
        created_at: c.created_at,
        voucherDate: dateFormatted,
        voucherTypeName: "Receipt",
        voucherNumber: c.reference_no || `REC-${idx + 1}`,
        buyerSupplierAddress: c.address || c.store_name || "",
        buyerSupplierPincode: c.pincode || "",
        ledgerName: c.retailer_name || "Cash Collection",
        ledgerAmount: Number(c.total_amount || c.totalAmount || 0),
        ledgerAmountDrCr: "Cr",
        itemName: "",
        billedQuantity: "",
        itemRate: "",
        colL: "",
        itemRatePer: "",
        itemAmount: "",
        changeMode: "As Voucher"
      });
    });

    // Deposits (Payment Vouchers)
    deposits.forEach((d: any, idx: number) => {
      const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
      if (dateFrom && dDate < dateFrom) return;
      if (dateTo && dDate > dateTo) return;

      let vchType = "Payment";
      if (d.deposit_type === "transfer") vchType = "Journal";

      const dt = getUtcDate(d.created_at || dDate);
      const dateFormatted = isNaN(dt.getTime())
        ? dDate
        : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" });

      combined.push({
        id: d.id || `dep_${idx}`,
        created_at: d.created_at,
        voucherDate: dateFormatted,
        voucherTypeName: vchType,
        voucherNumber: d.reference_no || `PAY-${idx + 1}`,
        buyerSupplierAddress: d.address || "",
        buyerSupplierPincode: d.pincode || "",
        ledgerName: d.portal_name || d.target_name || "Bank Deposit",
        ledgerAmount: Number(d.amount || 0),
        ledgerAmountDrCr: "Dr",
        itemName: "",
        billedQuantity: "",
        itemRate: "",
        colL: "",
        itemRatePer: "",
        itemAmount: "",
        changeMode: "As Voucher"
      });
    });

    return combined.sort((a, b) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
  }, [collections, deposits, dateFrom, dateTo]);

  // ── Virtual Ledger Data (Portal-to-Portal, Portal-to-Distributor, Dist-to-Portal)
  const virtualLedgerData = useMemo(() => {
    return deposits
      .filter((d: any) => {
        const dDate = d.deposit_date || getISTDateString(getUtcDate(d.created_at));
        if (dateFrom && dDate < dateFrom) return false;
        if (dateTo && dDate > dateTo) return false;

        // API returns camelCase: depositType, isRefund, paymentMode
        const isPortalTransfer = d.depositType === "portal_transfer" || d.deposit_type === "portal_transfer";
        const isVirtual = d.depositType === "virtual" || d.deposit_type === "virtual";
        const isRefund = d.isRefund === true || d.is_refund === true || d.paymentMode === "refund" || d.payment_mode === "refund";

        // sub-type specific filtering
        if (virtualLedgerSubType === "portal_to_portal") return isPortalTransfer;
        if (virtualLedgerSubType === "portal_to_dist") return isVirtual && !isRefund;
        if (virtualLedgerSubType === "dist_to_portal") return isVirtual && isRefund;
        // "all": portal_transfer OR virtual (any direction)
        return isPortalTransfer || isVirtual;
      })
      .map((d: any) => {
        const isPortalTransfer = d.depositType === "portal_transfer" || d.deposit_type === "portal_transfer";
        const isRefund = d.isRefund === true || d.is_refund === true || d.paymentMode === "refund" || d.payment_mode === "refund";
        const isVirtual = d.depositType === "virtual" || d.deposit_type === "virtual";

        let txSubType = "Portal → Portal";
        // fromLabel / toLabel — use camelCase fields that match VirtualLedgerTab
        let fromLabel = d.fromPortalName || d.fromBankAccountName || d.from_portal_name || "Portal";
        let toLabel = d.portalName || d.bankAccountName || d.portal_name || "Portal";

        if (isVirtual && !isRefund) {
          txSubType = "Portal → Distributor";
          fromLabel = d.portalName || d.bankAccountName || d.portal_name || "Portal";
          toLabel = (d.targetName || d.target_name || "Distributor")
            .replace(/^(Retailer:?\s*-\s*|Retailer:?\s*|Staff:?\s*-\s*|Staff:?\s*)/i, "");
        } else if (isVirtual && isRefund) {
          txSubType = "Distributor → Portal";
          fromLabel = (d.targetName || d.target_name || "Distributor")
            .replace(/^(Retailer:?\s*-\s*|Retailer:?\s*|Staff:?\s*-\s*|Staff:?\s*)/i, "");
          toLabel = d.portalName || d.bankAccountName || d.portal_name || "Portal";
        } else if (isPortalTransfer) {
          txSubType = "Portal → Portal";
          fromLabel = d.fromPortalName || d.fromBankAccountName || d.from_portal_name || "Portal";
          toLabel = d.portalName || d.bankAccountName || d.portal_name || "Portal";
        }

        return {
          id: d.id,
          created_at: d.created_at,
          date: d.deposit_date || d.date || d.created_at,
          amount: Number(d.amount || 0),
          txSubType,
          fromLabel,
          toLabel,
          staffName: d.staffName || d.staff_name || "Admin",
          remarks: d.remarks || "",
          reference_no: d.reference_no || d.referenceNo || "",
          rawRecord: d
        };
      })
      .sort((a: any, b: any) => getUtcDate(b.created_at).getTime() - getUtcDate(a.created_at).getTime());
  }, [deposits, dateFrom, dateTo, virtualLedgerSubType]);

  // Export handlers
  const handleExportCsv = (reportType: string) => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `Report_${reportType}_${dateFrom}_to_${dateTo}.csv`;

    if (reportType === "tally_import") {
      filename = `Tally_Friendly_Import_${dateFrom}_to_${dateTo}.csv`;
      headers = [
        "Voucher Date",
        "Voucher Type Name",
        "Voucher Number",
        "Buyer/Supplier - Address",
        "Buyer/Supplier - Pincode",
        "Ledger Name",
        "Ledger Amount",
        "Ledger Amount Dr/Cr",
        "Item Name",
        "Billed Quantity",
        "Item Rate",
        "",
        "Item Rate per",
        "Item Amount",
        "Change Mode"
      ];
      rows = filteredTallyImport.map((row) => [
        `"${row.voucherDate}"`,
        `"${row.voucherTypeName}"`,
        `"${row.voucherNumber}"`,
        `"${(row.buyerSupplierAddress || '').replace(/"/g, '""')}"`,
        `"${(row.buyerSupplierPincode || '').replace(/"/g, '""')}"`,
        `"${(row.ledgerName || '').replace(/"/g, '""')}"`,
        row.ledgerAmount,
        `"${row.ledgerAmountDrCr}"`,
        `"${(row.itemName || '').replace(/"/g, '""')}"`,
        `"${(row.billedQuantity || '').replace(/"/g, '""')}"`,
        `"${(row.itemRate || '').replace(/"/g, '""')}"`,
        `""`,
        `"${(row.itemRatePer || '').replace(/"/g, '""')}"`,
        `"${(row.itemAmount || '').replace(/"/g, '""')}"`,
        `"${(row.changeMode || '').replace(/"/g, '""')}"`
      ]);
    } else if (reportType === "collections") {
      filename = `GSTR1_Sales_CashIn_${dateFrom}_to_${dateTo}.csv`;
      headers = ["Collection Date", "Retailer Name", "Store Name", "Reference No", "Staff Name", "Amount (IN)", "Remarks"];
      rows = collections.map((c, i) => {
        const dt = formatDateDisplay(c.created_at);
        return [
          dt.date,
          `"${(c.retailer_name || '').replace(/"/g, '""')}"`,
          `"${(c.store_name || '').replace(/"/g, '""')}"`,
          `"${(c.reference_no || '').replace(/"/g, '""')}"`,
          `"${getStaffName(c).replace(/"/g, '""')}"`,
          Number(c.total_amount || c.totalAmount || 0),
          `"${(c.remarks || '').replace(/"/g, '""')}"`
        ];
      });
    } else if (reportType === "daybook") {
      headers = ["Date", "Time", "Particulars (Main)", "Particulars (Sub)", "Vch Type", "Vch No.", "Debit Amount (IN)", "Credit Amount (OUT)", "Remarks"];
      rows = filteredDaybook.map((tx) => {
        const dt = formatDateDisplay(tx.created_at);
        return [
          dt.date,
          dt.time,
          `"${tx.particularsMain.replace(/"/g, '""')}"`,
          `"${tx.particularsSub.replace(/"/g, '""')}"`,
          `"${tx.vchType}"`,
          `"${tx.vchNo}"`,
          tx.isReceipt ? tx.amount : 0,
          !tx.isReceipt ? tx.amount : 0,
          `"${(tx.remarks || '').replace(/"/g, '""')}"`
        ];
      });
    } else if (reportType === "cashbook") {
      headers = ["Receipt Particulars", "Receipt Cash", "Receipt Bank", "Receipt Remarks", "Payment Particulars", "Payment Cash", "Payment Bank", "Payment Remarks"];
      const { receipts, payments, maxRows } = filteredCashbook;
      rows = Array.from({ length: maxRows }).map((_, i) => {
        const r = receipts[i];
        const p = payments[i];
        return [
          r ? `"${r.particulars.replace(/"/g, '""')}"` : '""',
          r ? r.cashAmt : 0,
          r ? r.bankAmt : 0,
          r ? `"${(r.remarks || '').replace(/"/g, '""')}"` : '""',
          p ? `"${p.particulars.replace(/"/g, '""')}"` : '""',
          p ? p.cashAmt : 0,
          p ? p.bankAmt : 0,
          p ? `"${(p.remarks || '').replace(/"/g, '""')}"` : '""'
        ];
      });
    } else if (reportType === "retailer_ledger") {
      headers = ["No", "Date", "Time", "Retailer Name", "Store Name", "Staff Name", "Amount (IN)", "Remarks"];
      rows = filteredRetailerLedger.map((c, i) => {
        const dt = formatDateDisplay(c.created_at);
        return [
          i + 1,
          dt.date,
          dt.time,
          `"${(c.retailer_name || '').replace(/"/g, '""')}"`,
          `"${(c.store_name || 'Cash').replace(/"/g, '""')}"`,
          `"${getStaffName(c).replace(/"/g, '""')}"`,
          Number(c.total_amount || c.totalAmount || 0),
          `"${(c.remarks || '').replace(/"/g, '""')}"`
        ];
      });
    } else if (reportType === "portal_ledger") {
      headers = ["No", "Date", "Time", "Portal / Bank", "Deposit Type", "Target Name", "Staff Name", "Amount (OUT)", "Remarks"];
      rows = filteredPortalLedger.map((d, i) => {
        const dt = formatDateDisplay(d.created_at);
        return [
          i + 1,
          dt.date,
          dt.time,
          `"${(d.portal_name || 'Portal').replace(/"/g, '""')}"`,
          `"${(d.deposit_type || '').replace(/"/g, '""')}"`,
          `"${(d.target_name || 'Recipient').replace(/"/g, '""')}"`,
          `"${getStaffName(d).replace(/"/g, '""')}"`,
          Number(d.amount || 0),
          `"${(d.remarks || '').replace(/"/g, '""')}"`
        ];
      });
    } else if (reportType === "staff_efficiency") {
      headers = ["No", "Staff Name", "Collections Count", "Total Collected (IN)", "Deposits Count", "Total Deposited (OUT)", "Net Pending Handover"];
      rows = staffEfficiencyData.map((s, i) => [
        i + 1,
        `"${s.staffName.replace(/"/g, '""')}"`,
        s.collectionsCount,
        s.collectionsTotal,
        s.depositsCount,
        s.depositsTotal,
        s.collectionsTotal - s.depositsTotal
      ]);
    } else if (reportType === "staff_daily_cash") {
      if (!targetStaff) {
        alert("Please select a single staff member first.");
        return;
      }
      const staffNameClean = targetStaff.name.trim().replace(/\s+/g, "_");
      filename = `${staffNameClean}_${dateFrom}.csv`;
      headers = ["S.No", "Date", "Description/Narration", "In (Credit)", "Out (Debit)", "Remarks", "Denominations"];
      rows = staffReportItems.map((item, idx) => {
        const isCol = item.itemType === "collection";
        const dt = formatDateDisplay(item.created_at || item.date || "");
        
        const staffName = getStaffName(item) || targetStaff.name;
        let source = "";
        let destination = "";
        if (isCol) {
          const isCms = item.retailer_name?.toLowerCase().startsWith("cms");
          const storeStr = item.store_name && item.store_name !== "Cash" ? ` (${item.store_name})` : "";
          const retDispName = isCms 
            ? `${item.retailer_name} - ${item.store_name || "Cash"}` 
            : (item.from_staff_name ? `Staff: ${item.from_staff_name}` : `${item.retailer_name || "Retailer"}${storeStr}`);
          source = item.from_office ? "Super Distributor" : retDispName;
          destination = item.portal_name
            ? `${item.portal_name}${item.bank_name ? ` (${item.bank_name})` : (item.bank_account_name ? ` (${item.bank_account_name})` : "")}`
            : staffName;
        } else {
          source = staffName;
          const bankSuffix = (item.deposit_type === "portal" && item.bank_name)
            ? ` (${item.bank_name})`
            : (item.store_name && item.store_name !== "Cash" ? ` (${item.store_name})` : "");
          const destName = (item.deposit_type === "portal" && item.portal_name) ? item.portal_name : (item.target_name || "Recipient");
          destination = item.to_office ? "Super Distributor" : `${destName}${bankSuffix}`;
        }
        const narration = `From ${source} to ${destination}`;

        // Denominations text formatting
        const denoms = item.denominations || {};
        const denomParts: string[] = [];
        const notesKeys = ["note_500", "note_200", "note_100", "note_50", "note_20", "note_10"];
        notesKeys.forEach(k => {
          if (denoms[k]) denomParts.push(`${k.replace("note_", "")}x${denoms[k]}`);
        });
        if (denoms.coins) denomParts.push(`Coins: ${denoms.coins}`);
        if (denoms.online_amount) denomParts.push(`Online: ${denoms.online_amount}`);
        const denomStr = denomParts.join(", ");

        return [
          idx + 1,
          `"${dt.date} ${dt.time}"`,
          `"${narration.replace(/"/g, '""')}"`,
          isCol ? item.inAmount : "-",
          !isCol ? item.outAmount : "-",
          `"${(item.remarks || "").replace(/"/g, '""')}"`,
          `"${denomStr.replace(/"/g, '""')}"`
        ];
      });
    } else if (reportType === "virtual_ledger") {
      const subLabel = virtualLedgerSubType === "portal_to_portal" ? "Portal_to_Portal"
        : virtualLedgerSubType === "portal_to_dist" ? "Portal_to_Distributor"
        : virtualLedgerSubType === "dist_to_portal" ? "Distributor_to_Portal"
        : "All_Combined";
      filename = `Virtual_Ledger_${subLabel}_${dateFrom}_to_${dateTo}.csv`;
      headers = ["No", "Date", "Transaction Type", "From", "To", "Amount (₹)", "Staff", "Reference No", "Remarks"];
      rows = virtualLedgerData.map((tx: any, i: number) => {
        const dt = formatDateDisplay(tx.created_at);
        return [
          i + 1,
          dt.date,
          `"${tx.txSubType}"`,
          `"${(tx.fromLabel || '').replace(/"/g, '""')}"`,
          `"${(tx.toLabel || '').replace(/"/g, '""')}"`,
          Number(tx.amount || 0),
          `"${(tx.staffName || '').replace(/"/g, '""')}"`,
          `"${(tx.reference_no || '').replace(/"/g, '""')}"`,
          `"${(tx.remarks || '').replace(/"/g, '""')}"`
        ];
      });
    }

    if (rows.length === 0 && reportType !== "virtual_ledger" && reportType !== "staff_daily_cash") {
      alert("No data available for export.");
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportXml = () => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<ENVELOPE>\n`;
    xml += `  <HEADER>\n`;
    xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
    xml += `  </HEADER>\n`;
    xml += `  <BODY>\n`;
    xml += `    <IMPORTDATA>\n`;
    xml += `      <REQUESTDESC>\n`;
    xml += `        <REPORTNAME>Vouchers</REPORTNAME>\n`;
    xml += `      </REQUESTDESC>\n`;
    xml += `      <REQUESTDATA>\n`;

    filteredTallyImport.forEach(item => {
      let dateStr = item.voucherDate;
      let yyyymmdd = "";
      if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          yyyymmdd = `${parts[2]}${parts[1]}${parts[0]}`;
        }
      }
      if (!yyyymmdd) yyyymmdd = getISTDateString().replace(/-/g, "");

      const cleanLedger = (item.ledgerName || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
      xml += `          <VOUCHER VCHTYPE="${item.voucherTypeName}" ACTION="Create">\n`;
      xml += `            <DATE>${yyyymmdd}</DATE>\n`;
      xml += `            <VOUCHERTYPENAME>${item.voucherTypeName}</VOUCHERTYPENAME>\n`;
      xml += `            <VOUCHERNUMBER>${item.voucherNumber}</VOUCHERNUMBER>\n`;
      xml += `            <PARTYLEDGERNAME>${cleanLedger}</PARTYLEDGERNAME>\n`;
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${cleanLedger}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>${item.ledgerAmountDrCr === 'Dr' ? 'YES' : 'NO'}</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${item.ledgerAmountDrCr === 'Dr' ? -item.ledgerAmount : item.ledgerAmount}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      xml += `          </VOUCHER>\n`;
      xml += `        </TALLYMESSAGE>\n`;
    });

    xml += `      </REQUESTDATA>\n`;
    xml += `    </IMPORTDATA>\n`;
    xml += `  </BODY>\n`;
    xml += `</ENVELOPE>`;

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tally_Import_Vouchers_${dateFrom}_to_${dateTo}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdfReport = () => {
    setIsDownloadingPdf(true);
    const reportName = selectedReport === "staff_reports" 
      ? (staffSubReport === "efficiency" ? "Staff_Collection_Efficiency" : `${targetStaff ? targetStaff.name.trim().replace(/\s+/g, "_") : "Staff"}_Daily_Cash_Report`)
      : selectedReport;
    const filename = `${reportName}_${dateFrom}_to_${dateTo}.pdf`;
    downloadElementAsPdf("report-export-content", filename, 0.3)
      .catch((err) => {
        console.error("PDF Download error, opening print dialog:", err);
        window.print();
      })
      .finally(() => setIsDownloadingPdf(false));
  };

  // Overview stats — counts
  const totalStaffCount = staffList.length;
  const totalRetailerCount = useMemo(() => {
    if (retailerDirectory && retailerDirectory.length > 0) return retailerDirectory.length;
    return new Set(collections.map((c: any) => c.retailer_name || c.retailerName).filter(Boolean)).size;
  }, [retailerDirectory, collections]);
  const totalPortalCount = useMemo(() => {
    if (portalDirectory && portalDirectory.length > 0) return portalDirectory.length;
    const names = new Set<string>();
    deposits.forEach((d: any) => { if (d.portal_name && !isUuid(d.portal_name)) names.add(d.portal_name); });
    return names.size;
  }, [portalDirectory, deposits]);

  const reportSections = [
    {
      title: "Accounting & GST",
      reports: [
        { name: "Tally Friendly Import (XML)", icon: Book, formats: "XML • CSV", color: "blue", type: "tally_import" },
      ]
    },
    {
      title: "Daily Statements",
      reports: [
        { name: "Daybook Summary", icon: Calendar, formats: "PDF • XLSX", color: "emerald", type: "daybook" },
        { name: "Cashbook (Physical Flow)", icon: IndianRupee, formats: "PDF • XLSX", color: "emerald", type: "cashbook" },
        { name: "Staff Reports (Efficiency & Cash Flow)", icon: Activity, formats: "PDF • CSV • XLSX", color: "emerald", type: "staff_reports" },
      ]
    },
    {
      title: "Retailer & Portals",
      reports: [
        { name: "Retailer Ledger (A-Z)", icon: FileText, formats: "PDF • XLSX", color: "purple", type: "retailer_ledger" },
        { name: "Portal Ledger", icon: PieChart, formats: "PDF • XLSX", color: "purple", type: "portal_ledger" },
      ]
    },
    {
      title: "Virtual Ledger",
      reports: [
        { name: "Portal → Portal Transfers", icon: Share2, formats: "PDF • CSV", color: "indigo", type: "virtual_ledger", subType: "portal_to_portal" },
        { name: "Portal → Distributor (Gave)", icon: CreditCard, formats: "PDF • CSV", color: "indigo", type: "virtual_ledger", subType: "portal_to_dist" },
        { name: "Distributor → Portal (Got Back)", icon: Building2, formats: "PDF • CSV", color: "indigo", type: "virtual_ledger", subType: "dist_to_portal" },
        { name: "Virtual Ledger — All Combined", icon: BarChart, formats: "PDF • CSV", color: "indigo", type: "virtual_ledger", subType: "all" },
      ]
    }
  ];

  // If a report is selected, render the dedicated Filter & Report Viewer!
  if (selectedReport) {
    let reportTitle = "Report View";
    if (selectedReport === "daybook") reportTitle = "Day Book Summary";
    if (selectedReport === "cashbook") reportTitle = "Cash Book (Physical & Bank Flow)";
    if (selectedReport === "retailer_ledger") reportTitle = "Retailer Ledger Report (A-Z)";
    if (selectedReport === "portal_ledger") reportTitle = "Portal Ledger Report";
    if (selectedReport === "staff_reports") {
      reportTitle = staffSubReport === "efficiency"
        ? "Staff Collection Efficiency Report"
        : (targetStaff ? `${targetStaff.name}'s Daily Cash Report` : "Staff Daily Cash Report");
    }
    if (selectedReport === "tally_import") reportTitle = "Tally Friendly Import Report";
    if (selectedReport === "virtual_ledger") {
      reportTitle = virtualLedgerSubType === "portal_to_portal" ? "Virtual Ledger — Portal to Portal"
        : virtualLedgerSubType === "portal_to_dist" ? "Virtual Ledger — Portal to Distributor"
        : virtualLedgerSubType === "dist_to_portal" ? "Virtual Ledger — Distributor to Portal"
        : "Virtual Ledger — All Combined";
    }

    return (
      <div className="space-y-4 pb-20">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-sm w-full max-w-full">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSelectedReport(null)}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-sm cursor-pointer transition-colors shrink-0"
              title="Back to Reports Overview"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">{reportTitle}</h2>
              <p className="text-[10px] text-slate-400 font-bold truncate">
                {selectedReport === "daybook" || selectedReport === "cashbook" || selectedReport === "tally_import" ? "Complete Daily Statement (Unfiltered)" : "Interactive data filter & statement generator"}
              </p>
            </div>
          </div>

          {/* Export Action Buttons - Fully Responsive 3 Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full">
            {selectedReport === "tally_import" && (
              <button
                onClick={handleExportXml}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                <Book className="w-3.5 h-3.5" />
                <span>Tally XML</span>
              </button>
            )}
            <button
              onClick={() => {
                if (selectedReport === "staff_reports") {
                  if (staffSubReport === "efficiency") handleExportCsv("staff_efficiency");
                  else handleExportCsv("staff_daily_cash");
                } else {
                  handleExportCsv(selectedReport);
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel (CSV)</span>
            </button>
            <button
              onClick={handleDownloadPdfReport}
              disabled={isDownloadingPdf}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm text-[11px] font-bold disabled:opacity-50 cursor-pointer transition-colors whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? "Downloading..." : "PDF"}</span>
            </button>
          </div>
        </div>

        {/* Virtual Ledger Sub-Type Selector */}
        {selectedReport === "virtual_ledger" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Transaction Type Filter</p>
            <div className="flex flex-wrap gap-2">
              {([
                { id: "all", label: "All Combined", color: "indigo" },
                { id: "portal_to_portal", label: "Portal → Portal", color: "blue" },
                { id: "portal_to_dist", label: "Portal → Distributor", color: "purple" },
                { id: "dist_to_portal", label: "Distributor → Portal", color: "emerald" },
              ] as const).map((opt) => {
                const isActive = virtualLedgerSubType === opt.id;
                const colorMap: Record<string, string> = {
                  indigo: isActive ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50",
                  blue: isActive ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50",
                  purple: isActive ? "bg-purple-600 text-white border-purple-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-50",
                  emerald: isActive ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50",
                };
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVirtualLedgerSubType(opt.id)}
                    className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-colors ${colorMap[opt.color]}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Staff Reports Option Selector */}
        {selectedReport === "staff_reports" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Report Type Filter</p>
            <div className="flex flex-wrap gap-2">
              {([
                { id: "efficiency", label: "Staff Collection Efficiency", color: "emerald" },
                { id: "daily_cash", label: "Staff Daily Cash Report", color: "emerald" },
              ] as const).map((opt) => {
                const isActive = staffSubReport === opt.id;
                const colorClass = isActive 
                  ? "bg-emerald-600 text-white border-emerald-600" 
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50";
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStaffSubReport(opt.id)}
                    className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-colors ${colorClass}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Panel (Hidden for Daybook Summary, Cashbook & Tally Import as requested) */}
        {selectedReport !== "daybook" && selectedReport !== "cashbook" && selectedReport !== "tally_import" && selectedReport !== "virtual_ledger" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3.5 space-y-3">
            {selectedReport !== "staff_reports" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* SEARCH */}
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Search</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input autoComplete="one-time-code"
                      type="text"
                      placeholder="Search party or staff..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm pl-8 pr-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* FILTER BY RETAILER/PARTY */}
                <div>
                  <MultiSelectDropdown
                    label="Filter by Retailer/Party (Single/Multi)"
                    placeholder="All Parties / Retailers"
                    options={normalizedRetailerOptions}
                    selectedIds={selectedRetailerIds}
                    onChange={setSelectedRetailerIds}
                  />
                </div>

                {/* FILTER BY PORTAL/BANK */}
                <div>
                  <MultiSelectDropdown
                    label="Filter by Portal/Bank (Single/Multi)"
                    placeholder="All Portals / Banks"
                    options={normalizedPortalOptions}
                    selectedIds={selectedPortalIds}
                    onChange={setSelectedPortalIds}
                  />
                </div>
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-${selectedReport === "staff_reports" && staffSubReport === "daily_cash" ? "2" : "3"} gap-3 pt-1`}>
              {/* STAFF */}
              <div>
                <MultiSelectDropdown
                  label="Filter by Staff (Single/Multi)"
                  placeholder="All Staff Members"
                  options={normalizedStaffOptions}
                  selectedIds={selectedStaffIds}
                  onChange={setSelectedStaffIds}
                />
              </div>

              {/* DATE FROM / SELECTED DATE */}
              <div>
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  {selectedReport === "staff_reports" && staffSubReport === "daily_cash" ? "Selected Date" : "Date From"}
                </label>
                <input autoComplete="one-time-code"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>

              {/* DATE TO */}
              {!(selectedReport === "staff_reports" && staffSubReport === "daily_cash") && (
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Date To</label>
                  <input autoComplete="one-time-code"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Active Filter Badges & Reset Button */}
            {(selectedRetailerIds.length > 0 || selectedPortalIds.length > 0 || selectedStaffIds.length > 0 || searchQuery.trim()) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold">
                <span className="text-slate-400 uppercase text-[9px] font-black">Active Filters:</span>
                {selectedRetailerIds.length > 0 && !selectedRetailerIds.includes("all") && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full flex items-center gap-1">
                    Parties: {selectedRetailerIds.includes("__none__") ? "None" : `${selectedRetailerIds.length} Selected`}
                    <button onClick={() => setSelectedRetailerIds([])} className="hover:text-red-500 cursor-pointer">×</button>
                  </span>
                )}
                {selectedPortalIds.length > 0 && !selectedPortalIds.includes("all") && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full flex items-center gap-1">
                    Portals: {selectedPortalIds.includes("__none__") ? "None" : `${selectedPortalIds.length} Selected`}
                    <button onClick={() => setSelectedPortalIds([])} className="hover:text-red-500 cursor-pointer">×</button>
                  </span>
                )}
                {selectedStaffIds.length > 0 && !selectedStaffIds.includes("all") && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full flex items-center gap-1">
                    Staff: {selectedStaffIds.includes("__none__") ? "None" : `${selectedStaffIds.length} Selected`}
                    <button onClick={() => setSelectedStaffIds([])} className="hover:text-red-500 cursor-pointer">×</button>
                  </span>
                )}
                {searchQuery.trim() && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full flex items-center gap-1">
                    Query: "{searchQuery}"
                    <button onClick={() => setSearchQuery("")} className="hover:text-red-500 cursor-pointer">×</button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedRetailerIds([]);
                    setSelectedPortalIds([]);
                    setSelectedStaffIds([]);
                    setSearchQuery("");
                  }}
                  className="text-red-500 hover:underline cursor-pointer ml-auto text-[9px] font-black uppercase"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Virtual Ledger Date Filter (shown for virtual_ledger) */}
        {selectedReport === "virtual_ledger" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Date Range Filter</p>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="text-[9px] font-black text-indigo-600 hover:underline uppercase tracking-wider cursor-pointer"
                >
                  Clear — Show All Time
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Date From</label>
                <input autoComplete="one-time-code"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Date To</label>
                <input autoComplete="one-time-code"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-2">
              {virtualLedgerData.length} entries found{!dateFrom && !dateTo ? " (All Time)" : " in selected range"}
            </p>
          </div>
        )}

        {/* Exportable Report Content Section */}
        <div id="report-export-content" className="bg-white text-black p-3 rounded-sm border border-slate-200 space-y-3 font-sans">
          
          {/* Top Banner Header */}
          <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-cyan-400 via-sky-400 to-blue-500 opacity-90 transform skew-x-12 origin-top-right -mr-3" />
            <div className="relative p-2.5 pr-28 z-10">
              <h2 className="text-base font-black tracking-tight leading-none text-sky-900">{reportTitle}</h2>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-slate-50/50 py-1.5 text-center relative z-10">
              <span className="text-[11px] font-black text-slate-950 uppercase tracking-widest">
                Statement Period - {dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`}
              </span>
            </div>
          </div>

          {/* DAYBOOK SUMMARY VIEW (Complete Daily Statement) */}
          {selectedReport === "daybook" && (() => {
            const totalReceipts = filteredDaybook.reduce((sum, tx) => sum + (tx.isReceipt ? tx.amount : 0), 0);
            const totalPayments = filteredDaybook.reduce((sum, tx) => sum + (!tx.isReceipt ? tx.amount : 0), 0);
            const netFlow = totalReceipts - totalPayments;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Vouchers</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{filteredDaybook.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Receipts (Debit)</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5 font-mono">₹{totalReceipts.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Payments (Credit)</span>
                    <span className="text-sm font-black text-red-500 mt-0.5 font-mono">₹{totalPayments.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Net Cash Flow</span>
                    <span className={`text-sm font-black mt-0.5 font-mono ${netFlow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      ₹{netFlow.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Day Book Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
                  {filteredDaybook.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No daybook transactions found for {dateFrom}.
                    </div>
                  ) : (
                    <table className="w-full min-w-[600px] text-xs text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[12%] text-[11px] uppercase">Date</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[34%] text-[11px] uppercase">Particulars</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[14%] text-[11px] uppercase">Vch Type</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[10%] text-[11px] uppercase">Vch No.</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[15%] text-[11px] uppercase">Debit Amount (IN)</th>
                          <th className="py-2 px-0.5 text-center w-[15%] text-[11px] uppercase">Credit Amount (OUT)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredDaybook.map((tx, idx) => {
                          const dt = formatDateDisplay(tx.created_at);
                          return (
                            <tr key={tx.id || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center text-[11px] leading-tight font-semibold text-slate-700">
                                <div>{dt.date}</div>
                                <div className="text-slate-400 font-mono text-[10px] mt-0.5">{dt.time}</div>
                              </td>
                              <td className="py-2 px-1 text-center font-semibold text-slate-800 leading-snug">
                                <div className="font-black text-slate-900 text-[11.5px]">{tx.particularsMain}</div>
                                <div className="text-[10px] font-bold text-slate-500 mt-0.5">{tx.particularsSub}</div>
                              </td>
                              <td className="py-2 px-1 text-center font-bold text-slate-700 text-[11px] uppercase">
                                <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-black ${
                                  tx.vchType === "Receipt" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  tx.vchType === "Payment" ? "bg-red-50 text-red-700 border border-red-200" :
                                  "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}>
                                  {tx.vchType}
                                </span>
                              </td>
                              <td className="py-2 px-0.5 text-center font-mono text-slate-600 text-[11px]">
                                {tx.vchNo}
                              </td>
                              <td className="py-2 px-0.5 text-center font-extrabold text-emerald-600 text-xs font-mono">
                                {tx.isReceipt ? `₹${Number(tx.amount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2 px-0.5 text-center font-extrabold text-red-500 text-xs font-mono">
                                {!tx.isReceipt ? `₹${Number(tx.amount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* CASHBOOK VIEW (Two-Sided Receipts Dr / Payments Cr Format in CrediiFlow Theme) */}
          {selectedReport === "cashbook" && (() => {
            const { 
              receipts, 
              payments, 
              maxRows, 
              totalCashReceipts, 
              totalBankReceipts, 
              totalCashPayments, 
              totalBankPayments, 
              netCashBalance, 
              netBankBalance 
            } = filteredCashbook;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs gap-y-2 sm:gap-y-0">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Cash In (Dr)</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5 font-mono">₹{totalCashReceipts.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Cash Out (Cr)</span>
                    <span className="text-sm font-black text-red-500 mt-0.5 font-mono">₹{totalCashPayments.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Closing Cash Balance</span>
                    <span className={`text-sm font-black mt-0.5 font-mono ${netCashBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      ₹{netCashBalance.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Closing Bank Balance</span>
                    <span className={`text-sm font-black mt-0.5 font-mono ${netBankBalance >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                      ₹{netBankBalance.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Two-Sided T-Account Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
                  {maxRows === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No cashbook transactions recorded for the selected date.
                    </div>
                  ) : (
                    <table className="w-full min-w-[700px] text-xs text-left border-collapse table-fixed">
                      <thead>
                        {/* Group Header */}
                        <tr className="bg-sky-900 text-white font-black text-[11px] uppercase border-b border-sky-950">
                          <th colSpan={4} className="py-1.5 px-2 text-center border-r border-sky-800 tracking-wider">
                            Receipts (Dr.) - Cash & Bank Inflows
                          </th>
                          <th colSpan={4} className="py-1.5 px-2 text-center tracking-wider">
                            Payments (Cr.) - Cash & Bank Outflows
                          </th>
                        </tr>
                        {/* Sub Column Header */}
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold text-[10px] uppercase">
                          {/* Dr Side */}
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%]">Receipt Particulars</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[11%]">Cash</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[11%]">Bank</th>
                          <th className="py-2 px-0.5 border-r-2 border-slate-300 text-center w-[10%]">Remarks</th>
                          
                          {/* Cr Side */}
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%]">Payment Particulars</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[11%]">Cash</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[11%]">Bank</th>
                          <th className="py-2 px-0.5 text-center w-[10%]">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {Array.from({ length: maxRows }).map((_, idx) => {
                          const r = receipts[idx];
                          const p = payments[idx];

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              {/* Dr Side */}
                              <td className="py-2 px-1 border-r border-slate-200 text-center leading-tight">
                                {r ? (
                                  <>
                                    <div className="font-bold text-slate-900 text-[11px]">{r.particulars}</div>
                                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{r.subText}</div>
                                  </>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="py-2 px-0.5 border-r border-slate-200 text-center font-bold text-emerald-600 text-[11px] font-mono">
                                {r && !r.isBank ? `₹${r.cashAmt.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2 px-0.5 border-r border-slate-200 text-center font-bold text-indigo-600 text-[11px] font-mono">
                                {r && r.isBank ? `₹${r.bankAmt.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2 px-0.5 border-r-2 border-slate-300 text-center text-slate-500 italic text-[10px]">
                                {r ? r.remarks : "-"}
                              </td>

                              {/* Cr Side */}
                              <td className="py-2 px-1 border-r border-slate-200 text-center leading-tight">
                                {p ? (
                                  <>
                                    <div className="font-bold text-slate-900 text-[11px]">{p.particulars}</div>
                                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{p.subText}</div>
                                  </>
                                ) : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2 px-0.5 border-r border-slate-200 text-center font-bold text-red-500 text-[11px] font-mono">
                                {p && !p.isBank ? `₹${p.cashAmt.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2 px-0.5 border-r border-slate-200 text-center font-bold text-red-500 text-[11px] font-mono">
                                {p && p.isBank ? `₹${p.bankAmt.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2 px-0.5 text-center text-slate-500 italic text-[10px]">
                                {p ? p.remarks : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        {/* Totals Row */}
                        <tr className="bg-slate-100 font-black text-[11px] border-t-2 border-slate-300 text-slate-900">
                          <td className="py-2 px-1 text-center border-r border-slate-200 uppercase">Total Receipts (Dr)</td>
                          <td className="py-2 px-0.5 text-center border-r border-slate-200 font-mono text-emerald-700">₹{totalCashReceipts.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-0.5 text-center border-r border-slate-200 font-mono text-indigo-700">₹{totalBankReceipts.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-0.5 border-r-2 border-slate-300 text-center">-</td>

                          <td className="py-2 px-1 text-center border-r border-slate-200 uppercase">Total Payments (Cr)</td>
                          <td className="py-2 px-0.5 text-center border-r border-slate-200 font-mono text-red-600">₹{totalCashPayments.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-0.5 text-center border-r border-slate-200 font-mono text-red-600">₹{totalBankPayments.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-0.5 text-center">-</td>
                        </tr>

                        {/* Balance c/d Row */}
                        <tr className="bg-slate-200/70 font-black text-[11px] border-t border-slate-300 text-slate-950">
                          <td colSpan={4} className="py-2 px-1 text-center border-r-2 border-slate-300 uppercase">
                            Closing Cash & Bank Position
                          </td>
                          <td className="py-2 px-1 text-center border-r border-slate-200 uppercase font-black">Balance c/d</td>
                          <td className={`py-2 px-0.5 text-center border-r border-slate-200 font-mono ${netCashBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            ₹{netCashBalance.toLocaleString("en-IN")}
                          </td>
                          <td className={`py-2 px-0.5 text-center border-r border-slate-200 font-mono ${netBankBalance >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                            ₹{netBankBalance.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-0.5 text-center">-</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* RETAILER LEDGER VIEW */}
          {selectedReport === "retailer_ledger" && (() => {
            const totalIn = filteredRetailerLedger.reduce((sum, c) => sum + Number(c.total_amount || c.totalAmount || 0), 0);
            const uniqueRetCount = new Set(filteredRetailerLedger.map(c => c.retailer_name)).size;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-3 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Retailers</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{uniqueRetCount} Active</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Entries</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{filteredRetailerLedger.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Collected (IN)</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5 font-mono">₹{totalIn.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
                  {filteredRetailerLedger.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No retailer collection records found matching the filters.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse table-fixed min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[5%] text-[11px] uppercase">No</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[13%] text-[11px] uppercase">Date</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[25%] text-[11px] uppercase">Retailer</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[11px] uppercase">Store</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[15%] text-[11px] uppercase">Staff</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[14%] text-[11px] uppercase">Amount (IN)</th>
                          <th className="py-2 px-1 text-center w-[10%] text-[11px] uppercase">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredRetailerLedger.map((c, idx) => {
                          const dt = formatDateDisplay(c.created_at);
                          return (
                            <tr key={c.id || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center font-bold text-slate-800 text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-0.5 text-center text-[11px] leading-tight font-semibold text-slate-700">
                                <div>{dt.date}</div>
                                <div className="text-slate-400 font-mono text-[10px] mt-0.5">{dt.time}</div>
                              </td>
                              <td className="py-2 px-1 text-center font-bold text-slate-900 text-[11.5px]">{c.retailer_name || "Retailer"}</td>
                              <td className="py-2 px-1 text-center font-semibold text-indigo-600 text-[11px]">{c.store_name || "Cash"}</td>
                              <td className="py-2 px-1 text-center font-bold text-slate-700 text-[11px] uppercase">{getStaffName(c)}</td>
                              <td className="py-2 px-0.5 text-center font-extrabold text-emerald-600 text-xs font-mono">₹{Number(c.total_amount || c.totalAmount || 0).toLocaleString("en-IN")}</td>
                              <td className="py-2 px-1 text-center text-slate-500 italic text-[10px]">{c.remarks || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* PORTAL LEDGER VIEW */}
          {selectedReport === "portal_ledger" && (() => {
            const totalOut = filteredPortalLedger.reduce((sum, d) => sum + Number(d.amount || 0), 0);
            const uniquePortalsCount = new Set(filteredPortalLedger.map(d => d.portal_name)).size;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-3 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Portals</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{uniquePortalsCount} Active</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Entries</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{filteredPortalLedger.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Deposited (OUT)</span>
                    <span className="text-sm font-black text-red-500 mt-0.5 font-mono">₹{totalOut.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
                  {filteredPortalLedger.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No portal deposit records found matching the filters.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse table-fixed min-w-[650px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[5%] text-[11px] uppercase">No</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[13%] text-[11px] uppercase">Date</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[22%] text-[11px] uppercase">Portal / Bank</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[15%] text-[11px] uppercase">Deposit Type</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[11px] uppercase">Target Name</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[13%] text-[11px] uppercase">Staff</th>
                          <th className="py-2 px-0.5 text-center w-[14%] text-[11px] uppercase">Amount (OUT)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredPortalLedger.map((d, idx) => {
                          const dt = formatDateDisplay(d.created_at);
                          return (
                            <tr key={d.id || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center font-bold text-slate-800 text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-0.5 text-center text-[11px] leading-tight font-semibold text-slate-700">
                                <div>{dt.date}</div>
                                <div className="text-slate-400 font-mono text-[10px] mt-0.5">{dt.time}</div>
                              </td>
                              <td className="py-2 px-1 text-center font-bold text-slate-900 text-[11.5px]">{d.portal_name || "Portal"}</td>
                              <td className="py-2 px-1 text-center font-semibold text-slate-600 text-[11px] uppercase">{d.deposit_type || "portal"}</td>
                              <td className="py-2 px-1 text-center font-semibold text-indigo-600 text-[11px]">{d.target_name || "-"}</td>
                              <td className="py-2 px-1 text-center font-bold text-slate-700 text-[11px] uppercase">{getStaffName(d)}</td>
                              <td className="py-2 px-0.5 text-center font-extrabold text-red-500 text-xs font-mono">-₹{Number(d.amount || 0).toLocaleString("en-IN")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* STAFF COLLECTION EFFICIENCY VIEW */}
          {selectedReport === "staff_reports" && staffSubReport === "efficiency" && (() => {
            const grandCollected = staffEfficiencyData.reduce((sum, s) => sum + s.collectionsTotal, 0);
            const grandDeposited = staffEfficiencyData.reduce((sum, s) => sum + s.depositsTotal, 0);
            const grandNetPending = grandCollected - grandDeposited;

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Active Staff</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{staffEfficiencyData.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Collected (IN)</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5 font-mono">₹{grandCollected.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Handed Over (OUT)</span>
                    <span className="text-sm font-black text-red-500 mt-0.5 font-mono">₹{grandDeposited.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Net Pending Cash</span>
                    <span className={`text-sm font-black mt-0.5 font-mono ${grandNetPending > 0 ? 'text-amber-600' : 'text-blue-900'}`}>
                      ₹{grandNetPending.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
                  {staffEfficiencyData.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No staff activity records found matching the filters.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse table-fixed min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[6%] text-[11px] uppercase">No</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[24%] text-[11px] uppercase">Staff Name</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[11px] uppercase">Collections Count</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[18%] text-[11px] uppercase">Total Collected (IN)</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[16%] text-[11px] uppercase">Total Deposited</th>
                          <th className="py-2 px-1 text-center w-[18%] text-[11px] uppercase">Net Pending Cash</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {staffEfficiencyData.map((s, idx) => {
                          const net = s.collectionsTotal - s.depositsTotal;
                          return (
                            <tr key={s.staffId || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center font-bold text-slate-800 text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-1 text-center font-black text-slate-900 text-xs uppercase">{s.staffName}</td>
                              <td className="py-2 px-1 text-center font-semibold text-slate-700 text-[11px]">{s.collectionsCount} trips</td>
                              <td className="py-2 px-1 text-center font-extrabold text-emerald-600 text-xs font-mono">₹{s.collectionsTotal.toLocaleString("en-IN")}</td>
                              <td className="py-2 px-1 text-center font-extrabold text-red-500 text-xs font-mono">₹{s.depositsTotal.toLocaleString("en-IN")}</td>
                              <td className={`py-2 px-1 text-center font-black text-xs font-mono ${net > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                                ₹{net.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TALLY FRIENDLY IMPORT VIEW */}
          {selectedReport === "tally_import" && (() => {
            const totalReceipts = filteredTallyImport.filter(t => t.voucherTypeName === "Receipt").reduce((sum, t) => sum + t.ledgerAmount, 0);
            const totalPayments = filteredTallyImport.filter(t => t.voucherTypeName !== "Receipt").reduce((sum, t) => sum + t.ledgerAmount, 0);

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Vouchers</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{filteredTallyImport.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Receipt Vouchers (Cr)</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5 font-mono">₹{totalReceipts.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Payment Vouchers (Dr)</span>
                    <span className="text-sm font-black text-red-500 mt-0.5 font-mono">₹{totalPayments.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Turnover</span>
                    <span className="text-sm font-black text-blue-900 mt-0.5 font-mono">
                      ₹{(totalReceipts + totalPayments).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Tally Format Table matching Excel SS1 */}
                <div className="border border-amber-300 rounded-lg overflow-x-auto table-scrollbar bg-white shadow-xs">
                  {filteredTallyImport.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No voucher entries found for Tally import.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse table-auto whitespace-nowrap min-w-[1400px]">
                      <thead>
                        <tr className="bg-amber-400 text-slate-950 font-black border-b border-amber-500 text-[11px] uppercase">
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Voucher Date</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Voucher Type Name</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Voucher Number</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-left">Buyer/Supplier - Address</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Buyer/Supplier - Pincode</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-left">Ledger Name</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-right">Ledger Amount</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Ledger Amount Dr/Cr</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Item Name</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Billed Quantity</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Item Rate</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center w-8"></th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Item Rate per</th>
                          <th className="py-2.5 px-2 border-r border-amber-500/50 text-center">Item Amount</th>
                          <th className="py-2.5 px-2 text-center">Change Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredTallyImport.map((row, idx) => (
                          <tr key={row.id || idx} className="hover:bg-amber-50/40 divide-x divide-slate-200 font-mono text-[11px]">
                            <td className="py-2 px-2 text-center text-slate-800 font-semibold">{row.voucherDate}</td>
                            <td className="py-2 px-2 text-center font-bold">
                              <span className={`px-1.5 py-0.5 rounded-xs font-black uppercase text-[10px] ${
                                row.voucherTypeName === "Receipt" ? "bg-emerald-100 text-emerald-800" :
                                row.voucherTypeName === "Payment" ? "bg-red-100 text-red-800" :
                                "bg-blue-100 text-blue-800"
                              }`}>
                                {row.voucherTypeName}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center text-slate-700 font-semibold">{row.voucherNumber}</td>
                            <td className="py-2 px-2 text-left font-sans text-slate-700">{row.buyerSupplierAddress || "-"}</td>
                            <td className="py-2 px-2 text-center text-slate-500">{row.buyerSupplierPincode || "-"}</td>
                            <td className="py-2 px-2 text-left font-sans font-bold text-slate-900">{row.ledgerName}</td>
                            <td className="py-2 px-2 text-right font-extrabold text-slate-900">₹{Number(row.ledgerAmount).toLocaleString("en-IN")}</td>
                            <td className="py-2 px-2 text-center font-bold">
                              <span className={`px-1 py-0.5 rounded-xs text-[10px] font-black ${row.ledgerAmountDrCr === "Dr" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                                {row.ledgerAmountDrCr}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400 italic">{row.itemName || "-"}</td>
                            <td className="py-2 px-2 text-center text-slate-400">{row.billedQuantity || "-"}</td>
                            <td className="py-2 px-2 text-center text-slate-400">{row.itemRate || "-"}</td>
                            <td className="py-2 px-2 text-center text-slate-300 w-8"></td>
                            <td className="py-2 px-2 text-center text-slate-400">{row.itemRatePer || "-"}</td>
                            <td className="py-2 px-2 text-center text-slate-400">{row.itemAmount || "-"}</td>
                            <td className="py-2 px-2 text-center font-sans text-slate-600 font-semibold">{row.changeMode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}
          {/* VIRTUAL LEDGER VIEW */}
          {selectedReport === "virtual_ledger" && (() => {
            const totalAmt = virtualLedgerData.reduce((sum: number, tx: any) => sum + tx.amount, 0);
            const portalToPortal = virtualLedgerData.filter((tx: any) => tx.txSubType === "Portal → Portal");
            const portalToDist = virtualLedgerData.filter((tx: any) => tx.txSubType === "Portal → Distributor");
            const distToPortal = virtualLedgerData.filter((tx: any) => tx.txSubType === "Distributor → Portal");

            const typeColorMap: Record<string, string> = {
              "Portal → Portal": "bg-indigo-100 text-indigo-700",
              "Portal → Distributor": "bg-purple-100 text-purple-700",
              "Distributor → Portal": "bg-emerald-100 text-emerald-700",
            };

            return (
              <div className="space-y-3">
                {/* Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Entries</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{virtualLedgerData.length}</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Portal→Portal</span>
                    <span className="text-sm font-black text-indigo-600 mt-0.5">{portalToPortal.length} txns</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider">Portal→Dist</span>
                    <span className="text-sm font-black text-purple-600 mt-0.5">{portalToDist.length} txns</span>
                  </div>
                  <div className="flex flex-col justify-center px-1">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Dist→Portal</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5">{distToPortal.length} txns</span>
                  </div>
                </div>
                {/* Total Amount */}
                <div className="text-right text-sm font-black text-slate-700 px-1">
                  Total Amount: <span className="font-mono text-indigo-700">₹{totalAmt.toLocaleString("en-IN")}</span>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
                  {virtualLedgerData.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold bg-white italic">
                      No virtual ledger transactions found for the selected type and date range.
                    </div>
                  ) : (
                    <table className="w-full min-w-[700px] text-xs text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-sky-950 font-bold">
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[5%] text-[11px] uppercase">No</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[11%] text-[11px] uppercase">Date</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[16%] text-[11px] uppercase">Txn Type</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[19%] text-[11px] uppercase">From</th>
                          <th className="py-2 px-1 border-r border-slate-200 text-center w-[19%] text-[11px] uppercase">To</th>
                          <th className="py-2 px-0.5 border-r border-slate-200 text-center w-[13%] text-[11px] uppercase">Amount</th>
                          <th className="py-2 px-1 text-center w-[17%] text-[11px] uppercase">Staff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {virtualLedgerData.map((tx: any, idx: number) => {
                          const dt = formatDateDisplay(tx.created_at);
                          const badgeClass = typeColorMap[tx.txSubType] || "bg-slate-100 text-slate-700";
                          return (
                            <tr key={tx.id || idx} className="hover:bg-slate-50/50 divide-x divide-slate-200">
                              <td className="py-2 px-0.5 text-center font-bold text-slate-700 text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-0.5 text-center text-[11px] leading-tight font-semibold text-slate-700">
                                <div>{dt.date}</div>
                                <div className="text-slate-400 font-mono text-[10px] mt-0.5">{dt.time}</div>
                              </td>
                              <td className="py-2 px-1 text-center">
                                <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-black ${badgeClass}`}>
                                  {tx.txSubType}
                                </span>
                              </td>
                              <td className="py-2 px-1 text-center font-semibold text-slate-800 text-[11px]">{tx.fromLabel}</td>
                              <td className="py-2 px-1 text-center font-semibold text-slate-800 text-[11px]">{tx.toLabel}</td>
                              <td className="py-2 px-0.5 text-center font-extrabold text-indigo-600 text-xs font-mono">
                                ₹{Number(tx.amount).toLocaleString("en-IN")}
                              </td>
                              <td className="py-2 px-1 text-center font-bold text-slate-600 text-[11px] uppercase">{tx.staffName}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {/* STAFF DAILY CASH REPORT VIEW */}
          {selectedReport === "staff_reports" && staffSubReport === "daily_cash" && (() => {
            if (!targetStaff) {
              return (
                <div className="p-8 text-center text-xs text-slate-500 font-bold bg-white italic border border-slate-200 rounded-lg">
                  Please filter by a single staff member using the "Filter by Staff" dropdown above to display their Daily Cash Report.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {/* Balance Summary Row */}
                <div className="grid grid-cols-4 border border-slate-200 rounded-lg bg-slate-50 py-2.5 text-center divide-x divide-slate-200 shadow-xs">
                  <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Opening Balance</span>
                    <span className="text-sm font-black text-blue-900 mt-1 tabular-nums whitespace-nowrap">
                      ₹{staffOpeningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Today's In</span>
                    <span className="text-sm font-black text-emerald-600 mt-1 tabular-nums whitespace-nowrap">
                      ₹{staffTotalInToday.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Today's Out</span>
                    <span className="text-sm font-black text-red-600 mt-1 tabular-nums whitespace-nowrap">
                      ₹{staffTotalOutToday.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center px-1 py-0.5 min-w-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Last Balance</span>
                    <span className="text-sm font-black text-blue-900 mt-1 tabular-nums whitespace-nowrap">
                      ₹{staffLastBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Transaction Data Table */}
                <div className="border-2 border-slate-300 rounded-lg overflow-x-auto bg-white shadow-xs">
                  <table className="w-full text-xs text-left border-collapse table-fixed min-w-[620px]">
                    <thead>
                      <tr className="bg-sky-900 text-white font-bold border-b-2 border-sky-950">
                        <th className="py-2.5 px-1 border-r border-sky-800 text-center w-[5%] text-[11px] font-black uppercase tracking-wider">No</th>
                        <th className="py-2.5 px-1.5 border-r border-sky-800 text-center w-[13%] text-[11px] font-black uppercase tracking-wider">Date</th>
                        <th className="py-2.5 px-2 border-r border-sky-800 text-left w-[32%] text-[11px] font-black uppercase tracking-wider">Description</th>
                        <th className="py-2.5 px-1.5 border-r border-sky-800 text-right w-[16%] text-[11px] font-black uppercase tracking-wider">In</th>
                        <th className="py-2.5 px-1.5 border-r border-sky-800 text-right w-[16%] text-[11px] font-black uppercase tracking-wider">Out</th>
                        <th className="py-2.5 px-1.5 text-right w-[18%] text-[11px] font-black uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening Balance Row */}
                      <tr className="bg-sky-50/80 font-bold text-slate-900 border-b border-slate-300">
                        <td className="py-2.5 px-1 border-r border-slate-300 text-center text-slate-400 font-bold">-</td>
                        <td className="py-2.5 px-1 border-r border-slate-300 text-center text-[11px] text-slate-400 font-bold">-</td>
                        <td className="py-2.5 px-2.5 border-r border-slate-300 text-left font-black text-sky-950 uppercase text-[11.5px] tracking-wider">
                          OPENING BALANCE
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-right font-black text-blue-900 text-xs font-mono tabular-nums">
                          ₹{staffOpeningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-right text-slate-400 font-bold">-</td>
                        <td className="py-2.5 px-1.5 align-middle bg-sky-50/40 text-right border-slate-300">
                          {renderNetDenomBreakdown(staffOpeningDenom)}
                        </td>
                      </tr>

                      {staffReportItems.length === 0 ? (
                        <tr className="border-b border-slate-300">
                          <td colSpan={6} className="py-6 text-center text-xs text-slate-500 font-bold bg-white italic">
                            No transaction records found for {new Date(dateFrom).toLocaleDateString("en-IN", { dateStyle: 'medium', timeZone: "Asia/Kolkata" })}.
                          </td>
                        </tr>
                      ) : (
                        staffReportItems.map((item, idx) => {
                          const dt = formatDateDisplay(item.created_at || item.date || "");
                          const isCol = item.itemType === "collection";
                          
                          const staffName = getStaffName(item) || targetStaff.name;
                          let source = "";
                          let destination = "";
                          if (isCol) {
                            const isCms = item.retailer_name?.toLowerCase().startsWith("cms");
                            const storeStr = item.store_name && item.store_name !== "Cash" ? ` (${item.store_name})` : "";
                            const retDispName = isCms 
                              ? `${item.retailer_name} - ${item.store_name || "Cash"}` 
                              : (item.from_staff_name ? `Staff: ${item.from_staff_name}` : `${item.retailer_name || "Retailer"}${storeStr}`);
                            source = item.from_office
                              ? "Super Distributor"
                              : retDispName;
                            destination = item.portal_name
                               ? `${item.portal_name}${item.bank_name ? ` (${item.bank_name})` : (item.bank_account_name ? ` (${item.bank_account_name})` : "")}`
                               : staffName;
                          } else {
                            source = staffName;
                            let destName = "";
                            const bankSuffix = (item.deposit_type === "portal" && item.bank_name)
                              ? ` (${item.bank_name})`
                              : (item.store_name && item.store_name !== "Cash" ? ` (${item.store_name})` : "");

                            if (item.deposit_type === "portal") {
                              const portalPart = item.portal_name || item.portalName || "";
                              const bankPart = item.bank_name || item.bankName || item.bank_account_name || item.bankAccountName || "";
                              if (portalPart && bankPart) {
                                destName = `Portal ${portalPart} (${bankPart})`;
                              } else {
                                destName = portalPart || bankPart || item.target_name || item.targetName || "Portal";
                              }
                            } else if (item.deposit_type === "retailer") {
                              destName = `Retailer: ${item.retailer_name || item.retailerName || item.target_name || item.targetName || "Retailer"}${bankSuffix}`;
                            } else if (item.deposit_type === "staff") {
                              destName = `Staff: ${item.recipient_staff_name || item.recipientStaffName || item.target_name || item.targetName || "Staff"}`;
                            } else {
                              destName = item.target_name || item.targetName || item.portal_name || item.retailer_name || "Super Distributor";
                            }
                            destination = item.to_office ? "Super Distributor" : destName;
                          }
                          const narration = `From ${source} to ${destination}`;
                          const isEven = idx % 2 === 0;

                          return (
                            <tr key={item.id || idx} className={`${isEven ? 'bg-white' : 'bg-slate-50/70'} border-b border-slate-300 hover:bg-sky-50/40 transition-colors`}>
                              <td className="py-2.5 px-1 border-r border-slate-300 text-center font-bold text-slate-900 text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-1.5 border-r border-slate-300 text-center text-[11px] leading-tight font-bold text-slate-900">
                                <div>{dt.date}</div>
                                <div className="text-slate-500 mt-0.5 font-mono text-[10px] font-medium">{dt.time}</div>
                              </td>
                              <td className="py-2.5 px-2.5 border-r border-slate-300 text-left font-bold text-slate-900 break-words text-[11.5px] leading-snug">
                                <div className="text-slate-900 font-bold">{narration}</div>
                                {item.remarks && (
                                  <div className="text-[10px] text-slate-600 font-medium mt-0.5 italic">
                                    Remark: {item.remarks}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-2 border-r border-slate-300 text-right font-black text-emerald-700 text-xs font-mono tabular-nums">
                                {isCol ? `₹${Number(item.inAmount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2.5 px-2 border-r border-slate-300 text-right font-black text-red-600 text-xs font-mono tabular-nums">
                                {!isCol ? `-₹${Number(item.outAmount).toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                              <td className="py-2.5 px-1.5 align-middle bg-slate-50/40">
                                {renderNotesBreakdown(item)}
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {/* Last Balance Row */}
                      <tr className="bg-sky-50/80 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td className="py-2.5 px-1 border-r border-slate-300 text-center text-slate-400 font-bold">-</td>
                        <td className="py-2.5 px-1 border-r border-slate-300 text-center text-[11px] text-slate-400 font-bold">-</td>
                        <td className="py-2.5 px-2.5 border-r border-slate-300 text-left font-black text-sky-950 uppercase text-[11.5px] tracking-wider">
                          LAST BALANCE
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-right font-black text-blue-900 text-xs font-mono tabular-nums">
                          ₹{staffLastBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-right text-slate-400 font-bold">-</td>
                        <td className="py-2.5 px-1.5 align-middle bg-sky-50/40 text-right border-slate-300">
                          {renderNetDenomBreakdown(staffLastDenom)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    );
  }

  // DEFAULT VIEW: Professional Report Cards List
  return (
    <div className="space-y-3 pb-20">
      {/* Stats Overview — Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-sm">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-sm uppercase tracking-tighter">Staff</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Total No. of Staff</p>
          <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono tabular-nums">
            {totalStaffCount}
          </h3>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-sm">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-sm uppercase tracking-tighter">Retailers</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Total No. of Retailers</p>
          <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono tabular-nums">
            {totalRetailerCount}
          </h3>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-sm">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-sm uppercase tracking-tighter">Portals</span>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Total No. of Portals</p>
          <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1 font-mono tabular-nums">
            {totalPortalCount}
          </h3>
        </div>
      </div>

      {/* Professional Report Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reportSections.map((section, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <div className={`w-1 h-3 rounded-sm ${
                section.title.includes('GST') ? 'bg-blue-500'
                : section.title.includes('Daily') ? 'bg-emerald-500'
                : section.title.includes('Virtual') ? 'bg-indigo-500'
                : 'bg-purple-500'
              }`} />
              {section.title}
            </h4>

            <div className="space-y-1.5">
              {section.reports.map((report: any, rIdx: number) => (
                <div 
                  key={rIdx} 
                  onClick={() => {
                    if (report.type) {
                      if (report.subType) setVirtualLedgerSubType(report.subType);
                      if (report.type === "virtual_ledger") {
                        // Clear date filters so all-time records show
                        setDateFrom("");
                        setDateTo("");
                      }
                      setSelectedReport(report.type);
                    } else {
                      alert("Report generator for " + report.name + " is being prepared.");
                    }
                  }}
                  className="group flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white dark:bg-slate-900 rounded-sm border border-slate-100 dark:border-slate-800 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                      <report.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{report.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{report.formats}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                       e.stopPropagation();
                       if (report.type) {
                         if (report.subType) setVirtualLedgerSubType(report.subType);
                         if (report.type === "virtual_ledger") {
                           setDateFrom("");
                           setDateTo("");
                         }
                         setSelectedReport(report.type);
                       } else {
                         alert("Report generator for " + report.name + " is being prepared.");
                       }
                    }}
                    className={`p-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity ${
                      report.color === 'blue' ? 'bg-blue-600 text-white'
                      : report.color === 'emerald' ? 'bg-emerald-600 text-white'
                      : report.color === 'indigo' ? 'bg-indigo-600 text-white'
                      : 'bg-purple-600 text-white'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
