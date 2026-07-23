"use client";

import React, { useState, useEffect } from "react";
import { superAdminApi, API_BASE_URL } from "../utils/api";
import { toUserMessage } from "../utils/errors";

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  edit_window_minutes?: number;
  delete_window_minutes?: number;
  tenant_admin_can_edit_entities?: boolean;
  time_window_lock_enabled?: boolean;
  admin_edit_window_minutes?: number;
  admin_delete_window_minutes?: number;
}

interface Props {
  tenants: Tenant[];
  showToast: (msg: string) => void;
}

const inputCls = "flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold focus:outline-none disabled:opacity-40";
const labelCls = "block text-[10px] text-slate-400 uppercase font-bold mb-1";

export default function TenantControlsPanel({ tenants, showToast }: Props) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || null;

  // Window/entity controls state
  const [editWindow, setEditWindow] = useState("10");
  const [deleteWindow, setDeleteWindow] = useState("10");
  const [editPermanent, setEditPermanent] = useState(false);
  const [deletePermanent, setDeletePermanent] = useState(false);
  const [tenantAdminCanEdit, setTenantAdminCanEdit] = useState(false);
  // Item #3: admin's own (separate, longer) window, plus the whole-feature toggle.
  const [timeWindowLockEnabled, setTimeWindowLockEnabled] = useState(true);
  const [adminEditWindow, setAdminEditWindow] = useState("30");
  const [adminDeleteWindow, setAdminDeleteWindow] = useState("30");
  const [adminEditPermanent, setAdminEditPermanent] = useState(false);
  const [adminDeletePermanent, setAdminDeletePermanent] = useState(false);
  const [savingControls, setSavingControls] = useState(false);

  useEffect(() => {
    if (!selectedTenant) return;
    const em = selectedTenant.edit_window_minutes ?? 10;
    const dm = selectedTenant.delete_window_minutes ?? 10;
    setEditPermanent(em === -1);
    setDeletePermanent(dm === -1);
    setEditWindow(em === -1 ? "10" : String(em));
    setDeleteWindow(dm === -1 ? "10" : String(dm));
    setTenantAdminCanEdit(!!selectedTenant.tenant_admin_can_edit_entities);

    const aem = selectedTenant.admin_edit_window_minutes ?? 30;
    const adm = selectedTenant.admin_delete_window_minutes ?? 30;
    setAdminEditPermanent(aem === -1);
    setAdminDeletePermanent(adm === -1);
    setAdminEditWindow(aem === -1 ? "30" : String(aem));
    setAdminDeleteWindow(adm === -1 ? "30" : String(adm));
    setTimeWindowLockEnabled(selectedTenant.time_window_lock_enabled ?? true);
  }, [selectedTenantId]);

  const handleSaveControls = async () => {
    if (!selectedTenant) return;
    setSavingControls(true);
    try {
      await superAdminApi.updateTenantControls(selectedTenant.id, {
        edit_window_minutes: editPermanent ? -1 : (parseInt(editWindow) || 10),
        delete_window_minutes: deletePermanent ? -1 : (parseInt(deleteWindow) || 10),
        tenant_admin_can_edit_entities: tenantAdminCanEdit,
        time_window_lock_enabled: timeWindowLockEnabled,
        admin_edit_window_minutes: adminEditPermanent ? -1 : (parseInt(adminEditWindow) || 30),
        admin_delete_window_minutes: adminDeletePermanent ? -1 : (parseInt(adminDeleteWindow) || 30),
      });
      showToast(`Controls saved for ${selectedTenant.name}`);
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingControls(false);
    }
  };

  const [impersonating, setImpersonating] = useState(false);
  const handleImpersonate = async () => {
    if (!selectedTenant) return;
    if (!confirm(`Open a new tab logged in as ${selectedTenant.name}'s admin? This is logged in the audit trail.`)) return;
    setImpersonating(true);
    try {
      const res = await superAdminApi.impersonateTenant(selectedTenant.id);
      const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const targetOrigin = isLocal ? "http://localhost:3000" : `https://${res.subdomain}.crediiflow.in`;
      const url = `${targetOrigin}/?impersonate_token=${encodeURIComponent(res.access_token)}&impersonate_id=${encodeURIComponent(res.admin_id)}&impersonate_name=${encodeURIComponent(res.admin_name)}&impersonate_phone=${encodeURIComponent(res.admin_phone)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      showToast(`Opened admin session for ${selectedTenant.name} in a new tab.`);
    } catch (err: any) {
      alert("Failed to impersonate: " + err.message);
    } finally {
      setImpersonating(false);
    }
  };

  const [backingUp, setBackingUp] = useState(false);
  const handleDownloadBackup = async () => {
    if (!selectedTenant) return;
    setBackingUp(true);
    try {
      const token = localStorage.getItem("superadmin_token");
      const res = await fetch(`${API_BASE_URL}/superadmin/tenants/${selectedTenant.id}/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || res.statusText);
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `${selectedTenant.subdomain}_backup.sql.gz`;
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Backup downloaded for ${selectedTenant.name}.`);
    } catch (err: any) {
      alert("Failed to download backup: " + toUserMessage(err));
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {/* Tenant picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm overflow-hidden h-fit">
        <div className="px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Select Tenant</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[70vh] overflow-y-auto">
          {tenants.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTenantId(t.id)}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                selectedTenantId === t.id
                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              {t.name}
              <span className="block text-[9px] font-medium text-slate-400 mt-0.5">{t.subdomain}</span>
            </button>
          ))}
        </div>
      </div>

      {!selectedTenant ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm p-8 text-center text-xs font-bold text-slate-400">
          Select a tenant on the left to manage its edit/delete windows and Retailer/Staff/Store records.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Support access */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">{selectedTenant.name} — Support Access</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Both actions are written to the audit log every time they're used.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadBackup}
                disabled={backingUp}
                title="Runs pg_dump for this tenant's database right now and downloads it -- separate from the nightly cluster-wide backup."
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-sm text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-60 cursor-pointer"
              >
                {backingUp ? "Dumping..." : "Download Backup"}
              </button>
              <button
                onClick={handleImpersonate}
                disabled={impersonating}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-sm text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-60 cursor-pointer"
              >
                {impersonating ? "Opening..." : "Impersonate Admin"}
              </button>
            </div>
          </div>

          <TenantHealthPanel tenantId={selectedTenant.id} tenantName={selectedTenant.name} />

          {/* Edit/Delete window + delegation controls */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                {selectedTenant.name} — Edit/Delete Time Windows
              </h3>
              <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                <span className="text-[9px] font-black uppercase text-slate-400">{timeWindowLockEnabled ? "Enabled" : "Disabled"}</span>
                <div
                  onClick={() => setTimeWindowLockEnabled(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${timeWindowLockEnabled ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${timeWindowLockEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </div>
              </label>
            </div>
            <p className="text-[9px] text-slate-400 font-medium -mt-2">
              Off: no time limit and no downstream-cash-use lock for anyone on this tenant, regardless of the values below.
            </p>

            <div>
              <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Staff</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Edit Window (Minutes)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={editWindow} onChange={e => setEditWindow(e.target.value)} disabled={editPermanent || !timeWindowLockEnabled} className={inputCls} />
                    <label className="flex items-center gap-1 text-[9px] font-black uppercase text-purple-600 cursor-pointer select-none">
                      <input type="checkbox" checked={editPermanent} onChange={e => setEditPermanent(e.target.checked)} disabled={!timeWindowLockEnabled} /> Unlimited
                    </label>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Delete Window (Minutes)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={deleteWindow} onChange={e => setDeleteWindow(e.target.value)} disabled={deletePermanent || !timeWindowLockEnabled} className={inputCls} />
                    <label className="flex items-center gap-1 text-[9px] font-black uppercase text-red-500 cursor-pointer select-none">
                      <input type="checkbox" checked={deletePermanent} onChange={e => setDeletePermanent(e.target.checked)} disabled={!timeWindowLockEnabled} /> Unlimited
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Admin</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Edit Window (Minutes)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={adminEditWindow} onChange={e => setAdminEditWindow(e.target.value)} disabled={adminEditPermanent || !timeWindowLockEnabled} className={inputCls} />
                    <label className="flex items-center gap-1 text-[9px] font-black uppercase text-purple-600 cursor-pointer select-none">
                      <input type="checkbox" checked={adminEditPermanent} onChange={e => setAdminEditPermanent(e.target.checked)} disabled={!timeWindowLockEnabled} /> Unlimited
                    </label>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Delete Window (Minutes)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={adminDeleteWindow} onChange={e => setAdminDeleteWindow(e.target.value)} disabled={adminDeletePermanent || !timeWindowLockEnabled} className={inputCls} />
                    <label className="flex items-center gap-1 text-[9px] font-black uppercase text-red-500 cursor-pointer select-none">
                      <input type="checkbox" checked={adminDeletePermanent} onChange={e => setAdminDeletePermanent(e.target.checked)} disabled={!timeWindowLockEnabled} /> Unlimited
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[9px] text-slate-400 font-medium pt-2 border-t border-slate-100 dark:border-slate-800">
              A Collection also locks immediately (regardless of the windows above) once its cash has been drawn on by a later deposit — protects denomination accuracy, not just time.
            </p>

            <label className="flex items-center justify-between gap-3 cursor-pointer select-none pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="block text-[10px] text-slate-700 dark:text-slate-200 uppercase font-black">Delegate Entity Editing Back To Tenant Admin</span>
                <span className="block text-[9px] text-slate-400 font-medium mt-0.5">
                  Off (default): only superadmin can edit this tenant's Retailer/Staff/Store records and retailer balances.
                </span>
              </div>
              <div
                onClick={() => setTenantAdminCanEdit(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${tenantAdminCanEdit ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${tenantAdminCanEdit ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
            </label>

            <button
              onClick={handleSaveControls}
              disabled={savingControls}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-60 cursor-pointer"
            >
              {savingControls ? "Saving..." : "Save Controls"}
            </button>
          </div>

          <FeatureFlagsPanel tenantId={selectedTenant.id} tenantName={selectedTenant.name} showToast={showToast} />

          <EntityManager tenantId={selectedTenant.id} tenantName={selectedTenant.name} showToast={showToast} />
        </div>
      )}
    </div>
  );
}

function TenantHealthPanel({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = () => {
    setLoading(true);
    superAdminApi.getTenantHealth(tenantId)
      .then(setHealth)
      .catch(err => console.error("Failed to load tenant health:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">{tenantName} — Health</h3>
        <button onClick={load} className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Refresh</button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-xs font-bold text-slate-400">Loading...</div>
      ) : !health ? (
        <div className="text-center py-4 text-xs font-bold text-slate-400">Couldn't load health data.</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className={`p-2.5 rounded-sm border text-center ${health.db_reachable ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'}`}>
              <span className={`block text-[9px] font-black uppercase tracking-wider ${health.db_reachable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>Database</span>
              <span className={`block text-xs font-black mt-0.5 ${health.db_reachable ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{health.db_reachable ? "Reachable" : "Unreachable"}</span>
            </div>
            <div className={`p-2.5 rounded-sm border text-center ${health.error_count_24h === 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30'}`}>
              <span className={`block text-[9px] font-black uppercase tracking-wider ${health.error_count_24h === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>Errors (24h)</span>
              <span className={`block text-xs font-black mt-0.5 ${health.error_count_24h === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{health.error_count_24h}</span>
            </div>
            <div className="p-2.5 rounded-sm border bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-center">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Errors (7d)</span>
              <span className="block text-xs font-black mt-0.5 text-slate-700 dark:text-slate-300">{health.error_count_7d}</span>
            </div>
          </div>

          {!health.db_reachable && health.db_error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20 rounded-sm text-[10px] font-mono text-red-600 dark:text-red-400 break-all">
              {health.db_error}
            </div>
          )}

          {health.recent_errors.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                {expanded ? "Hide" : "Show"} {health.recent_errors.length} recent error{health.recent_errors.length === 1 ? "" : "s"}
              </button>
              {expanded && (
                <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-sm overflow-hidden max-h-[240px] overflow-y-auto">
                  {health.recent_errors.map((e: any) => (
                    <div key={e.id} className="p-2.5 bg-slate-50/50 dark:bg-slate-950/20">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                        <span>{new Date(e.created_at).toLocaleString("en-IN", { hour12: false })}</span>
                        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-sm">{e.method} {e.path}</span>
                      </div>
                      <p className="text-[10px] font-mono text-red-600 dark:text-red-400 mt-1 break-all">{e.error_type}: {e.error_message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeatureFlagsPanel({ tenantId, tenantName, showToast }: { tenantId: string; tenantName: string; showToast: (m: string) => void }) {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    superAdminApi.getTenantFeatureFlags(tenantId)
      .then(res => setFlags(res.flags || []))
      .catch(err => console.error("Failed to load feature flags:", err))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const toggle = async (featureKey: string, current: boolean) => {
    setSavingKey(featureKey);
    const next = !current;
    try {
      await superAdminApi.setTenantFeatureFlag(tenantId, featureKey, next);
      setFlags(prev => prev.map(f => f.key === featureKey ? { ...f, enabled: next } : f));
      showToast(`${next ? "Enabled" : "Disabled"} for ${tenantName} — takes effect immediately.`);
    } catch (err: any) {
      alert("Failed to update flag: " + err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const grouped = flags.reduce((acc: Record<string, any[]>, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm p-5 space-y-4">
      <div>
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">{tenantName} — Feature Flags</h3>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Turn individual features on or off for this tenant. Changes apply immediately, no redeploy.</p>
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs font-bold text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{category}</span>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-sm overflow-hidden">
                {items.map((f: any) => (
                  <div key={f.key} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50/40 dark:bg-slate-950/20">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{f.label}</span>
                        {f.enforced === "ui" && (
                          <span className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-sm" title="No separate backend call exists to gate this -- enforced by hiding it in the UI only.">
                            UI-only
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-snug">{f.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(f.key, f.enabled)}
                      disabled={savingKey === f.key}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${f.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EntityManager({ tenantId, tenantName, showToast }: { tenantId: string; tenantName: string; showToast: (m: string) => void }) {
  const [subTab, setSubTab] = useState<"retailers" | "staff" | "stores">("retailers");
  const [retailers, setRetailers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [storeRetailerId, setStoreRetailerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const loadRetailers = async () => {
    setLoading(true);
    try { setRetailers(await superAdminApi.getTenantRetailers(tenantId)); } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const loadStaff = async () => {
    setLoading(true);
    try { setStaff(await superAdminApi.getTenantStaff(tenantId)); } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const loadStores = async (retailerId: string) => {
    if (!retailerId) { setStores([]); return; }
    setLoading(true);
    try { setStores(await superAdminApi.getTenantStores(tenantId, retailerId)); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    setEditingId(null);
    if (subTab === "retailers") loadRetailers();
    if (subTab === "staff") loadStaff();
    if (subTab === "stores") { setStores([]); setStoreRetailerId(""); if (retailers.length === 0) loadRetailers(); }
  }, [subTab, tenantId]);

  const startEdit = (row: any) => { setEditingId(row.id); setForm({ ...row, opening_to_give: 0, opening_to_take: 0 }); };
  const cancelEdit = () => { setEditingId(null); setForm({}); };

  const save = async () => {
    setSaving(true);
    try {
      if (subTab === "retailers") {
        const updated = await superAdminApi.updateTenantRetailer(tenantId, editingId!, {
          retailer_name: form.retailer_name, phone: form.phone, address: form.address,
          email: form.email, category: form.category,
          opening_to_give: parseFloat(form.opening_to_give) || 0,
          opening_to_take: parseFloat(form.opening_to_take) || 0,
        });
        setRetailers(prev => prev.map(r => r.id === editingId ? updated : r));
      } else if (subTab === "staff") {
        const updated = await superAdminApi.updateTenantStaff(tenantId, editingId!, {
          name: form.name, phone: form.phone, role: form.role,
          password: form.password || undefined,
        });
        setStaff(prev => prev.map(s => s.id === editingId ? updated : s));
      } else {
        const updated = await superAdminApi.updateTenantStore(tenantId, editingId!, {
          store_name: form.store_name, address: form.address, phone: form.phone,
        });
        setStores(prev => prev.map(s => s.id === editingId ? updated : s));
      }
      showToast("Saved.");
      cancelEdit();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = (key: typeof subTab, label: string) => (
    <button
      onClick={() => setSubTab(key)}
      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
        subTab === key ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">{tenantName} — Retailer / Staff / Store Editing</h3>
        <div className="flex items-center gap-1.5">
          {tabBtn("retailers", "Retailers")}
          {tabBtn("staff", "Staff")}
          {tabBtn("stores", "Stores")}
        </div>
      </div>

      {subTab === "stores" && (
        <select
          value={storeRetailerId}
          onChange={e => { setStoreRetailerId(e.target.value); loadStores(e.target.value); }}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-bold"
        >
          <option value="">Select a retailer to view its stores...</option>
          {retailers.map(r => <option key={r.id} value={r.id}>{r.retailer_name}</option>)}
        </select>
      )}

      {loading ? (
        <div className="text-center py-6 text-xs font-bold text-slate-400">Loading...</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[50vh] overflow-y-auto">
          {subTab === "retailers" && retailers.map(r => (
            <div key={r.id} className="py-2.5">
              {editingId === r.id ? (
                <div className="space-y-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Name" value={form.retailer_name || ""} onChange={e => setForm({ ...form, retailer_name: e.target.value })} className={inputCls} />
                    <input placeholder="Phone" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                  </div>
                  <input placeholder="Address" value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })} className={`${inputCls} w-full`} />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
                    <input placeholder="Category" value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Adjust To Give (₹, delta)</label>
                      <input type="number" value={form.opening_to_give} onChange={e => setForm({ ...form, opening_to_give: e.target.value })} className={`${inputCls} w-full mt-1`} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Adjust To Take (₹, delta)</label>
                      <input type="number" value={form.opening_to_take} onChange={e => setForm({ ...form, opening_to_take: e.target.value })} className={`${inputCls} w-full mt-1`} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={save} disabled={saving} className="flex-1 py-1.5 bg-blue-600 text-white rounded-sm text-[10px] font-black uppercase cursor-pointer disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
                    <button onClick={cancelEdit} className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-sm text-[10px] font-black uppercase cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{r.retailer_name}</span>
                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5">{r.phone} · Balance ₹{r.balance}</span>
                  </div>
                  <button onClick={() => startEdit(r)} className="px-2.5 py-1 text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-sm cursor-pointer">Edit</button>
                </div>
              )}
            </div>
          ))}

          {subTab === "staff" && staff.map(s => (
            <div key={s.id} className="py-2.5">
              {editingId === s.id ? (
                <div className="space-y-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Name" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
                    <input placeholder="Phone" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={form.role || "staff"} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input placeholder="New password (optional)" type="password" value={form.password || ""} onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={save} disabled={saving} className="flex-1 py-1.5 bg-blue-600 text-white rounded-sm text-[10px] font-black uppercase cursor-pointer disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
                    <button onClick={cancelEdit} className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-sm text-[10px] font-black uppercase cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{s.name}</span>
                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5">{s.phone} · {s.role}</span>
                  </div>
                  <button onClick={() => startEdit(s)} className="px-2.5 py-1 text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-sm cursor-pointer">Edit</button>
                </div>
              )}
            </div>
          ))}

          {subTab === "stores" && stores.map(st => (
            <div key={st.id} className="py-2.5">
              {editingId === st.id ? (
                <div className="space-y-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-sm">
                  <input placeholder="Store name" value={form.store_name || ""} onChange={e => setForm({ ...form, store_name: e.target.value })} className={`${inputCls} w-full`} />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Address" value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} />
                    <input placeholder="Phone" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={save} disabled={saving} className="flex-1 py-1.5 bg-blue-600 text-white rounded-sm text-[10px] font-black uppercase cursor-pointer disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
                    <button onClick={cancelEdit} className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-sm text-[10px] font-black uppercase cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{st.store_name}</span>
                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5">{st.phone || "--"}</span>
                  </div>
                  <button onClick={() => startEdit(st)} className="px-2.5 py-1 text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-sm cursor-pointer">Edit</button>
                </div>
              )}
            </div>
          ))}

          {((subTab === "retailers" && retailers.length === 0) || (subTab === "staff" && staff.length === 0) || (subTab === "stores" && storeRetailerId && stores.length === 0)) && (
            <div className="text-center py-6 text-xs font-bold text-slate-400">No records found.</div>
          )}
        </div>
      )}
    </div>
  );
}
