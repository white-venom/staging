"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, DenominationCounts } from "../utils/store";
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

export default function NewDeposit() {
  const router = useRouter();
  const { theme, toggleTheme, addDeposit } = useAppStore();

  const [depositType, setDepositType] = useState<"portal" | "retailer" | "staff">("portal");

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
    const val = value === "" ? 0 : parseFloat(value);
    setDenominations(prev => ({
      ...prev,
      [key]: isNaN(val) ? 0 : val
    }));
  };

  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
    // Load dynamic options from backend
    const loadOptions = async () => {
      try {
        const { api } = await import("../utils/api");
        const [groups, r, s] = await Promise.all([api.getPortalGroups(), api.getRetailers(), api.getStaffList()]);
        const mappedGroups = groups.map((x: any) => {
          const bal = parseFloat(x.balance || 0);
          return { 
            id: x.id, 
            name: x.name,
            toGive: bal < 0 ? Math.abs(bal) : 0,
            toTake: bal > 0 ? bal : 0
          };
        });
        const mappedRetailers = r.map((x: any) => ({ id: x.id, name: x.retailer_name || x.name }));
        const mappedStaff = s.map((x: any) => ({ id: x.id, name: x.name }));
        
        setPortalGroups(mappedGroups);
        setRetailers(mappedRetailers);
        setStaffUsers(mappedStaff);
        
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
    } else {
      targetName = toOffice ? "Main Office Cashier" : (staffUsers.find(s => s.id === selectedStaffId)?.name || "Field Staff");
    }

    // Build proper backend payload with UUIDs
    const backendPayload: any = {
      deposit_type: depositType,
      payment_mode: "unified",
      amount: totalAmount,
      denominations: denominations,
    };
    if (depositType === "portal") backendPayload.portal_id = selectedPortalId;
    if (depositType === "retailer") backendPayload.retailer_id = selectedRetailerId;
    if (depositType === "staff") {
      if (toOffice) {
        backendPayload.to_office = true;
      } else {
        backendPayload.recipient_staff_id = selectedStaffId;
      }
    }

    // Local store payload (uses camelCase display fields)
    const localDepData: any = {
      depositType,
      targetName,
      amount: totalAmount,
      paymentMode: "cash",
      denominations: denominations,
      portal_id: depositType === "portal" ? selectedPortalId : undefined,
      retailer_id: depositType === "retailer" ? selectedRetailerId : undefined,
      recipient_staff_id: depositType === "staff" ? selectedStaffId : undefined,
    };

    const submitOnline = async () => {
      try {
        const { api } = await import("../utils/api");
        await api.createDeposit(backendPayload);
        addDeposit(localDepData);
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
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Cash Out Entry</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Record payout details.</p>
            </div>
          </div>


        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel selections */}
          <div>
            <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-2 px-1">
              Where is money going? (Channel)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: "portal", label: "Portals", desc: "To Bank Account" },
                { type: "retailer", label: "Shops", desc: "Retailer Refund" },
                { type: "staff", label: "Office", desc: "Staff or Office" },
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
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            {depositType === "portal" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                    1. Choose Portal
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-700 dark:text-slate-300 appearance-none cursor-pointer font-semibold"
                    >
                      {portalGroups.length === 0 && <option value="">Loading portals...</option>}
                      {portalGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  
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
                    <div className="relative">
                      <CreditCard className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <select
                        value={selectedPortalId}
                        onChange={(e) => setSelectedPortalId(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-700 dark:text-slate-300 appearance-none cursor-pointer font-semibold"
                      >
                        {groupAccounts.length === 0 && <option value="">No accounts found...</option>}
                        {groupAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {depositType === "retailer" && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                  Select Shop for Refund
                </label>
                <div className="relative">
                  <Layers className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <select
                    value={selectedRetailerId}
                    onChange={(e) => setSelectedRetailerId(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-700 dark:text-slate-300 appearance-none cursor-pointer font-semibold"
                  >
                    {retailers.length === 0 && <option value="">Loading retailers...</option>}
                    {retailers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            {depositType === "staff" && (
              <div className="space-y-3">
                <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">
                  Select Staff or Office Receiver
                </label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setToOffice(false)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      !toOffice ? "bg-slate-900 text-white border-slate-900" : "bg-white dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800"
                    }`}>Staff Member</button>
                  <button type="button" onClick={() => setToOffice(true)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      toOffice ? "bg-slate-900 text-white border-slate-900" : "bg-white dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800"
                    }`}>Main Office</button>
                </div>
                {!toOffice && (
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl focus:outline-none text-xs text-slate-700 dark:text-slate-300 appearance-none cursor-pointer font-semibold"
                    >
                      {staffUsers.length === 0 && <option value="">Loading staff...</option>}
                      {staffUsers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            )}
          </div>



          {/* Unified Calculator Table */}
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
            Submit Cash Out Entry
          </button>
        </form>
      </div>
    </div>
  );
}
