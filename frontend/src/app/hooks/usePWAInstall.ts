"use client";

import { useState, useEffect } from "react";

declare global {
  interface Window {
    deferredPrompt?: any;
  }
}

export function usePWAInstall() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already installed (running in standalone PWA mode)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS Safari
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIOS(ios);

    // On iOS, app is always "installable" via the Add to Home Screen flow
    if (ios && !standalone) {
      setInstallable(true);
    }

    // Listen for the deferred install prompt (Android/Chrome/Edge)
    const handlePromptAvailable = () => {
      setInstallable(true);
    };

    window.addEventListener("pwa-prompt-available", handlePromptAvailable);

    // Check if prompt is already stored from a previous event
    if (window.deferredPrompt) {
      setInstallable(true);
    }

    return () => {
      window.removeEventListener("pwa-prompt-available", handlePromptAvailable);
    };
  }, []);

  const triggerInstall = async (): Promise<"show-ios-modal" | "prompted" | "dismissed"> => {
    if (isIOS) {
      return "show-ios-modal";
    }

    const prompt = window.deferredPrompt;
    if (!prompt) return "dismissed";

    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.deferredPrompt = undefined;
    setInstallable(false);

    return outcome === "accepted" ? "prompted" : "dismissed";
  };

  return { isStandalone, isIOS, installable, triggerInstall };
}
