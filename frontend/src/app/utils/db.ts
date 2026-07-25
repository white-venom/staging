import Dexie, { type Table } from "dexie";
import { DenominationCounts } from "./store";

export interface OfflineCollection {
  id?: number;
  retailer_id: string;
  store_id?: string;
  bank_account_id?: string;
  retailerName: string;
  bankAccountName: string;
  portalName?: string;
  totalAmount: number;
  denominations: DenominationCounts;
  remarks?: string;
  date: string;
  synced: number; // 0 = unsynced, 1 = synced
  // Set when the server rejected this entry for a reason a retry can't fix
  // (validation error, deleted retailer, etc.) -- distinguishes "still
  // waiting for a network connection" from "stuck and needs the user's
  // attention" instead of retrying forever with no visible reason.
  syncError?: string;
}

export interface OfflineDeposit {
  id?: number;
  bank_account_id?: string;
  retailer_id?: string;
  recipient_staff_id?: string;
  depositType: "portal" | "retailer" | "staff" | "staff_person" | "virtual";
  targetName: string;
  amount: number;
  paymentMode: "cash" | "online";
  denominations?: DenominationCounts;
  remarks?: string;
  bankAccountName?: string;
  bankName?: string;
  date: string;
  synced: number; // 0 = unsynced, 1 = synced
  // See OfflineCollection.syncError.
  syncError?: string;
}

export interface CachedRetailer {
  id: string;
  name: string;
  phone: string;
  bankAccountName: string;
  opening_to_give?: number;
  opening_to_take?: number;
  net_balance?: number;
}

class OfflineDatabase extends Dexie {
  collections!: Table<OfflineCollection>;
  deposits!: Table<OfflineDeposit>;
  retailers!: Table<CachedRetailer>;

  constructor() {
    super("CrediiFlowOfflineDB");
    this.version(1).stores({
      collections: "++id, synced, date",
      deposits: "++id, synced, date",
      retailers: "id, name, bankAccountName"
    });
  }
}

export const db = new OfflineDatabase();

// No longer seeding mock retailers as we now have a backend with real UUIDs.
export async function seedOfflineRetailers() {
  // Empty implementation to avoid breaking imports
}
