import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "staff";
  token?: string;
}

export interface DenominationCounts {
  note_500: number;
  note_200: number;
  note_100: number;
  note_50: number;
  note_20: number;
  note_10: number;
  coins: number;
  online_amount: number;
  online_bank_account_id?: string;
}

export interface AttendanceState {
  isCheckedIn: boolean;
  startKm: number;
  endKm?: number;
  checkInTime?: string;
}

export interface CollectionItem {
  id: string;
  retailer_id: string;
  store_id?: string;
  store_name?: string;
  retailerName: string;
  bankAccountName: string;
  portalName?: string;
  staffName?: string;
  totalAmount: number;
  denominations: DenominationCounts;
  status: "pending" | "verified";
  remarks?: string;
  date: string;
  retailer_ledger_token?: string;
  created_at?: string;
}

export interface DepositItem {
  id: string;
  bank_account_id?: string;
  retailer_id?: string;
  recipient_staff_id?: string;
  depositType: "portal" | "retailer" | "staff" | "staff_person" | "virtual";
  targetName: string; // Bank account name, retailer name, or staff recipient name
  amount: number;
  paymentMode: "cash" | "online";
  denominations?: DenominationCounts;
  status: "pending" | "verified";
  remarks?: string;
  bankAccountName?: string;
  bankName?: string;
  date: string;
  retailer_ledger_token?: string;
  created_at?: string;
}

interface AppStore {
  currentUser: UserSession | null;
  attendance: AttendanceState;
  collections: CollectionItem[];
  deposits: DepositItem[];
  theme: "light" | "dark";
  setCurrentUser: (user: UserSession | null) => void;
  checkIn: (startKm: number) => void;
  checkOut: (endKm: number) => void;
  restoreAttendance: (attendance: AttendanceState) => void;
  addCollection: (col: Omit<CollectionItem, "id" | "date" | "status" | "created_at">) => void;
  setCollections: (cols: CollectionItem[]) => void;
  verifyCollection: (id: string) => void;
  editCollection: (id: string, amount: number, remarks: string) => void;
  addDeposit: (dep: Omit<DepositItem, "id" | "date" | "status" | "created_at">) => void;
  setDeposits: (deps: DepositItem[]) => void;
  verifyDeposit: (id: string) => void;
  toggleTheme: () => void;
  resetStore: () => void;
}

export const getStorageKey = (): string => {
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const host = window.location.hostname;
    return `crediiflow-storage-${host.replace(/[^a-zA-Z0-9-]/g, "_")}`;
  }
  return "crediiflow-storage";
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      currentUser: null,
      attendance: {
        isCheckedIn: false,
        startKm: 0,
      },
      collections: [],
      deposits: [],
      theme: "light",

      setCurrentUser: (user) => set({ currentUser: user }),
      checkIn: (startKm) => set({
        attendance: {
          isCheckedIn: true,
          startKm,
          checkInTime: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
        }
      }),
      checkOut: (endKm) => set((state) => ({
        attendance: {
          ...state.attendance,
          isCheckedIn: false,
          endKm,
        }
      })),
      restoreAttendance: (attendance) => set({ attendance }),
      addCollection: (col) => set((state) => ({
        collections: [
          {
            ...col,
            id: `col-${Date.now()}`,
            status: "pending",
            date: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
            created_at: new Date().toISOString(),
          },
          ...state.collections,
        ]
      })),
      setCollections: (cols) => set({ collections: cols }),
      verifyCollection: (id) => set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? { ...c, status: "verified" } : c
        )
      })),
      editCollection: (id, amount, remarks) => set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? { ...c, totalAmount: amount, remarks } : c
        )
      })),
      addDeposit: (dep) => set((state) => ({
        deposits: [
          {
            ...dep,
            id: `dep-${Date.now()}`,
            status: "pending",
            date: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).substring(0, 16),
            created_at: new Date().toISOString(),
          },
          ...state.deposits,
        ]
      })),
      setDeposits: (deps) => set({ deposits: deps }),
      verifyDeposit: (id) => set((state) => ({
        deposits: state.deposits.map((d) =>
          d.id === id ? { ...d, status: "verified" } : d
        )
      })),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      resetStore: () => set({
        currentUser: null,
        attendance: { isCheckedIn: false, startKm: 0 },
        collections: [],
        deposits: [],
      })
    }),
    {
      name: getStorageKey(),
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ...state,
        // Exclude JWT access token from localStorage for XSS mitigation (BUG-020)
        currentUser: state.currentUser ? {
          id: state.currentUser.id,
          name: state.currentUser.name,
          phone: state.currentUser.phone,
          role: state.currentUser.role,
        } : null,
      }),
    }
  )
);

// Cross-tab synchronization listener
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === getStorageKey()) {
      useAppStore.persist.rehydrate();
    }
  });
}
