"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, DenominationCounts } from "../utils/store";
import { db, seedOfflineRetailers, CachedRetailer } from "../utils/db";
import InlineSelect from "../components/InlineSelect";
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

function NewCollectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
  const { theme, toggleTheme, addCollection } = useAppStore();

  // Network State status bar
  const [isOnline, setIsOnline] = useState(true);

  // Search & Selector State
  const [retailers, setRetailers] = useState<CachedRetailer[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState<CachedRetailer | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [retailerStores, setRetailerStores] = useState<any[]>([]);
  const [remarks, setRemarks] = useState("");

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [sourceType, setSourceType] = useState<"retailer" | "staff" | "office">("retailer");
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [portals, setPortals] = useState<any[]>([]);
  const [showOnlinePortal, setShowOnlinePortal] = useState(false);

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

  const [denominations, setDenominations] = useState<DenominationCounts & { online_portal_id?: string }>({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0
  });

  const [mounted, setMounted] = useState(false);

  // Pre-fill if editing
  useEffect(() => {
    if (editId && mounted && retailers.length > 0) {
      const fetchEditData = async () => {
        try {
          const { api } = await import("../utils/api");
          const cols = await api.getCollections();
          const target = cols.find((c: any) => c.id === editId);
          if (target) {
            if (target.retailer_id) {
              setSourceType("retailer");
              const targetRet = retailers.find(r => r.id === target.retailer_id);
              if (targetRet) setSelectedRetailer(targetRet);
              if (target.store_id) setSelectedStoreId(target.store_id);
            } else if (target.from_staff_id) {
              setSourceType("staff");
              setSelectedStaffId(target.from_staff_id);
            } else {
              setSourceType("office");
            }
            if (target.denominations) {
              setDenominations({
                note_500: Number(target.denominations.note_500) || 0,
                note_200: Number(target.denominations.note_200) || 0,
                note_100: Number(target.denominations.note_100) || 0,
                note_50: Number(target.denominations.note_50) || 0,
                note_20: Number(target.denominations.note_20) || 0,
                note_10: Number(target.denominations.note_10) || 0,
                coins: Number(target.denominations.coins) || 0,
                online_amount: Number(target.denominations.online_amount) || 0,
                online_portal_id: target.denominations.online_portal_id
              });
              if (target.denominations.online_portal_id) {
                setShowOnlinePortal(true);
              }
            }
            setRemarks(target.remarks || "");
          }
        } catch (err) {
          console.error("Failed to load edit data", err);
        }
      };
      fetchEditData();
    }
  }, [editId, mounted, retailers]);

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
      // Do not auto-select the first retailer on mount, keep it null for search
      setSelectedRetailer(null);

      // Fetch Staff Members and Portals
      try {
        const { api } = await import("../utils/api");
        const staffList = await api.getStaffList();
        setStaffMembers(staffList);
        
        const portalsList = await api.getPortals();
        setPortals(portalsList.map((p: any) => ({ id: p.id, name: p.portal_name })));
      } catch (err) {
        console.warn("Failed to fetch staff members or portals", err);
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



  const handleDenomChange = (key: keyof DenominationCounts, value: string) => {
    if (key === "online_portal_id") {
      setDenominations(prev => ({ ...prev, [key]: value }));
      return;
    }
    // coins and online_amount must stay >= 0; note counts can be negative (exchange)
    const isNoteKey = ["note_500", "note_200", "note_100", "note_50", "note_20", "note_10"].includes(key);
    let val = value === "" ? 0 : parseFloat(value);
    if (isNaN(val)) val = 0;
    if (!isNoteKey && val < 0) val = 0; // coins/online can't be negative
    setDenominations(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleNoNegativeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, allowDecimal: boolean = false) => {
    const invalidKeys = allowDecimal ? ["-", "+", "e", "E"] : ["-", "+", "e", "E", "."];
    if (invalidKeys.includes(e.key)) {
      e.preventDefault();
    }
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
    // Allow zero (pure note exchange) and negative (note exchange with net outflow)
    // Only block if all fields are truly empty (no interaction at all)
    const allZero = Object.values(denominations).every(v => v === 0 || v === "");
    if (allZero) {
      alert("Please enter at least one denomination.");
      return;
    }

    // INTERCEPT OFFLINE SUBMISSIONS:
    if (!isOnline) {
      await db.collections.add({
        retailer_id: selectedRetailer!.id,
        store_id: selectedStoreId || undefined,
        retailerName: selectedRetailer?.name || "Unknown",
        portalName: selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : "Cash",
        totalAmount: totalCollectionAmount,
        denominations,
        remarks: remarks || "Offline transaction logs",
        date: new Date().toISOString().replace("T", " ").substring(0, 16),
        synced: 0
      });
      alert("[Offline Mode]  Collection saved to local device browser database. It will automatically sync as soon as you connect to internet!");
      router.push("/staff");
      return;
    }

    // ONLINE SUBMISSION: Attempt to hit the backend API
    try {
      const { api } = await import("../utils/api");
      
      const payload = {
        retailer_id: sourceType === "retailer" ? selectedRetailer!.id : null,
        from_staff_id: sourceType === "staff" ? selectedStaffId : null,
        from_office: sourceType === "office",
        store_id: selectedStoreId || null,
        total_amount: totalCollectionAmount,
        denominations: denominations,
        remarks: remarks || "Immediate credit logged"
      };

      if (editId) {
        await api.updateCollection(editId, payload);
      } else {
        await api.createCollection(payload);
        // If successful create, update Zustand
        addCollection({
          retailer_id: sourceType === "retailer" ? selectedRetailer!.id : "office",
          store_id: selectedStoreId || undefined,
          retailerName: sourceType === "retailer" ? selectedRetailer!.name : (sourceType === "staff" ? `Staff: ${staffMembers.find(s => s.id === selectedStaffId)?.name}` : "Super Distributor"),
          portalName: selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : "Cash",
          totalAmount: totalCollectionAmount,
          denominations,
          remarks: remarks || "Immediate credit logged"
        });
      }
      
      router.push("/staff");
    } catch (err: any) {
      console.error("Backend submission failed:", err);
      
      // FALLBACK for local testing: if backend is not linked or IDs are invalid
      // We still update the local store so it shows up in the Admin Panel
      addCollection({
        retailer_id: sourceType === "retailer" ? selectedRetailer!.id : "office",
        store_id: selectedStoreId || undefined,
        retailerName: sourceType === "retailer" ? selectedRetailer!.name : (sourceType === "staff" ? `Staff: ${staffMembers.find(s => s.id === selectedStaffId)?.name}` : "Super Distributor"),
        portalName: selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : "Cash",
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
      <div className="flex-1 w-full max-w-md mx-auto px-2 py-3 flex flex-col gap-2.5 select-none pb-24">
        
        {/* Navigation block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/staff")}
              type="button"
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">{editId ? "Edit Cash In" : "Cash In Entry"}</h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">{editId ? "Update payment details." : "Record payment details."}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Live Network Indicators */}
            <div className={`p-1 rounded-md flex items-center justify-center border ${
              isOnline 
                ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-emerald-600" 
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-500 animate-pulse"
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3">
          
          {/* SOURCE TYPE SELECTOR */}
          <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-1">
            <button
              type="button"
              onClick={() => setSourceType("retailer")}
              className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${sourceType === "retailer" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-655"}`}
            >
              Retailer
            </button>
            <button
              type="button"
              onClick={() => setSourceType("staff")}
              className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${sourceType === "staff" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-655"}`}
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => setSourceType("office")}
              className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${sourceType === "office" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-655"}`}
            >
              Super Distributor
            </button>
          </div>

          {/* DYNAMIC SOURCE INPUT */}
          {sourceType !== "office" && (
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              {sourceType === "retailer" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 mb-1">
                      Select Retailer
                    </label>
                    
                    <InlineSelect
                      value={selectedRetailer?.id || ""}
                      onChange={(val) => {
                        const match = retailers.find(r => r.id === val);
                        setSelectedRetailer(match || null);
                      }}
                      options={retailers.map((r) => ({ value: r.id, label: `${r.name}${r.phone ? ` (${r.phone})` : ""}` }))}
                      placeholder="Search Retailer..."
                      icon={<StoreIcon className="w-3.5 h-3.5" />}
                    />
                  </div>

                    {selectedRetailer && (
                      <div className="space-y-2 mt-2">
                        <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800/60 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <div className="text-[10px]">
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{selectedRetailer.name}</span>
                            <span className="text-slate-400 dark:text-slate-500 block text-[8px] mt-0.5 font-bold">Phone: {selectedRetailer.phone}</span>
                          </div>
                        </div>

                        {/* Retailer Balance Display */}
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const bal = selectedRetailer.net_balance || 0;
                            const toGive = bal < 0 ? Math.abs(bal) : 0;
                            const toTake = bal > 0 ? bal : 0;
                            
                            if (toGive === 0 && toTake === 0) {
                              return (
                                <div className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Balance</span>
                                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-500">Settled</span>
                                </div>
                              );
                            }
                            
                            return (
                              <>
                                {toGive > 0 && (
                                  <div className="flex-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
                                    <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block">To Give</span>
                                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">₹{toGive.toLocaleString()}</span>
                                  </div>
                                )}
                                {toTake > 0 && (
                                  <div className="flex-1 px-2.5 py-1.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg">
                                    <span className="text-[7px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest block">To Take</span>
                                    <span className="text-[10px] font-black text-red-700 dark:text-red-400">₹{toTake.toLocaleString()}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Select Shop (Branch) inside selectedRetailer block */}
                        <div className="mt-2">
                          <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 mb-1">
                            Select Shop (Branch)
                          </label>
                          <InlineSelect
                            value={selectedStoreId}
                            onChange={(val) => setSelectedStoreId(val)}
                            options={[
                              { value: "", label: "Cash" },
                              ...retailerStores.map((store) => ({ value: store.id, label: store.store_name }))
                            ]}
                            placeholder="Cash"
                            icon={<StoreIcon className="w-3.5 h-3.5" />}
                          />
                        </div>
                      </div>
                    )}
                </div>
              )}

              {sourceType === "staff" && (
                <div>
                  <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 mb-1">
                    Select Staff Member
                  </label>
                  <InlineSelect
                    value={selectedStaffId}
                    onChange={(val) => setSelectedStaffId(val)}
                    options={staffMembers.map((s) => ({ value: s.id, label: s.name }))}
                    placeholder="Choose Staff Member"
                    icon={<UserIcon className="w-3.5 h-3.5" />}
                  />
                </div>
              )}
            </div>
          )}

          {/* Currency Breakdowns calculator with matching locks */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Coins className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Counting Details (Notes)
              </h2>
            </div>

            <div className="space-y-1.5">
              {[
                { label: "₹500 Notes", key: "note_500", multiplier: 500 },
                { label: "₹200 Notes", key: "note_200", multiplier: 200 },
                { label: "₹100 Notes", key: "note_100", multiplier: 100 },
                { label: "₹50 Notes", key: "note_50", multiplier: 50 },
                { label: "₹20 Notes", key: "note_20", multiplier: 20 },
                { label: "₹10 Notes", key: "note_10", multiplier: 10 },
                { label: "Coins / ₹1", key: "coins", multiplier: 1 },
              ].map((n) => (
                <div key={n.key} className="flex items-center gap-2 justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-20 text-left">
                      {n.label}
                    </span>
                  </div>

                  <span className="text-slate-350 dark:text-slate-600 text-xs font-bold">&times;</span>

                  {/* Input box */}
                  <input
                    type="number"
                    value={denominations[n.key as keyof DenominationCounts] === 0 ? "" : denominations[n.key as keyof DenominationCounts]}
                    onChange={(e) => handleDenomChange(n.key as keyof DenominationCounts, e.target.value)}
                    className="w-14 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 focus:outline-none rounded text-center text-xs text-slate-800 dark:text-slate-200 font-extrabold"
                    placeholder="0"
                  />

                  <span className="text-slate-300 dark:text-slate-650 text-[9px] font-bold">＝</span>

                  {/* Line total */}
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right w-16">
                    ₹{(Number(denominations[n.key as keyof DenominationCounts] || 0) * n.multiplier).toLocaleString()}
                  </span>
                </div>
              ))}

              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 justify-between">
                  <span 
                    className="text-[11px] font-black text-slate-600 dark:text-slate-300 w-24 cursor-pointer"
                    onClick={() => setShowOnlinePortal(true)}
                  >
                    Online (UPI)
                  </span>
                  <span className="text-slate-350 dark:text-slate-600 text-xs font-bold">+</span>
                  <input
                    type="number"
                    placeholder="₹0.00"
                    value={denominations.online_amount || ""}
                    onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                    onKeyDown={(e) => handleNoNegativeKeyDown(e, true)}
                    className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded text-center text-xs text-slate-800 dark:text-slate-200 font-extrabold"
                    min="0"
                  />
                </div>
                {(showOnlinePortal || denominations.online_amount > 0) && (
                  <div className="mt-0.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <select
                      value={denominations.online_portal_id || ""}
                      onChange={(e) => handleDenomChange("online_portal_id", e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-slate-400"
                    >
                      <option value="">Select Portal Account...</option>
                      {portals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clean minimal total sum display */}
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[8px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">
                Total Amount
              </span>
              <div className="text-[9px] text-slate-505 dark:text-slate-400 mt-0.5 font-bold">
                Cash: ₹{totalCashAmount.toLocaleString()} | UPI: ₹{denominations.online_amount.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
                <span className={`text-lg font-black ${totalCollectionAmount < 0 ? 'text-red-500' : totalCollectionAmount === 0 ? 'text-amber-500' : 'text-slate-850 dark:text-white'}`}>
                  ₹{totalCollectionAmount.toLocaleString()}
                </span>
                {totalCollectionAmount <= 0 && (
                  <p className="text-[8px] font-bold text-amber-500 mt-0.5">
                    {totalCollectionAmount === 0 ? "⇄ Note exchange (zero net)" : "↓ Net outflow"}
                  </p>
                )}
              </div>
          </div>

          {/* REMARKS COMPONENT */}
          <div className="space-y-1">
            <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 px-1">
              Remarks
            </label>
            <div className="relative">
              <FileText className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Type remark..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-lg text-xs font-bold transition-all cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {editId ? "Update Cash In Entry" : "Submit Cash In Entry"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewCollection() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-955 flex items-center justify-center">
        <div className="text-slate-400 dark:text-slate-500 text-xs font-semibold">Loading...</div>
      </div>
    }>
      <NewCollectionContent />
    </React.Suspense>
  );
}
