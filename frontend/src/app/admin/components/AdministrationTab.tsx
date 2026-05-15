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
import { api } from "../../utils/api";
import { useAdmin } from "../context/AdminContext";

export default function AdministrationTab() {
  const { fetchData, showToastNotification } = useAdmin();
  const [users, setUsers] = useState<any[]>([]);
  
  // Staff State
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uRole, setURole] = useState("field_staff");
  const [uPassword, setUPassword] = useState("");

  // Portal & Bank State
  const [pName, setPName] = useState("");
  const [pToTake, setPToTake] = useState(0);
  const [pToGive, setPToGive] = useState(0);
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
  const [retToTake, setRetToTake] = useState(0);
  const [retToGive, setRetToGive] = useState(0);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
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
    try {
      const group = await api.createPortalGroup({ 
        name: pName,
        opening_to_give: pToGive,
        opening_to_take: pToTake
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
      setPName(""); setPToTake(0); setPToGive(0);
      setBAccName(""); setBBankName(""); setBBranchName(""); setBAccNo(""); setBIfsc("");
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleCreateRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRetailer({
        retailer_name: retName,
        phone: retPhone,
        address: retArea,
        email: retEmail,
        opening_to_take: retToTake,
        opening_to_give: retToGive
      });
      showToastNotification(`Retailer "${retName}" registered!`);
      setRetName(""); setRetPhone(""); setRetArea(""); setRetEmail("");
      setRetToTake(0); setRetToGive(0);
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
                    <input type="number" value={retToTake} onChange={e => setRetToTake(e.target.value ? Number(e.target.value) : 0)} className="w-full px-3 py-2 bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-xs font-bold text-red-600 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-500 uppercase">To Give</label>
                    <input type="number" value={retToGive} onChange={e => setRetToGive(e.target.value ? Number(e.target.value) : 0)} className="w-full px-3 py-2 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs font-bold text-emerald-600 focus:outline-none" />
                  </div>
               </div>
               <button type="submit" className="w-full py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl text-xs font-black shadow-lg transition-all active:scale-[0.98]">
                 Register Retailer
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
                    <input type="number" value={pToTake} onChange={e => setPToTake(e.target.value ? Number(e.target.value) : 0)} placeholder="To Take" className="w-full px-3 py-2 bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-xs font-bold text-red-600 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-500 uppercase">To Give</label>
                    <input type="number" value={pToGive} onChange={e => setPToGive(e.target.value ? Number(e.target.value) : 0)} placeholder="To Give" className="w-full px-3 py-2 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs font-bold text-emerald-600 focus:outline-none" />
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
