"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, DenominationCounts } from "../utils/store";
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
    if (isNaN(val) || val < 0) {
      val = 0;
    }
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
      try {
        const { api } = await import("../utils/api");
        const [groups, r, s, portals] = await Promise.all([api.getPortalGroups(), api.getRetailers(), api.getStaffList(), api.getPortals()]);
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
        setPortalsList(portals.map((p: any) => ({ id: p.id, name: p.portal_name })));
        
        if (mappedGroups.length > 0) setSelectedGroupId(mappedGroups[0].id);
        if (mappedRetailers.length > 0) setSelectedRetailerId(mappedRetailers[0].id);
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
      const accName = groupAccounts.find(a => a.id === selectedPortalId)?.name || "Account";
      targetName = `${groupName} - ${accName}`;
    } else if (depositType === "retailer") {
      targetName = retailers.find(r => r.id === selectedRetailerId)?.name || "Retailer Store";
    } else if (depositType === "virtual") {
      const portalName = groupAccounts.find(a => a.id === selectedPortalId)?.name || "Portal";
      const retailerName = retailers.find(r => r.id === selectedRetailerId)?.name || "Retailer";
      targetName = `Virtual: ${portalName} ➔ ${retailerName}`;
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
        addDeposit(localDepData);
        alert("Note: Deposit recorded locally. (Backend sync failed: " + (err.message || "Unlinked") + ")");
        router.push("/staff");
      }
    };

    submitOnline();
  };

  if (!mounted) return null;


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col gap-5 select-none pb-24">
        
        {/* Header Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/staff")}
              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{editId ? "Edit Cash Out" : "Cash Out Entry"}</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{editId ? "Update payout details." : "Record payout details."}</p>
            </div>
          </div>


        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel selections */}
          <div>
            <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-2 px-1">
              Where is money going? (Channel)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: "portal", label: "Portals", desc: "To Bank Account" },
                { type: "retailer", label: "Shops", desc: "Retailer Refund" },
                { type: "staff", label: "Super Distributor", desc: "Super Distributor" },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setDepositType(opt.type as any)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    depositType === opt.type
                      ? "bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-950 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <div className="text-[11px] font-extrabold">{opt.label}</div>
                  <div className="text-[8px] font-bold uppercase tracking-wider opacity-70 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Context details options selector */}
          {depositType !== "staff" && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              {depositType === "virtual" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                      1. Select Source Portal Account
                    </label>
                    <InlineSelect
                      value={selectedGroupId}
                      onChange={(val) => setSelectedGroupId(val)}
                      options={portalGroups.map(g => ({ value: g.id, label: g.name }))}
                      placeholder={portalGroups.length === 0 ? "Loading portals..." : "Select Portal"}
                      icon={<Building className="w-4 h-4" />}
                    />
                  </div>

                  {selectedGroupId && (
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                        2. Select Source Bank Account
                      </label>
                      <InlineSelect
                        value={selectedPortalId}
                        onChange={(val) => setSelectedPortalId(val)}
                        options={groupAccounts.map(a => ({ value: a.id, label: a.name }))}
                        placeholder={groupAccounts.length === 0 ? "No accounts found..." : "Select Account"}
                        icon={<CreditCard className="w-4 h-4" />}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                      3. Select Destination Retailer
                    </label>
                    <InlineSelect
                      value={selectedRetailerId}
                      onChange={(val) => setSelectedRetailerId(val)}
                      options={retailers.map(r => ({ value: r.id, label: r.name }))}
                      placeholder={retailers.length === 0 ? "Loading retailers..." : "Select Retailer"}
                      icon={<Layers className="w-4 h-4" />}
                    />
                  </div>
                </div>
              )}

              {depositType === "portal" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                      1. Choose Portal
                    </label>
                    <InlineSelect
                      value={selectedGroupId}
                      onChange={(val) => setSelectedGroupId(val)}
                      options={portalGroups.map(g => ({ value: g.id, label: g.name }))}
                      placeholder={portalGroups.length === 0 ? "Loading portals..." : "Select Portal"}
                      icon={<Building className="w-4 h-4" />}
                    />
                    
                    {selectedGroupId && (
                      <div className="mt-2.5 flex items-center gap-2">
                        {portalGroups.find(g => g.id === selectedGroupId)?.toGive > 0 && (
                          <div className="flex-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                            <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block">To Give</span>
                            <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">₹{portalGroups.find(g => g.id === selectedGroupId)?.toGive.toLocaleString()}</span>
                          </div>
                        )}
                        {portalGroups.find(g => g.id === selectedGroupId)?.toTake > 0 && (
                          <div className="flex-1 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                            <span className="text-[8px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest block">To Take</span>
                            <span className="text-[11px] font-black text-red-700 dark:text-red-400">₹{portalGroups.find(g => g.id === selectedGroupId)?.toTake.toLocaleString()}</span>
                          </div>
                        )}
                        {(portalGroups.find(g => g.id === selectedGroupId)?.toGive === 0 || !portalGroups.find(g => g.id === selectedGroupId)?.toGive) && 
                         (portalGroups.find(g => g.id === selectedGroupId)?.toTake === 0 || !portalGroups.find(g => g.id === selectedGroupId)?.toTake) && (
                          <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Balance</span>
                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-500">Settled</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedGroupId && (
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                        2. Choose Bank Account
                      </label>
                      <InlineSelect
                        value={selectedPortalId}
                        onChange={(val) => setSelectedPortalId(val)}
                        options={groupAccounts.map(a => ({ value: a.id, label: a.name }))}
                        placeholder={groupAccounts.length === 0 ? "No accounts found..." : "Select Account"}
                        icon={<CreditCard className="w-4 h-4" />}
                      />
                    </div>
                  )}
                </div>
              )}

              {depositType === "retailer" && (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                    Select Shop for Refund
                  </label>
                  <InlineSelect
                    value={selectedRetailerId}
                    onChange={(val) => setSelectedRetailerId(val)}
                    options={retailers.map(r => ({ value: r.id, label: r.name }))}
                    placeholder={retailers.length === 0 ? "Loading retailers..." : "Select Shop"}
                    icon={<Layers className="w-4 h-4" />}
                  />
                </div>
              )}
            </div>
          )}



          {/* Unified Calculator Table */}
          {depositType === "virtual" ? (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                Amount to Transfer (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 10000"
                value={denominations.online_amount || ""}
                onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200"
                min="1"
                required
              />
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Counting Details (Notes)
              </h2>
            </div>

            <div className="space-y-3">
              {[
                { label: "₹500 Notes", key: "note_500", multiplier: 500, img: "/images/notes/500.jpg" },
                { label: "₹200 Notes", key: "note_200", multiplier: 200, img: "/images/notes/200.jpg" },
                { label: "₹100 Notes", key: "note_100", multiplier: 100, img: "/images/notes/100.png" },
                { label: "₹50 Notes", key: "note_50", multiplier: 50, img: "/images/notes/50.jpg" },
                { label: "₹20 Notes", key: "note_20", multiplier: 20, img: "/images/notes/20.jpg" },
                { label: "₹10 Notes", key: "note_10", multiplier: 10, img: "/images/notes/10.jpg" },
                { label: "Coins / ₹1", key: "coins", multiplier: 1, img: "/images/notes/1.jpg" },
              ].map((n) => (
                <div key={n.key} className="flex items-center gap-3 justify-between py-1 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                  {/* Note label without image */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 w-24 text-left">
                      {n.label}
                    </span>
                  </div>

                  <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">✖</span>

                  {/* Input box */}
                  <input
                    type="number"
                    placeholder="0"
                    value={denominations[n.key as keyof DenominationCounts] || ""}
                    onChange={(e) => handleDenomChange(n.key as keyof DenominationCounts, e.target.value)}
                    onKeyDown={(e) => handleNoNegativeKeyDown(e, n.key === "coins")}
                    className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 focus:outline-none rounded-lg text-center text-xs text-slate-800 dark:text-slate-200 font-extrabold"
                    min="0"
                  />

                  <span className="text-slate-300 dark:text-slate-655 text-[10px] font-bold">＝</span>

                  {/* Line total */}
                  <span className="text-xs font-black text-slate-700 dark:text-slate-350 text-right w-16">
                    ₹{(Number(denominations[n.key as keyof DenominationCounts] || 0) * n.multiplier).toLocaleString()}
                  </span>
                </div>
              ))}

              <div className="flex flex-col gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 justify-between">
                  <span 
                    className="text-xs font-black text-slate-600 dark:text-slate-300 w-28 cursor-pointer"
                    onClick={() => setShowOnlinePortal(true)}
                  >
                    Online (GPay)
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">➕</span>
                  <input
                    type="number"
                    placeholder="₹0.00"
                    value={denominations.online_amount || ""}
                    onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                    onKeyDown={(e) => handleNoNegativeKeyDown(e, true)}
                    className="w-32 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-lg text-center text-xs text-slate-800 dark:text-slate-200 font-bold"
                    min="0"
                  />
                </div>
                {(showOnlinePortal || denominations.online_amount > 0) && (
                  <div className="mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <select
                      value={denominations.online_portal_id || ""}
                      onChange={(e) => handleDenomChange("online_portal_id", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-slate-400"
                    >
                      <option value="">Select Portal Account...</option>
                      {portalsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {/* Computed summary box */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Total Payout Amount
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Channel: {depositType.toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-slate-850 dark:text-white">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer shadow"
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
