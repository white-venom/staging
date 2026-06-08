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
}

export default function DashboardPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [username, setUsername] = useState("");

  // Form states
  const [clientName, setClientName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [tenantAdminName, setTenantAdminName] = useState("");
  const [tenantAdminPhone, setTenantAdminPhone] = useState("");
  const [tenantAdminPassword, setTenantAdminPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

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

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await superAdminApi.getTenants();
      setTenants(data);
    } catch (err) {
      console.error("Failed to load tenants:", err);
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

      // Reset form
      setClientName("");
      setSubdomain("");
      setTenantAdminName("");
      setTenantAdminPhone("");
      setTenantAdminPassword("");
      setShowModal(false);
      
      // Refresh list
      fetchTenants();
    } catch (err: any) {
      setFormError(err.message || "Failed to onboard new tenant. Check details and DB connection.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleMaintenance = async (tenantId: string, enabled: boolean) => {
    try {
      await superAdminApi.toggleMaintenance(tenantId, enabled);
      fetchTenants();
    } catch (err: any) {
      alert(err.message || "Failed to toggle maintenance mode");
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden font-sans">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-30%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-950/25 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-20%] w-[70%] h-[70%] rounded-full bg-indigo-950/20 blur-[150px] pointer-events-none" />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/50 backdrop-blur-md border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-violet-950/40">
            CF
          </div>
          <div>
            <span className="font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              CrediFlow
            </span>
            <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 rounded-md px-1.5 py-0.5 ml-2">Console</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-200">{adminName}</p>
            <p className="text-xs text-slate-400">@{username}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-slate-800 hover:border-red-900/50 hover:bg-red-950/10 text-slate-400 hover:text-red-400 rounded-lg text-sm transition-all duration-200"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Super Admin Dashboard</h1>
            <p className="text-slate-400 mt-2">Configure, scale, and manage tenant database clusters from one command center.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="self-start md:self-auto px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-indigo-950/20 active:scale-[0.98]"
          >
            + Onboard New Client
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900/40 border border-slate-900/80 rounded-xl p-6 shadow-md backdrop-blur-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Active Tenants</p>
            <p className="text-4xl font-black mt-2 text-violet-400">{tenants.length}</p>
            <p className="text-xs text-slate-500 mt-2">Provisioned database-per-client model</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-900/80 rounded-xl p-6 shadow-md backdrop-blur-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">PostgreSQL Server Status</p>
            <p className="text-4xl font-black mt-2 text-emerald-400">ONLINE</p>
            <p className="text-xs text-emerald-500/80 mt-2">Accepting new database schemas</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-900/80 rounded-xl p-6 shadow-md backdrop-blur-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Master DB Name</p>
            <p className="text-lg font-mono font-bold mt-4 text-slate-300">crediiflow_master</p>
            <p className="text-xs text-slate-500 mt-2">Runs isolated metadata mapping</p>
          </div>
        </div>

        {/* Tenants Section */}
        <div className="bg-slate-900/30 border border-slate-900/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-5 border-b border-slate-900/80 bg-slate-950/20 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-200">Registered Tenants</h2>
            <button 
              onClick={fetchTenants}
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Refresh Table
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading client instances...</div>
          ) : tenants.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              No clients onboarded yet. Click "+ Onboard New Client" to provision the first client!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/45 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900/80">
                    <th className="px-6 py-4">Client Name</th>
                    <th className="px-6 py-4">Subdomain</th>
                    <th className="px-6 py-4">Database Name</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Maintenance Mode</th>
                    <th className="px-6 py-4">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40 text-sm">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-900/20 transition-colors duration-150">
                      <td className="px-6 py-4 font-bold text-slate-200">{t.name}</td>
                      <td className="px-6 py-4 text-indigo-400">
                        <a href={`http://${t.subdomain}.crediiflow.in`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {t.subdomain}.crediiflow.in
                        </a>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{t.db_name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          t.status === "active" ? "bg-emerald-950/40 border border-emerald-900 text-emerald-400" : "bg-red-950/40 border border-red-900 text-red-400"
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleMaintenance(t.id, !t.maintenance_mode)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            t.maintenance_mode
                              ? "bg-amber-950/40 border border-amber-900 text-amber-400 hover:bg-amber-900/20"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {t.maintenance_mode ? "ON (Under Maintenance)" : "OFF (Live)"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(t.created_at).toLocaleDateString(undefined, {
                          year: "numeric", month: "short", day: "numeric"
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Onboarding Dialog / Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
              <h3 className="text-xl font-bold text-slate-100">Onboard New Client Instance</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-6 p-4 text-sm bg-red-950/30 border border-red-800/50 text-red-400 rounded-lg text-center">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Company / Client Name</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 focus:border-violet-500 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none transition-all duration-200 text-sm"
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subdomain Slug</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      className="w-full pl-4 pr-24 py-2.5 bg-slate-950/60 border border-slate-850 focus:border-violet-500 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none transition-all duration-200 text-sm"
                      placeholder="e.g. acme"
                    />
                    <span className="absolute right-3 text-xs text-slate-500">.crediiflow.in</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950/35 border border-slate-900 rounded-xl space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Client Admin Account (Credentials)</p>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={tenantAdminName}
                    onChange={(e) => setTenantAdminName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 focus:border-violet-500 rounded-lg text-slate-200 placeholder-slate-650 focus:outline-none transition-all duration-200 text-sm"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-505 uppercase tracking-wider mb-2">Admin Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={tenantAdminPhone}
                      onChange={(e) => setTenantAdminPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 focus:border-violet-500 rounded-lg text-slate-200 placeholder-slate-650 focus:outline-none transition-all duration-200 text-sm"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-505 uppercase tracking-wider mb-2">Admin Password</label>
                    <input
                      type="password"
                      required
                      value={tenantAdminPassword}
                      onChange={(e) => setTenantAdminPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 focus:border-violet-500 rounded-lg text-slate-200 placeholder-slate-650 focus:outline-none transition-all duration-200 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/20 rounded-lg text-sm font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all duration-200 shadow-md disabled:opacity-50 text-sm"
                >
                  {creating ? "Provisioning Client DB..." : "Deploy Client Instance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
