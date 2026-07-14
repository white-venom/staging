"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "../utils/store";

export default function WelcomePage() {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!currentUser) {
      router.push("/");
      return;
    }

    const timer = setTimeout(() => {
      router.push(currentUser.role === "admin" ? "/admin" : "/staff");
    }, 900);

    return () => clearTimeout(timer);
  }, [currentUser, router]);

  if (!mounted || !currentUser) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 select-none">
      <div className="w-full max-w-xs text-center space-y-6">
        <img src="/logo.png" alt="Logo" className="h-12 w-auto object-contain mx-auto" />

        <h1 className="text-xl font-black text-white tracking-tight">
          Welcome, {currentUser.name.split("(")[0].trim()}
        </h1>

        <div className="h-1 w-full max-w-[200px] mx-auto bg-white/10 rounded-sm overflow-hidden">
          <div className="h-full bg-emerald-500 w-full" />
        </div>
      </div>
    </div>
  );
}
