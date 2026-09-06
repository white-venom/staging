"use client";

import React, { useEffect, useState } from "react";
import { useAppStore, getStorageKey } from "../utils/store";
import { API_BASE_URL } from "../utils/api";

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const currentUser = useAppStore((state) => state.currentUser);
  const [isMaintenance, setIsMaintenance] = useState<boolean | null>(null);
  const [isTenantNotFound, setIsTenantNotFound] = useState<boolean>(false);
  const [tenantName, setTenantName] = useState<string>("CrediiFlow");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkMaintenance() {
      try {
        let tenantId: string | null = null;
        if (typeof window !== "undefined") {
          // Check query parameter or session storage bypass
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get("bypass") === "true") {
            sessionStorage.setItem("maintenance_bypass", "true");
          }

          if (sessionStorage.getItem("maintenance_bypass") === "true") {
            setIsMaintenance(false);
            setLoading(false);
            return;
          }

          const host = window.location.hostname;
          const parts = host.split(".");
          if (parts.length >= 3 || (host.endsWith("localhost") && parts.length >= 2)) {
            tenantId = parts[0];
            if (tenantId === "www" || tenantId === "superadmin" || tenantId === "api") {
              tenantId = null;
            }
          }
        }

        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (tenantId) {
          headers["X-Tenant-ID"] = tenantId;
        }

        // Use a 5-second timeout so the app doesn't hang after a laptop restart
        // when the network/server is still reconnecting
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let res: Response;
        try {
          res = await fetch(`${API_BASE_URL}/tenant/info`, { headers, signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }
        if (res.ok) {
          const data = await res.json();
          if (data.status !== "active") {
            setIsTenantNotFound(true);
            if (typeof window !== "undefined") {
              localStorage.removeItem(getStorageKey());
            }
            return;
          }
          setIsMaintenance(data.maintenance_mode);
          // Show the subdomain (e.g. "suji"), not the tenant's stored
          // display name -- that field holds the owner/company name
          // (e.g. "Jafer Khan"), not something meant to identify the site.
          if (data.subdomain) {
            setTenantName(data.subdomain);
          }
        } else {
          if (res.status === 404) {
            setIsTenantNotFound(true);
            if (typeof window !== "undefined") {
              localStorage.removeItem(getStorageKey());
            }
            return;
          }
          setIsMaintenance(false);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          // Timed out — network not yet available (e.g., just after laptop restart)
          // Safe to proceed: show the app normally, maintenance check will re-run on next load
          console.warn("Maintenance check timed out (network may be slow). Proceeding normally.");
        } else {
          console.error("Failed to check maintenance mode:", err);
        }
        setIsMaintenance(false);
      } finally {
        setLoading(false);
      }
    }

    checkMaintenance();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-slate-700 dark:border-t-slate-300 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isTenantNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 select-none">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-4 px-6 py-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="w-14 h-14 bg-red-600 rounded-sm flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-3">
            <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase">
              Bank Account Inactive
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              This organization bank account link is no longer active. The subdomain may have been changed, suspended, or deleted.
            </p>
            <p className="text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-widest mt-3">
              Please contact your administrator for the new login link.
            </p>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />

          {/* Superadmin link */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Are you a Super Admin?{" "}
            <a href="https://superadmin.crediiflow.in" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold transition-colors">
              Access Console Here
            </a>
          </div>
        </div>
      </div>
    );
  }

  // If maintenance is enabled and the user is NOT an admin, show maintenance screen
  if (isMaintenance && currentUser?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 select-none">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-4 px-6 py-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="w-14 h-14 bg-slate-800 dark:bg-slate-700 rounded-sm flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white animate-spin"
              style={{ animationDuration: "12s" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>

          <div className="space-y-3">
            <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase">
              Under Maintenance
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              {tenantName} is currently undergoing scheduled system upgrades. We are optimizing our services to bring you a better experience.
            </p>
            <p className="text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-widest mt-3">
              We regret the inconvenience caused.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
