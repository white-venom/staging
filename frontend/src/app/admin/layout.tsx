"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";
import { AdminProvider } from "./context/AdminContext";
import AdminDesktopLayout from "./components/layout/AdminDesktopLayout";
import AdminMobileLayout from "./components/layout/AdminMobileLayout";
import { useDevice } from "../hooks/useDevice";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const { isMobile } = useDevice();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!currentUser || currentUser.role !== "admin")) {
      router.push("/");
    }
  }, [currentUser, router, mounted]);

  // Prevent flash of content during hydration
  if (!mounted || !currentUser) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
       <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (isMobile) {
    return <AdminMobileLayout>{children}</AdminMobileLayout>;
  }

  return <AdminDesktopLayout>{children}</AdminDesktopLayout>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminProvider>
  );
}
