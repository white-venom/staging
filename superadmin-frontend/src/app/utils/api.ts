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

// FastAPI error bodies come in two shapes: `detail` is a plain string for
// HTTPException, but a list of {msg, loc} objects for Pydantic validation
// (422) errors. Rendering the list directly (or passing it to `new Error()`)
// stringifies it to "[object Object]" -- this always resolves to readable text.
function extractErrorMessage(errorData: any): string {
  const detail = errorData?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e: any) => {
        const field = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : null;
        return field ? `${field}: ${e.msg}` : e?.msg;
      })
      .filter(Boolean)
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "";
}

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
  getTenants: () => request<any[]>("/superadmin/tenants"),
  getTenantStats: (tenantId: string) => request<any>(`/superadmin/tenants/${tenantId}/stats`),
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
  getInfraStatus: () => request<any>("/superadmin/infra/status"),
  getInfraServices: () => request<any>("/superadmin/infra/services"),
  getSSLStatus: () => request<any>("/superadmin/ssl/status"),
  renewSSL: () => request<any>("/superadmin/ssl/renew", {
    method: "POST",
  }),
};
