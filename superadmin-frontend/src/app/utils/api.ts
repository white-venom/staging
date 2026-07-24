// Shared error-message extraction lives in ./errors.ts (same utility shape
// used by the main tenant-facing app) so both apps read FastAPI error bodies
// the same way instead of maintaining two ad hoc copies.
import { extractErrorMessage } from "./errors";

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    // Check if we are running in local dev
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.endsWith(".localhost")) {
      return "http://127.0.0.1:8000";
    }
  }
  return "https://api.crediiflow.in"; // Default production URL
};

export const API_BASE_URL = getApiBaseUrl();

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("superadmin_token") : null;
  const baseUrl = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(extractErrorMessage(errorData) || response.statusText);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

export const superAdminApi = {
  login: (data: any) => request<any>("/superadmin/login", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  getProfile: () => request<any>("/superadmin/profile"),
  updateProfile: (data: { name?: string; email?: string; phone?: string }) => request<any>("/superadmin/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  forgotPassword: (email: string) => request<any>("/superadmin/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  }),
  resetPassword: (data: { email: string; otp: string; new_password: string }) => request<any>("/superadmin/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  getTenants: () => request<any[]>("/superadmin/tenants"),
  getTenantStats: (tenantId: string) => request<any>(`/superadmin/tenants/${tenantId}/stats`),
  getTenantHealth: (tenantId: string) => request<any>(`/superadmin/tenants/${tenantId}/health`),
  createTenant: (data: any) => request<any>("/superadmin/tenants", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  toggleMaintenance: (tenantId: string, enabled: boolean) => request<any>(`/superadmin/tenants/${tenantId}/maintenance`, {
    method: "POST",
    body: JSON.stringify({ maintenance_mode: enabled }),
  }),
  editTenant: (tenantId: string, data: any) => request<any>(`/superadmin/tenants/${tenantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  deleteTenant: (tenantId: string) => request<any>(`/superadmin/tenants/${tenantId}`, {
    method: "DELETE",
  }),
  impersonateTenant: (tenantId: string) => request<any>(`/superadmin/tenants/${tenantId}/impersonate`, {
    method: "POST",
  }),
  getPlatformPulse: () => request<any>("/superadmin/platform/pulse"),
  getInfraStatus: () => request<any>("/superadmin/infra/status"),
  getInfraServices: () => request<any>("/superadmin/infra/services"),
  getSSLStatus: () => request<any>("/superadmin/ssl/status"),
  renewSSL: () => request<any>("/superadmin/ssl/renew", {
    method: "POST",
  }),
  provisionSSL: (subdomain: string) => request<any>(`/superadmin/ssl/provision/${subdomain}`, {
    method: "POST",
  }),

  // Per-tenant controls (items #2, #3, #4)
  updateTenantControls: (tenantId: string, data: any) => request<any>(`/superadmin/tenants/${tenantId}/controls`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),

  // Tenant entity management (items #3, #4)
  getTenantRetailers: (tenantId: string) => request<any[]>(`/superadmin/tenants/${tenantId}/retailers`),
  updateTenantRetailer: (tenantId: string, retailerId: string, data: any) => request<any>(`/superadmin/tenants/${tenantId}/retailers/${retailerId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  getTenantStaff: (tenantId: string) => request<any[]>(`/superadmin/tenants/${tenantId}/staff`),
  updateTenantStaff: (tenantId: string, userId: string, data: any) => request<any>(`/superadmin/tenants/${tenantId}/staff/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  getTenantStores: (tenantId: string, retailerId: string) => request<any[]>(`/superadmin/tenants/${tenantId}/retailers/${retailerId}/stores`),
  updateTenantStore: (tenantId: string, storeId: string, data: any) => request<any>(`/superadmin/tenants/${tenantId}/stores/${storeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),

  // Audit log (item #6)
  searchAuditLog: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/superadmin/audit-log${qs ? `?${qs}` : ""}`);
  },
  getAuditLogActions: () => request<any>("/superadmin/audit-log/actions"),

  // Feature flags (Part 1)
  getFeatureRegistry: () => request<any>("/superadmin/feature-flags/registry"),
  getTenantFeatureFlags: (tenantId: string) => request<any>(`/superadmin/feature-flags/tenants/${tenantId}`),
  setTenantFeatureFlag: (tenantId: string, featureKey: string, enabled: boolean) =>
    request<any>(`/superadmin/feature-flags/tenants/${tenantId}/${featureKey}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
};

