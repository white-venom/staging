"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, DenominationCounts } from "../utils/store";
import { db, seedOfflineRetailers, CachedRetailer } from "../utils/db";
import { getISTDateString, buildDisplayDate } from "../utils/dateHelpers";
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
  const { theme, toggleTheme, addCollection, currentUser } = useAppStore();

  // Network State status bar
  const [isOnline, setIsOnline] = useState(true);

  // Collection Date Selector
  const [collectionDate, setCollectionDate] = useState<string>(() => {
    return getISTDateString();
  });

  // Search & Selector State
  const [retailers, setRetailers] = useState<CachedRetailer[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState<CachedRetailer | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [retailerStores, setRetailerStores] = useState<any[]>([]);
  const [remarks, setRemarks] = useState("");

  // Difference Calculator State
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcTarget, setCalcTarget] = useState<number | "">("");
  const [calcPaid, setCalcPaid] = useState<number | "">("");

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [sourceType, setSourceType] = useState<"retailer" | "staff" | "office">("retailer");
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  // Item #2 follow-up: the online-routing picker now shows Portals, not
  // individual BankAccounts (balance is Portal-level; which specific account
  // under it receives the online payment is resolved automatically). Kept
  // separate from `bankAccounts` above since that flat list is still needed
  // to resolve a portal's first online-eligible account id.
  const [onlinePortals, setOnlinePortals] = useState<{ id: string; name: string }[]>([]);
  const [selectedOnlinePortalId, setSelectedOnlinePortalId] = useState("");
  const [showOnlineBankAccount, setShowOnlineBankAccount] = useState(false);

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

  const [denominations, setDenominations] = useState<DenominationCounts & { online_bank_account_id?: string }>({
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffCanChangeCashInDate, setStaffCanChangeCashInDate] = useState(false);
  const [portals, setPortals] = useState<any[]>([]);

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
                online_bank_account_id: target.denominations.online_bank_account_id
              });
              if (target.denominations.online_bank_account_id) {
                setShowOnlineBankAccount(true);
              }
            }
            if (target.collection_date) {
              setCollectionDate(target.collection_date.substring(0, 10));
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

  // Keep the Portal picker's value in sync with whichever account id is
  // actually selected (e.g. once bankAccounts loads after an edit-prefill
  // already set online_bank_account_id from the existing entry).
  useEffect(() => {
    const accountId = denominations.online_bank_account_id;
    if (!accountId) return;
    const owner = bankAccounts.find(p => p.id === accountId);
    if (owner) setSelectedOnlinePortalId(owner.portalId);
  }, [denominations.online_bank_account_id, bankAccounts]);

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
            bankAccountName: "Standard",
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

      // Fetch Staff Members and Bank Accounts
      try {
        const { api } = await import("../utils/api");
        const staffList = await api.getStaffList();
        setStaffMembers(staffList);
        
        const settings = await api.getAdminSettings().catch(() => null);
        if (settings) setStaffCanChangeCashInDate(settings.staff_can_change_collection_date ?? false);

        const groups = await api.getPortals();
        setPortals(groups);
        // Flatten: only individual bankAccount accounts marked show_in_online_payment=true.
        // Still needed (not shown directly) to resolve a chosen Portal down to
        // a specific account id for the backend payload.
        const onlineBankAccounts: { id: string; name: string; portalId: string }[] = [];
        const onlinePortalList: { id: string; name: string }[] = [];
        for (const g of groups) {
          let portalHasOnlineAccount = false;
          for (const p of (g.bank_accounts || [])) {
            if (p.show_in_online_payment) {
              onlineBankAccounts.push({
                id: p.id,
                name: g.bank_accounts.length > 1 ? `${g.name} - ${p.bank_account_name}` : g.name,
                portalId: g.id,
              });
              portalHasOnlineAccount = true;
            }
          }
          if (portalHasOnlineAccount) onlinePortalList.push({ id: g.id, name: g.name });
        }
        setBankAccounts(onlineBankAccounts);
        setOnlinePortals(onlinePortalList);

        // Auto default to last used online Portal if not editing
        if (!editId && typeof window !== "undefined") {
          const lastUsedPortalId = localStorage.getItem("last_used_online_portal_id");
          const firstAccount = lastUsedPortalId ? onlineBankAccounts.find(p => p.portalId === lastUsedPortalId) : undefined;
          if (lastUsedPortalId && firstAccount) {
            setSelectedOnlinePortalId(lastUsedPortalId);
            setDenominations(prev => ({ ...prev, online_bank_account_id: firstAccount.id }));
            setShowOnlineBankAccount(true);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch staff members or bankAccounts", err);
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
    if (key === "online_bank_account_id") {
      setDenominations(prev => ({ ...prev, [key]: value }));
      return;
    }
    // coins and note counts can be negative (exchange); online_amount must stay >= 0
    const isNoteOrCoinsKey = ["note_500", "note_200", "note_100", "note_50", "note_20", "note_10", "coins"].includes(key);
    let val = value === "" ? 0 : parseFloat(value);
    if (isNaN(val)) val = 0;
    if (!isNoteOrCoinsKey && val < 0) val = 0; // online can't be negative
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
    if (isSubmitting) return;

    if (sourceType === "retailer" && !selectedRetailer) {
      alert("Please select a valid retailer.");
      return;
    }
    if (sourceType === "staff" && !selectedStaffId) {
      alert("Please select the source staff member.");
      return;
    }
    // Block zero or negative total amount submissions (Cash In requires positive sum)
    if (totalCollectionAmount <= 0) {
      alert("Cash In entries must have a positive total amount (₹ > 0). If you are recording a payout or cash withdrawal, please record it in the Cash Out tab.");
      return;
    }
    // Only block if all fields are truly empty (no interaction at all)
    const allZero = Object.values(denominations).every(v => v === 0 || v === "");
    if (allZero) {
      alert("Please enter at least one denomination.");
      return;
    }

    // Resolve bank account name and portal name for display
    let computedBankAccountName = "Cash";
    let computedPortalName = "";
    if (denominations.online_amount > 0 && denominations.online_bank_account_id) {
      for (const g of portals) {
        const foundP = (g.bank_accounts || []).find((p: any) => p.id === denominations.online_bank_account_id);
        if (foundP) {
          computedBankAccountName = foundP.bank_account_name;
          computedPortalName = g.name;
          break;
        }
      }
    } else if (selectedStoreId) {
      const storeObj = retailerStores.find(s => s.id === selectedStoreId);
      if (storeObj) {
        computedBankAccountName = storeObj.store_name;
      }
    }

    // INTERCEPT OFFLINE SUBMISSIONS:
    if (!isOnline) {
      setIsSubmitting(true);
      try {
        await db.collections.add({
          retailer_id: selectedRetailer!.id,
          store_id: selectedStoreId || undefined,
          bank_account_id: (denominations.online_amount > 0 || sourceType !== "retailer") ? (denominations.online_bank_account_id || undefined) : undefined,
          retailerName: selectedRetailer?.name || "Unknown",
          bankAccountName: computedBankAccountName,
          portalName: computedPortalName || undefined,
          totalAmount: totalCollectionAmount,
          denominations,
          remarks: remarks || "Offline transaction logs",
          date: buildDisplayDate(new Date().toISOString()),
          synced: 0
        });
        alert("[Offline Mode] Collection saved to local device browser database. It will automatically sync as soon as you connect to internet!");
        router.push("/staff");
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    // ONLINE SUBMISSION: Attempt to hit the backend API
    setIsSubmitting(true);
    try {
      const { api } = await import("../utils/api");
      
      const payload = {
        retailer_id: sourceType === "retailer" ? selectedRetailer!.id : null,
        from_staff_id: sourceType === "staff" ? selectedStaffId : null,
        from_office: sourceType === "office",
        store_id: selectedStoreId || null,
        bank_account_id: (denominations.online_amount > 0 || sourceType !== "retailer") ? (denominations.online_bank_account_id || null) : null,
        total_amount: totalCollectionAmount,
        collection_date: collectionDate,
        denominations: denominations,
        remarks: remarks || ""
      };

      if (editId) {
        await api.updateCollection(editId, payload);
      } else {
        await api.createCollection(payload);
        // If successful create, update Zustand
        addCollection({
          retailer_id: sourceType === "retailer" ? selectedRetailer!.id : "office",
          store_id: selectedStoreId || undefined,
          store_name: sourceType === "retailer" && selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : undefined,
          retailerName: sourceType === "retailer" ? selectedRetailer!.name : (sourceType === "staff" ? `Staff: ${staffMembers.find(s => s.id === selectedStaffId)?.name}` : "Super Distributor"),
          bankAccountName: computedBankAccountName,
          portalName: computedPortalName || undefined,
          totalAmount: totalCollectionAmount,
          denominations,
          remarks: remarks || ""
        });
      }
      
      router.push("/staff");
    } catch (err: any) {
      console.error("Backend submission failed:", err);

      // Previously this silently faked success by saving to local-only state with a
      // non-UUID id (e.g. "col-<timestamp>") that the backend can never recognize —
      // the entry looked saved but never reached the server, and editing it later
      // crashed with a UUID parse error. Don't pretend it succeeded: tell the user
      // and let them retry (the form stays filled in). Genuine offline submissions
      // are already handled safely above via the local sync queue.
      if (editId) {
        alert("Could not save changes: " + (err.message || "Unknown error") + ". Please check your connection and try again.");
      } else if (sourceType === "retailer" && selectedRetailer) {
        // Queue it the same way the explicit offline path does, so it's retried
        // automatically by the existing background sync instead of being lost.
        const onlineBankAccountName = denominations.online_amount > 0 && denominations.online_bank_account_id
          ? bankAccounts.find(p => p.id === denominations.online_bank_account_id)?.name || "Online"
          : (selectedStoreId ? retailerStores.find(s => s.id === selectedStoreId)?.store_name : "Cash");

        await db.collections.add({
          retailer_id: selectedRetailer.id,
          store_id: selectedStoreId || undefined,
          bank_account_id: (denominations.online_amount > 0 || sourceType !== "retailer") ? (denominations.online_bank_account_id || undefined) : undefined,
          retailerName: selectedRetailer.name || "Unknown",
          bankAccountName: onlineBankAccountName,
          totalAmount: totalCollectionAmount,
          denominations,
          remarks: remarks || "Queued (online submission failed)",
          // buildDisplayDate converts to IST -- a bare toISOString() is UTC and
        // was showing the Waiting List entry ~5.5 hours behind the time it
        // actually appears at once synced (which does go through this helper).
        date: buildDisplayDate(new Date().toISOString()),
          synced: 0
        });

        const { syncOfflineData } = await import("../utils/sync");
        syncOfflineData().catch(() => {});

        alert("Could not reach the server right now. Saved to the local queue — it will sync automatically.");
        router.push("/staff");
      } else {
        alert("Could not save entry: " + (err.message || "Unknown error") + ". Please check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 w-full max-w-md mx-auto px-2 py-2 flex flex-col gap-1.5 select-none pb-20">

        {/* Navigation block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/staff")}
              type="button"
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-sm cursor-pointer"
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
            <div className={`p-1 rounded-sm flex items-center justify-center border ${
              isOnline
                ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-emerald-600"
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-500"
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-2">

          {/* SOURCE TYPE SELECTOR */}
          <div className="rounded-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-px overflow-hidden">
            <button
              type="button"
              onClick={() => setSourceType("retailer")}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${sourceType === "retailer" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950" : "bg-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Retailer
            </button>
            {/* "Staff" is no longer a selectable source for NEW entries -- staff
                handovers are now initiated by the SENDING staff via Cash Out >
                To Staff (item #9), which auto-creates the matching Collection
                here. This tab still renders (read-only selection) when editing
                an existing from-staff entry so old records stay editable. */}
            {editId && sourceType === "staff" && (
              <button
                type="button"
                onClick={() => setSourceType("staff")}
                className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950"
              >
                Staff
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSourceType("office");
                setDenominations(prev => ({
                  ...prev,
                  online_amount: 0,
                  online_bank_account_id: undefined
                }));
                setSelectedOnlinePortalId("");
                setShowOnlineBankAccount(false);
              }}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${sourceType === "office" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950" : "bg-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Super Distributor
            </button>
          </div>

          {/* DYNAMIC SOURCE INPUT */}
          {sourceType !== "office" && (
            <div className="p-2 rounded-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
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
                      <div className="space-y-1.5 mt-1.5">
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-950 rounded-sm border border-slate-200 dark:border-slate-800/60 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="text-[10px] leading-tight">
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
                                <div className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm flex items-center justify-between">
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Balance</span>
                                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-500 font-mono">Settled</span>
                                </div>
                              );
                            }

                            return (
                              <>
                                {toGive > 0 && (
                                  <div className="flex-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-sm flex items-center justify-between">
                                    <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">To Give</span>
                                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">₹{toGive.toLocaleString()}</span>
                                  </div>
                                )}
                                {toTake > 0 && (
                                  <div className="flex-1 px-2 py-1 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-sm flex items-center justify-between">
                                    <span className="text-[7px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest">To Take</span>
                                    <span className="text-[10px] font-black text-red-700 dark:text-red-400 font-mono tabular-nums">₹{toTake.toLocaleString()}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Select Shop (Branch) inside selectedRetailer block */}
                        <div>
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
                    options={staffMembers.filter((s) => s.id !== currentUser?.id).map((s) => ({ value: s.id, label: s.name }))}
                    placeholder="Choose Staff Member"
                    icon={<UserIcon className="w-3.5 h-3.5" />}
                  />
                </div>
              )}
            </div>
          )}

          {/* Currency Breakdowns calculator with matching locks */}
          <div className="rounded-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <Coins className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Counting Details (Notes)
              </h2>
            </div>

            <div>
              {[
                { label: "₹500 Notes", key: "note_500", multiplier: 500 },
                { label: "₹200 Notes", key: "note_200", multiplier: 200 },
                { label: "₹100 Notes", key: "note_100", multiplier: 100 },
                { label: "₹50 Notes", key: "note_50", multiplier: 50 },
                { label: "₹20 Notes", key: "note_20", multiplier: 20 },
                { label: "₹10 Notes", key: "note_10", multiplier: 10 },
                { label: "Coins / ₹1", key: "coins", multiplier: 1 },
              ].map((n) => (
                <div key={n.key} className="flex items-center gap-2 justify-between px-2 py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">
                    {n.label}
                  </span>

                  <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">&times;</span>

                  {/* Input box */}
                  <input autoComplete="one-time-code"
                    type="number"
                    inputMode="numeric"
                    value={denominations[n.key as keyof DenominationCounts] === 0 ? "" : denominations[n.key as keyof DenominationCounts]}
                    onChange={(e) => handleDenomChange(n.key as keyof DenominationCounts, e.target.value)}
                    className="w-14 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none rounded-sm text-right text-xs text-slate-800 dark:text-slate-200 font-mono font-extrabold tabular-nums"
                    placeholder="0"
                  />

                  <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>

                  {/* Line total */}
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 text-right w-16 font-mono tabular-nums">
                    ₹{(Number(denominations[n.key as keyof DenominationCounts] || 0) * n.multiplier).toLocaleString()}
                  </span>
                </div>
              ))}

              {sourceType === "retailer" && (
                <div className="flex flex-col gap-1.5 px-2 py-1.5 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 justify-between">
                    <span
                      className="text-[11px] font-black text-slate-600 dark:text-slate-300 w-16 cursor-pointer"
                      onClick={() => setShowOnlineBankAccount(true)}
                    >
                      Online (UPI)
                    </span>
                    <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">+</span>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      placeholder="₹0.00"
                      value={denominations.online_amount || ""}
                      onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                      onKeyDown={(e) => handleNoNegativeKeyDown(e, true)}
                      className="w-28 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none rounded-sm text-right text-xs text-slate-800 dark:text-slate-200 font-mono font-extrabold tabular-nums"
                      min="0"
                    />
                  </div>
                  {(showOnlineBankAccount || denominations.online_amount > 0) && (
                    <div>
                      <InlineSelect
                        value={selectedOnlinePortalId}
                        onChange={(portalId) => {
                          setSelectedOnlinePortalId(portalId);
                          // Item #2 follow-up: only the Portal is a visible choice --
                          // resolve to that portal's first online-eligible account
                          // internally (balance is Portal-level, so which specific
                          // account carries the FK no longer matters to the user).
                          const account = bankAccounts.find(p => p.portalId === portalId);
                          const accountId = account?.id || "";
                          handleDenomChange("online_bank_account_id", accountId);
                          if (portalId && typeof window !== "undefined") {
                            localStorage.setItem("last_used_online_portal_id", portalId);
                          }
                        }}
                        options={[
                          { value: "", label: "Select Portal..." },
                          ...onlinePortals.map(p => ({ value: p.id, label: p.name }))
                        ]}
                        placeholder="Select Portal..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Difference Calculator Card */}
          <div className="rounded-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCalcOpen(!isCalcOpen)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              <span>Difference Calculator</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCalcOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCalcOpen && (
              <div className="px-2 pb-2 space-y-2 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">
                      Target Amount
                    </label>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      placeholder="e.g. 26000"
                      value={calcTarget}
                      onChange={(e) => setCalcTarget(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-right text-xs text-slate-800 dark:text-slate-200 font-mono font-extrabold tabular-nums"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">
                        Already Paid
                      </label>
                      {calcPaid !== "" && (
                        <button
                          type="button"
                          onClick={() => setCalcPaid("")}
                          className="text-[8px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          Sync Total
                        </button>
                      )}
                    </div>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      placeholder="e.g. 24000"
                      value={calcPaid === "" ? totalCollectionAmount : calcPaid}
                      onChange={(e) => setCalcPaid(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-right text-xs text-slate-800 dark:text-slate-200 font-mono font-extrabold tabular-nums"
                    />
                  </div>
                </div>

                <div className="p-1.5 bg-slate-50 dark:bg-slate-950 rounded-sm border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-500 uppercase">
                    Remaining to Pay
                  </span>
                  {(() => {
                    const currentPaid = calcPaid === "" ? totalCollectionAmount : Number(calcPaid);
                    const remaining = calcTarget && calcTarget !== 0 ? calcTarget - currentPaid : 0;
                    const isNegative = remaining < 0;
                    return (
                      <span className={`text-sm font-black font-mono tabular-nums ${isNegative ? 'text-red-600 dark:text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                        {isNegative
                          ? `-₹${Math.abs(remaining).toLocaleString("en-IN")}`
                          : `₹${remaining.toLocaleString("en-IN")}`}
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Clean minimal total sum display */}
          <div aria-live="polite" aria-atomic="true" className="p-2 rounded-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[8px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">
                Total Amount
              </span>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold font-mono tabular-nums">
                Cash: ₹{totalCashAmount.toLocaleString()} | UPI: ₹{denominations.online_amount.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
                <span className={`text-lg font-black font-mono tabular-nums ${totalCollectionAmount < 0 ? 'text-red-600 dark:text-red-500' : totalCollectionAmount === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  ₹{totalCollectionAmount.toLocaleString()}
                </span>
                {totalCollectionAmount <= 0 && (
                  <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    {totalCollectionAmount === 0 ? "Note exchange (zero net)" : "Net outflow"}
                  </p>
                )}
              </div>
          </div>

          {/* Collection Date */}
          <div className="space-y-1">
            <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 px-1">
              Collection Date
            </label>
            {staffCanChangeCashInDate ? (
              /* Admin has allowed date change — show calendar picker with chevron */
              <div className="relative">
                <input autoComplete="one-time-code"
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full px-3 py-1.5 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-sm focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-bold cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              </div>
            ) : (
              /* Admin has disabled date change — show today's date as fixed display */
              <div className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-sm text-xs text-slate-500 dark:text-slate-400 font-bold select-none">
                {(() => {
                  const [y, m, d] = collectionDate.split("-");
                  return `${d}/${m}/${y}`;
                })()}
              </div>
            )}
          </div>

          {/* REMARKS COMPONENT */}
          <div className="space-y-1">
            <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 px-1">
              Remarks
            </label>
            <div className="relative">
              <FileText className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <input autoComplete="one-time-code"
                type="text"
                placeholder="Type remark..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-sm focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || totalCollectionAmount <= 0}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-sm text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                <span>{editId ? "Updating..." : "Submitting..."}</span>
              </>
            ) : (
              editId ? "Update Cash In Entry" : "Submit Cash In Entry"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewCollection() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 dark:text-slate-500 text-xs font-semibold">Loading...</div>
      </div>
    }>
      <NewCollectionContent />
    </React.Suspense>
  );
}
