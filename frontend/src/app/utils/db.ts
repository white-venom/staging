import Dexie, { type Table } from "dexie";
import { DenominationCounts } from "./store";

export interface OfflineCollection {
  id?: number;
  retailer_id: string;
  store_id?: string;
  portal_id?: string;
  retailerName: string;
  portalName: string;
  portalGroupName?: string;
  totalAmount: number;
  denominations: DenominationCounts;
  remarks?: string;
  date: string;
  synced: number; // 0 = unsynced, 1 = synced
}

export interface OfflineDeposit {
  id?: number;
  portal_id?: string;
  retailer_id?: string;
  recipient_staff_id?: string;
  depositType: "portal" | "retailer" | "staff" | "virtual";
  targetName: string;
  amount: number;
  paymentMode: "cash" | "online";
  denominations?: DenominationCounts;
  remarks?: string;
  portalName?: string;
  bankName?: string;
  date: string;
  synced: number; // 0 = unsynced, 1 = synced
}

export interface CachedRetailer {
  id: string;
  name: string;
  phone: string;
  portalName: string;
  opening_to_give?: number;
  opening_to_take?: number;
  net_balance?: number;
}

class OfflineDatabase extends Dexie {
  collections!: Table<OfflineCollection>;
  deposits!: Table<OfflineDeposit>;
  retailers!: Table<CachedRetailer>;

  constructor() {
    super("DoItServicesOfflineDB");
    this.version(1).stores({
      collections: "++id, synced, date",
      deposits: "++id, synced, date",
      retailers: "id, name, portalName"
    });
  }
}

export const db = new OfflineDatabase();

// No longer seeding mock retailers as we now have a backend with real UUIDs.
export async function seedOfflineRetailers() {
  // Empty implementation to avoid breaking imports
}
