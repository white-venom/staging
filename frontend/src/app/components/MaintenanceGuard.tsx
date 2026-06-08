"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "../utils/store";
import { API_BASE_URL } from "../utils/api";

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const currentUser = useAppStore((state) => state.currentUser);
  const [isMaintenance, setIsMaintenance] = useState<boolean | null>(null);
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

        const res = await fetch(`${API_BASE_URL}/tenant/info`, { headers });
        if (res.ok) {
          const data = await res.json();
          setIsMaintenance(data.maintenance_mode);
          if (data.name) {
            setTenantName(data.name);
          }
        } else {
          setIsMaintenance(false);
        }
      } catch (err) {
        console.error("Failed to check maintenance mode:", err);
        setIsMaintenance(false);
      } finally {
        setLoading(false);
      }
    }

    checkMaintenance();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // If maintenance is enabled and the user is NOT an admin, show maintenance screen
  if (isMaintenance && currentUser?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden select-none font-sans text-slate-800">
        {/* Ambient Blur Spheres */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[70%] h-[70%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-lg relative z-10 flex flex-col items-center text-center gap-8 px-6 py-12 bg-white/85 backdrop-blur-xl border border-slate-200/80 rounded-[2.5rem] shadow-[0_40px_120px_-20px_rgba(15,23,42,0.08)]">
          {/* Maintenance Icon Area */}
          <div className="relative w-24 h-24 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/25">
            <svg
              className="w-12 h-12 text-white animate-spin"
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

          <div className="space-y-4">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent uppercase">
              Under Maintenance
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed max-w-md">
              {tenantName} is currently undergoing scheduled system upgrades. We are optimizing our services to bring you a better experience.
            </p>
            <p className="text-indigo-600 font-bold text-xs uppercase tracking-widest mt-4">
              We regret the inconvenience caused.
            </p>
          </div>

          <div className="w-full h-[1px] bg-slate-200/60 my-2" />

          {/* Subtle bypass mechanism */}
          <div className="text-xs text-slate-500">
            Are you a system administrator?{" "}
            <a href="/?bypass=true" className="text-indigo-650 hover:text-indigo-700 hover:underline font-semibold transition-colors duration-150">
              Sign In Here
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
