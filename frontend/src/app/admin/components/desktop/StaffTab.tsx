"use client";

import React, { useState } from "react";
import { CheckCircle, Clock, UserPlus, ShieldAlert, Trash2, Edit } from "lucide-react";
import { api } from "../../../utils/api";

interface StaffTabProps {
  staffComplianceLogs: any[];
  userDirectory?: any[];
  showToastNotification?: (msg: string) => void;
  fetchData?: () => void;
}

export default function StaffTab({ 
  staffComplianceLogs, 
  userDirectory = [], 
  showToastNotification = () => {}, 
  fetchData = () => {} 
}: StaffTabProps) {
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uRole, setURole] = useState("staff");
  const [uPassword, setUPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const staffMembers = userDirectory.filter((u: any) => u.role === "staff" || u.role === "admin");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Edit mode
        const payload: any = { name: uName, phone: uPhone, role: uRole };
        if (uPassword) {
          payload.password = uPassword;
        }
        await api.updateUser(editingId, payload);
        showToastNotification(`Staff member "${uName}" updated!`);
      } else {
        // Create mode
        await api.createUser({ name: uName, phone: uPhone, role: uRole, password: uPassword });
        showToastNotification(`Staff member "${uName}" created!`);
      }
      resetForm();
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setUName(user.name);
    setUPhone(user.phone);
    setURole(user.role);
    setUPassword(""); // Keep blank to indicate no change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member? This cannot be undone.")) return;
    try {
      await api.deleteUser(id);
      showToastNotification("Staff member deleted.");
      if (editingId === id) resetForm();
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setUName("");
    setUPhone("");
    setURole("staff");
    setUPassword("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        
        {/* LEFT COLUMN: STAFF MANAGEMENT */}
        <div className="space-y-6">
          {/* Add/Edit Staff Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {editingId ? <Edit className="w-5 h-5 text-indigo-600" /> : <UserPlus className="w-5 h-5 text-indigo-600" />}
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  {editingId ? "Edit Staff Member" : "Add Staff Member"}
                </h3>
              </div>
              {editingId && (
                <button onClick={resetForm} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase">
                  Cancel Edit
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                  {editingId ? "New Password (leave blank to keep current)" : "Initial Password"}
                </label>
                <input type="password" value={uPassword} onChange={e => setUPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none" required={!editingId} />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                {editingId ? "Update Account" : "Create Account"}
              </button>
            </form>
          </div>

          {/* Staff Directory */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <h3 className="text-[10px] font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">REGISTERED STAFF</h3>
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
                  {staffMembers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-6 text-center text-xs font-bold text-slate-400">No staff members found</td>
                    </tr>
                  ) : (
                    staffMembers.map((u: any) => (
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
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleEdit(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: COMPLIANCE LOGS */}
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Field Compliance Log</h3>
                <p className="text-[9px] text-slate-400 font-medium">Real-time monitoring of staff shift activity.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {(staffComplianceLogs || []).map((log) => {
              const totalKmTravelled = log.endKm ? (log.endKm - log.startKm) : 0;
              return (
                <div
                  key={log.id}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${log.status === "Active Duty" ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`} />
                      <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">{log.name}</h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{log.date}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center py-1">
                    <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                      <span className="text-[8px] uppercase text-slate-400 font-bold block">Start KM</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{log.startKm} km</span>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                      <span className="text-[8px] uppercase text-slate-400 font-bold block">End KM</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{log.endKm || "Active..."} km</span>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                      <span className="text-[8px] uppercase text-slate-400 font-bold block">Distance Travelled</span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 block mt-1">
                        {totalKmTravelled ? `${totalKmTravelled} km` : "Running..."}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-3 gap-4 items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Started At</span>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        <Clock className="w-3 h-3 text-blue-500" /> {log.startTime}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 border-x border-slate-100 dark:border-slate-800 px-4">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ended At</span>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        <Clock className="w-3 h-3 text-red-400" /> {log.endTime || "Active..."}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-right">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Shift Duration</span>
                      <div className={`text-[10px] font-black ${log.status === "Active Duty" ? "text-emerald-600" : "text-slate-500"}`}>
                        {log.duration}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-900">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Compliance Status</span>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${log.status === "Active Duty" ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"}`}>
                      {log.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {(staffComplianceLogs || []).length === 0 && (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 border-dashed dark:border-slate-800">
               <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
               <p className="text-sm font-bold text-slate-500">No Staff Activity Found</p>
               <p className="text-[10px] text-slate-400 mt-1">Attendance logs will appear once staff members check-in.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
