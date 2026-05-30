"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Phone, 
  Lock,
  Plus,
  ArrowLeft,
  X,
  Edit
} from "lucide-react";
import { api } from "@/app/utils/api";
import Link from "next/link";

export default function MobileStaff() {
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  // Form states
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uRole, setURole] = useState("staff");
  const [uPassword, setUPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, { 
          name: uName, 
          phone: uPhone, 
          role: uRole, 
          password: uPassword || undefined 
        });
        showToast(`✓ Staff "${uName}" updated`);
      } else {
        await api.createUser({ name: uName, phone: uPhone, role: uRole, password: uPassword });
        showToast(`✓ Staff "${uName}" created`);
      }
      setUName(""); setUPhone(""); setURole("staff"); setUPassword("");
      setEditingUser(null);
      setShowAddForm(false);
      loadUsers();
    } catch (err: any) {
      showToast("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (u: any) => {
    setEditingUser(u);
    setUName(u.name);
    setUPhone(u.phone);
    setURole(u.role);
    setUPassword("");
    setShowAddForm(true);
  };

  const handleToggleAddForm = () => {
    if (showAddForm) {
      setEditingUser(null);
      setUName(""); setUPhone(""); setURole("staff"); setUPassword("");
    }
    setShowAddForm(v => !v);
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.deleteUser(id);
      showToast(`"${name}" deleted`);
      loadUsers();
    } catch (err: any) {
      showToast("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-4 right-4 z-[200] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest px-5 py-4 rounded-2xl shadow-xl animate-in slide-in-from-top-4 duration-300">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-500 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Staff Management</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{users.length} Active Accounts</p>
          </div>
        </div>
        <button 
          onClick={handleToggleAddForm}
          className={`w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform bg-blue-600 text-white shadow-blue-500/30`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Add/Edit Staff Modal Popup */}
      {showAddForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-l-2 border-blue-500 pl-2">
                {editingUser ? "Edit Account" : "New Account"}
              </p>
              <button type="button" onClick={handleToggleAddForm} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full active:scale-90 text-slate-500 transition-transform cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={uName}
                  onChange={e => setUName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="tel"
                      value={uPhone}
                      onChange={e => setUPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-10 pr-3 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Role</label>
                  <select
                    value={uRole}
                    onChange={e => setURole(e.target.value)}
                    className="w-full px-3 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Password {editingUser && "(leave blank to keep unchanged)"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={uPassword}
                    onChange={e => setUPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword(v => !v);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center z-10 text-slate-400 cursor-pointer active:scale-90 bg-transparent"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-4 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Saving..." : editingUser ? "Save Changes" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="space-y-4 pb-20">
        {loadingUsers ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading staff...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No users found</p>
          </div>
        ) : (
          users.map((u: any) => (
            <div
              key={u.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black ${u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {u.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 dark:text-white truncate">{u.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {u.role}
                  </span>
                  <span className="text-[9px] font-bold text-slate-450">{u.phone}</span>
                </div>
                {u.role === 'staff' && (
                  <p className="text-[9px] font-bold text-slate-400 mt-1">
                    Virtual balance: <span className="font-extrabold text-slate-700 dark:text-slate-300">₹{Number(u.virtual_balance || 0).toLocaleString()}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStartEdit(u)}
                  className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 text-blue-500 rounded-xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    className="w-10 h-10 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

