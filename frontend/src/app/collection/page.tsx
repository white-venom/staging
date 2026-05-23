"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, DenominationCounts } from "../utils/store";
import { db, seedOfflineRetailers, CachedRetailer } from "../utils/db";
import { 
  ArrowLeft, 
  Store as StoreIcon, 
  Coins, 
  FileText, 
  Smartphone,
  Sun,
  Moon,
  Search,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  User as UserIcon,
  Building,
  ChevronDown
} from "lucide-react";

export default function NewCollection() {
  const router = useRouter();
  const { theme, toggleTheme, addCollection } = useAppStore();

  // Network State status bar
  const [isOnline, setIsOnline] = useState(true);

  // Search & Selector State
  const [retailers, setRetailers] = useState<CachedRetailer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<CachedRetailer | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [retailerStores, setRetailerStores] = useState<any[]>([]);
  const [remarks, setRemarks] = useState("");

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [sourceType, setSourceType] = useState<"retailer" | "staff" | "office">("retailer");
  const [staffMembers, setStaffMembers] = useState<any[]>([]);

  // Fetch stores when retailer changes
  useEffect(() => {
    const fetchStores = async () => {
      if (selectedRetailer && !selectedRetailer.id.startsWith("ret-") && isOnline) {
        try {
          const { api } = await import("../utils/api");
          const stores = await api.getRetailerStores(selectedRetailer.id);
          setRetailerStores(stores);
          setSelectedStoreId("");
        } catch (err) {
          console.warn("Failed to load stores", err);
          setRetailerStores([]);
        }
      } else {
        setRetailerStores([]);
      }
    };
    fetchStores();
  }, [selectedRetailer, isOnline]);

  // Notes state
  const [denominations, setDenominations] = useState<DenominationCounts>({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0
  });

  // Calculate dynamic cash totals
  const totalCashAmount = (
    denominations.note_500 * 500 +
    denominations.note_200 * 200 +
    denominations.note_100 * 100 +
    denominations.note_50 * 50 +
    denominations.note_20 * 20 +
    denominations.note_10 * 10 +
    denominations.coins
  );

  const totalCollectionAmount = totalCashAmount + denominations.online_amount;

  // Touch Remarks Chips
  const remarksChips = ["Fully Collected", "Closed Shop", "Partial Payment", "Customer Out of Town", "Short cash"];

  const [mounted, setMounted] = useState(false);

  // Seed and fetch offline database (Dexie) on mount
  useEffect(() => {
    setMounted(true);
    const initDB = async () => {
      try {
        const { api } = await import("../utils/api");
        const realRetailers = await api.getRetailers();
        
        if (realRetailers && realRetailers.length > 0) {
          await db.retailers.clear();
          await db.retailers.bulkPut(realRetailers.map((r: any) => ({
            id: r.id,
            name: r.retailer_name,
            phone: r.phone || "",
            portalName: "Standard",
            opening_to_give: parseFloat(r.opening_to_give || 0),
            opening_to_take: parseFloat(r.opening_to_take || 0),
            net_balance: parseFloat(r.balance || 0)
          })));
        }
      } catch (err) {
        console.warn("Failed to fetch live retailers, using cache:", err);
      }
      
      const cached = await db.retailers.toArray();
      const validRetailers = cached.filter(r => !r.id.startsWith("ret-"));
      setRetailers(validRetailers);
      if (validRetailers.length > 0) {
        setSelectedRetailer(validRetailers[0]);
      }

      // Fetch Staff Members
      try {
        const { api } = await import("../utils/api");
        const allUsers = await api.getUsers();
        setStaffMembers(allUsers.filter((u: any) => u.role === "staff"));
      } catch (err) {
        console.warn("Failed to fetch staff members", err);
      }
    };
    initDB();

    // Browser network tracker
    if (typeof window !== "undefined") {
      setIsOnline(window.navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  if (!mounted) return null;

  // Filter query selector
  const filteredRetailers = retailers.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.phone.includes(searchQuery)
  );

  const handleDenomChange = (key: keyof DenominationCounts, value: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setDenominations(prev => ({
      ...prev,
      [key]: isNaN(val) ? 0 : val
    }));
  };



  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceType === "retailer" && !selectedRetailer) {
      alert("Please select a valid retailer.");
      return;
    }
    if (sourceType === "staff" && !selectedStaffId) {
      alert("Please select the source staff member.");
      return;
    }
    if (totalCollectionAmount <= 0) {
      alert("Collection total must be greater than zero.");
      return;
    }

    // INTERCEPT OFFLINE SUBMISSIONS:
    if (!isOnline) {
      await db.collections.add({
        retailer_id: selectedRetailer!.id,
        store_id: selectedStoreId || undefined,
        retailerName: selectedRetailer?.name || "Unknown",
        portalName: selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : "Direct Retailer Handover",
        totalAmount: totalCollectionAmount,
        denominations,
        remarks: remarks || "Offline transaction logs",
        date: new Date().toISOString().replace("T", " ").substring(0, 16),
        synced: 0
      });
      alert("⚠️ Offline! Collection saved to local device browser database. It will automatically sync as soon as you connect to internet!");
      router.push("/staff");
      return;
    }

    // ONLINE SUBMISSION: Attempt to hit the backend API
    try {
      const { api } = await import("../utils/api");
      
      // Attempt to send to real backend
      await api.createCollection({
        retailer_id: sourceType === "retailer" ? selectedRetailer!.id : null,
        from_staff_id: sourceType === "staff" ? selectedStaffId : null,
        from_office: sourceType === "office",
        store_id: selectedStoreId || null,
        total_amount: totalCollectionAmount,
        denominations: denominations,
        remarks: remarks || "Immediate credit logged"
      });

      // If successful, we still update Zustand so it reflects immediately
      addCollection({
        retailer_id: sourceType === "retailer" ? selectedRetailer!.id : "office",
        store_id: selectedStoreId || undefined,
        retailerName: sourceType === "retailer" ? selectedRetailer!.name : (sourceType === "staff" ? `Staff: ${staffMembers.find(s => s.id === selectedStaffId)?.name}` : "Office"),
        portalName: selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : "Direct Handover",
        totalAmount: totalCollectionAmount,
        denominations,
        remarks: remarks || "Immediate credit logged"
      });
      
      router.push("/staff");
    } catch (err: any) {
      console.error("Backend submission failed:", err);
      
      // FALLBACK for local testing: if backend is not linked or IDs are invalid
      // We still update the local store so it shows up in the Admin Panel
      addCollection({
        retailer_id: sourceType === "retailer" ? selectedRetailer!.id : "office",
        store_id: selectedStoreId || undefined,
        retailerName: sourceType === "retailer" ? selectedRetailer!.name : (sourceType === "staff" ? `Staff: ${staffMembers.find(s => s.id === selectedStaffId)?.name}` : "Office"),
        portalName: selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : "Direct Handover",
        totalAmount: totalCollectionAmount,
        denominations,
        remarks: remarks || "Logged locally (Backend failed/unlinked)"
      });
      
      const detail = err.message || "Unlinked";
      alert("Note: Entry saved to local state. (Backend sync failed: " + detail + ")");
      router.push("/staff");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col gap-5 select-none pb-24">
        
        {/* Navigation block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/staff")}
              type="button"
              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Cash In Entry</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Record payment details.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Network Indicators */}
            <div className={`p-2 rounded-lg flex items-center justify-center border ${
              isOnline 
                ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-emerald-600" 
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-500 animate-pulse"
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>


          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          
          {/* SOURCE TYPE SELECTOR */}
          <div className="p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-1">
            <button
              type="button"
              onClick={() => setSourceType("retailer")}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${sourceType === "retailer" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              Retailer
            </button>
            <button
              type="button"
              onClick={() => setSourceType("staff")}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${sourceType === "staff" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => setSourceType("office")}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${sourceType === "office" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              Office
            </button>
          </div>

          {/* DYNAMIC SOURCE INPUT */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
            {sourceType === "retailer" && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                    Find Shop or Retailer
                  </label>
                  
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Type retailer name or phone..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-semibold"
                    />
                  </div>

                  {showSearchDropdown && searchQuery && (
                    <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 z-20 relative">
                      {filteredRetailers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center font-medium">
                          No retailers matched.
                        </div>
                      ) : (
                        filteredRetailers.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelectedRetailer(r);
                              setSearchQuery("");
                              setShowSearchDropdown(false);
                            }}
                            className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-950 text-xs flex justify-between items-center transition-colors cursor-pointer"
                          >
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">{r.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{r.phone}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedRetailer && (
                    <div className="space-y-3 mt-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/60 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <div className="text-[11px]">
                          <span className="font-extrabold text-slate-700 dark:text-slate-300">{selectedRetailer.name}</span>
                          <span className="text-slate-400 dark:text-slate-500 block text-[9px] mt-0.5">Phone: {selectedRetailer.phone}</span>
                        </div>
                      </div>

                      {/* Retailer Balance Display */}
                      <div className="flex items-center gap-2">
                        {(() => {
                          const bal = selectedRetailer.net_balance || 0;
                          const toGive = bal < 0 ? Math.abs(bal) : 0;
                          const toTake = bal > 0 ? bal : 0;
                          
                          if (toGive === 0 && toTake === 0) {
                            return (
                              <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Balance</span>
                                <span className="text-[11px] font-black text-slate-600 dark:text-slate-500">Settled</span>
                              </div>
                            );
                          }
                          
                          return (
                            <>
                              {toGive > 0 && (
                                <div className="flex-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                                  <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block">To Give</span>
                                  <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">₹{toGive.toLocaleString()}</span>
                                </div>
                              )}
                              {toTake > 0 && (
                                <div className="flex-1 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                                  <span className="text-[8px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest block">To Take</span>
                                  <span className="text-[11px] font-black text-red-700 dark:text-red-400">₹{toTake.toLocaleString()}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                    Select Shop (Branch)
                  </label>
                  <div className="relative">
                    <StoreIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <select
                      value={selectedStoreId}
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-700 dark:text-slate-300 appearance-none cursor-pointer font-semibold"
                    >
                      <option value="">Direct Retailer Handover</option>
                      {retailerStores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.store_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {sourceType === "staff" && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                  Select Staff Member
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-700 dark:text-slate-300 appearance-none cursor-pointer font-semibold"
                  >
                    <option value="">Choose Staff Member</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            {sourceType === "office" && (
              <div className="flex flex-col items-center justify-center py-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                <Building className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Office Cash Handover</p>
              </div>
            )}
          </div>



          {/* Currency Breakdowns calculator with matching locks */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Counting Details (Notes)
              </h2>
            </div>

            <div className="space-y-3">
              {[
                { label: "₹500 Notes", key: "note_500", multiplier: 500 },
                { label: "₹200 Notes", key: "note_200", multiplier: 200 },
                { label: "₹100 Notes", key: "note_100", multiplier: 100 },
                { label: "₹50 Notes", key: "note_50", multiplier: 50 },
                { label: "₹20 Notes", key: "note_20", multiplier: 20 },
                { label: "₹10 Notes", key: "note_10", multiplier: 10 },
              ].map((n) => (
                <div key={n.key} className="flex items-center gap-3 justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold w-24">{n.label}</span>
                  <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">✖</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={denominations[n.key as keyof DenominationCounts] || ""}
                    onChange={(e) => handleDenomChange(n.key as keyof DenominationCounts, e.target.value)}
                    className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg text-center text-xs text-slate-800 dark:text-slate-200"
                    min="0"
                  />
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 text-right w-16">
                    ₹{(denominations[n.key as keyof DenominationCounts] as number * n.multiplier).toLocaleString()}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-3 justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold w-24">Coins (Change)</span>
                <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">➕</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={denominations.coins || ""}
                  onChange={(e) => handleDenomChange("coins", e.target.value)}
                  className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg text-center text-xs text-slate-800 dark:text-slate-200"
                  min="0"
                  step="0.01"
                />
                <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 text-right w-16">
                  ₹{denominations.coins.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-3 justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300 w-24">Online (GPay/PhonePe)</span>
                <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">➕</span>
                <input
                  type="number"
                  placeholder="₹0.00"
                  value={denominations.online_amount || ""}
                  onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                  className="w-32 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg text-center text-xs text-slate-800 dark:text-slate-200 font-bold"
                  min="0"
                />
              </div>
            </div>
          </div>



          {/* Clean minimal total sum display */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Total Amount
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Cash: ₹{totalCashAmount.toLocaleString()} | UPI: ₹{denominations.online_amount.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-slate-850 dark:text-white">
                ₹{totalCollectionAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* TOUCHABLE REMARKS CHIPS SELECTOR COMPONENT (Task 45) */}
          <div className="space-y-2">
            <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 px-1">
              Quick Notes (Selection)
            </label>
            <div className="flex flex-wrap gap-1.5 px-0.5">
              {remarksChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setRemarks(chip)}
                  className={`py-1 px-2.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                    remarks === chip 
                      ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-950" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Or type custom remark..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Submission action */}
          <button
            type="submit"
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit Cash In Entry
          </button>
        </form>
      </div>
    </div>
  );
}
