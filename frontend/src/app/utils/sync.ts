import { db } from "./db";
import { useAppStore } from "./store";
import { api } from "./api";

// Network listener initializer to monitor offline/online connection states
export function initializeSyncEngine(
  onStatusChange?: (isOnline: boolean) => void,
  onSyncComplete?: (message: string) => void
) {
  if (typeof window === "undefined") return () => {};

  const handleOnline = async () => {
    if (onStatusChange) onStatusChange(true);
    
    // Attempt automatic background synchronization!
    try {
      const syncedCount = await syncOfflineData();
      if (syncedCount > 0 && onSyncComplete) {
        onSyncComplete(`Successfully synced ${syncedCount} offline submissions to the central server!`);
      }
    } catch (e) {
      console.error("Auto background sync failed: ", e);
    }
  };

  const handleOffline = () => {
    if (onStatusChange) onStatusChange(false);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Return unsubscribe cleanup handler
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

// Function to process outstanding offline queues
export async function syncOfflineData(): Promise<number> {
  const unsyncedCollections = await db.collections.where("synced").equals(0).toArray();
  const unsyncedDeposits = await db.deposits.where("synced").equals(0).toArray();

  if (unsyncedCollections.length === 0 && unsyncedDeposits.length === 0) {
    return 0;
  }

  let totalSynced = 0;

  // Iterate and upload collections
  for (const col of unsyncedCollections) {
    try {
      // Real API call
      await api.createCollection({
        retailer_id: col.retailer_id,
        store_id: col.store_id,
        portal_id: col.portal_id,
        total_amount: col.totalAmount,
        denominations: col.denominations,
        remarks: col.remarks
      });

      if (col.id) {
        await db.collections.update(col.id, { synced: 1 });
        totalSynced++;
        
        // Update client store so state updates in real-time
        const store = useAppStore.getState();
        const alreadyInStore = store.collections.some(c => c.retailerName === col.retailerName && c.totalAmount === col.totalAmount && c.date === col.date);
        if (!alreadyInStore) {
          store.addCollection({
            retailer_id: col.retailer_id,
            store_id: col.store_id,
            retailerName: col.retailerName,
            portalName: col.portalName,
            portalGroupName: col.portalGroupName,
            totalAmount: col.totalAmount,
            denominations: col.denominations,
            remarks: col.remarks
          });
        }
      }
    } catch (err) {
      console.error("Sync failed for collection:", col, err);
    }
  }

  // Iterate and upload deposits
  for (const dep of unsyncedDeposits) {
    try {
      await api.createDeposit({
        deposit_type: dep.depositType,
        portal_id: dep.portal_id,
        retailer_id: dep.retailer_id,
        recipient_staff_id: dep.recipient_staff_id,
        amount: dep.amount,
        payment_mode: dep.paymentMode,
        denominations: dep.denominations
      });

      if (dep.id) {
        await db.deposits.update(dep.id, { synced: 1 });
        totalSynced++;
        
        const store = useAppStore.getState();
        store.addDeposit({
          portal_id: dep.portal_id,
          retailer_id: dep.retailer_id,
          recipient_staff_id: dep.recipient_staff_id,
          depositType: dep.depositType,
          targetName: dep.targetName,
          amount: dep.amount,
          paymentMode: dep.paymentMode,
          denominations: dep.denominations
        });
      }
    } catch (err) {
      console.error("Sync failed for deposit:", dep, err);
    }
  }

  return totalSynced;
}
