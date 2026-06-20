"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, History } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";
import InlineSelect from "../../../components/InlineSelect";

export default function WalletTransferTab() {
  const adminContext = useAdmin();
  const { retailerDirectory, portalDirectory, userDirectory, deposits, fetchData, showToastNotification } = adminContext;

  const [vSourcePortalId, setVSourcePortalId] = useState("");
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

  const allPortals = (portalDirectory || []).flatMap((g: any) => 
    (g.portals || []).map((p: any) => ({
      ...p,
      groupName: g.name
    }))
  );

  const handleVirtualTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vSourcePortalId) {
      alert("Please select a source portal account");
      return;
    }
    const amt = parseFloat(vAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid transfer amount greater than 0");
      return;
    }

    const payload: any = {
      portal_id: vSourcePortalId,
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
        : `Moved ₹${amt.toLocaleString()} from ${targetMsg} back to Portal!`;

      if (showToastNotification) {
        showToastNotification(actionMsg);
      } else {
        alert(actionMsg);
      }

      setVSourcePortalId("");
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

  const recentVirtualTransfers = (deposits || [])
    .filter((d: any) => d.depositType === "virtual")
    .sort((a: any, b: any) => {
       const da = a.created_at || a.date;
       const db = b.created_at || b.date;
       return new Date(db || 0).getTime() - new Date(da || 0).getTime();
    })
    .slice(0, 8); // show top 8 recent transfers

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
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
            className="text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value="load">Virtual Transfer</option>
            <option value="refund">Move to Distributor</option>
          </select>
        </div>

        <form onSubmit={handleVirtualTransfer} className="space-y-4">
          <div className={`flex ${vDirection === 'load' ? 'flex-col' : 'flex-col-reverse'} gap-4`}>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                {vDirection === "load" ? "Source Portal" : "Destination Portal"}
              </label>
              <InlineSelect
                value={vSourcePortalId}
                onChange={(val) => setVSourcePortalId(val)}
                options={(portalDirectory || []).map((g: any) => {
                  const primaryPortalId = g.portals && g.portals.length > 0 ? g.portals[0].id : "";
                  return {
                    value: primaryPortalId,
                    label: `${g.name} - Bal: ₹${(g.balance || 0).toLocaleString()}`
                  };
                })}
                placeholder="Select Portal"
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
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200 text-left cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Amount to Load (₹)</label>
            <input autoComplete="one-time-code"
              type="number"
              value={vAmount}
              onChange={e => setVAmount(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200"
              min="1"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isTransferring}
            className={`w-full py-3 text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              vDirection === 'load' 
                ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600' 
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            }`}
          >
            {isTransferring 
              ? "Processing Transfer..." 
              : vDirection === "load" 
                ? "Execute Money Transfer" 
                : "Move to Distributor"}
          </button>
        </form>
      </div>

      {/* Recent Entries Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
            Recent Virtual Transfers
          </h3>
        </div>
        <div className="space-y-3">
          {recentVirtualTransfers.length === 0 ? (
            <p className="text-xs text-slate-500 font-bold italic text-center py-8">No recent virtual transfers found.</p>
          ) : (
            recentVirtualTransfers.map((tx: any) => {
              const snapBal = parseFloat(tx.balance_snapshot || 0);
              const balText = snapBal < 0
                ? `Bal: -₹${Math.abs(snapBal).toLocaleString()}`
                : `Bal: ₹${snapBal.toLocaleString()}`;

              const isRefund = tx.isRefund === true;

              // Build narration names
              const portalName = tx.portalGroupName || tx.portalName || "Portal";
              const retailer = (retailerDirectory || []).find((r: any) => r.id === tx.retailer_id);
              const retailerName = retailer?.name || "Retailer";

              const narrationFrom = isRefund ? retailerName : portalName;
              const narrationTo   = isRefund ? portalName   : retailerName;

              return (
                <div
                  key={tx.id}
                  className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                    isRefund
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    {/* Direction badge */}
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider self-start ${
                      isRefund
                        ? 'bg-red-200 dark:bg-red-900 text-red-700 dark:text-red-300'
                        : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {isRefund ? 'Move to Distributor' : 'Virtual Transfer'}
                    </span>
                    {/* Narration */}
                    <div className={`text-xs font-black flex items-center gap-1 ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      <span className="truncate max-w-[70px]" title={narrationFrom}>{narrationFrom}</span>
                      <span className="text-slate-400">→</span>
                      <span className="truncate max-w-[70px]" title={narrationTo}>{narrationTo}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{tx.date?.split(" ")[0]} • By {tx.staffName || 'Admin'}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <span className={`text-xs font-black ${isRefund ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {isRefund ? '-' : '+'}₹{(tx.amount || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold tracking-tight mt-0.5">{balText}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
