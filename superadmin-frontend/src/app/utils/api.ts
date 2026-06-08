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
    throw new Error(errorData.detail || response.statusText);
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
  createTenant: (data: any) => request<any>("/superadmin/tenants", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  toggleMaintenance: (tenantId: string, enabled: boolean) => request<any>(`/superadmin/tenants/${tenantId}/maintenance`, {
    method: "POST",
    body: JSON.stringify({ maintenance_mode: enabled }),
  }),
};
