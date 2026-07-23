"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, DenominationCounts } from "../utils/store";
import { db } from "../utils/db";
import InlineSelect from "../components/InlineSelect";
import { getISTDateString } from "../utils/dateHelpers";
import { 
  ArrowLeft, 
  Layers, 
  User, 
  Coins, 
  Building,
  CreditCard,
  Sun,
  Moon,
  ChevronDown,
  FileText
} from "lucide-react";

function NewDepositContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
  const { theme, toggleTheme, addDeposit, currentUser } = useAppStore();

  // "staff" = handed to the office/super-distributor (to_office=true).
  // "staff_person" = a genuine staff-to-staff handover (recipient_staff_id set) --
  // item #9: the SENDING staff now initiates this via this Cash Out channel,
  // which auto-creates the matching incoming Collection on the recipient's side.
  const [depositType, setDepositType] = useState<"portal" | "retailer" | "staff" | "staff_person" | "virtual">("portal");

  // Dynamic options loaded from backend
  const [portals, setPortals] = useState<any[]>([]);
  const [portalAccounts, setPortalAccounts] = useState<{ id: string; name: string }[]>([]);
  const [retailers, setRetailers] = useState<{ id: string; name: string }[]>([]);
  const [staffUsers, setStaffUsers] = useState<{ id: string; name: string }[]>([]);

  const [selectedPortalId, setSelectedPortalId] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [selectedRetailerId, setSelectedRetailerId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [toOffice, setToOffice] = useState(false);
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [showOnlineBankAccount, setShowOnlineBankAccount] = useState(false);
  const [remarks, setRemarks] = useState("");

  // Deposit Date Selector
  const [depositDate, setDepositDate] = useState<string>(() => getISTDateString());
  const [staffCanChangeCashInDate, setStaffCanChangeCashInDate] = useState(false);
  // Superadmin-controlled feature flags (Part 1) -- default true (shown) so a
  // transient settings-fetch failure never silently removes a working channel.
  const [staffHandoverEnabled, setStaffHandoverEnabled] = useState(true);

  // Difference Calculator State
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcTarget, setCalcTarget] = useState<number | "">("");
  const [calcPaid, setCalcPaid] = useState<number | "">("");

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
    if (key === "online_bank_account_id") {
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
    if (editId && mounted && portals.length > 0) {
      const loadEdit = async () => {
        try {
          const { api } = await import("../utils/api");
          const deps = await api.getDeposits();
          const target = deps.find((d: any) => d.id === editId);
          if (target) {
            if (target.deposit_type === "staff" && target.recipient_staff_id) {
              setDepositType("staff_person");
              setSelectedStaffId(target.recipient_staff_id);
            } else {
              setDepositType(target.deposit_type);
            }
            if (target.deposit_type === "portal" || target.deposit_type === "virtual") {
              setSelectedBankAccountId(target.bank_account_id);
            }
            if (target.deposit_type === "retailer" || target.deposit_type === "virtual") {
              setSelectedRetailerId(target.retailer_id);
            }
            if (target.remarks) {
              setRemarks(target.remarks);
            }
            if (target.deposit_date) {
              setDepositDate(String(target.deposit_date).substring(0, 10));
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
          }
        } catch (err) {
          console.error("Failed to load edit deposit", err);
        }
      };
      loadEdit();
    }
  }, [editId, mounted, portals]);


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
        const [groups, r, s] = await Promise.all([api.getPortals(), api.getRetailers(), api.getStaffList()]);
        const mappedPortals = groups.map((x: any) => {
          return { 
            id: x.id, 
            name: x.name,
            toGive: parseFloat(x.opening_to_give || 0),
            toTake: parseFloat(x.opening_to_take || 0)
          };
        });
        const mappedRetailers = r.map((x: any) => ({ id: x.id, name: x.retailer_name || x.name }));
        const mappedStaff = s.map((x: any) => ({ id: x.id, name: x.name }));
        
        setPortals(mappedPortals);
        setRetailers(mappedRetailers);
        setStaffUsers(mappedStaff);

        // Update IndexedDB cache for retailers
        if (r && r.length > 0) {
          await db.retailers.clear();
          await db.retailers.bulkPut(r.map((x: any) => ({
            id: x.id,
            name: x.retailer_name || x.name,
            phone: x.phone || "",
            bankAccountName: "Standard",
            opening_to_give: parseFloat(x.opening_to_give || 0),
            opening_to_take: parseFloat(x.opening_to_take || 0),
            net_balance: parseFloat(x.balance || 0)
          })));
        }

        // Flatten: only individual bank accounts marked show_in_online_payment=true
        const onlineBankAccounts: { id: string; name: string }[] = [];
        for (const g of groups) {
          for (const p of (g.bank_accounts || [])) {
            if (p.show_in_online_payment) {
              onlineBankAccounts.push({
                id: p.id,
                name: g.bank_accounts.length > 1 ? `${g.name} - ${p.bank_account_name}` : g.name
              });
            }
          }
        }
        setBankAccountsList(onlineBankAccounts);
        
        // Auto default to last used online bankAccount if not editing
        if (!editId && typeof window !== "undefined") {
          const lastUsedBankAccountId = localStorage.getItem("last_used_online_bank_account_id");
          if (lastUsedBankAccountId && onlineBankAccounts.some(p => p.id === lastUsedBankAccountId)) {
            setDenominations(prev => ({ ...prev, online_bank_account_id: lastUsedBankAccountId }));
            setShowOnlineBankAccount(true);
          }
        }
        
        if (mappedPortals.length > 0) setSelectedPortalId(mappedPortals[0].id);
        // Do not auto-select the first retailer/staff recipient on mount -- for a
        // money-moving handover this must be an explicit choice, not a default
        // that could send cash to the wrong person if submitted unreviewed.
        setSelectedRetailerId("");
        if (!editId) setSelectedStaffId("");
      } catch (err) {
        console.error("Failed to load deposit options:", err);
      }
    };
    loadOptions();

    (async () => {
      try {
        const { api } = await import("../utils/api");
        const settings = await api.getAdminSettings().catch(() => null);
        if (settings) {
          setStaffCanChangeCashInDate(settings.staff_can_change_collection_date ?? false);
          if (settings.feature_flags && "staff_handover" in settings.feature_flags) {
            setStaffHandoverEnabled(!!settings.feature_flags.staff_handover);
          }
        }
      } catch (err) {
        console.error("Failed to load admin settings:", err);
      }
    })();
  }, []);

  // Fetch accounts when group changes
  React.useEffect(() => {
    if (selectedPortalId) {
      const fetchAccounts = async () => {
        try {
          const { api } = await import("../utils/api");
          const accounts = await api.getPortalAccounts(selectedPortalId);
          const mappedAccounts = accounts.map((x: any) => ({ id: x.id, name: x.bank_account_name }));
          setPortalAccounts(mappedAccounts);
          if (mappedAccounts.length > 0) setSelectedBankAccountId(mappedAccounts[0].id);
          else setSelectedBankAccountId("");
        } catch (err) {
          console.error("Failed to fetch group accounts:", err);
        }
      };
      fetchAccounts();
    }
  }, [selectedPortalId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mounted) return;
    if (totalAmount <= 0) {
      alert("Please specify a deposit amount greater than zero.");
      return;
    }
    if (depositType === "staff_person" && !selectedStaffId) {
      alert("Please select which staff member is receiving this handover.");
      return;
    }

    // Build target name for local store display
    let targetName = "";
    if (depositType === "portal") {
      const groupName = portals.find(g => g.id === selectedPortalId)?.name || "Bank Account";
      targetName = groupName;
    } else if (depositType === "retailer") {
      targetName = retailers.find(r => r.id === selectedRetailerId)?.name || "Retailer Store";
    } else if (depositType === "virtual") {
      const bankAccountName = portalAccounts.find(a => a.id === selectedBankAccountId)?.name || "Bank Account";
      const retailerName = retailers.find(r => r.id === selectedRetailerId)?.name || "Retailer";
      targetName = `Virtual: ${bankAccountName} → ${retailerName}`;
    } else if (depositType === "staff_person") {
      targetName = staffUsers.find(s => s.id === selectedStaffId)?.name || "Staff Member";
    } else {
      targetName = "Super Distributor";
    }

    // Build proper backend payload with UUIDs. "staff_person" is a frontend-only
    // distinction -- the backend's deposit_type is "staff" either way, split by
    // to_office vs recipient_staff_id (see item #9).
    const backendPayload: any = {
      deposit_type: depositType === "staff_person" ? "staff" : depositType,
      payment_mode: depositType === "virtual" ? "online" : "unified",
      amount: totalAmount,
      denominations: denominations,
      remarks: remarks,
      deposit_date: depositDate,
    };
    if (depositType === "portal" || depositType === "virtual") backendPayload.bank_account_id = selectedBankAccountId;
    if (depositType === "retailer" || depositType === "virtual") backendPayload.retailer_id = selectedRetailerId;
    if (depositType === "staff") {
      backendPayload.to_office = true;
    }
    if (depositType === "staff_person") {
      backendPayload.recipient_staff_id = selectedStaffId;
    }

    // Local store payload (uses camelCase display fields). Mirrors the backend's
    // canonical "staff" type -- "staff_person" only exists as a form-input
    // distinction, never as a stored/displayed deposit type.
    const localDepData: any = {
      depositType: depositType === "staff_person" ? "staff" : depositType,
      targetName,
      amount: totalAmount,
      paymentMode: depositType === "virtual" ? "online" : "cash",
      denominations: denominations,
      remarks: remarks,
      bank_account_id: (depositType === "portal" || depositType === "virtual") ? selectedBankAccountId : undefined,
      retailer_id: (depositType === "retailer" || depositType === "virtual") ? selectedRetailerId : undefined,
      recipient_staff_id: depositType === "staff_person" ? selectedStaffId : undefined,
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
          bank_account_id: backendPayload.bank_account_id,
          retailer_id: backendPayload.retailer_id,
          recipient_staff_id: backendPayload.recipient_staff_id,
          depositType,
          targetName,
          amount: totalAmount,
          paymentMode: depositType === "virtual" ? "online" : "cash",
          denominations,
          remarks: remarks,
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 w-full max-w-md mx-auto px-2 py-2 flex flex-col gap-1.5 select-none pb-20">

        {/* Header Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/staff")}
              className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-sm cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{editId ? "Edit Cash Out" : "Cash Out Entry"}</h1>
              <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">{editId ? "Update payout details." : "Record payout details."}</p>
            </div>
          </div>


        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Channel selections */}
          <div>
            <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1 px-1">
              Where is money going? (Channel)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-sm overflow-hidden border border-slate-200 dark:border-slate-800">
              {[
                { type: "portal", label: "Portals", desc: "Bank Acc" },
                { type: "retailer", label: "Shops", desc: "Refund" },
                ...(staffHandoverEnabled ? [{ type: "staff_person", label: "Staff", desc: "Handover" }] : []),
                { type: "staff", label: "Office", desc: "Distributor" },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setDepositType(opt.type as any);
                    if (opt.type === "staff" || opt.type === "staff_person") {
                      setDenominations(prev => ({
                        ...prev,
                        online_amount: 0,
                        online_bank_account_id: undefined
                      }));
                      setShowOnlineBankAccount(false);
                    }
                  }}
                  className={`py-1.5 px-1 text-center transition-colors cursor-pointer ${
                    depositType === opt.type
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-wider">{opt.label}</div>
                  <div className="text-[7px] font-bold uppercase tracking-wider opacity-70 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Staff-to-staff handover: pick the recipient (item #9) */}
          {depositType === "staff_person" && (
            <div className="p-2 rounded-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 mb-1">
                Select Recipient Staff Member
              </label>
              <InlineSelect
                value={selectedStaffId}
                onChange={(val) => setSelectedStaffId(val)}
                options={staffUsers.filter((s) => s.id !== currentUser?.id).map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Choose Staff Member"
                icon={<User className="w-3.5 h-3.5" />}
              />
            </div>
          )}

          {/* Context details options selector */}
          {depositType !== "staff" && depositType !== "staff_person" && (
            <div className="p-2 rounded-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {depositType === "virtual" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                      1. Select Source Portal
                    </label>
                    <InlineSelect
                      value={selectedPortalId}
                      onChange={(val) => setSelectedPortalId(val)}
                      options={portals.map(g => ({ value: g.id, label: g.name }))}
                      placeholder={portals.length === 0 ? "Loading accounts..." : "Select Bank"}
                      icon={<Building className="w-3.5 h-3.5" />}
                    />
                  </div>

                  {selectedPortalId && (
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                        2. Select Source Bank Account
                      </label>
                      <InlineSelect
                        value={selectedBankAccountId}
                        onChange={(val) => setSelectedBankAccountId(val)}
                        options={portalAccounts.map(a => ({ value: a.id, label: a.name }))}
                        placeholder={portalAccounts.length === 0 ? "No accounts found..." : "Select Account"}
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
                      value={selectedPortalId}
                      onChange={(val) => setSelectedPortalId(val)}
                      options={portals.map(g => ({ value: g.id, label: g.name }))}
                      placeholder={portals.length === 0 ? "Loading accounts..." : "Select Bank"}
                      icon={<Building className="w-3.5 h-3.5" />}
                    />
                    
                    {selectedPortalId && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {portals.find(g => g.id === selectedPortalId)?.toGive > 0 && (
                          <div className="flex-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-sm flex items-center justify-between">
                            <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">To Give</span>
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">₹{portals.find(g => g.id === selectedPortalId)?.toGive.toLocaleString()}</span>
                          </div>
                        )}
                        {portals.find(g => g.id === selectedPortalId)?.toTake > 0 && (
                          <div className="flex-1 px-2 py-1 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-sm flex items-center justify-between">
                            <span className="text-[7px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest">To Take</span>
                            <span className="text-[10px] font-black text-red-700 dark:text-red-400 font-mono tabular-nums">₹{portals.find(g => g.id === selectedPortalId)?.toTake.toLocaleString()}</span>
                          </div>
                        )}
                        {(portals.find(g => g.id === selectedPortalId)?.toGive === 0 || !portals.find(g => g.id === selectedPortalId)?.toGive) &&
                         (portals.find(g => g.id === selectedPortalId)?.toTake === 0 || !portals.find(g => g.id === selectedPortalId)?.toTake) && (
                          <div className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm flex items-center justify-between">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Balance</span>
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-500 font-mono">Settled</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedPortalId && (
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1">
                        2. Choose Bank Account
                      </label>
                      <InlineSelect
                        value={selectedBankAccountId}
                        onChange={(val) => setSelectedBankAccountId(val)}
                        options={portalAccounts.map(a => ({ value: a.id, label: a.name }))}
                        placeholder={portalAccounts.length === 0 ? "No accounts found..." : "Select Account"}
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
            <div className="p-2 rounded-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <label className="block text-[8px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500">
                Amount to Transfer (₹)
              </label>
              <input autoComplete="one-time-code"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 10000"
                value={denominations.online_amount || ""}
                onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none rounded-sm text-right text-xs font-mono font-extrabold tabular-nums text-slate-800 dark:text-slate-200"
                min="1"
                required
              />
            </div>
          ) : (
            <div className="rounded-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60">
              <Coins className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
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
                <div key={n.key} className="flex items-center gap-1.5 justify-between px-2 py-0.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                  <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 w-16 text-left">
                    {n.label}
                  </span>

                  <span className="text-slate-400 dark:text-slate-600 text-[10px] font-bold">&times;</span>

                  {/* Input box */}
                  <input autoComplete="one-time-code"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={denominations[n.key as keyof DenominationCounts] || ""}
                    onChange={(e) => handleDenomChange(n.key as keyof DenominationCounts, e.target.value)}
                    className="w-12 px-1 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none rounded-sm text-right text-[10px] text-slate-800 dark:text-slate-200 font-mono font-black tabular-nums"
                  />
                  <span className="text-slate-300 dark:text-slate-500 text-[9px] font-bold">＝</span>

                  {/* Line total */}
                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 text-right w-14 font-mono tabular-nums">
                    ₹{(Number(denominations[n.key as keyof DenominationCounts] || 0) * n.multiplier).toLocaleString()}
                  </span>
                </div>
              ))}

              {depositType !== "staff" && depositType !== "staff_person" && (
                <div className="flex flex-col gap-1 px-2 py-1.5 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span
                      className="text-[10px] font-black text-slate-600 dark:text-slate-300 w-16 cursor-pointer"
                      onClick={() => setShowOnlineBankAccount(true)}
                    >
                      Online (GPay)
                    </span>
                    <span className="text-slate-400 dark:text-slate-600 text-[10px] font-bold">+</span>
                    <input autoComplete="one-time-code"
                      type="number"
                      inputMode="decimal"
                      placeholder="₹0.00"
                      value={denominations.online_amount || ""}
                      onChange={(e) => handleDenomChange("online_amount", e.target.value)}
                      onKeyDown={(e) => handleNoNegativeKeyDown(e, true)}
                      className="w-24 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none rounded-sm text-right text-[10px] text-slate-800 dark:text-slate-200 font-mono font-bold tabular-nums"
                      min="0"
                    />
                  </div>
                  {(showOnlineBankAccount || denominations.online_amount > 0) && (
                    <div>
                      <InlineSelect
                        value={denominations.online_bank_account_id || ""}
                        onChange={(val) => {
                          handleDenomChange("online_bank_account_id", val);
                          if (val && typeof window !== "undefined") {
                            localStorage.setItem("last_used_online_bank_account_id", val);
                          }
                        }}
                        options={[
                          { value: "", label: "Select Bank Account..." },
                          ...bankAccountsList.map(p => ({ value: p.id, label: p.name }))
                        ]}
                        placeholder="Select Bank Account..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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
                  <label className="text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">
                    Already Paid
                  </label>
                  <input autoComplete="one-time-code"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 24000"
                    value={calcPaid === "" ? totalAmount : calcPaid}
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
                  const currentPaid = calcPaid === "" ? totalAmount : Number(calcPaid);
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

        {/* Deposit Date */}
        <div className="space-y-1">
          <label className="block text-[8px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 px-1">
            Deposit Date
          </label>
          {staffCanChangeCashInDate ? (
            /* Admin has allowed date change — show calendar picker with chevron */
            <div className="relative">
              <input autoComplete="one-time-code"
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                className="w-full px-3 py-1.5 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-sm focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-bold cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </div>
          ) : (
            /* Admin has disabled date change — show today's date as fixed display */
            <div className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-sm text-xs text-slate-500 dark:text-slate-400 font-bold select-none">
              {(() => {
                const [y, m, d] = depositDate.split("-");
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

        {/* Computed summary box */}
        <div className="p-2 rounded-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[8px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">
                Total Payout Amount
              </span>
              <div className="text-[8px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold uppercase">
                Channel: {depositType === "staff_person" ? "STAFF" : depositType.toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <span className={`text-base font-black font-mono tabular-nums ${totalAmount < 0 ? 'text-red-600 dark:text-red-500' : totalAmount === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-sm text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
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
