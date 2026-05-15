"use client";

import { useState, useEffect } from "react";

export function useDevice() {
  const [device, setDevice] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 0,
  });

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const w = window.innerWidth;
      setDevice({
        isMobile: w < 1024, // Setting a higher threshold temporarily to see if it triggers
        isTablet: w >= 1024 && w < 1280,
        isDesktop: w >= 1280,
        width: w,
      });
      console.log(`[useDevice] Width: ${w}, isMobile: ${w < 1024}`);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return device;
}
