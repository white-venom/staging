"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, DenominationCounts } from "../utils/store";
import { db } from "../utils/db";
import InlineSelect from "../components/InlineSelect";
import { 
  ArrowLeft, 
  Layers, 
  User, 
  Coins, 
  Building,
  CreditCard,
  Sun,
  Moon,
  ChevronDown
} from "lucide-react";

function NewDepositContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
  const { theme, toggleTheme, addDeposit } = useAppStore();

  const [depositType, setDepositType] = useState<"portal" | "retailer" | "staff" | "virtual">("portal");

  // Dynamic options loaded from backend
  const [portalGroups, setPortalGroups] = useState<any[]>([]);
  const [groupAccounts, setGroupAccounts] = useState<{ id: string; name: string }[]>([]);
  const [retailers, setRetailers] = useState<{ id: string; name: string }[]>([]);
  const [staffUsers, setStaffUsers] = useState<{ id: string; name: string }[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedPortalId, setSelectedPortalId] = useState("");
  const [selectedRetailerId, setSelectedRetailerId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [toOffice, setToOffice] = useState(false);
  const [portalsList, setPortalsList] = useState<any[]>([]);
  const [showOnlinePortal, setShowOnlinePortal] = useState(false);

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



  const totalCashAmount = (
    denominations.note_500 * 500 +
    denominations.note_200 * 200 +
    denominations.note_100 * 100 +
    denominations.note_50 * 50 +
    denominations.note_20 * 20 +
    denominations.note_10 * 10 +
    denominations.coins
  );

  const totalAmount = totalCashAmount + denominations.online_amount;

  const handleDenomChange = (key: keyof DenominationCounts, value: string) => {
    if (key === "online_portal_id") {
      setDenominations(prev => ({ ...prev, [key]: value }));
      return;
    }
    let val = value === "" ? 0 : parseFloat(value);
    if (isNaN(val)) val = 0;
    if (key === "online_amount" && val < 0) val = 0;
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

  const [mounted, setMounted] = useState(false);

  // Pre-fill if editing
  React.useEffect(() => {
    if (editId && mounted && portalGroups.length > 0) {
      const loadEdit = async () => {
        try {
          const { api } = await import("../utils/api");
          const deps = await api.getDeposits();
          const target = deps.find((d: any) => d.id === editId);
          if (target) {
            setDepositType(target.deposit_type);
            if (target.deposit_type === "portal" || target.deposit_type === "virtual") {
              setSelectedPortalId(target.portal_id);
            }
            if (target.deposit_type === "retailer" || target.deposit_type === "virtual") {
              setSelectedRetailerId(target.retailer_id);
            }
            if (target.deposit_type === "staff" && target.recipient_staff_id) {
              setSelectedStaffId(target.recipient_staff_id);
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
          }
        } catch (err) {
          console.error("Failed to load edit deposit", err);
        }
      };
      loadEdit();
    }
  }, [editId, mounted, portalGroups]);


  React.useEffect(() => {
    setMounted(true);
    // Load dynamic options from backend
    const loadOptions = async () => {
      // Load cached retailers from Dexie database as fallback first
      try {
        const cached = await db.retailers.toArray();
        if (cached && cached.length > 0) {
          const validRetailers = cached.filter(r => !r.id.startsWith("ret-")).map(r => ({ id: r.id, name: r.name }));
          setRetailers(validRetailers);
        }
      } catch (cacheErr) {
        console.warn("Failed to load retailers from cache:", cacheErr);
      }

      try {
        const { api } = await import("../utils/api");
        const [groups, r, s] = await Promise.all([api.getPortalGroups(), api.getRetailers(), api.getStaffList()]);
        const mappedGroups = groups.map((x: any) => {
          return { 
            id: x.id, 
            name: x.name,
            toGive: parseFloat(x.opening_to_give || 0),
            toTake: parseFloat(x.opening_to_take || 0)
          };
        });
        const mappedRetailers = r.map((x: any) => ({ id: x.id, name: x.retailer_name || x.name }));
        const mappedStaff = s.map((x: any) => ({ id: x.id, name: x.name }));
        
        setPortalGroups(mappedGroups);
        setRetailers(mappedRetailers);
        setStaffUsers(mappedStaff);

        // Update IndexedDB cache for retailers
        if (r && r.length > 0) {
          await db.retailers.clear();
          await db.retailers.bulkPut(r.map((x: any) => ({
            id: x.id,
            name: x.retailer_name || x.name,
            phone: x.phone || "",
            portalName: "Standard",
            opening_to_give: parseFloat(x.opening_to_give || 0),
            opening_to_take: parseFloat(x.opening_to_take || 0),
            net_balance: parseFloat(x.balance || 0)
          })));
        }

        // Flatten: only individual portal accounts marked show_in_online_payment=true
        const onlinePortals: { id: string; name: string }[] = [];
        for (const g of groups) {
          for (const p of (g.portals || [])) {
            if (p.show_in_online_payment) {
              onlinePortals.push({
                id: p.id,
                name: g.portals.length > 1 ? `${g.name} - ${p.portal_name}` : g.name
              });
            }
          }
        }
        setPortalsList(onlinePortals);
        
        // Auto default to last used online portal if not editing
        if (!editId && typeof window !== "undefined") {
          const lastUsedPortalId = localStorage.getItem("last_used_online_portal_id");
          if (lastUsedPortalId && onlinePortals.some(p => p.id === lastUsedPortalId)) {
            setDenominations(prev => ({ ...prev, online_portal_id: lastUsedPortalId }));
            setShowOnlinePortal(true);
          }
        }
        
        if (mappedGroups.length > 0) setSelectedGroupId(mappedGroups[0].id);
        // Do not auto-select the first retailer on mount, keep it empty for search selection
        setSelectedRetailerId("");
        if (mappedStaff.length > 0) setSelectedStaffId(mappedStaff[0].id);
      } catch (err) {
        console.error("Failed to load deposit options:", err);
      }
    };
    loadOptions();
  }, []);

  // Fetch accounts when group changes
  React.useEffect(() => {
    if (selectedGroupId) {
      const fetchAccounts = async () => {
        try {
          const { api } = await import("../utils/api");
          const accounts = await api.getGroupAccounts(selectedGroupId);
          const mappedAccounts = accounts.map((x: any) => ({ id: x.id, name: x.portal_name }));
          setGroupAccounts(mappedAccounts);
          if (mappedAccounts.length > 0) setSelectedPortalId(mappedAccounts[0].id);
          else setSelectedPortalId("");
        } catch (err) {
          console.error("Failed to fetch group accounts:", err);
        }
      };
      fetchAccounts();
    }
  }, [selectedGroupId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mounted) return;
    if (totalAmount <= 0) {
      alert("Please specify a deposit amount greater than zero.");
      return;
    }

    // Build target name for local store display
    let targetName = "";
    if (depositType === "portal") {
      const groupName = portalGroups.find(g => g.id === selectedGroupId)?.name || "Portal";
      targetName = groupName;
    } else if (depositType === "retailer") {
      targetName = retailers.find(r => r.id === selectedRetailerId)?.name || "Retailer Store";
    } else if (depositType === "virtual") {
      const portalName = groupAccounts.find(a => a.id === selectedPortalId)?.name || "Portal";
      const retailerName = retailers.find(r => r.id === selectedRetailerId)?.name || "Retailer";
      targetName = `Virtual: ${portalName} → ${retailerName}`;
    } else {
      targetName = "Super Distributor";
    }

    // Build proper backend payload with UUIDs
    const backendPayload: any = {
      deposit_type: depositType,
      payment_mode: depositType === "virtual" ? "online" : "unified",
      amount: totalAmount,
      denominations: denominations,
    };
    if (depositType === "portal" || depositType === "virtual") backendPayload.portal_id = selectedPortalId;
    if (depositType === "retailer" || depositType === "virtual") backendPayload.retailer_id = selectedRetailerId;
    if (depositType === "staff") {
      backendPayload.to_office = true;
    }

    // Local store payload (uses camelCase display fields)
    const localDepData: any = {
      depositType,
      targetName,
      amount: totalAmount,
      paymentMode: depositType === "virtual" ? "online" : "cash",
      denominations: denominations,
      portal_id: (depositType === "portal" || depositType === "virtual") ? selectedPortalId : undefined,
      retailer_id: (depositType === "retailer" || depositType === "virtual") ? selectedRetailerId : undefined,
      recipient_staff_id: depositType === "staff" ? selectedStaffId : undefined,
    };

    const submitOnline = async () => {
      try {
        const { api } = await import("../utils/api");
        if (editId) {
          await api.updateDeposit(editId, backendPayload);
        } else {
          await api.createDeposit(backendPayload);
          addDeposit(localDepData);
        }
        router.push("/staff");
      } catch (err: any) {
        console.error("Backend deposit failed:", err);

        // Previously this silently faked success by saving to local-only state with
        // a non-UUID id (e.g. "dep-<timestamp>") that the backend can never
        // recognize — the entry looked saved but never reached the server, and
        // editing it later crashed with a UUID parse error. Don't pretend it
        // succeeded: tell the user and let them retry instead.
        if (editId) {
          alert("Could not save changes: " + (err.message || "Unknown error") + ". Please check your connection and try again.");
          return;
        }

        // Queue it for the existing background sync to retry automatically,
        // instead of losing it or faking success.
        await db.deposits.add({
          portal_id: backendPayload.portal_id,
          retailer_id: backendPayload.retailer_id,
          recipient_staff_id: backendPayload.recipient_staff_id,
          depositType,
          targetName,
          amount: totalAmount,
          paymentMode: depositType === "virtual" ? "online" : "cash",
          denominations,
          date: new Date().toISOString().replace("T", " ").substring(0, 16),
          synced: 0
        });

        const { syncOfflineData } = await import("../utils/sync");
        syncOfflineData().catch(() => {});

        alert("Could not reach the server right now. Saved to the local queue — it will sync automatically.");
        router.push("/staff");
      }
    };

    submitOnline();
  };

  if (!mounted) return null;


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="flex-1 w-full max-w-md mx-auto px-2 py-2.5 flex flex-col gap-2 select-none pb-16">
        
        {/* Header Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/staff")}
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-md cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">{editId ? "Edit Cash Out" : "Cash Out Entry"}</h1>
              <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">{editId ? "Update payout details." : "Record payout details."}</p>
            </div>
          </div>


        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* Channel selections */}
          <div>
            <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1 px-1">
              Where is money going? (Channel)
            </label>
            <div className="grid grid-cols-3 gap-1.5">              {[
                { type: "portal", label: "Portals", desc: "Bank Acc" },
                { type: "retailer", label: "Shops", desc: "Refund" },
                { type: "staff", label: "Super Dist", desc: "Distributor" },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setDepositType(opt.type as any);
                    if (opt.type === "staff") {
                      setDenominations(prev => ({
                        ...prev,
                        online_amount: 0,
                        online_portal_id: undefined
                      }));
                      setShowOnlinePortal(false);
                    }
                  }}
                  className={`py-1.5 px-1 rounded-md border text-center transition-all cursor-pointer ${
                    depositType === opt.type
                      ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-955 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-wider">{opt.label}</div>
                  <div className="text-[7px] font-bold uppercase tracking-wider opacity-70 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Context details options selector */}
          {depositType !== "staff" && (
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              {depositType === "virtual" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                      1. Select Source Portal Account
                    </label>
                    <InlineSelect
                      value={selectedGroupId}
                      onChange={(val) => setSelectedGroupId(val)}
                      options={portalGroups.map(g => ({ value: g.id, label: g.name }))}
                      placeholder={portalGroups.length === 0 ? "Loading portals..." : "Select Portal"}
                      icon={<Building className="w-3.5 h-3.5" />}
                    />
                  </div>

                  {selectedGroupId && (
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                        2. Select Source Bank Account
                      </label>
                      <InlineSelect
                        value={selectedPortalId}
                        onChange={(val) => setSelectedPortalId(val)}
                        options={groupAccounts.map(a => ({ value: a.id, label: a.name }))}
                        placeholder={groupAccounts.length === 0 ? "No accounts found..." : "Select Account"}
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                      3. Select Destination Retailer
                    </label>
                    <InlineSelect
                      value={selectedRetailerId}
                      onChange={(val) => setSelectedRetailerId(val)}
                      options={retailers.map(r => ({ value: r.id, label: r.name }))}
                      placeholder={retailers.length === 0 ? "Loading retailers..." : "Select Retailer"}
                      icon={<Layers className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>
              )}

              {depositType === "portal" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                      1. Choose Portal
                    </label>
                    <InlineSelect
                      value={selectedGroupId}
                      onChange={(val) => setSelectedGroupId(val)}
                      options={portalGroups.map(g => ({ value: g.id, label: g.name }))}
                      placeholder={portalGroups.length === 0 ? "Loading portals..." : "Select Portal"}
                      icon={<Building className="w-3.5 h-3.5" />}
                    />
                    
                    {selectedGroupId && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {portalGroups.find(g => g.id === selectedGroupId)?.toGive > 0 && (
                          <div className="flex-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
                            <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block">To Give</span>
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">₹{portalGroups.find(g => g.id === selectedGroupId)?.toGive.toLocaleString()}</span>
                          </div>
                        )}
                        {portalGroups.find(g => g.id === selectedGroupId)?.toTake > 0 && (
                          <div className="flex-1 px-2 py-1 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg">
                            <span className="text-[7px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest block">To Take</span>
                            <span className="text-[10px] font-black text-red-700 dark:text-red-400">₹{portalGroups.find(g => g.id === selectedGroupId)?.toTake.toLocaleString()}</span>
                          </div>
                        )}
                        {(portalGroups.find(g => g.id === selectedGroupId)?.toGive === 0 || !portalGroups.find(g => g.id === selectedGroupId)?.toGive) && 
                         (portalGroups.find(g => g.id === selectedGroupId)?.toTake === 0 || !portalGroups.find(g => g.id === selectedGroupId)?.toTake) && (
                          <div className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Balance</span>
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-500">Settled</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedGroupId && (
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                        2. Choose Bank Account
                      </label>
                      <InlineSelect
                        value={selectedPortalId}
                        onChange={(val) => setSelectedPortalId(val)}
                        options={groupAccounts.map(a => ({ value: a.id, label: a.name }))}
                        placeholder={groupAccounts.length === 0 ? "No accounts found..." : "Select Account"}
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                      />
                    </div>
                  )}
                </div>
              )}

              {depositType === "retailer" && (
                <div>
                  <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                    Select Shop for Refund
                  </label>
                  <InlineSelect
                    value={selectedRetailerId}
                    onChange={(val) => setSelectedRetailerId(val)}
                    options={retailers.map(r => ({ value: r.id, label: r.name }))}
                    placeholder={retailers.length === 0 ? "Loading retailers..." : "Search Shop..."}
                    icon={<Layers className="w-3.5 h-3.5" />}
                  />
                </div>
              )}
            </div>
          )}



          {/* Unified Calculator Table */}
          {depositType === "virtual" ? (
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                Amount to Transfer (₹)
              </label>
              <input autoComplete="one-time-code"
                type="number"
                placeholder="e.g. 10000"
                value={denominations.online_amount || ""}
                onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200"
                min="1"
                required
              />
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Coins className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                Counting Details (Notes)
              </h2>
            </div>

            <div className="space-y-1">
              {[
                { label: "₹500 Notes", key: "note_500", multiplier: 500 },
                { label: "₹200 Notes", key: "note_200", multiplier: 200 },
                { label: "₹100 Notes", key: "note_100", multiplier: 100 },
                { label: "₹50 Notes", key: "note_50", multiplier: 50 },
                { label: "₹20 Notes", key: "note_20", multiplier: 20 },
                { label: "₹10 Notes", key: "note_10", multiplier: 10 },
                { label: "Coins / ₹1", key: "coins", multiplier: 1 },
              ].map((n) => (
                <div key={n.key} className="flex items-center gap-1.5 justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 w-20 text-left">
                      {n.label}
                    </span>
                  </div>

                  <span className="text-slate-350 dark:text-slate-600 text-[10px] font-bold">&times;</span>

                  {/* Input box */}
                  <input autoComplete="one-time-code"
                    type="number"
                    placeholder="0"
                    value={denominations[n.key as keyof DenominationCounts] || ""}
                    onChange={(e) => handleDenomChange(n.key as keyof DenominationCounts, e.target.value)}
                    className="w-12 px-1 py-0.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 focus:outline-none rounded text-center text-[10px] text-slate-800 dark:text-slate-200 font-black"
                  />
                  <span className="text-slate-300 dark:text-slate-655 text-[9px] font-bold">＝</span>

                  {/* Line total */}
                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-350 text-right w-14">
                    ₹{(Number(denominations[n.key as keyof DenominationCounts] || 0) * n.multiplier).toLocaleString()}
                  </span>
                </div>
              ))}

              {depositType !== "staff" && (
                <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span 
                      className="text-[10px] font-black text-slate-600 dark:text-slate-300 w-20 cursor-pointer"
                      onClick={() => setShowOnlinePortal(true)}
                    >
                      Online (GPay)
                    </span>
                    <span className="text-slate-355 dark:text-slate-600 text-[10px] font-bold">+</span>
                    <input autoComplete="one-time-code"
                      type="number"
                      placeholder="₹0.00"
                      value={denominations.online_amount || ""}
                      onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                      onKeyDown={(e) => handleNoNegativeKeyDown(e, true)}
                      className="w-24 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-805 focus:border-slate-400 rounded text-center text-[10px] text-slate-800 dark:text-slate-200 font-bold"
                      min="0"
                    />
                  </div>
                  {(showOnlinePortal || denominations.online_amount > 0) && (
                    <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <InlineSelect
                        value={denominations.online_portal_id || ""}
                        onChange={(val) => {
                          handleDenomChange("online_portal_id", val);
                          if (val && typeof window !== "undefined") {
                            localStorage.setItem("last_used_online_portal_id", val);
                          }
                        }}
                        options={[
                          { value: "", label: "Select Portal Account..." },
                          ...portalsList.map(p => ({ value: p.id, label: p.name }))
                        ]}
                        placeholder="Select Portal Account..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

          {/* Computed summary box */}
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[8px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">
                Total Payout Amount
              </span>
              <div className="text-[8px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold uppercase">
                Channel: {depositType.toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-slate-850 dark:text-white">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-955 rounded-lg text-[10px] font-black uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer shadow"
          >
            {editId ? "Update Cash Out Entry" : "Submit Cash Out Entry"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewDeposit() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 dark:text-slate-500 text-xs font-semibold">Loading...</div>
      </div>
    }>
      <NewDepositContent />
    </React.Suspense>
  );
}
