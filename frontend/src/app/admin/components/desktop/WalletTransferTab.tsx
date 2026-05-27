"use client";

import React, { useState, useEffect } from "react";
import { CreditCard } from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";

export default function WalletTransferTab() {
  const adminContext = useAdmin();
  const { retailerDirectory, portalDirectory, deposits, fetchData, showToastNotification } = adminContext;

  const [users, setUsers] = useState<any[]>([]);
  const [individualPortals, setIndividualPortals] = useState<any[]>([]);
  const [selectedPortalGroupId, setSelectedPortalGroupId] = useState("");
  const [vSourcePortalId, setVSourcePortalId] = useState("");
  const [vDestType, setVDestType] = useState<"retailer" | "staff">("retailer");
  const [vDestRetailerId, setVDestRetailerId] = useState("");
  const [vDestStaffId, setVDestStaffId] = useState("");
  const [vAmount, setVAmount] = useState("");
  const [vRemarks, setVRemarks] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    loadUsersAndPortals();
  }, []);

  const loadUsersAndPortals = async () => {
    try {
      const [usersData, portalsData] = await Promise.all([
        api.getUsers(),
        api.getPortals()
      ]);
      setUsers(usersData);
      setIndividualPortals(portalsData);
    } catch (err) {
      console.error("Error loading directories:", err);
    }
  };

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
      remarks: vRemarks || undefined
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

      const targetMsg = vDestType === "retailer" ? "Retailer's wallet" : "Staff's virtual wallet";
      if (showToastNotification) {
        showToastNotification(`Virtually loaded ₹${amt.toLocaleString()} to ${targetMsg}!`);
      } else {
        alert(`Virtually loaded ₹${amt.toLocaleString()} to ${targetMsg}!`);
      }
      
      setSelectedPortalGroupId("");
      setVSourcePortalId("");
      setVDestRetailerId("");
      setVDestStaffId("");
      setVAmount("");
      setVRemarks("");
      
      await loadUsersAndPortals();
      if (fetchData) fetchData();
    } catch (err: any) {
      alert("Transfer Error: " + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
            Virtual Wallet Transfer
          </h3>
        </div>
        
        <form onSubmit={handleVirtualTransfer} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Source Portal</label>
              <select 
                value={selectedPortalGroupId} 
                onChange={e => {
                  setSelectedPortalGroupId(e.target.value);
                  setVSourcePortalId("");
                }} 
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none appearance-none text-slate-700 dark:text-slate-200"
                required
              >
                <option value="">-- Select Portal --</option>
                {(portalDirectory || [])
                  .filter((g: any) => individualPortals.some((p: any) => p.group_id === g.id))
                  .map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Source Bank/Account</label>
              <select 
                value={vSourcePortalId} 
                onChange={e => setVSourcePortalId(e.target.value)} 
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none appearance-none text-slate-700 dark:text-slate-200 disabled:opacity-50"
                required
                disabled={!selectedPortalGroupId}
              >
                <option value="">-- Select Bank Account --</option>
                {individualPortals
                  .filter((p: any) => p.group_id === selectedPortalGroupId)
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.portal_name} (Bal: ₹{parseFloat(p.balance).toLocaleString()})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Destination Type</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input 
                  type="radio" 
                  name="destType" 
                  value="retailer" 
                  checked={vDestType === "retailer"} 
                  onChange={() => setVDestType("retailer")} 
                  className="accent-indigo-600"
                />
                Retailer Wallet
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input 
                  type="radio" 
                  name="destType" 
                  value="staff" 
                  checked={vDestType === "staff"} 
                  onChange={() => setVDestType("staff")} 
                  className="accent-indigo-600"
                />
                Staff Virtual Limit
              </label>
            </div>
          </div>

          {vDestType === "retailer" ? (
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Destination Retailer</label>
              <select 
                value={vDestRetailerId} 
                onChange={e => setVDestRetailerId(e.target.value)} 
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none appearance-none text-slate-700 dark:text-slate-200"
                required
              >
                <option value="">-- Select Retailer --</option>
                {(retailerDirectory || []).map((r: any) => {
                  const hasVirtualTx = (deposits || []).some(d => d.retailer_id === r.id && d.depositType === "virtual");
                  const bal = hasVirtualTx ? (r.balance || 0) : (r.opening_to_take || 0);
                  return (
                    <option key={r.id} value={r.id}>
                      {r.name} (Bal: ₹{bal.toLocaleString()})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Destination Staff Member</label>
              <select 
                value={vDestStaffId} 
                onChange={e => setVDestStaffId(e.target.value)} 
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none appearance-none text-slate-700 dark:text-slate-200"
                required
              >
                <option value="">-- Select Staff Member --</option>
                {(users || []).filter((u: any) => u.role === "staff").map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (Virtual: ₹{(u.virtual_balance || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Amount to Load (₹)</label>
              <input 
                type="number" 
                value={vAmount} 
                onChange={e => setVAmount(e.target.value)} 
                placeholder="e.g. 15000" 
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200"
                min="1"
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Remarks (Optional)</label>
              <input 
                type="text" 
                value={vRemarks} 
                onChange={e => setVRemarks(e.target.value)} 
                placeholder="e.g. Loaded via RinovaPay" 
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isTransferring}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl text-xs font-black shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isTransferring ? "Processing Transfer..." : "Execute Wallet Transfer"}
          </button>
        </form>
      </div>
    </div>
  );
}
