"use client";

import React, { useState, useEffect } from "react";
import { superAdminApi } from "../utils/api";

interface Tenant { id: string; name: string; }

interface Props { tenants: Tenant[]; }

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Asia/Kolkata",
    });
  } catch { return iso; }
};

const actionColor = (action: string) => {
  if (action === "login") return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
  if (action.endsWith(".delete")) return "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400";
  if (action.endsWith(".update")) return "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400";
  if (action.endsWith(".create") || action === "staff_handover") return "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400";
  return "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400";
};

export default function AuditLogPanel({ tenants }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  const [q, setQ] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [actorType, setActorType] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const pageSize = 50;

  const load = async (targetPage = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(targetPage), page_size: String(pageSize) };
      if (q) params.q = q;
      if (tenantId) params.tenant_id = tenantId;
      if (actorType) params.actor_type = actorType;
      if (action) params.action = action;
      if (entityType) params.entity_type = entityType;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await superAdminApi.searchAuditLog(params);
      setItems(res.items);
      setTotal(res.total);
      setPage(targetPage);
    } catch (err) {
      console.error("Failed to load audit log:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    superAdminApi.getAuditLogActions().then(res => {
      setActions(res.actions || []);
      setEntityTypes(res.entity_types || []);
    }).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <input
            placeholder="Search actor / description..."
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(1)}
            className="lg:col-span-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold focus:outline-none"
          />
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold">
            <option value="">All Tenants</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={actorType} onChange={e => setActorType(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold">
            <option value="">All Actor Types</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <select value={action} onChange={e => setAction(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold">
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={entityType} onChange={e => setEntityType(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold">
            <option value="">All Entity Types</option>
            {entityTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[9px] font-black uppercase text-slate-400">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold" />
          <label className="text-[9px] font-black uppercase text-slate-400">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm text-xs font-semibold" />
          <button onClick={() => load(1)} className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-[10px] font-black uppercase tracking-wider cursor-pointer">
            Apply Filters
          </button>
          <button
            onClick={() => { setQ(""); setTenantId(""); setActorType(""); setAction(""); setEntityType(""); setDateFrom(""); setDateTo(""); load(1); }}
            className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-sm text-[10px] font-black uppercase tracking-wider cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">{total} Events</h3>
          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
            <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-2 py-1 disabled:opacity-30 cursor-pointer">← Prev</button>
            Page {page} / {totalPages}
            <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="px-2 py-1 disabled:opacity-30 cursor-pointer">Next →</button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-10 text-xs font-bold text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-xs font-bold text-slate-400">No matching audit events.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[65vh] overflow-y-auto">
            {items.map(ev => (
              <div key={ev.id}>
                <div
                  onClick={() => setExpandedId(prev => prev === ev.id ? null : ev.id)}
                  className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <span className="text-[9px] font-mono text-slate-400 shrink-0 w-32">{fmtTime(ev.created_at)}</span>
                  <span className={`px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-wider shrink-0 ${actionColor(ev.action)}`}>{ev.action}</span>
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 shrink-0 w-28 truncate">{ev.tenant_name || "—"}</span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 w-32 truncate">{ev.actor_name || "system"} ({ev.actor_type})</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">{ev.description}</span>
                  {ev.amount != null && <span className="text-xs font-black font-mono text-slate-800 dark:text-white shrink-0">₹{ev.amount}</span>}
                </div>
                {expandedId === ev.id && (ev.before_values || ev.after_values) && (
                  <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/60 dark:bg-slate-950/40">
                    {ev.before_values && (
                      <div>
                        <span className="text-[9px] font-black uppercase text-red-500">Before</span>
                        <pre className="text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-2 mt-1 overflow-x-auto">{JSON.stringify(ev.before_values, null, 2)}</pre>
                      </div>
                    )}
                    {ev.after_values && (
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-600">After</span>
                        <pre className="text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-2 mt-1 overflow-x-auto">{JSON.stringify(ev.after_values, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
