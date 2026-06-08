"use client";

import React, { useState, useEffect } from "react";
import { 
  Building, 
  Users, 
  Database, 
  Cpu, 
  Plus, 
  Edit, 
  Trash2, 
  Globe, 
  RefreshCw, 
  TrendingUp, 
  AlertTriangle, 
  Check, 
  X,
  Server,
  Play,
  Pause,
  LogOut,
  Sliders,
  DollarSign
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";

interface Client {
  id: string;
  name: string;
  owner: string;
  phone: string;
  email: string;
  plan: "Basic" | "Pro" | "Enterprise";
  monthlyFee: number;
  activeStaff: number;
  staffLimit: number;
  activeRetailers: number;
  retailerLimit: number;
  status: "Online" | "Maintenance";
  dbSizeMb: number;
  apiRequests: number;
  cpuLoad: number;
  memoryUsage: number;
}

export default function SuperadminPage() {
  const router = useRouter();
  const { currentUser, resetStore, theme } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("clients");

  // Initial Seed Clients
  const [clients, setClients] = useState<Client[]>([
    {
      id: "cli-101",
      name: "Sharma Money Exchange",
      owner: "Rahul Sharma",
      phone: "9917128864",
      email: "rahul@sharmamoney.in",
      plan: "Pro",
      monthlyFee: 2500,
      activeStaff: 12,
      staffLimit: 20,
      activeRetailers: 76,
      retailerLimit: 100,
      status: "Online",
      dbSizeMb: 34.2,
      apiRequests: 1420,
      cpuLoad: 8,
      memoryUsage: 384
    },
    {
      id: "cli-102",
      name: "Gupta Distributors Noida",
      owner: "Ankit Gupta",
      phone: "7900671145",
      email: "ankit@guptadist.com",
      plan: "Basic",
      monthlyFee: 1500,
      activeStaff: 4,
      staffLimit: 5,
      activeRetailers: 22,
      retailerLimit: 30,
      status: "Online",
      dbSizeMb: 12.8,
      apiRequests: 480,
      cpuLoad: 3,
      memoryUsage: 192
    },
    {
      id: "cli-103",
      name: "CrediiFlow Global Services",
      owner: "Siddharth Verma",
      phone: "9876543210",
      email: "siddharth@crediiflow.in",
      plan: "Enterprise",
      monthlyFee: 5000,
      activeStaff: 34,
      staffLimit: 50,
      activeRetailers: 198,
      retailerLimit: 250,
      status: "Online",
      dbSizeMb: 92.5,
      apiRequests: 4320,
      cpuLoad: 24,
      memoryUsage: 1024
    },
    {
      id: "cli-104",
      name: "Delhi Cash Logistix",
      owner: "Vikram Malhotra",
      phone: "8888888888",
      email: "vikram@delhicash.co.in",
      plan: "Pro",
      monthlyFee: 2500,
      activeStaff: 18,
      staffLimit: 20,
      activeRetailers: 85,
      retailerLimit: 100,
      status: "Maintenance",
      dbSizeMb: 48.1,
      apiRequests: 1890,
      cpuLoad: 12,
      memoryUsage: 448
    }
  ]);

  // Selected client for viewing details
  const [selectedClient, setSelectedClient] = useState<Client | null>(clients[0]);

  // Drawer States
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  // Form States
  const [fName, setFName] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPlan, setFPlan] = useState<"Basic" | "Pro" | "Enterprise">("Pro");
  const [fFee, setFFee] = useState(2500);
  const [fStaffLimit, setFStaffLimit] = useState(20);
  const [fRetLimit, setFRetLimit] = useState(100);
  const [fStatus, setFStatus] = useState<"Online" | "Maintenance">("Online");

  // Global Toast State
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Resource Usage Simulation Timer
  useEffect(() => {
    setMounted(true);
    
    // Simulate real-time API load and CPU variations
    const interval = setInterval(() => {
      setClients(prev => prev.map(c => {
        if (c.status === "Maintenance") {
          return {
            ...c,
            apiRequests: Math.max(0, c.apiRequests + Math.floor(Math.random() * 5) - 3),
            cpuLoad: Math.max(1, Math.floor(Math.random() * 3) + 1),
            memoryUsage: c.memoryUsage
          };
        }
        return {
          ...c,
          apiRequests: Math.max(10, c.apiRequests + Math.floor(Math.random() * 21) - 10),
          cpuLoad: Math.max(2, Math.min(99, c.cpuLoad + Math.floor(Math.random() * 5) - 2)),
          dbSizeMb: Number((c.dbSizeMb + 0.002).toFixed(3))
        };
      }));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Sync selected client state when clients update
  useEffect(() => {
    if (selectedClient) {
      const match = clients.find(c => c.id === selectedClient.id);
      if (match) {
        setSelectedClient(match);
      }
    }
  }, [clients]);

  if (!mounted) return null;

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Add Client Handler
  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fName || !fOwner || !fPhone || !fEmail) {
      alert("Please fill all required fields");
      return;
    }
    const newClient: Client = {
      id: `cli-${Date.now().toString().slice(-3)}`,
      name: fName,
      owner: fOwner,
      phone: fPhone,
      email: fEmail,
      plan: fPlan,
      monthlyFee: Number(fFee),
      activeStaff: 0,
      staffLimit: Number(fStaffLimit),
      activeRetailers: 0,
      retailerLimit: Number(fRetLimit),
      status: fStatus,
      dbSizeMb: 1.5,
      apiRequests: 0,
      cpuLoad: 1,
      memoryUsage: 64
    };

    setClients(prev => [...prev, newClient]);
    setShowAddDrawer(false);
    triggerToast(`Client "${fName}" registered successfully!`);
    resetForm();
  };

  // Open Edit Drawer
  const openEdit = (client: Client) => {
    setEditTargetId(client.id);
    setFName(client.name);
    setFOwner(client.owner);
    setFPhone(client.phone);
    setFEmail(client.email);
    setFPlan(client.plan);
    setFFee(client.monthlyFee);
    setFStaffLimit(client.staffLimit);
    setFRetLimit(client.retailerLimit);
    setFStatus(client.status);
    setShowEditDrawer(true);
  };

  // Edit Client Handler
  const handleEditClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetId) return;

    setClients(prev => prev.map(c => {
      if (c.id === editTargetId) {
        return {
          ...c,
          name: fName,
          owner: fOwner,
          phone: fPhone,
          email: fEmail,
          plan: fPlan,
          monthlyFee: Number(fFee),
          staffLimit: Number(fStaffLimit),
          retailerLimit: Number(fRetLimit),
          status: fStatus
        };
      }
      return c;
    }));

    setShowEditDrawer(false);
    triggerToast(`Client details updated.`);
    resetForm();
  };

  // Delete Client Handler
  const handleDeleteClient = (id: string, name: string) => {
    if (!confirm(`CAUTION: Are you sure you want to permanently delete Client "${name}"? All database clusters and file storages for this tenant will be destroyed.`)) return;
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedClient?.id === id) {
      setSelectedClient(null);
    }
    triggerToast(`Client "${name}" has been deleted.`);
  };

  // Toggle Maintenance Mode
  const toggleMaintenance = (id: string, currentStatus: string, name: string) => {
    const nextStatus = currentStatus === "Online" ? "Maintenance" : "Online";
    setClients(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: nextStatus, cpuLoad: nextStatus === "Maintenance" ? 2 : 10 };
      }
      return c;
    }));
    triggerToast(`Client "${name}" status updated to ${nextStatus}.`);
  };

  const resetForm = () => {
    setFName("");
    setFOwner("");
    setFPhone("");
    setFEmail("");
    setFPlan("Pro");
    setFFee(2500);
    setFStaffLimit(20);
    setFRetLimit(100);
    setFStatus("Online");
    setEditTargetId(null);
  };

  // Calculations for KPIs
  const totalRevenue = clients.reduce((s, c) => s + c.monthlyFee, 0);
  const totalStaff = clients.reduce((s, c) => s + c.activeStaff, 0);
  const totalRetailers = clients.reduce((s, c) => s + c.activeRetailers, 0);
  const totalDbSize = Number(clients.reduce((s, c) => s + c.dbSizeMb, 0).toFixed(1));
  const avgCpu = Math.round(clients.reduce((s, c) => s + c.cpuLoad, 0) / clients.length);

  return (
    <div className={`flex min-h-screen ${theme === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-900"} font-sans select-none`}>
      
      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col fixed h-full z-20 transition-all shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="w-20 h-20 bg-slate-950 rounded-2xl flex items-center justify-center p-2 border border-white/10 relative overflow-hidden group shadow-lg shadow-black/20">
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
             <img src="/logo.png" alt="CrediiFlow Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
            <span className="text-xs font-black tracking-widest text-indigo-650 dark:text-indigo-400 uppercase">CrediiFlow Core</span>
            <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Global Superadmin</h2>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab("clients")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "clients"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-150 hover:bg-slate-50 dark:hover:bg-slate-950/40"
            }`}
          >
            <Building className="w-4.5 h-4.5" />
            Client Directories
          </button>
          
          <button
            onClick={() => router.push("/maintenance")}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-850 dark:hover:text-slate-150 hover:bg-slate-50 dark:hover:bg-slate-950/40 text-left cursor-pointer"
          >
            <Server className="w-4.5 h-4.5" />
            Check Maintenance
          </button>
        </nav>

        <div className="border-t border-slate-150 dark:border-slate-800 pt-5">
          <button
            onClick={() => { resetStore(); router.push("/"); }}
            className="flex items-center gap-2.5 text-red-650 hover:text-red-700 text-xs font-black uppercase tracking-wider transition-all px-2 py-1.5 cursor-pointer hover:bg-red-50/50 rounded-lg w-fit"
          >
            <LogOut className="w-4.5 h-4.5" />
            Exit Dashboard
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTAINER ── */}
      <main className="flex-1 ml-64 p-8 min-h-screen">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
             <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">SaaS Command Center</h1>
             <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Multi-Tenant Management & Resource Utilization</p>
          </div>
          
          <button
            onClick={() => { resetForm(); setShowAddDrawer(true); }}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-650/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Client
          </button>
        </header>

        {/* ── TOP KPI SUMMARY GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          {/* Active Clients */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Clients</span>
              <span className="text-2xl font-black block text-slate-900 dark:text-white tracking-tight">{clients.length} Teams</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Fully Isolated Clusters</span>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Building className="w-6 h-6" />
            </div>
          </div>

          {/* Monthly MRR */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Monthly MRR</span>
              <span className="text-2xl font-black block text-slate-900 dark:text-white tracking-tight">₹{totalRevenue.toLocaleString()}</span>
              <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider block">100% Subscription Flow</span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          {/* Database Size */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Relational Storage</span>
              <span className="text-2xl font-black block text-slate-900 dark:text-white tracking-tight">{totalDbSize} MB</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{totalStaff} Staff | {totalRetailers} Retailers</span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
          </div>

          {/* VPS Average Load */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Avg Engine Load</span>
              <span className="text-2xl font-black block text-slate-900 dark:text-white tracking-tight">{avgCpu}% CPU</span>
              <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">Container Cluster OK</span>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl">
              <Cpu className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* ── CLIENTS DIRECTORY & MONITORING PANEL ── */}
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          
          {/* Directory Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">Tenant Directory</h3>
                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-450 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-indigo-200/50">
                  Manage Clients ({clients.length})
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-250 dark:border-slate-800">
                      <th className="px-6 py-4">Client Name</th>
                      <th className="px-6 py-4">Owner / Contact</th>
                      <th className="px-6 py-4 text-center">Plan Limits</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold text-slate-700 dark:text-slate-350">
                    {clients.map(c => (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedClient(c)}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/10 transition-colors cursor-pointer ${selectedClient?.id === c.id ? "bg-slate-50 dark:bg-slate-850/20" : ""}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-tight leading-snug">{c.name}</span>
                            <span className="text-[8px] text-slate-400 uppercase mt-0.5">{c.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 dark:text-slate-250">{c.owner}</span>
                            <span className="text-[9px] font-medium text-slate-450 dark:text-slate-500">{c.phone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                              c.plan === 'Enterprise' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-650' : c.plan === 'Pro' ? 'bg-blue-100 dark:bg-blue-950 text-blue-650' : 'bg-slate-100 dark:bg-slate-800 text-slate-650'
                            }`}>
                              {c.plan}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold mt-1">
                              Stf: {c.activeStaff}/{c.staffLimit} | Ret: {c.activeRetailers}/{c.retailerLimit}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleMaintenance(c.id, c.status, c.name); }}
                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 mx-auto transition-all active:scale-95 ${
                              c.status === 'Online'
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-250 dark:border-emerald-900/30'
                              : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border-amber-250 dark:border-amber-900/30 animate-pulse'
                            }`}
                          >
                            {c.status === "Online" ? <Play className="w-2.5 h-2.5 fill-emerald-600 stroke-none" /> : <Pause className="w-2.5 h-2.5 fill-amber-600 stroke-none" />}
                            {c.status}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => openEdit(c)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteClient(c.id, c.name)}
                              className="p-1.5 text-slate-450 hover:text-red-650 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Delete Client"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Details Column */}
          <div className="space-y-6">
            
            {/* Resource Usage & Stats Card */}
            {selectedClient ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6 animate-fade-in">
                
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wide">Resource Usage</h3>
                      <p className="text-[9px] font-bold text-slate-450 uppercase mt-0.5">{selectedClient.name}</p>
                    </div>
                  </div>
                </div>

                {/* Gauges & Meters */}
                <div className="space-y-5">
                  
                  {/* Database size */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>DB Cluster Storage</span>
                      <span className="text-slate-700 dark:text-slate-350">{selectedClient.dbSizeMb} MB / 100 MB</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(selectedClient.dbSizeMb / 100) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Active staff limit */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>Active Staff allocation</span>
                      <span className="text-slate-700 dark:text-slate-350">{selectedClient.activeStaff} / {selectedClient.staffLimit} Users</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(selectedClient.activeStaff / selectedClient.staffLimit) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Retailers allocation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>Retailer Accounts</span>
                      <span className="text-slate-700 dark:text-slate-350">{selectedClient.activeRetailers} / {selectedClient.retailerLimit} Stores</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(selectedClient.activeRetailers / selectedClient.retailerLimit) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* API Calls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>API Call frequency</span>
                      <span className="text-slate-700 dark:text-slate-350">{selectedClient.apiRequests} req/hour</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, (selectedClient.apiRequests / 5000) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Virtual CPU / Mem details */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl">
                      <span className="text-[8px] font-black uppercase text-slate-400 block mb-1">Engine CPU Load</span>
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-550 dark:text-indigo-400" />
                        <span className="text-xs font-black">{selectedClient.cpuLoad}%</span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl">
                      <span className="text-[8px] font-black uppercase text-slate-400 block mb-1">Engine RAM allocation</span>
                      <div className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-indigo-550 dark:text-indigo-400" />
                        <span className="text-xs font-black">{selectedClient.memoryUsage} MB</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* DB Optimization Trigger */}
                <button
                  onClick={() => triggerToast(`Optimized index clusters on "${selectedClient.name}".`)}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-950 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  Optimize DB Clusters
                </button>
                
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-8 text-center text-slate-400 italic font-bold">
                 Select a tenant directory to monitor real-time resource allocations.
              </div>
            )}

            {/* Quick backup logs */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Database className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Global Backups Log</h3>
              </div>
              <div className="space-y-3 text-[11px] font-semibold">
                <div className="flex items-center justify-between p-2 rounded bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100/50 dark:border-slate-850">
                  <span className="text-slate-655 dark:text-slate-400">Database Daily Snapshot</span>
                  <span className="font-black text-emerald-600">SUCCESS (R2)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100/50 dark:border-slate-850">
                  <span className="text-slate-655 dark:text-slate-400">Odometer Images Sync</span>
                  <span className="font-black text-emerald-600">SUCCESS (R2)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100/50 dark:border-slate-850 opacity-60">
                  <span className="text-slate-655 dark:text-slate-400">Weekly Full Backup</span>
                  <span className="font-black text-slate-400">07-Jun-2026</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* ── CREATE CLIENT DRAWER/MODAL ── */}
      {showAddDrawer && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.2rem] w-full max-w-md p-8 space-y-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-tight">Add New Tenant Profile</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Setup Isolated Database</p>
              </div>
              <button 
                onClick={() => { setShowAddDrawer(false); resetForm(); }} 
                className="p-2 bg-slate-50 dark:bg-slate-850 text-slate-550 dark:text-slate-400 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleAddClient} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Company / Business Name</label>
                <input 
                  type="text" 
                  value={fName} 
                  onChange={e => setFName(e.target.value)} 
                  placeholder="e.g. Noida Cash Exchange" 
                  className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none focus:border-indigo-500" 
                  required 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Owner Name</label>
                  <input 
                    type="text" 
                    value={fOwner} 
                    onChange={e => setFOwner(e.target.value)} 
                    placeholder="e.g. Ramesh Verma" 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Owner Phone</label>
                  <input 
                    type="tel" 
                    value={fPhone} 
                    onChange={e => setFPhone(e.target.value)} 
                    placeholder="e.g. 9917128864" 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Billing Email</label>
                <input 
                  type="email" 
                  value={fEmail} 
                  onChange={e => setFEmail(e.target.value)} 
                  placeholder="billing@company.com" 
                  className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Pricing Plan</label>
                  <select 
                    value={fPlan} 
                    onChange={e => {
                      const plan = e.target.value as "Basic" | "Pro" | "Enterprise";
                      setFPlan(plan);
                      if(plan === "Basic") { setFFee(1500); setFStaffLimit(5); setFRetLimit(30); }
                      else if(plan === "Pro") { setFFee(2500); setFStaffLimit(20); setFRetLimit(100); }
                      else { setFFee(5000); setFStaffLimit(50); setFRetLimit(250); }
                    }} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none"
                  >
                    <option value="Basic">Basic Plan</option>
                    <option value="Pro">Pro Plan</option>
                    <option value="Enterprise">Enterprise Plan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Monthly Fee (₹)</label>
                  <input 
                    type="number" 
                    value={fFee} 
                    onChange={e => setFFee(Number(e.target.value))} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-bold" 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Staff Limit</label>
                  <input 
                    type="number" 
                    value={fStaffLimit} 
                    onChange={e => setFStaffLimit(Number(e.target.value))} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Retailer Limit</label>
                  <input 
                    type="number" 
                    value={fRetLimit} 
                    onChange={e => setFRetLimit(Number(e.target.value))} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-semibold" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full py-4.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-950/20 active:scale-95 transition-all mt-4 cursor-pointer"
              >
                Provision Isolated Database
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT CLIENT DRAWER/MODAL ── */}
      {showEditDrawer && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.2rem] w-full max-w-md p-8 space-y-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-tight">Edit Tenant Profile</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Modify Allocation Limits</p>
              </div>
              <button 
                onClick={() => { setShowEditDrawer(false); resetForm(); }} 
                className="p-2 bg-slate-50 dark:bg-slate-850 text-slate-550 dark:text-slate-400 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleEditClient} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Company Name</label>
                <input 
                  type="text" 
                  value={fName} 
                  onChange={e => setFName(e.target.value)} 
                  className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none" 
                  required 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Owner Name</label>
                  <input 
                    type="text" 
                    value={fOwner} 
                    onChange={e => setFOwner(e.target.value)} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Owner Phone</label>
                  <input 
                    type="tel" 
                    value={fPhone} 
                    onChange={e => setFPhone(e.target.value)} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Billing Email</label>
                <input 
                  type="email" 
                  value={fEmail} 
                  onChange={e => setFEmail(e.target.value)} 
                  className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Pricing Plan</label>
                  <select 
                    value={fPlan} 
                    onChange={e => setFPlan(e.target.value as any)} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none"
                  >
                    <option value="Basic">Basic Plan</option>
                    <option value="Pro">Pro Plan</option>
                    <option value="Enterprise">Enterprise Plan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Monthly Fee (₹)</label>
                  <input 
                    type="number" 
                    value={fFee} 
                    onChange={e => setFFee(Number(e.target.value))} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-bold" 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Staff Limit</label>
                  <input 
                    type="number" 
                    value={fStaffLimit} 
                    onChange={e => setFStaffLimit(Number(e.target.value))} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Retailer Limit</label>
                  <input 
                    type="number" 
                    value={fRetLimit} 
                    onChange={e => setFRetLimit(Number(e.target.value))} 
                    className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none font-semibold" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 uppercase font-black mb-1">Cluster status</label>
                <select 
                  value={fStatus} 
                  onChange={e => setFStatus(e.target.value as any)} 
                  className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl outline-none"
                >
                  <option value="Online">Online Cluster</option>
                  <option value="Maintenance">Maintenance Mode</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="w-full py-4.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all mt-4 cursor-pointer"
              >
                Save Configurations
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[60] animate-slide-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Global Notification</p>
              <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">{toastMsg}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
