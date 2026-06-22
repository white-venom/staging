import { useAppStore } from "./store";

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  if (typeof window !== "undefined") {
    // Production VPS domains
    if (window.location.hostname.endsWith("crediiflow.in")) {
      return "https://api.crediiflow.in";
    }
    
    // Legacy Vercel/Render fallback
    if (window.location.hostname === "do-it-services.vercel.app" || 
        window.location.hostname.includes("vercel.app")) {
      return "https://doit-backend-9yel.onrender.com";
    }
    
    // Local dev
    if (window.location.port === "3000" || window.location.port === "5173" || 
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || 
        /^192\.168\./.test(window.location.hostname) || window.location.hostname.endsWith(".local")) {
       return "http://127.0.0.1:8000";
    }
  }
  return "https://api.crediiflow.in";
};

export const API_BASE_URL = getApiBaseUrl();

let refreshPromise: Promise<string | null> | null = null;

// Attempt to refresh the access token using the HttpOnly refresh cookie
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include", // sends the HttpOnly refresh cookie
      });
      if (!response.ok) return null;
      const data = await response.json();
      const newToken: string = data.access_token;
      // Update the stored token in Zustand
      const store = useAppStore.getState();
      if (store.currentUser) {
        store.setCurrentUser({ ...store.currentUser, token: newToken });
      }
      return newToken;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = useAppStore.getState().currentUser?.token;
  
  // Extract tenant subdomain from window location hostname
  let tenantId: string | null = null;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length >= 3 || (host.endsWith("localhost") && parts.length >= 2)) {
      tenantId = parts[0];
      if (tenantId === "www" || tenantId === "superadmin" || tenantId === "api") {
        tenantId = null;
      }
    }
  }

  // Bulletproof URL joining to prevent double slashes
  const baseUrl = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${path}`;
  
  console.log(`[API] Requesting: ${fullUrl} (Tenant: ${tenantId})`);
  
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
    ...options.headers,
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include", // ensure cookies are sent for refresh
  });

  const isAuthEndpoint = endpoint.includes("/auth/login") || endpoint.includes("/auth/refresh");

  // Auto-refresh on 401 and retry once (but not for login/refresh itself)
  if (response.status === 401 && retry && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry with fresh token
      return request<T>(endpoint, options, false);
    } else {
      // Refresh failed — force logout
      const store = useAppStore.getState();
      if (store.currentUser) {
        // Only run logout/redirect logic once for the first failing request
        store.resetStore();
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("doit-services-storage");
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.state) {
                parsed.state.currentUser = null;
                parsed.state.collections = [];
                parsed.state.deposits = [];
                parsed.state.attendance = { isCheckedIn: false, startKm: 0 };
                localStorage.setItem("doit-services-storage", JSON.stringify(parsed));
              }
            } else {
              localStorage.removeItem("doit-services-storage");
            }
          } catch (e) {
            localStorage.removeItem("doit-services-storage");
          }
          window.location.href = "/";
        }
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
      const detail = typeof errorData.detail === "object" ? JSON.stringify(errorData.detail) : errorData.detail;
      
      // Auto-logout if tenant is suspended or deleted
      if ((response.status === 404 || response.status === 400) && detail && (detail.toLowerCase().includes("tenant") || detail.toLowerCase().includes("not found") || detail.toLowerCase().includes("not active"))) {
        const store = useAppStore.getState();
        if (store.currentUser) {
          store.resetStore();
          if (typeof window !== "undefined") {
            localStorage.removeItem("doit-services-storage");
            window.location.href = "/";
          }
        }
      }
      
      throw new Error(detail || response.statusText);
    } else {
      const text = await response.text();
      console.error(`Non-JSON error from ${endpoint}:`, text.substring(0, 200));
      throw new Error(`Server returned ${response.status} ${response.statusText}`);
    }
  }

  if (response.status === 204) return {} as T;

  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`JSON Parse Error for ${endpoint}. Body starts with:`, text.substring(0, 200));
    throw new Error(`Malformed JSON response from ${endpoint}`);
  }
}

export const api = {
  // Collections
  getCollections: () => request<any[]>("/collections"),
  createCollection: (data: any) => request<any>("/collections", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  verifyCollection: (id: string) => request<any>(`/collections/${id}/verify`, {
    method: "PUT",
  }),
  deleteCollection: (id: string) => request<any>(`/collections/${id}`, {
    method: "DELETE",
  }),
  updateCollection: (id: string, data: any) => request<any>(`/collections/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),

  // Deposits
  getDeposits: () => request<any[]>("/bank-deposits"),
  createDeposit: (data: any) => request<any>("/bank-deposits", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  verifyDeposit: (id: string) => request<any>(`/bank-deposits/${id}/verify`, {
    method: "PUT",
  }),
  deleteDeposit: (id: string) => request<any>(`/bank-deposits/${id}`, {
    method: "DELETE",
  }),
  updateDeposit: (id: string, data: any) => request<any>(`/bank-deposits/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),

  // Retailers
  getRetailers: () => request<any[]>("/retailers"),
  getRetailerStores: (retailerId: string) => request<any[]>(`/retailers/${retailerId}/stores`),
  createRetailer: (data: any) => request<any>("/retailers", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateRetailer: (id: string, data: any) => request<any>(`/retailers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  deleteRetailer: (id: string) => request<any>(`/retailers/${id}`, {
    method: "DELETE",
  }),
  createStore: (retailerId: string, data: any) => request<any>(`/retailers/${retailerId}/stores`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateStore: (retailerId: string, storeId: string, data: any) => request<any>(`/retailers/${retailerId}/stores/${storeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  deleteStore: (retailerId: string, storeId: string) => request<any>(`/retailers/${retailerId}/stores/${storeId}`, {
    method: "DELETE",
  }),
  
  // Portals
  getPortalGroups: () => request<any[]>("/portals/groups"),
  createPortalGroup: (data: any) => request<any>("/portals/groups", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updatePortalGroup: (id: string, data: any) => request<any>(`/portals/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  deletePortalGroup: (id: string) => request<any>(`/portals/groups/${id}`, {
    method: "DELETE",
  }),
  getPortals: () => request<any[]>("/portals"),
  getGroupAccounts: (groupId: string) => request<any[]>(`/portals/groups/${groupId}/accounts`),
  createPortal: (data: any) => request<any>("/portals", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updatePortal: (id: string, data: any) => request<any>(`/portals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  deletePortal: (id: string) => request<any>(`/portals/${id}`, {
    method: "DELETE",
  }),

  // Users
  getUsers: () => request<any[]>("/users"),                          // admin-only
  getStaffList: () => request<any[]>("/users/staff-list"),           // any authenticated user
  createUser: (data: any) => request<any>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateUser: (id: string, data: any) => request<any>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  deleteUser: (id: string) => request<any>(`/users/${id}`, {
    method: "DELETE",
  }),

  // Admin Settings & Penalties
  getAdminSettings: () => request<any>("/admin-settings/business"),
  updateAdminSettings: (data: any) => request<any>("/admin-settings/business", {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  getPendingPenalties: () => request<any[]>("/admin-settings/pending-penalties"),
  approvePenalty: (attendanceId: string, approve: boolean) => request<any>("/admin-settings/approve-penalty", {
    method: "POST",
    body: JSON.stringify({ attendance_id: attendanceId, approve }),
  }),
  virtualTransfer: (data: { portal_id: string; retailer_id?: string; staff_id?: string; amount: number; remarks?: string; direction?: string }) => request<any>("/admin-settings/virtual-transfer", {
    method: "POST",
    body: JSON.stringify(data),
  }),


  // Attendance
  getMyAttendanceStatus: () => request<any>("/attendance/my-status"),
  getTodayAttendance: () => request<any[]>("/attendance/today"),
  checkIn: (startKm: number, image?: string, latitude?: number, longitude?: number) => request<any>("/attendance/check-in", {
    method: "POST",
    body: JSON.stringify({ start_km: startKm, image, latitude, longitude }),
  }),
  checkOut: (endKm: number, image?: string, latitude?: number, longitude?: number) => request<any>("/attendance/check-out", {
    method: "POST",
    body: JSON.stringify({ end_km: endKm, image, latitude, longitude }),
  }),

  // Auth
  login: (data: any) => request<any>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  logout: () => request<any>("/auth/logout", {
    method: "POST",
  }),
  getPublicLedger: (token: string) => request<any>(`/public/ledger/${token}`),
  getPortalLedger: (portalId: string) => request<any>(`/portals/${portalId}/ledger`),
  getPortalGroupLedger: (groupId: string) => request<any>(`/portals/groups/${groupId}/ledger`),
  getStaffLedger: (staffId: string) => request<any>(`/staff/${staffId}/ledger`),
  getStaffDailySummary: (date: string, staffId?: string) => request<any>(`/staff/daily-summary?selected_date=${date}${staffId ? `&staff_id=${staffId}` : ''}`),
};

