"use client";

import { useEffect } from "react";
import { useAppStore } from "../utils/store";

export default function PWARegister() {
  // Enforce standard Light Mode and remove any dark mode residue on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("CrediiFlow: Service Worker registered successfully! Scope: ", reg.scope);
        })
        .catch((err) => {
          console.error("CrediiFlow: Service Worker registration failed: ", err);
        });
    }
  }, []);

  return null;
}
