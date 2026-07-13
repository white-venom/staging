"use client";

import React, { useState, useEffect } from "react";
import { 
  UserPlus, 
  Globe, 
  Edit, 
  Trash2, 
  Search,
  ShieldAlert,
  Clock,
  Save,
  Infinity,
  CheckCircle2
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
  portalDirectory: propsBankAccountDir,
  fetchData: propsFetchData,
  showToastNotification: propsShowToast
}: AdministrationTabProps) {
  const adminContext = useAdmin();
  const fetchData = propsFetchData || adminContext.fetchData;
  const showToastNotification = propsShowToast || adminContext.showToastNotification;
  const { retailerDirectory, portalDirectory, collections, deposits } = adminContext;
  const [users, setUsers] = useState<any[]>([]);


  // Staff State
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uRole, setURole] = useState("staff");
  const [uPassword, setUPassword] = useState("");

  // BankAccount & Bank State
  const [pName, setPName] = useState("");
  const [pToTake, setPToTake] = useState<string>("");
  const [pToGive, setPToGive] = useState<string>("");
  const [pOnline, setPGroupOnline] = useState(false);
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

  // Entry Window Settings state
  const [editWindow, setEditWindow] = useState<string>("5");
  const [deleteWindow, setDeleteWindow] = useState<string>("5");
  const [editPermanent, setEditPermanent] = useState(false);
  const [deletePermanent, setDeletePermanent] = useState(false);
  const [staffCanChangeCashInDate, setStaffCanChangeCashInDate] = useState(false);
  const [savingWindows, setSavingWindows] = useState(false);
  const [openingCashInHand, setOpeningCashInHand] = useState("0");
  const [savingOpeningCash, setSavingOpeningCash] = useState(false);

  useEffect(() => {
    loadUsers();
    loadBusinessSettings();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await api.getUsers();
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBusinessSettings = async () => {
    try {
      const s = await api.getAdminSettings();
      const em = s.edit_window_minutes ?? 5;
      const dm = s.delete_window_minutes ?? 5;
      const och = s.opening_cash_in_hand ?? 0;
      setEditPermanent(em === -1);
      setDeletePermanent(dm === -1);
      setEditWindow(em === -1 ? "5" : String(em));
      setDeleteWindow(dm === -1 ? "5" : String(dm));
      setOpeningCashInHand(String(och));
      setStaffCanChangeCashInDate(s.staff_can_change_collection_date ?? false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveWindowSettings = async () => {
    setSavingWindows(true);
    try {
      const current = await api.getAdminSettings();
      await api.updateAdminSettings({
        late_threshold: current.late_threshold ?? "10:00",
        late_penalty: current.late_penalty ?? 100,
        auto_checkout_time: current.auto_checkout_time ?? "20:00",
        edit_window_minutes: editPermanent ? -1 : (parseInt(editWindow) || 5),
        delete_window_minutes: deletePermanent ? -1 : (parseInt(deleteWindow) || 5),
        opening_cash_in_hand: current.opening_cash_in_hand ?? 0,
        staff_can_change_collection_date: staffCanChangeCashInDate,
      });
      showToastNotification("Entry window settings saved!");
      fetchData();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingWindows(false);
    }
  };

  const handleSaveOpeningCash = async () => {
    setSavingOpeningCash(true);
    try {
      const current = await api.getAdminSettings();
      await api.updateAdminSettings({
        late_threshold: current.late_threshold ?? "10:00",
        late_penalty: current.late_penalty ?? 100,
        auto_checkout_time: current.auto_checkout_time ?? "20:00",
        edit_window_minutes: current.edit_window_minutes ?? 5,
        delete_window_minutes: current.delete_window_minutes ?? 5,
        opening_cash_in_hand: parseFloat(openingCashInHand) || 0,
      });
      showToastNotification("Opening cash balance saved!");
      fetchData();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingOpeningCash(false);
    }
  };


  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({ name: uName, phone: uPhone, role: uRole, password: uPassword });
      showToastNotification(`User "${uName}" created!`);
      setUName(""); setUPhone(""); setURole("staff"); setUPassword("");
      loadUsers();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleRegisterBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const takeVal = parseFloat(pToTake || "0");
    const giveVal = parseFloat(pToGive || "0");
    if (takeVal < 0 || giveVal < 0) {
      alert("Opening balances cannot be negative");
      return;
    }
    try {
      const group = await api.createPortal({ 
        name: pName,
        opening_to_give: giveVal,
        opening_to_take: takeVal
      });

      if (bAccName) {
        await api.createBankAccount({
          portal_id: group.id,
          bank_account_name: bAccName,
          bank_name: `${bBankName}${bBranchName ? ' (' + bBranchName + ')' : ''}`,
          bank_account_no: bAccNo,
          ifsc_code: bIfsc
        });
      }

      showToastNotification(`Portal "${pName}" & Bank Account registered!`);
      setPName(""); setPToTake(""); setPToGive("");
      setPGroupOnline(false);
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
                <input autoComplete="one-time-code" type="text" value={uName} onChange={e => setUName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Phone Number</label>
                <input autoComplete="one-time-code" type="tel" value={uPhone} onChange={e => setUPhone(e.target.value)} placeholder="e.g. 9917128864" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
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
                <input autoComplete="new-password" type="password" value={uPassword} onChange={e => setUPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
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
                 <input autoComplete="one-time-code" type="text" value={retName} onChange={e => setRetName(e.target.value)} placeholder="e.g. Gupta General Store" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Phone Number</label>
                   <input autoComplete="one-time-code" type="tel" value={retPhone} onChange={e => setRetPhone(e.target.value)} placeholder="9876543210" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
                 </div>
                 <div>
                   <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Area</label>
                   <input autoComplete="one-time-code" type="text" value={retArea} onChange={e => setRetArea(e.target.value)} placeholder="Area" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                 </div>
               </div>
               <div>
                 <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Email</label>
                 <input autoComplete="one-time-code" type="email" value={retEmail} onChange={e => setRetEmail(e.target.value)} placeholder="Email Address" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-red-500 uppercase">To Take</label>
                    <input autoComplete="one-time-code" 
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
                    <input autoComplete="one-time-code" 
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


        </div>


        {/* Right Column: BankAccount/Bank & Users Directory */}
        <div className="space-y-6">
          {/* Register BankAccount & Bank Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Register BankAccount & Bank</h3>
            </div>
            
            <form onSubmit={handleRegisterBankAccount} className="space-y-6">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-l-2 border-indigo-500 pl-2">add bankAccount details</span>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">BankAccount Name</label>
                  <input autoComplete="one-time-code" type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="e.g. RevaPay" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-red-500 uppercase">To Take</label>
                    <input autoComplete="one-time-code" 
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
                    <input autoComplete="one-time-code" 
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
                <div className="flex items-center gap-2 px-1 py-1">
                  <input 
                    type="checkbox" 
                    id="adminPortalOnline"
                    checked={pOnline} 
                    onChange={(e) => setPGroupOnline(e.target.checked)} 
                    className="w-4 h-4 rounded text-indigo-650 focus:ring-indigo-500 border-slate-200 dark:border-slate-800 dark:bg-slate-950 cursor-pointer"
                  />
                  <label htmlFor="adminPortalOnline" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none">
                    Online
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-l-2 border-blue-500 pl-2">add bank details</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Account Label</label>
                    <input autoComplete="one-time-code" type="text" value={bAccName} onChange={e => setBAccName(e.target.value)} placeholder="e.g. ICICI Primary" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Bank Name</label>
                    <input autoComplete="one-time-code" type="text" value={bBankName} onChange={e => setBBankName(e.target.value)} placeholder="ICICI Bank" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Branch Name</label>
                    <input autoComplete="one-time-code" type="text" value={bBranchName} onChange={e => setBBranchName(e.target.value)} placeholder="e.g. Civil Lines" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Account No</label>
                    <input autoComplete="one-time-code" type="text" value={bAccNo} onChange={e => setBAccNo(e.target.value)} placeholder="Account Number" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">IFSC Code</label>
                  <input autoComplete="one-time-code" type="text" value={bIfsc} onChange={e => setBIfsc(e.target.value)} placeholder="IFSC Code" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all active:scale-[0.98]">
                Register BankAccount & Bank
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
                      <td className="px-6 py-3 text-right">
                        {u.role !== "admin" && (
                          <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-slate-300 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Entry Window Settings Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Entry Edit / Delete Window</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Define the time limit for staff to edit or delete their entries.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Edit Window */}
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase font-bold">Edit Window (Minutes)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={editWindow}
                  onChange={e => setEditWindow(e.target.value)}
                  disabled={editPermanent}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  placeholder="e.g. 5"
                />
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editPermanent}
                    onChange={e => setEditPermanent(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider flex items-center gap-0.5">
                    <Infinity className="w-3 h-3" /> Permanent
                  </span>
                </label>
              </div>
            </div>

            {/* Delete Window */}
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase font-bold">Delete Window (Minutes)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={deleteWindow}
                  onChange={e => setDeleteWindow(e.target.value)}
                  disabled={deletePermanent}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  placeholder="e.g. 5"
                />
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deletePermanent}
                    onChange={e => setDeletePermanent(e.target.checked)}
                    className="w-4 h-4 rounded text-red-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-wider flex items-center gap-0.5">
                    <Infinity className="w-3 h-3" /> Permanent
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Staff Cash-In Date Permission */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none group">
              <div>
                <span className="block text-[10px] text-slate-700 dark:text-slate-200 uppercase font-black">Staff Can Change Cash-In Date</span>
                <span className="block text-[9px] text-slate-400 font-medium mt-0.5">Allow staff to change the collection date when editing a cash-in entry.</span>
              </div>
              <div
                onClick={() => setStaffCanChangeCashInDate(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${staffCanChangeCashInDate ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${staffCanChangeCashInDate ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>

          <button
            onClick={handleSaveWindowSettings}
            disabled={savingWindows}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {savingWindows ? "Saving..." : "Save Window Settings"}
          </button>
        </div>

        {/* Opening Cash in Hand / Old Balance Settings Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Globe className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">Opening Cash (Old Balance)</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Define opening cash balance for the "Net Cash in Hand" indicator.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase font-bold">Opening Balance (₹)</label>
              <input
                type="number"
                value={openingCashInHand}
                onChange={e => setOpeningCashInHand(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:outline-none"
                placeholder="e.g. 50000"
              />
            </div>
            
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 min-h-[1.5rem]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Currently set: <strong className="text-slate-700 dark:text-slate-350">₹{Number(openingCashInHand || 0).toLocaleString()}</strong></span>
            </div>
          </div>

          <button
            onClick={handleSaveOpeningCash}
            disabled={savingOpeningCash}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {savingOpeningCash ? "Saving..." : "Save Opening Balance"}
          </button>
        </div>

      </div>
    </div>
  );
}
