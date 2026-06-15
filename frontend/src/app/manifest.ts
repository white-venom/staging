import type { MetadataRoute } from "next";

const API_BASE = "https://api.crediiflow.in";

async function getTenantName(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/tenant/info`, {
      headers: { "X-Tenant-ID": "do-it" },
      next: { revalidate: 3600 }, // re-fetch every 1 hour
    });
    if (!res.ok) return "CrediiFlow";
    const data = await res.json();
    return data.name || "CrediiFlow";
  } catch {
    return "CrediiFlow";
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenantName = await getTenantName();

  return {
    name: tenantName,
    short_name: tenantName,
    description: `${tenantName} – Field operations, cash ledger & staff tracking platform.`,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfdfd",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/pwa-icon.ico",
        sizes: "any",
        type: "image/x-icon",
        // @ts-ignore — purpose is valid for PWA manifest
        purpose: "any maskable",
      },
    ],
  };
}
