"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, History, Edit, Trash2, X, Save, ArrowLeftRight } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import InlineSelect from "../../../components/InlineSelect";
import { getISTDateString } from "../../../utils/dateHelpers";

export default function WalletTransferTab() {
  const adminContext = useAdmin();
  const { retailerDirectory, portalDirectory, userDirectory, deposits, fetchData, showToastNotification } = adminContext;

  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);

  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);

  const [selectedNewRetailerId, setSelectedNewRetailerId] = useState("");
  const [selectedNewBankAccountId, setSelectedNewBankAccountId] = useState("");
  const [selectedNewRemarks, setSelectedNewRemarks] = useState("");
  const [selectedNewRecipientStaffId, setSelectedNewRecipientStaffId] = useState("");
  const [selectedNewToOffice, setSelectedNewToOffice] = useState(false);
  const [selectedNewDepositType, setSelectedNewDepositType] = useState("");
  const [selectedNewPaymentMode, setSelectedNewPaymentMode] = useState("");
  const [selectedNewAmount, setSelectedNewAmount] = useState(0);
  const [selectedNewDate, setSelectedNewDate] = useState("");
  const [selectedNewRefNo, setSelectedNewRefNo] = useState("");
  const [selectedNewVirtualTargetType, setSelectedNewVirtualTargetType] = useState("retailer");
  const [isSavingCollection, setIsSavingCollection] = useState(false);

  const [selectedNewDenoms, setSelectedNewDenoms] = useState({
    note_500: 0,
    note_200: 0,
    note_100: 0,
    note_50: 0,
    note_20: 0,
    note_10: 0,
    coins: 0,
    online_amount: 0,
  });

  const handleStartEditDeposit = (item: any) => {
    setEditingCollection(item);
    setSelectedNewRetailerId(item.retailer_id || "");
    setSelectedNewBankAccountId(item.bank_account_id || "");
    setSelectedNewRemarks(item.remarks || "");
    setSelectedNewDepositType(item.depositType || item.deposit_type || "virtual");
    setSelectedNewPaymentMode(item.paymentMode || item.payment_mode || "online");
    setSelectedNewAmount(Number(item.amount || 0));
    setSelectedNewDate(item.deposit_date ? item.deposit_date : (item.date ? item.date.split(" ")[0] : getISTDateString()));
    setSelectedNewRefNo(item.reference_no || item.referenceNo || "");
    setSelectedNewRecipientStaffId(item.recipient_staff_id || item.recipientStaffId || "");
    setSelectedNewToOffice(item.to_office === true);
    const hasStaff = !!(item.recipient_staff_id || item.recipientStaffId);
    setSelectedNewVirtualTargetType(hasStaff ? "staff" : "retailer");

    const den = item.denominations || {};
    setSelectedNewDenoms({
      note_500: Number(den.note_500 || 0),
      note_200: Number(den.note_200 || 0),
      note_100: Number(den.note_100 || 0),
      note_50: Number(den.note_50 || 0),
      note_20: Number(den.note_20 || 0),
      note_10: Number(den.note_10 || 0),
      coins: Number(den.coins || 0),
      online_amount: Number(den.online_amount || 0),
    });

    setIsEditCollectionModalOpen(true);
    setSelectedDepositId(null);
  };

  const handleSaveDepositEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    setIsSavingCollection(true);

    try {
      const bankAccountId = selectedNewDepositType === "portal" || selectedNewDepositType === "virtual" ? selectedNewBankAccountId : null;
      const retailerId = selectedNewDepositType === "retailer" || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "retailer") ? selectedNewRetailerId : null;
      const recipientStaffId = (selectedNewDepositType === "staff" && !selectedNewToOffice) || (selectedNewDepositType === "virtual" && selectedNewVirtualTargetType === "staff") ? selectedNewRecipientStaffId : null;
      const toOffice = selectedNewDepositType === "staff" ? selectedNewToOffice : false;

      await api.updateDeposit(editingCollection.id, {
        deposit_type: selectedNewDepositType,
        bank_account_id: bankAccountId || null,
        retailer_id: retailerId || null,
        recipient_staff_id: recipientStaffId || null,
        to_office: toOffice,
        payment_mode: selectedNewPaymentMode,
        amount: Number(selectedNewAmount),
        deposit_date: selectedNewDate || getISTDateString(),
        reference_no: selectedNewRefNo || null,
        remarks: selectedNewRemarks || "",
        denominations: selectedNewPaymentMode === "cash" ? selectedNewDenoms : null
      });

      if (showToastNotification) showToastNotification("Deposit/Payout updated successfully.");
      setIsEditCollectionModalOpen(false);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

  const currentSelection = (deposits || []).find((d: any) => d.id === selectedDepositId);

  const handleDelete = async () => {
    if (!selectedDepositId) return;
    if (!confirm("Are you sure you want to delete this virtual transfer?")) return;
    try {
      await api.deleteDeposit(selectedDepositId);
      if (showToastNotification) showToastNotification("Deleted successfully!");
      setSelectedDepositId(null);
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const [vSourceBankAccountId, setVSourceBankAccountId] = useState("");
  const [vDirection, setVDirection] = useState<"load" | "refund">("load");
  const [vDestType, setVDestType] = useState<"retailer" | "staff">("retailer");
  const [vDestRetailerId, setVDestRetailerId] = useState("");
  const [vDestStaffId, setVDestStaffId] = useState("");
  const [vAmount, setVAmount] = useState("");
  const [vRemarks, setVRemarks] = useState("");
  const [vDate, setVDate] = useState(() => {
    const d = new Date();
    const tzString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const parts = new Date(tzString);
    const y = parts.getFullYear();
    const m = String(parts.getMonth() + 1).padStart(2, "0");
    const day = String(parts.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [isTransferring, setIsTransferring] = useState(false);

  // BankAccount-to-BankAccount Transfer state
  const todayIST = () => {
    const d = new Date();
    const tzString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const parts = new Date(tzString);
    const y = parts.getFullYear();
    const m = String(parts.getMonth() + 1).padStart(2, "0");
    const day = String(parts.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const [activeTab, setActiveTab] = useState<"virtual" | "portal_to_portal">("virtual");
  const [ptpFromAccountId, setPtpFromAccountId] = useState("");
  const [ptpToAccountId, setPtpToAccountId] = useState("");
  const [ptpAmount, setPtpAmount] = useState("");
  const [ptpRemarks, setPtpRemarks] = useState("");
  const [ptpDate, setPtpDate] = useState(todayIST);
  const [isPortalTransferring, setIsPortalTransferring] = useState(false);

  const allBankAccounts = (portalDirectory || []).flatMap((g: any) => 
    (g.bankAccounts || []).map((p: any) => ({
      ...p,
      groupName: g.name
    }))
  );

  const handlePortalToPortalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ptpFromAccountId || !ptpToAccountId) {
      alert("Please select both source and destination bankAccounts.");
      return;
    }
    if (ptpFromAccountId === ptpToAccountId) {
      alert("Source and destination bankAccounts must be different.");
      return;
    }
    const amt = parseFloat(ptpAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }
    setIsPortalTransferring(true);
    try {
      await api.portalTransfer({
        from_bank_account_id: ptpFromAccountId,
        bank_account_id: ptpToAccountId,
        amount: amt,
        remarks: ptpRemarks || undefined,
        deposit_date: ptpDate,
      });
      if (showToastNotification) {
        showToastNotification(`BankAccount Transfer of ₹${amt.toLocaleString("en-IN")} done successfully!`);
      }
      setPtpFromAccountId("");
      setPtpToAccountId("");
      setPtpAmount("");
      setPtpRemarks("");
      setPtpDate(todayIST());
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Transfer Error: " + err.message);
    } finally {
      setIsPortalTransferring(false);
    }
  };

  const handleVirtualTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vSourceBankAccountId) {
      alert("Please select a source bankAccount account");
      return;
    }
    const amt = parseFloat(vAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid transfer amount greater than 0");
      return;
    }

    const payload: any = {
      bank_account_id: vSourceBankAccountId,
      amount: amt,
      remarks: vRemarks || undefined,
      direction: vDirection,
      transfer_date: vDate
    };

    if (vDestType === "retailer") {
      if (!vDestRetailerId) {
        alert("Please select a destination retailer");
        return;
      }
      payload.retailer_id = vDestRetailerId;
    } else {
      if (!vDestStaffId) {
        alert("Please select a destination staff member");
        return;
      }
      payload.staff_id = vDestStaffId;
    }

    setIsTransferring(true);
    try {
      await api.virtualTransfer(payload);

      const targetMsg = vDestType === "retailer" ? "Retailer" : "Staff";
      const actionMsg = vDirection === "load" 
        ? `Virtually loaded ₹${amt.toLocaleString()} to ${targetMsg}'s wallet!`
        : `Moved ₹${amt.toLocaleString()} from ${targetMsg} back to BankAccount!`;

      if (showToastNotification) {
        showToastNotification(actionMsg);
      } else {
        alert(actionMsg);
      }

      setVSourceBankAccountId("");
      setVDestRetailerId("");
      setVDestStaffId("");
      setVAmount("");
      setVRemarks("");
      setVDate(() => {
        const d = new Date();
        const tzString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const parts = new Date(tzString);
        const y = parts.getFullYear();
        const m = String(parts.getMonth() + 1).padStart(2, "0");
        const day = String(parts.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      });

      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Transfer Error: " + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const formatIST = (dateStr: string) => {
    try {
      let parseStr = dateStr;
      if (!dateStr.endsWith("Z") && !dateStr.includes("+")) {
        parseStr = dateStr.replace(" ", "T") + "Z";
      }
      const d = new Date(parseStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: "", full: dateStr };

      const datePart = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        timeZone: "Asia/Kolkata"
      });

      const timePart = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata"
      });

      return { date: datePart, time: timePart, full: `${datePart}, ${timePart}` };
    } catch {
      return { date: dateStr, time: "", full: dateStr };
    }
  };

  const recentVirtualTransfers = React.useMemo(() => {
    const virtualDeps = (deposits || []).filter((d: any) => d.depositType === "virtual");
    return [...virtualDeps]
      .sort((a: any, b: any) => {
        const da = a.created_at || a.date;
        const db = b.created_at || b.date;
        return new Date(db || 0).getTime() - new Date(da || 0).getTime();
      })
      .slice(0, 10);
  }, [deposits]);

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 space-y-6">
        {/* Tab switcher */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-sm">
          <button
            type="button"
            onClick={() => setActiveTab("virtual")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wide rounded-sm transition-colors ${
              activeTab === "virtual"
                ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Virtual Transfer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("portal_to_portal")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-wide rounded-sm transition-colors ${
              activeTab === "portal_to_portal"
                ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            BankAccount to BankAccount
          </button>
        </div>

        {activeTab === "portal_to_portal" ? (
          /* ---- ACCOUNT TO ACCOUNT TRANSFER FORM ---- */
          <>
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ArrowLeftRight className="w-5 h-5 text-violet-600" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                BankAccount to BankAccount Transfer
              </h3>
            </div>
            <form onSubmit={handlePortalToPortalTransfer} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Source BankAccount (From)</label>
                <InlineSelect
                  value={ptpFromAccountId}
                  onChange={(val) => setPtpFromAccountId(val)}
                  options={(portalDirectory || []).flatMap((g: any) =>
                    (g.bankAccounts || []).map((p: any) => ({
                      value: p.id,
                      label: `${g.name}${g.bankAccounts.length > 1 ? ` / ${p.bank_account_name}` : ""} — Bal: ₹${(p.balance || 0).toLocaleString("en-IN")}`
                    }))
                  )}
                  placeholder="Select Source BankAccount"
                />
              </div>
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Destination BankAccount (To)</label>
                <InlineSelect
                  value={ptpToAccountId}
                  onChange={(val) => setPtpToAccountId(val)}
                  options={(portalDirectory || []).flatMap((g: any) =>
                    (g.bankAccounts || []).map((p: any) => ({
                      value: p.id,
                      label: `${g.name}${g.bankAccounts.length > 1 ? ` / ${p.bank_account_name}` : ""} — Bal: ₹${(p.balance || 0).toLocaleString("en-IN")}`,
                      disabled: p.id === ptpFromAccountId
                    }))
                  )}
                  placeholder="Select Destination BankAccount"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Transfer Date</label>
                <input autoComplete="one-time-code"
                  type="date"
                  value={ptpDate}
                  onChange={e => setPtpDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Amount (₹)</label>
                <input autoComplete="one-time-code"
                  type="number"
                  inputMode="decimal"
                  value={ptpAmount}
                  onChange={e => setPtpAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 text-slate-700 dark:text-slate-200"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Remarks (Optional)</label>
                <input autoComplete="one-time-code"
                  type="text"
                  value={ptpRemarks}
                  onChange={e => setPtpRemarks(e.target.value)}
                  placeholder="e.g. Monthly settlement"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200"
                />
              </div>
              <button
                type="submit"
                disabled={isPortalTransferring}
                className="w-full py-3 text-white rounded-sm text-xs font-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
              >
                {isPortalTransferring ? "Processing Transfer..." : "Transfer Between Accounts"}
              </button>
            </form>
          </>
        ) : (
          /* ---- VIRTUAL MONEY TRANSFER FORM ---- */
          <>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
              Virtual Money Transfer
            </h3>
          </div>
          <select
            value={vDirection}
            onChange={(e) => setVDirection(e.target.value as "load" | "refund")}
            className="text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-sm px-2 py-1 outline-none cursor-pointer"
          >
            <option value="load">Virtual Transfer</option>
            <option value="refund">Move to Distributor</option>
          </select>
        </div>

        <form onSubmit={handleVirtualTransfer} className="space-y-4">
          <div className={`flex ${vDirection === 'load' ? 'flex-col' : 'flex-col-reverse'} gap-4`}>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                {vDirection === "load" ? "Source BankAccount" : "Destination BankAccount"}
              </label>
              <InlineSelect
                value={vSourceBankAccountId}
                onChange={(val) => setVSourceBankAccountId(val)}
                options={(portalDirectory || []).map((g: any) => {
                  const primaryBankAccountId = g.bankAccounts && g.bankAccounts.length > 0 ? g.bankAccounts[0].id : "";
                  return {
                    value: primaryBankAccountId,
                    label: `${g.name} - Bal: ₹${(g.balance || 0).toLocaleString()}`
                  };
                })}
                placeholder="Select Bank Account"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                {vDirection === "load" ? "Destination Retailer" : "Source Retailer"}
              </label>
              <InlineSelect
                value={vDestRetailerId}
                onChange={(val) => setVDestRetailerId(val)}
                options={(retailerDirectory || []).map((r: any) => {
                  const bal = r.balance || 0;
                  const balText = bal < 0 
                    ? `To Give: ₹${Math.abs(bal).toLocaleString()}` 
                    : `To Take: ₹${bal.toLocaleString()}`;
                  return {
                    value: r.id,
                    label: `${r.name} (${balText})`
                  };
                })}
                placeholder="Select Retailer"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Transfer Date</label>
            <input autoComplete="one-time-code"
              type="date"
              value={vDate}
              onChange={e => setVDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200 text-left cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Amount to Load (₹)</label>
            <input autoComplete="one-time-code"
              type="number"
              inputMode="decimal"
              value={vAmount}
              onChange={e => setVAmount(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 text-slate-700 dark:text-slate-200"
              min="1"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isTransferring}
            className={`w-full py-3 text-white rounded-sm text-xs font-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              vDirection === 'load' 
                ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600' 
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            }`}
          >
            {isTransferring 
              ? "Processing Transfer..." 
              : vDirection === "load" 
                ? "Virtual Transfer" 
                : "Move to Distributor"}
          </button>
        </form>
        </>
        )}
      </div>
      {/* RECENT ENTRIES VIEW */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 space-y-4 col-span-1">

        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
            Recent Virtual Transfers
          </h3>
        </div>

        <div className="space-y-3">
          {recentVirtualTransfers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-400 font-bold italic">
              No recent virtual transfers found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
              {recentVirtualTransfers.map((tx: any) => {
                const formatted = formatIST(tx.created_at || tx.date);
                const isRefund = tx.isRefund === true;
                const bankAccountName = tx.portalName || tx.bankAccountName || "Bank Account";
                const retailer = (retailerDirectory || []).find((r: any) => r.id === tx.retailer_id);
                const retailerName = retailer?.name || tx.targetName || "Retailer/Staff";
                
                const narrationFrom = isRefund ? retailerName : bankAccountName;
                const narrationTo = isRefund ? bankAccountName : retailerName;

                return (
                  <div 
                    key={tx.id} 
                    onClick={() => {
                      setSelectedDepositId(tx.id);
                    }}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors cursor-pointer rounded-sm px-2"
                  >
                    {/* Left: Date & Time */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{formatted.date}</span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{formatted.time}</span>
                    </div>
                    
                    {/* Middle: Narration */}
                    <div className="flex-1 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-0">
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider self-start ${
                          isRefund
                            ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {isRefund ? 'Move to Dist' : 'Virtual Load'}
                        </span>
                        <div className="text-xs font-black truncate text-slate-800 dark:text-slate-200 mt-0.5">
                          {narrationFrom} → {narrationTo}
                        </div>
                        {tx.remarks && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate italic">
                            {tx.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Right: Amount */}
                    <div className={`text-right font-mono tabular-nums text-xs font-black shrink-0 ${
                      isRefund ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {isRefund ? "-" : "+"} ₹{Math.round(tx.amount || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* View All → Virtual Ledger */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <a
            href="/admin/virtual-ledger"
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-sm text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-900/30 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            View All Virtual Transfers
          </a>
        </div>
      </div>

      {/* Audit Drawer/Modal */}
      {selectedDepositId && currentSelection && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-sm p-6 space-y-4 select-none">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Audit Virtual Transfer Entry
              </h3>
              <button
                onClick={() => {
                  setSelectedDepositId(null);
                }}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Target (Bank/BankAccount)</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.targetName}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Staff</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{currentSelection.staffName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Amount</span>
                  <span className="text-sm font-black text-red-600 font-mono tabular-nums">₹{currentSelection.amount.toLocaleString()}.00</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    handleStartEditDeposit(currentSelection);
                  }}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-sm text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" /> Edit Entry
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full py-3 border border-red-200 text-red-600 rounded-sm text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditCollectionModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                Edit Virtual Transfer Entry
              </h3>
              <button 
                onClick={() => setIsEditCollectionModalOpen(false)} 
                className="p-1.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveDepositEdit} className="space-y-4">
              
              <div className="space-y-3">
                {/* Deposit Type */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Deposit/Payout Type</label>
                  <select
                    value={selectedNewDepositType === "virtual" ? (selectedNewPaymentMode === "refund" ? "virtual-refund" : "virtual-load") : selectedNewDepositType}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "virtual-load") {
                        setSelectedNewDepositType("virtual");
                        setSelectedNewPaymentMode("online");
                      } else if (val === "virtual-refund") {
                        setSelectedNewDepositType("virtual");
                        setSelectedNewPaymentMode("refund");
                      } else {
                        setSelectedNewDepositType(val);
                        if (val === "portal" || val === "retailer") {
                          setSelectedNewPaymentMode("online");
                        } else if (val === "staff") {
                          setSelectedNewPaymentMode("cash");
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                  >
                    <option value="portal">Cash Out</option>
                    <option value="retailer">Retailer Payout</option>
                    <option value="staff">Direct Handover</option>
                    <option value="virtual-load">Virtual Transfer</option>
                    <option value="virtual-refund">Move to Distributor</option>
                  </select>
                </div>

                {/* Target Fields depending on deposit type */}
                {selectedNewDepositType === "portal" && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target BankAccount</label>
                    <InlineSelect
                      value={selectedNewBankAccountId}
                      onChange={setSelectedNewBankAccountId}
                      options={[
                        { value: "", label: "Select Bank Account" },
                        ...portalDirectory.flatMap((group: any) => {
                          const firstBankAccount = (group.bankAccounts || [])[0];
                          if (!firstBankAccount) return [];
                          return [{ value: String(firstBankAccount.id), label: group.name }];
                        })
                      ]}
                      placeholder="Select Bank Account"
                    />
                  </div>
                )}

                {selectedNewDepositType === "retailer" && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Target Retailer</label>
                    <InlineSelect
                      value={selectedNewRetailerId}
                      onChange={setSelectedNewRetailerId}
                      options={[
                        { value: "", label: "Select Retailer" },
                        ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                      ]}
                      placeholder="Select Retailer"
                    />
                  </div>
                )}

                {selectedNewDepositType === "staff" && (
                  <>
                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="editToOfficeCheckbox"
                        checked={selectedNewToOffice}
                        onChange={(e) => setSelectedNewToOffice(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="editToOfficeCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-400">Handover to Main Office Cashier</label>
                    </div>

                    {!selectedNewToOffice && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Recipient Staff</label>
                        <InlineSelect
                          value={selectedNewRecipientStaffId}
                          onChange={setSelectedNewRecipientStaffId}
                          options={[
                            { value: "", label: "Select Staff Member" },
                            ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                          ]}
                          placeholder="Select Staff Member"
                        />
                      </div>
                    )}
                  </>
                )}

                {selectedNewDepositType === "virtual" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                        {selectedNewPaymentMode === "refund" ? "Destination BankAccount" : "Source BankAccount"}
                      </label>
                      <InlineSelect
                        value={selectedNewBankAccountId}
                        onChange={setSelectedNewBankAccountId}
                        options={[
                          { value: "", label: "Select Bank Account" },
                          ...portalDirectory.flatMap((group: any) => {
                            const firstBankAccount = (group.bankAccounts || [])[0];
                            if (!firstBankAccount) return [];
                            return [{ value: String(firstBankAccount.id), label: group.name }];
                          })
                        ]}
                        placeholder="Select Bank Account"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                        {selectedNewPaymentMode === "refund" ? "Source Type" : "Destination Type"}
                      </label>
                      <select
                        value={selectedNewVirtualTargetType}
                        onChange={(e) => setSelectedNewVirtualTargetType(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                      >
                        <option value="retailer">Retailer</option>
                        <option value="staff">Staff Member</option>
                      </select>
                    </div>

                    {selectedNewVirtualTargetType === "retailer" ? (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Source Retailer" : "Destination Retailer"}
                        </label>
                        <InlineSelect
                          value={selectedNewRetailerId}
                          onChange={setSelectedNewRetailerId}
                          options={[
                            { value: "", label: "Select Retailer" },
                            ...retailerDirectory.map((r: any) => ({ value: String(r.id), label: r.name }))
                          ]}
                          placeholder="Select Retailer"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">
                          {selectedNewPaymentMode === "refund" ? "Source Staff Member" : "Destination Staff Member"}
                        </label>
                        <InlineSelect
                          value={selectedNewRecipientStaffId}
                          onChange={setSelectedNewRecipientStaffId}
                          options={[
                            { value: "", label: "Select Staff Member" },
                            ...(userDirectory || []).filter((u: any) => u.role === "staff").map((u: any) => ({ value: String(u.id), label: u.name }))
                          ]}
                          placeholder="Select Staff Member"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Amount</label>
                  <input autoComplete="one-time-code"
                    type="number"
                    inputMode="decimal"
                    value={selectedNewAmount}
                    onChange={(e) => setSelectedNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-right font-mono tabular-nums text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                    required
                  />
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Date</label>
                  <input autoComplete="one-time-code"
                    type="date"
                    value={selectedNewDate}
                    onChange={(e) => setSelectedNewDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                    required
                  />
                </div>

                {/* Reference No */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Reference No</label>
                  <input autoComplete="one-time-code"
                    type="text"
                    value={selectedNewRefNo}
                    onChange={(e) => setSelectedNewRefNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                    placeholder="Optional"
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block ml-1">Remarks</label>
                  <textarea
                    value={selectedNewRemarks}
                    onChange={(e) => setSelectedNewRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm text-xs font-bold focus:outline-none focus:border-slate-500 dark:focus:border-slate-400 dark:text-white"
                    rows={2}
                    placeholder="Remarks..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditCollectionModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-sm text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCollection}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingCollection ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
