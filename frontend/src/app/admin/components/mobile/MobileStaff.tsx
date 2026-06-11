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
import InlineSelect from "@/app/components/InlineSelect";

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
    <div className="space-y-2">
      {/* Toast */}
      {toast && (
        <div className="fixed top-14 left-4 right-4 z-[200] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg shadow-xl animate-in slide-in-from-top-3 duration-200">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md text-slate-500 active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Staff Management</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{users.length} Active Accounts</p>
          </div>
        </div>
        <button 
          onClick={handleToggleAddForm}
          className={`w-8 h-8 rounded-lg shadow flex items-center justify-center active:scale-90 transition-transform bg-blue-600 text-white shadow-blue-500/30`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add/Edit Staff Modal Popup */}
      {showAddForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 w-full max-w-xs space-y-2.5 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold text-blue-605 uppercase tracking-wider border-l-2 border-blue-500 pl-1.5">
                {editingUser ? "Edit Account" : "New Account"}
              </p>
              <button type="button" onClick={handleToggleAddForm} className="p-1 bg-slate-50 dark:bg-slate-800 rounded-md active:scale-90 text-slate-500 transition-transform cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Full Name</label>
                <input
                  type="text"
                  value={uName}
                  onChange={e => setUName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input
                      type="tel"
                      value={uPhone}
                      onChange={e => setUPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-7 pr-2 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>
                <div className="relative z-[60]">
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Role</label>
                  <InlineSelect
                    value={uRole}
                    onChange={(val) => setURole(val)}
                    options={[
                      { value: "staff", label: "Staff" },
                      { value: "admin", label: "Admin" }
                    ]}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">
                  Password {editingUser && "(leave blank to keep unchanged)"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={uPassword}
                    onChange={e => setUPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-7 pr-8 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword(v => !v);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-10 text-slate-400 cursor-pointer active:scale-90 bg-transparent"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-blue-600 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Saving..." : editingUser ? "Save Changes" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-850 pb-20">
        {loadingUsers ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Loading staff...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2 opacity-50">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No users found</p>
          </div>
        ) : (
          users.map((u: any) => (
            <div
              key={u.id}
              className="bg-white dark:bg-slate-900 py-2 px-2 flex items-center gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 border-b border-slate-50 dark:border-slate-900/50"
            >
              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {u.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{u.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {u.role}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">{u.phone}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleStartEdit(u)}
                  className="w-7 h-7 bg-blue-50 dark:bg-blue-950/30 text-blue-500 rounded-md flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    className="w-7 h-7 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-md flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
