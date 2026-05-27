"use client";

import React, { useState } from "react";
import { 
  Search, 
  Plus, 
  Store, 
  MapPin, 
  Phone, 
  Trash2,
  X,
  ArrowLeft
} from "lucide-react";
import { api } from "@/app/utils/api";
import Link from "next/link";

interface MobileRetailersProps {
  retailerDirectory: any[];
  showToastNotification: (msg: string) => void;
  fetchData: () => void;
}

export default function MobileRetailers({
  retailerDirectory,
  showToastNotification,
  fetchData
}: MobileRetailersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [retName, setRetName] = useState("");
  const [retPhone, setRetPhone] = useState("");
  const [retArea, setRetArea] = useState("");
  const [retEmail, setRetEmail] = useState("");
  const [retToTake, setRetToTake] = useState("");
  const [retToGive, setRetToGive] = useState("");

  // Inline balance editing states
  const [inlineEditing, setInlineEditing] = useState<{ id: string, field: 'take' | 'give' } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  const handleInlineRetailerUpdate = async (id: string, field: 'take' | 'give') => {
    setIsUpdatingBalance(true);
    try {
      const retailer = retailerDirectory.find(r => r.id === id);
      if (!retailer) return;

      const targetValue = parseFloat(inlineValue || "0");
      if (targetValue < 0) {
        showToastNotification("Negative values are not allowed.");
        setIsUpdatingBalance(false);
        return;
      }

      const payload: any = {
        retailer_name: retailer.name,
        phone: retailer.phone,
        address: retailer.area,
        email: retailer.email || "",
      };
      if (field === 'take' && targetValue > 0) payload.opening_to_take = targetValue;
      if (field === 'give' && targetValue > 0) payload.opening_to_give = targetValue;

      await api.updateRetailer(id, payload);
      showToastNotification(`✓ Balance updated for ${retailer.name}`);
      setInlineEditing(null);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  const handleCreateRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const takeVal = parseFloat(retToTake || "0");
    const giveVal = parseFloat(retToGive || "0");
    if (takeVal < 0 || giveVal < 0) {
      showToastNotification("Opening balances cannot be negative");
      setSubmitting(false);
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
      showToastNotification(`✓ Retailer "${retName}" registered`);
      setRetName(""); setRetPhone(""); setRetArea(""); setRetEmail(""); setRetToTake(""); setRetToGive("");
      setShowAddForm(false);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRetailer = async (id: string, name: string) => {
    if (!confirm(`Delete retailer "${name}"?`)) return;
    try {
      await api.deleteRetailer(id);
      showToastNotification(`Retailer "${name}" deleted`);
      fetchData();
    } catch (err: any) {
      showToastNotification("Error: " + err.message);
    }
  };

  const filtered = retailerDirectory.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-500 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Retailers</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{retailerDirectory.length} Total Partners</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(v => !v)}
          className={`w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform ${showAddForm ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-355 shadow-none' : 'bg-emerald-600 text-white shadow-emerald-500/30'}`}
        >
          {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {/* Add Retailer Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-3 duration-250">
          <p className="text-[10px] font-black text-emerald-650 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">New Retailer</p>
          <form onSubmit={handleCreateRetailer} className="space-y-3">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Retailer Name</label>
              <input
                type="text"
                value={retName}
                onChange={e => setRetName(e.target.value)}
                placeholder="e.g. Laxmi Telecom"
                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  value={retPhone}
                  onChange={e => setRetPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={retEmail}
                  onChange={e => setRetEmail(e.target.value)}
                  placeholder="laxmi@gmail.com"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Address/Area</label>
              <input
                type="text"
                value={retArea}
                onChange={e => setRetArea(e.target.value)}
                placeholder="Sector 62, Noida"
                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Opening To Take (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={retToTake}
                  onChange={e => setRetToTake(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Opening To Give (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={retToGive}
                  onChange={e => setRetToGive(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Registering..." : "Register Retailer"}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="px-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search retailer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Retailer Cards */}
      <div className="space-y-4 pb-20">
        {filtered.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <Store className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No retailers found</p>
          </div>
        ) : (
          filtered.map((retailer) => {
            const isEditingThis = inlineEditing?.id === retailer.id;
            const editingField = inlineEditing && inlineEditing.id === retailer.id ? inlineEditing.field : null;
            return (
              <div 
                key={retailer.id}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white truncate max-w-[150px]">{retailer.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                      <MapPin className="w-3 h-3" /> {retailer.area || 'Unknown'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {retailer.phone && (
                    <a 
                      href={`tel:${retailer.phone}`}
                      className="p-2.5 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl active:scale-95 transition-transform"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  <button 
                    onClick={() => handleDeleteRetailer(retailer.id, retailer.name)}
                    className="p-2.5 bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 rounded-xl active:scale-95 transition-transform cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-black text-red-500 uppercase tracking-tighter">To Take</p>
                    <button
                      onClick={() => {
                        setInlineEditing({ id: retailer.id, field: 'take' });
                        setInlineValue("");
                      }}
                      className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded text-red-500 hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <p className="text-xs font-black mt-0.5 text-red-650 dark:text-red-400">
                    ₹{(retailer.opening_to_take || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">To Give</p>
                    <button
                      onClick={() => {
                        setInlineEditing({ id: retailer.id, field: 'give' });
                        setInlineValue("");
                      }}
                      className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded text-emerald-500 hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <p className="text-xs font-black mt-0.5 text-emerald-650 dark:text-emerald-555">
                    ₹{(retailer.opening_to_give || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Net Bal</p>
                  <p className={`text-xs font-black mt-0.5 ${(retailer.balance || 0) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    ₹{Math.abs(retailer.balance || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {isEditingThis && editingField && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2 animate-in fade-in duration-200">
                  <p className="text-[9px] font-black text-slate-450 uppercase tracking-wider">
                    Add more to {editingField === 'take' ? 'To Take (Red)' : 'To Give (Green)'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount to Add"
                      value={inlineValue}
                      onChange={e => setInlineValue(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleInlineRetailerUpdate(retailer.id, editingField)}
                      disabled={isUpdatingBalance}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setInlineEditing(null)}
                      className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );})
        )}
      </div>
    </div>
  );
}
