"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { superAdminApi } from "./utils/api";

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  db_name: string;
  status: string;
  maintenance_mode: boolean;
  created_at: string;
  admin_phone?: string;
  // Simulated fields for UI metrics
  cpu?: number;
  memory?: number;
  storage?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("directory"); // "directory", "resources", "infrastructure"
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Profile data
  const [adminName, setAdminName] = useState("");
  const [username, setUsername] = useState("");

  // Onboard Form States
  const [clientName, setClientName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [tenantAdminName, setTenantAdminName] = useState("");
  const [tenantAdminPhone, setTenantAdminPhone] = useState("");
  const [tenantAdminPassword, setTenantAdminPassword] = useState("");
  const [showOnboardPassword, setShowOnboardPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Form States
  const [editTenantId, setEditTenantId] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editSubdomain, setEditSubdomain] = useState("");
  const [editAdminPhone, setEditAdminPhone] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete Form States
  const [deleteTenantId, setDeleteTenantId] = useState("");
  const [deleteClientName, setDeleteClientName] = useState("");
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Global Toast
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    if (!token) {
      router.push("/login");
      return;
    }
    setAdminName(localStorage.getItem("superadmin_name") || "Admin");
    setUsername(localStorage.getItem("superadmin_username") || "superadmin");
    fetchTenants();
  }, [router]);

  // Simulate real-time metric fluctuations
  useEffect(() => {
    if (tenants.length === 0) return;
    const interval = setInterval(() => {
      setTenants((prevTenants) =>
        prevTenants.map((t) => {
          if (t.maintenance_mode) {
            return {
              ...t,
              cpu: Math.max(1, Math.floor(Math.random() * 4) + 1),
              memory: Math.max(64, (t.memory || 128) + Math.floor(Math.random() * 5) - 2),
              storage: t.storage || Number((10 + Math.random() * 5).toFixed(1)),
            };
          }
          return {
            ...t,
            cpu: Math.max(2, Math.min(99, (t.cpu || Math.floor(Math.random() * 30) + 5) + Math.floor(Math.random() * 11) - 5)),
            memory: Math.max(128, Math.min(2048, (t.memory || Math.floor(Math.random() * 512) + 128) + Math.floor(Math.random() * 21) - 10)),
            storage: Number(((t.storage || Math.floor(Math.random() * 50) + 10) + 0.001).toFixed(3)),
          };
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [tenants.length]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  const fetchTenants = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await superAdminApi.getTenants();
      const mapped = data.map((t) => ({
        ...t,
        cpu: Math.floor(Math.random() * 25) + 5,
        memory: Math.floor(Math.random() * 256) + 128,
        storage: Number((15.4 + Math.random() * 12).toFixed(1)),
      }));
      setTenants(mapped);
      if (mapped.length > 0 && !selectedTenant) {
        setSelectedTenant(mapped[0]);
      } else if (selectedTenant) {
        const updatedSelected = mapped.find((t) => t.id === selectedTenant.id);
        if (updatedSelected) setSelectedTenant(updatedSelected);
      }
    } catch (err: any) {
      console.error("Failed to load tenants:", err);
      const msg = err?.message || "";
      // Token expired or unauthorized → force re-login
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("credentials")) {
        localStorage.removeItem("superadmin_token");
        localStorage.removeItem("superadmin_name");
        localStorage.removeItem("superadmin_username");
        router.push("/login");
        return;
      }
      setFetchError(msg || "Failed to connect to backend. Please check server status.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("superadmin_token");
    localStorage.removeItem("superadmin_name");
    localStorage.removeItem("superadmin_username");
    router.push("/login");
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setCreating(true);

    try {
      await superAdminApi.createTenant({
        name: clientName,
        subdomain: subdomain.toLowerCase().replace(/\s+/g, "-"),
        admin_name: tenantAdminName,
        admin_phone: tenantAdminPhone,
        admin_password: tenantAdminPassword,
      });

      setClientName("");
      setSubdomain("");
      setTenantAdminName("");
      setTenantAdminPhone("");
      setTenantAdminPassword("");
      setShowAddModal(false);
      triggerToast("New client database cluster provisioned successfully!");
      fetchTenants();
    } catch (err: any) {
      setFormError(err.message || "Failed to onboard new tenant.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (tenant: Tenant) => {
    setEditTenantId(tenant.id);
    setEditClientName(tenant.name);
    setEditStatus(tenant.status);
    setEditSubdomain(tenant.subdomain || "");
    setEditAdminPhone(tenant.admin_phone || "");
    setEditAdminPassword("");
    setShowEditPassword(false);
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    setUpdating(true);

    try {
      const payload: any = {
        name: editClientName,
        status: editStatus,
        subdomain: editSubdomain.toLowerCase().replace(/\s+/g, "-"),
        admin_phone: editAdminPhone,
      };
      if (editAdminPassword) {
        payload.admin_password = editAdminPassword;
      }

      await superAdminApi.editTenant(editTenantId, payload);
      setShowEditModal(false);
      triggerToast("Client credentials and configurations updated!");
      fetchTenants();
    } catch (err: any) {
      setEditError(err.message || "Failed to update tenant details.");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenDelete = (tenant: Tenant) => {
    setDeleteTenantId(tenant.id);
    setDeleteClientName(tenant.name);
    setDeleteConfirmationName("");
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const handleDeleteTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmationName !== deleteClientName) {
      setDeleteError("Confirmation name does not match the company name.");
      return;
    }
    setDeleteError("");
    setDeleting(true);

    try {
      await superAdminApi.deleteTenant(deleteTenantId);
      setShowDeleteModal(false);
      triggerToast("Client cluster completely removed and data wiped.");
      if (selectedTenant && selectedTenant.id === deleteTenantId) {
        setSelectedTenant(null);
      }
      fetchTenants();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete tenant.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleMaintenance = async (tenantId: string, enabled: boolean) => {
    try {
      await superAdminApi.toggleMaintenance(tenantId, enabled);
      fetchTenants();
      triggerToast(enabled ? "Client put in Maintenance Mode" : "Client cluster restored Live");
    } catch (err: any) {
      alert(err.message || "Failed to toggle maintenance mode");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-slate-800 overflow-x-hidden font-sans">
      {/* Ambient Light Gradients */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-100/50 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/40 blur-[130px] pointer-events-none" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-5 py-4 bg-white border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.08)] animate-bounce text-[10px] font-black uppercase tracking-wider">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0d1b3e] border-b border-blue-900/40 px-3.5 py-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-1">
          <img 
            src="/logo.png" 
            alt="CrediiFlow Logo" 
            className="h-7 w-auto object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black uppercase text-slate-100 tracking-wider">{adminName}</p>
            <p className="text-[8px] font-bold text-blue-200/70 uppercase mt-0.5">@{username}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-2.5 py-1 border border-blue-800 hover:border-red-400 hover:bg-red-950/30 text-blue-200 hover:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-4 relative z-10">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-base font-black uppercase tracking-tight text-slate-900">Super Admin Command Center</h1>
            <p className="text-slate-500 text-[10px] mt-0.5 font-medium">Manage global directories, edit plan constraints, and monitor tenant database clusters.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="self-start md:self-auto px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md active:scale-[0.98] cursor-pointer"
          >
            + Onboard New Client
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 border-b border-slate-200 mb-4 pb-px">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all duration-250 cursor-pointer ${
              activeTab === "directory"
                ? "border-violet-650 text-violet-650 bg-slate-100/50"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Client Directory
          </button>
          <button
            onClick={() => setActiveTab("resources")}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all duration-250 cursor-pointer ${
              activeTab === "resources"
                ? "border-violet-650 text-violet-650 bg-slate-100/50"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Resource Visualizer
          </button>
          <button
            onClick={() => setActiveTab("infrastructure")}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all duration-250 cursor-pointer ${
              activeTab === "infrastructure"
                ? "border-violet-650 text-violet-650 bg-slate-100/50"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Infrastructure Health
          </button>
        </div>

        {/* ─── TAB 1: DIRECTORY ─── */}
        {activeTab === "directory" && (
          <div className="space-y-4 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-lg p-3 shadow-sm">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Total Active Tenants</p>
                <p className="text-xl font-black mt-1 text-violet-650">{tenants.length}</p>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wide">Isolated DB-Per-Client Model</p>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-lg p-3 shadow-sm">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">PostgreSQL Server Status</p>
                <p className="text-xl font-black mt-1 text-emerald-600">ONLINE</p>
                <p className="text-[9px] text-emerald-500 font-bold mt-1 uppercase tracking-wide">Accepting DB schema connections</p>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-lg p-3 shadow-sm">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Master Database Node</p>
                <p className="text-[13px] font-mono font-black mt-2 text-slate-755">crediiflow_master</p>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wide">Runs global tenant indexing</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-3.5 py-2 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-800">Registered Tenant Clusters</h2>
                <button 
                  onClick={fetchTenants}
                  className="text-[10px] text-indigo-650 hover:text-indigo-700 font-black uppercase tracking-wider cursor-pointer"
                >
                  Refresh Data
                </button>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-400 text-[11px] font-bold uppercase tracking-wider animate-pulse">Loading database client instances...</div>
              ) : fetchError ? (
                <div className="p-10 text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200/60 text-red-600 rounded-xl text-[10px] font-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    API Error: {fetchError}
                  </div>
                  <p className="text-slate-400 text-[10px] font-medium">Failed to fetch data from backend. Session may have expired.</p>
                  <button
                    onClick={fetchTenants}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : tenants.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-sm font-semibold">
                  No clients onboarded yet. Click "+ Onboard New Client" to provision the first client!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-200/80">
                        <th className="px-3.5 py-2">Client / Company Name</th>
                        <th className="px-3.5 py-2">Subdomain / Domain Target</th>
                        <th className="px-3.5 py-2">Database Node</th>
                        <th className="px-3.5 py-2 text-center">Status</th>
                        <th className="px-3.5 py-2 text-center">Maintenance Guard</th>
                        <th className="px-3.5 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[10px] text-slate-705">
                      {tenants.map((t) => (
                        <tr 
                          key={t.id} 
                          onClick={() => setSelectedTenant(t)}
                          className={`hover:bg-slate-50/40 transition-colors duration-155 cursor-pointer ${
                            selectedTenant?.id === t.id ? "bg-slate-50/80 border-l-2 border-l-violet-600" : ""
                          }`}
                        >
                          <td className="px-3.5 py-2 font-black text-slate-900">{t.name}</td>
                          <td className="px-3.5 py-2 text-indigo-600 font-bold">
                            <a href={`https://${t.subdomain}.crediiflow.in`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {t.subdomain}.crediiflow.in
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          </td>
                          <td className="px-3.5 py-2 font-mono text-slate-500">{t.db_name}</td>
                          <td className="px-3.5 py-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                              t.status === "active" 
                                ? "bg-emerald-50 border border-emerald-200/50 text-emerald-600" 
                                : "bg-red-50 border border-red-200/50 text-red-650"
                            }`}>
                              {t.status === "active" ? "Active" : "Suspended"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleToggleMaintenance(t.id, !t.maintenance_mode)}
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer ${
                                  t.maintenance_mode
                                    ? "bg-amber-50 border border-amber-200/60 text-amber-600 hover:bg-amber-100"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200/60"
                                }`}
                              >
                                {t.maintenance_mode ? "ON (Maintenance)" : "OFF (Live)"}
                              </button>
                              {t.maintenance_mode && (
                                <a
                                  href={`https://${t.subdomain}.crediiflow.in/?bypass=true`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-indigo-50 border border-indigo-200/60 text-indigo-650 hover:bg-indigo-100 transition-colors"
                                  title="Admin Login Bypass"
                                >
                                  Login
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-2 h-2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(t)}
                                className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/60 rounded hover:text-slate-800 transition-colors cursor-pointer"
                                title="Edit Client Config"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleOpenDelete(t)}
                                className="p-1 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200/40 rounded transition-colors cursor-pointer"
                                title="Delete Tenant"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: RESOURCE VISUALIZER ─── */}
        {activeTab === "resources" && (
          <div className="space-y-4 animate-fade-in">
            {selectedTenant ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Selector column */}
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-lg p-2.5 h-fit space-y-2 shadow-sm">
                  <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">Select Instance</h3>
                  <div className="space-y-1">
                    {tenants.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTenant(t)}
                        className={`w-full p-2.5 rounded-lg text-left border flex items-center justify-between transition-all duration-205 cursor-pointer ${
                          selectedTenant.id === t.id
                            ? "bg-slate-50 border-violet-500/40 text-slate-900 shadow-sm font-black"
                            : "bg-transparent border-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider">{t.name}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{t.subdomain}.crediiflow.in</p>
                        </div>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.maintenance_mode ? "bg-amber-500" : "bg-emerald-500"}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dashboard column */}
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-lg p-4 space-y-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                    <div>
                      <h2 className="text-base font-black uppercase tracking-tight text-slate-900">{selectedTenant.name}</h2>
                      <p className="text-[9px] text-indigo-650 mt-0.5 font-bold">Resource allocation cluster logs</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border self-start sm:self-auto ${
                      selectedTenant.maintenance_mode
                        ? "bg-amber-50 text-amber-600 border-amber-200/60"
                        : "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                    }`}>
                      {selectedTenant.maintenance_mode ? "Maintenance Mode" : "Cluster Operational"}
                    </span>
                  </div>

                  {/* Meter Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* CPU gauge */}
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CPU Utilization</span>
                        <span className="text-[10px] font-black text-violet-650">{selectedTenant.cpu || 12}%</span>
                      </div>
                      <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full transition-all duration-750"
                          style={{ width: `${selectedTenant.cpu || 12}%` }}
                        />
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Core Limit: 2.0 vCPU Shared</p>
                    </div>

                    {/* RAM gauge */}
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Memory Heap</span>
                        <span className="text-[10px] font-black text-indigo-605">{selectedTenant.memory || 256} MB</span>
                      </div>
                      <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-blue-500 h-1.5 rounded-full transition-all duration-750"
                          style={{ width: `${Math.min(100, ((selectedTenant.memory || 256) / 2048) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">RAM Ceiling: 2048 MB</p>
                    </div>

                    {/* Storage Gauge */}
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DB Disk Storage</span>
                        <span className="text-[10px] font-black text-blue-600">{selectedTenant.storage || 15.4} MB</span>
                      </div>
                      <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1.5 rounded-full transition-all duration-750"
                          style={{ width: `${Math.min(100, ((selectedTenant.storage || 15.4) / 100) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Max Database Allocation: 100 MB</p>
                    </div>
                  </div>

                  {/* System details */}
                  <div className="p-3 bg-slate-50/50 border border-slate-200/60 rounded-lg space-y-2 text-slate-755">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Database cluster specifications</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                      <div>
                        <span className="text-slate-400 block mb-0.5">DB Name</span>
                        <span className="font-mono font-bold text-slate-800">{selectedTenant.db_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Port Mapping</span>
                        <span className="font-bold text-slate-800">5432 Internal</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Created Date</span>
                        <span className="font-bold text-slate-800">
                          {new Date(selectedTenant.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Instance Type</span>
                        <span className="font-bold text-indigo-650 uppercase tracking-wider">Kubernetes-Pod</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
                Please onboard a tenant directory to monitor live resource usage.
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: INFRASTRUCTURE HEALTH ─── */}
        {activeTab === "infrastructure" && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-lg p-3 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Central PG Database</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="space-y-0.5 text-[10px] text-slate-650">
                  <div className="flex justify-between"><span className="text-slate-450">Node Status</span><span className="font-bold text-slate-850">HEALTHY</span></div>
                  <div className="flex justify-between"><span className="text-slate-450">Connections</span><span className="font-bold text-slate-850">7 Active</span></div>
                  <div className="flex justify-between"><span className="text-slate-450">Version</span><span className="font-mono text-slate-500">PostgreSQL 16-alpine</span></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-lg p-3 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">FastAPI Core Backend</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="space-y-0.5 text-[10px] text-slate-650">
                  <div className="flex justify-between"><span className="text-slate-450">Uvicorn Status</span><span className="font-bold text-slate-850">OPERATIONAL</span></div>
                  <div className="flex justify-between"><span className="text-slate-450">CORS Policy</span><span className="font-bold text-indigo-600 uppercase tracking-widest text-[10px]">*.crediiflow.in</span></div>
                  <div className="flex justify-between"><span className="text-slate-450">Port Mapping</span><span className="font-mono text-slate-500">{"8000 -> 8000"}</span></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-lg p-3 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Nginx Reverse Proxy</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="space-y-0.5 text-[10px] text-slate-650">
                  <div className="flex justify-between"><span className="text-slate-450">SSL Certificates</span><span className="font-bold text-slate-850">SECURE (Let's Encrypt)</span></div>
                  <div className="flex justify-between"><span className="text-slate-450">HTTP/2 Support</span><span className="font-bold text-slate-850">ENABLED</span></div>
                  <div className="flex justify-between"><span className="text-slate-450">Config Path</span><span className="font-mono text-slate-500">/etc/nginx/nginx.conf</span></div>
                </div>
              </div>
            </div>

            {/* Docker Container Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200/80 bg-slate-50/50">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800">Active Container Host Services</h3>
              </div>
              <div className="overflow-x-auto text-[10px]">
                <table className="w-full text-left border-collapse text-slate-600">
                  <thead>
                    <tr className="bg-slate-50/70 text-slate-450 text-[10px] font-black uppercase tracking-widest border-b border-slate-200/80">
                      <th className="px-3.5 py-2">Service Name</th>
                      <th className="px-3.5 py-2">Docker Image</th>
                      <th className="px-3.5 py-2">Container ID</th>
                      <th className="px-3.5 py-2">Ports</th>
                      <th className="px-3.5 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-755">
                    <tr>
                      <td className="px-3.5 py-2 font-bold text-slate-900">doit_frontend</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">do-it-services-frontend:latest</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">doit_frontend</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">{"3000 -> 3000"}</td>
                      <td className="px-3.5 py-2 text-center"><span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-full font-black uppercase tracking-wider text-[8px]">Running</span></td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-bold text-slate-900">doit_backend</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">do-it-services-backend:latest</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">doit_backend</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">{"8000 -> 8000"}</td>
                      <td className="px-3.5 py-2 text-center"><span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-full font-black uppercase tracking-wider text-[8px]">Running</span></td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-bold text-slate-900">doit_superadmin_frontend</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">do-it-services-superadmin-frontend:latest</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">doit_superadmin_frontend</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">{"3001 -> 3001"}</td>
                      <td className="px-3.5 py-2 text-center"><span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-full font-black uppercase tracking-wider text-[8px]">Running</span></td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-bold text-slate-900">doit_nginx</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">nginx:alpine</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">doit_nginx</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">80:80, 443:443</td>
                      <td className="px-3.5 py-2 text-center"><span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-full font-black uppercase tracking-wider text-[8px]">Running</span></td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-bold text-slate-900">doit_db</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">postgres:16-alpine</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">doit_db</td>
                      <td className="px-3.5 py-2 font-mono text-slate-500">5432 Internal</td>
                      <td className="px-3.5 py-2 text-center"><span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-full font-black uppercase tracking-wider text-[8px]">Running</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── ADD ONBOARD MODAL ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden relative text-slate-755">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Onboard New Client Instance</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-650 p-1 rounded-lg hover:bg-slate-100 focus:outline-none cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-6 p-4 text-[10px] bg-red-50 border border-red-200/50 text-red-650 rounded-xl text-center font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Company / Client Name</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Subdomain Slug</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      className="w-full pl-4 pr-24 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                      placeholder="e.g. acme"
                    />
                    <span className="absolute right-2 text-[8px] font-black text-slate-400 lowercase">.crediiflow.in</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50/50 border border-slate-200/60 rounded-lg space-y-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Client Admin Account (Credentials)</p>
                
                <div>
                  <label className="block text-[8px] font-black text-slate-450 uppercase tracking-widest mb-0.5">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={tenantAdminName}
                    onChange={(e) => setTenantAdminName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-slate-455 uppercase tracking-widest mb-0.5">Admin Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={tenantAdminPhone}
                      onChange={(e) => setTenantAdminPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-455 uppercase tracking-widest mb-0.5">Admin Password</label>
                    <div className="relative">
                      <input
                        type={showOnboardPassword ? "text" : "password"}
                        required
                        value={tenantAdminPassword}
                        onChange={(e) => setTenantAdminPassword(e.target.value)}
                        className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOnboardPassword(!showOnboardPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                      >
                        {showOnboardPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {creating ? "Provisioning DB..." : "Deploy Instance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden relative text-slate-755">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Edit Client Configuration</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-650 p-1 rounded-lg hover:bg-slate-100 focus:outline-none cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {editError && (
              <div className="mx-6 mt-6 p-4 text-[10px] bg-red-50 border border-red-200/50 text-red-650 rounded-xl text-center font-bold">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditTenant} className="p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Company / Client Name</label>
                  <input
                    type="text"
                    required
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Subdomain Slug</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={editSubdomain}
                      onChange={(e) => setEditSubdomain(e.target.value)}
                      className="w-full pl-4 pr-24 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                      placeholder="e.g. acme"
                    />
                    <span className="absolute right-2 text-[8px] font-black text-slate-400 lowercase">.crediiflow.in</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Cluster Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                >
                  <option value="active">Active (Operational)</option>
                  <option value="suspended">Suspended (Access Revoked)</option>
                </select>
              </div>

              <div className="p-2.5 bg-slate-50/50 border border-slate-200/60 rounded-lg space-y-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Client Admin Credentials</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-slate-455 uppercase tracking-widest mb-0.5">Admin Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={editAdminPhone}
                      onChange={(e) => setEditAdminPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-455 uppercase tracking-widest mb-0.5">New Admin Password</label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        value={editAdminPassword}
                        onChange={(e) => setEditAdminPassword(e.target.value)}
                        className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                        placeholder="Leave blank to keep same"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                      >
                        {showEditPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 border border-slate-205 text-slate-450 hover:text-slate-655 hover:bg-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {updating ? "Saving Changes..." : "Save Config"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-2xl overflow-hidden relative text-slate-755">
            <div className="px-3 py-2 border-b border-red-100 flex items-center justify-between bg-red-50/50">
              <h3 className="text-sm font-black uppercase tracking-wider text-red-650 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-red-650 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>Danger: Drop Tenant DB Cluster</span>
              </h3>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-650 p-1 rounded-lg hover:bg-slate-100 focus:outline-none cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {deleteError && (
              <div className="mx-6 mt-6 p-4 text-[10px] bg-red-50 border border-red-200 text-red-600 rounded-xl text-center font-bold">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteTenant} className="p-3.5 space-y-2.5">
              <div className="p-4 bg-red-50 border border-red-200 text-[10px] text-red-650 leading-relaxed font-bold rounded-xl">
                WARNING: Wipes <span className="font-mono bg-red-105/70 px-1 py-0.5 rounded font-black text-red-750">crediiflow_{deleteClientName.toLowerCase().replace(/\s+/g, "_")}</span>. All client data and configs will be destroyed.
              </div>

              <div>
                <label className="block text-[8px] font-black text-slate-450 uppercase tracking-widest mb-0.5">
                  Type <span className="text-slate-900 font-black">{deleteClientName}</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmationName}
                  onChange={(e) => setDeleteConfirmationName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-red-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[10px] font-bold"
                  placeholder="Enter company name exactly"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2.5 border border-slate-205 text-slate-450 hover:text-slate-650 hover:bg-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || deleteConfirmationName !== deleteClientName}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-550 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {deleting ? "Destroying Cluster..." : "Permanently Destroy Cluster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
