"use client";

import React, { useState, useEffect } from "react";
import { 
  UserPlus, 
  Globe, 
  Edit, 
  Trash2, 
  Search,
  ShieldAlert,
  CreditCard
} from "lucide-react";
import { api } from "../../../utils/api";
import { useAdmin } from "../../context/AdminContext";

interface AdministrationTabProps {
  userDirectory: any[];
  portalDirectory: any[];
  fetchData: () => void;
  showToastNotification: (msg: string) => void;
}

export default function AdministrationTab({
  userDirectory: propsUserDir,
  portalDirectory: propsPortalDir,
  fetchData: propsFetchData,
  showToastNotification: propsShowToast
}: AdministrationTabProps) {
  const adminContext = useAdmin();
  const fetchData = propsFetchData || adminContext.fetchData;
  const showToastNotification = propsShowToast || adminContext.showToastNotification;
  const { retailerDirectory, portalDirectory, collections, deposits } = adminContext;
  const [users, setUsers] = useState<any[]>([]);
  
  // Virtual Transfer State
  const [selectedPortalGroupId, setSelectedPortalGroupId] = useState("");
  const [vSourcePortalId, setVSourcePortalId] = useState("");
  const [vDestType, setVDestType] = useState<"retailer" | "staff">("retailer");
  const [vDestRetailerId, setVDestRetailerId] = useState("");
  const [vDestStaffId, setVDestStaffId] = useState("");
  const [vAmount, setVAmount] = useState("");
  const [vRemarks, setVRemarks] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [individualPortals, setIndividualPortals] = useState<any[]>([]);

  // Staff State
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uRole, setURole] = useState("field_staff");
  const [uPassword, setUPassword] = useState("");

  // Portal & Bank State
  const [pName, setPName] = useState("");
  const [pToTake, setPToTake] = useState<string>("");
  const [pToGive, setPToGive] = useState<string>("");
  const [bAccName, setBAccName] = useState("");
  const [bBankName, setBBankName] = useState("");
  const [bBranchName, setBBranchName] = useState("");
  const [bAccNo, setBAccNo] = useState("");
  const [bIfsc, setBIfsc] = useState("");

  // Retailer State
  const [retName, setRetName] = useState("");
  const [retPhone, setRetPhone] = useState("");
  const [retArea, setRetArea] = useState("");
  const [retEmail, setRetEmail] = useState("");
  const [retToTake, setRetToTake] = useState<string>("");
  const [retToGive, setRetToGive] = useState<string>("");

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
      console.error(err);
    }
  };

  const loadUsers = async () => {
    await loadUsersAndPortals();
  };


  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({ name: uName, phone: uPhone, role: uRole, password: uPassword });
      showToastNotification(`User "${uName}" created!`);
      setUName(""); setUPhone(""); setURole("field_staff"); setUPassword("");
      loadUsers();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleRegisterPortalAndBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const takeVal = parseFloat(pToTake || "0");
    const giveVal = parseFloat(pToGive || "0");
    if (takeVal < 0 || giveVal < 0) {
      alert("Opening balances cannot be negative");
      return;
    }
    try {
      const group = await api.createPortalGroup({ 
        name: pName,
        opening_to_give: giveVal,
        opening_to_take: takeVal
      });

      if (bAccName) {
        await api.createPortal({
          group_id: group.id,
          portal_name: bAccName,
          bank_name: `${bBankName}${bBranchName ? ' (' + bBranchName + ')' : ''}`,
          bank_account_no: bAccNo,
          ifsc_code: bIfsc
        });
      }

      showToastNotification(`Portal "${pName}" & Bank Account registered!`);
      setPName(""); setPToTake(""); setPToGive("");
      setBAccName(""); setBBankName(""); setBBranchName(""); setBAccNo(""); setBIfsc("");
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleCreateRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    const takeVal = parseFloat(retToTake || "0");
    const giveVal = parseFloat(retToGive || "0");
    if (takeVal < 0 || giveVal < 0) {
      alert("Opening balances cannot be negative");
      return;
    }
    try {
      await api.createRetailer({
        retailer_name: retName,
        phone: retPhone,
        address: retArea,
        email: retEmail,
        opening_to_take: takeVal,
        opening_to_give: giveVal
      });
      showToastNotification(`Retailer "${retName}" registered!`);
      setRetName(""); setRetPhone(""); setRetArea(""); setRetEmail("");
      setRetToTake(""); setRetToGive("");
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
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
      showToastNotification(`Virtually loaded ₹${amt.toLocaleString()} to ${targetMsg}!`);
      setSelectedPortalGroupId("");
      setVSourcePortalId("");
      setVDestRetailerId("");
      setVDestStaffId("");
      setVAmount("");
      setVRemarks("");
      
      // Sync local portals state and context dashboard data
      await loadUsersAndPortals();
      fetchData();
    } catch (err: any) {
      alert("Transfer Error: " + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.deleteUser(id);
      showToastNotification("User deleted.");
      loadUsers();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Staff & Retailer */}
        <div className="space-y-6">
          {/* Add Staff Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Add Staff</h3>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Full Name</label>
                <input type="text" value={uName} onChange={e => setUName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Phone Number</label>
                <input type="tel" value={uPhone} onChange={e => setUPhone(e.target.value)} placeholder="e.g. 9917128864" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">System Role</label>
                <select value={uRole} onChange={e => setURole(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none appearance-none">
                  <option value="staff">Field Staff (Cash In/Out Ops)</option>
                  <option value="admin">Master Admin (Full Access)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Initial Password</label>
                <input type="password" value={uPassword} onChange={e => setUPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                Create Account
              </button>
            </form>
          </div>

          {/* Register New Retailer Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Edit className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Register New Retailer</h3>
            </div>
            
            <form onSubmit={handleCreateRetailer} className="space-y-4">
               <div>
                 <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Retailer Name</label>
                 <input type="text" value={retName} onChange={e => setRetName(e.target.value)} placeholder="e.g. Gupta General Store" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Phone Number</label>
                   <input type="tel" value={retPhone} onChange={e => setRetPhone(e.target.value)} placeholder="9876543210" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
                 </div>
                 <div>
                   <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Area</label>
                   <input type="text" value={retArea} onChange={e => setRetArea(e.target.value)} placeholder="Area" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                 </div>
               </div>
               <div>
                 <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Email</label>
                 <input type="email" value={retEmail} onChange={e => setRetEmail(e.target.value)} placeholder="Email Address" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-red-500 uppercase">To Take</label>
                    <input 
                      type="number" 
                      min="0"
                      value={retToTake} 
                      onChange={e => setRetToTake(e.target.value)} 
                      onFocus={e => {
                        if (Number(e.target.value) === 0) setRetToTake("");
                        e.target.select();
                      }}
                      className="w-full px-3 py-2 bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-xs font-bold text-red-600 focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-500 uppercase">To Give</label>
                    <input 
                      type="number" 
                      min="0"
                      value={retToGive} 
                      onChange={e => setRetToGive(e.target.value)} 
                      onFocus={e => {
                        if (Number(e.target.value) === 0) setRetToGive("");
                        e.target.select();
                      }}
                      className="w-full px-3 py-2 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs font-bold text-emerald-600 focus:outline-none" 
                    />
                  </div>
               </div>
               <button type="submit" className="w-full py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl text-xs font-black shadow-lg transition-all active:scale-[0.98]">
                  Register Retailer
               </button>
             </form>
          </div>

          {/* Virtual Wallet Transfer Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Virtual Wallet Transfer</h3>
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
                    {portalDirectory
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
                    {retailerDirectory.map((r: any) => {
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


        {/* Right Column: Portal/Bank & Users Directory */}
        <div className="space-y-6">
          {/* Register Portal & Bank Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Register Portal & Bank</h3>
            </div>
            
            <form onSubmit={handleRegisterPortalAndBank} className="space-y-6">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-l-2 border-indigo-500 pl-2">add portal details</span>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Portal Name</label>
                  <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="e.g. RevaPay" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-red-500 uppercase">To Take</label>
                    <input 
                      type="number" 
                      value={pToTake} 
                      onChange={e => setPToTake(e.target.value)} 
                      onFocus={e => {
                        if (Number(e.target.value) === 0) setPToTake("");
                        e.target.select();
                      }}
                      placeholder="To Take" 
                      className="w-full px-3 py-2 bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-xs font-bold text-red-600 focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-500 uppercase">To Give</label>
                    <input 
                      type="number" 
                      value={pToGive} 
                      onChange={e => setPToGive(e.target.value)} 
                      onFocus={e => {
                        if (Number(e.target.value) === 0) setPToGive("");
                        e.target.select();
                      }}
                      placeholder="To Give" 
                      className="w-full px-3 py-2 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs font-bold text-emerald-600 focus:outline-none" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-l-2 border-blue-500 pl-2">add bank details</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Account Label</label>
                    <input type="text" value={bAccName} onChange={e => setBAccName(e.target.value)} placeholder="e.g. ICICI Primary" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Bank Name</label>
                    <input type="text" value={bBankName} onChange={e => setBBankName(e.target.value)} placeholder="ICICI Bank" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Branch Name</label>
                    <input type="text" value={bBranchName} onChange={e => setBBranchName(e.target.value)} placeholder="e.g. Civil Lines" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Account No</label>
                    <input type="text" value={bAccNo} onChange={e => setBAccNo(e.target.value)} placeholder="Account Number" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">IFSC Code</label>
                  <input type="text" value={bIfsc} onChange={e => setBIfsc(e.target.value)} placeholder="IFSC Code" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all active:scale-[0.98]">
                Register Portal & Bank
              </button>
            </form>
          </div>

          {/* USERS DIRECTORY */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <h3 className="text-[10px] font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">USERS</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 text-[9px] font-black uppercase tracking-wide text-slate-400">
                    <th className="px-6 py-3">Full Name</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3 text-right">Virtual Balance</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-950/80 transition-colors">
                      <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300">{u.name}</td>
                      <td className="px-6 py-3 text-slate-500 font-medium">{u.phone}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                        {u.role === 'staff' ? `₹${Number(u.virtual_balance || 0).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-slate-300 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
